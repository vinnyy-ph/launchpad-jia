import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import backendAuthCheck from "@/lib/firebase/backendAuthCheck";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { toIdString } from "@/lib/utils/dataTransform";
import { decrypt, encrypt } from "@/lib/utils/cryptography";
import {
  isRelevantEmailCandidate,
  OutlookMessage,
} from "@/lib/utils/outlookEmailCandidate";
import { refreshMicrosoftToken } from "@/lib/data/microsoftAuth";

/**
 * GET /api/outlook/email
 * Sync Outlook mailbox:
 * 1. For each Outlook thread we have in DB (with outlookConversationId), fetch the full conversation from Graph and persist only new messages (no resave).
 * 2. Optionally fetch messages since last sync from inbox/sent for new conversations; persist only new messages.
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!authToken) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const decodedToken = await backendAuthCheck(authToken);
    if (!decodedToken) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");

    if (!orgID) {
      return new NextResponse("Missing orgID", { status: 400 });
    }

    const { db } = await connectMongoDB();

    // First, find the member to get their MongoDB _id
    const member = await db.collection("members").findOne({
      orgID: toIdString(orgID),
      email: decodedToken.email,
    });

    if (!member) {
      return new NextResponse("User not found in organization", { status: 403 });
    }

    // Get email settings for Outlook account using member's MongoDB _id
    const emailSettings = await db.collection("email-settings").findOne({
      orgID: toIdString(orgID),
      userID: toIdString(member._id),
      outlookConnected: true,
    });

    if (!emailSettings || !emailSettings.outlookTokens) {
      return new NextResponse("Outlook not connected", { status: 404 });
    }

    // Decrypt access token
    let accessToken: string;
    try {
      const decryptedTokens = decrypt(emailSettings.outlookTokens);
      if (!decryptedTokens) {
        throw new Error("Failed to decrypt tokens");
      }
      const parsedTokens = JSON.parse(decryptedTokens);
      
      // Check if token is expired and refresh if needed
      if (parsedTokens.expires_at && Date.now() > parsedTokens.expires_at) {
        const refreshed = await refreshMicrosoftToken(parsedTokens.refresh_token);
        parsedTokens.access_token = refreshed.access_token;
        parsedTokens.expires_at = Date.now() + (refreshed.expires_in * 1000);
        
        // Update token in database
        const encryptedTokens = encrypt(JSON.stringify(parsedTokens));
        await db.collection("email-settings").updateOne(
          { orgID: toIdString(orgID), userID: toIdString(member._id) },
          { $set: { outlookTokens: encryptedTokens } }
        );
      }
      
      accessToken = parsedTokens.access_token;
    } catch (err) {
      console.error("Failed to decrypt/refresh Outlook token:", err);
      return NextResponse.json(
        { error: "Failed to retrieve credentials", outlookTokenExpired: true },
        { status: 500 }
      );
    }

    const selectParams = "id,conversationId,subject,from,toRecipients,ccRecipients,bccRecipients,body,bodyPreview,hasAttachments,receivedDateTime,internetMessageId,internetMessageHeaders";

    // Format "display name <email@domain.com>" for from/to/cc/bcc
    const formatRecipient = (name: string | null | undefined, address: string | null | undefined): string => {
      if (!address) return "";
      if (!name || String(name).trim() === "") return address;
      return `${String(name).trim()} <${address}>`;
    };

    const threadsCollection = db.collection("mailgun-threads");
    const messagesCollection = db.collection("mailgun-messages");
    const orgIdStr = toIdString(orgID);
    const orgObjectId = ObjectId.isValid(orgIdStr) ? new ObjectId(orgIdStr) : null;

    // Build known threads and message IDs from DB (so we never resave; only add new messages)
    const knownThreads = new Map();
    const knownMessageIds = new Set<string>();
    const appSentFromAddresses = new Set<string>();

    const threads = await threadsCollection
      .find({
        organizationId: toIdString(orgID),
        mode: "outlook"
      })
      .toArray();

    threads.forEach((thread: any) => {
      if (thread.outlookConversationId) {
        knownThreads.set(thread.outlookConversationId, {
          _id: thread._id,
          appThreadId: thread._id.toString(),
          mode: thread.mode ?? thread.provider,
          outlookConversationId: thread.outlookConversationId,
        });
      }
    });

    const existingMessages = await messagesCollection
      .find({
        $or: [
          { organizationId: orgObjectId },
          { organizationId: orgIdStr },
        ],
      })
      .toArray();

    existingMessages.forEach((msg: any) => {
      const mid = msg.modeMessageId;
      if (mid) knownMessageIds.add(mid);
      if (msg.internetMessageId) knownMessageIds.add(msg.internetMessageId);
      if (msg.outlookMessageId) knownMessageIds.add(msg.outlookMessageId);
    });

    const outlookUsers = await db.collection("email-settings")
      .find({
        orgID: toIdString(orgID),
        outlookConnected: true,
        outlookEmail: { $exists: true },
      })
      .toArray();

    outlookUsers.forEach((user: any) => {
      if (user.outlookEmail) appSentFromAddresses.add(user.outlookEmail);
    });

    const persistedMessages: any[] = [];
    let syncedCount = 0;

    // Resolve html/text from Graph message body (body.contentType + body.content); fallback bodyPreview
    const getBodyFromMessage = (m: any): { html: string | null; text: string | null } => {
      const body = m.body;
      const preview = m.bodyPreview || null;
      if (body?.content != null) {
        const ct = (body.contentType || "").toLowerCase();
        if (ct === "html") return { html: body.content, text: null };
        if (ct === "text") return { html: null, text: body.content };
        return { html: body.content, text: null };
      }
      return { html: preview, text: null };
    };

    // Fetch attachment metadata for a message (Graph: GET /me/messages/{id}/attachments)
    const fetchAttachmentMetadata = async (messageId: string): Promise<any[]> => {
      try {
        const res = await fetch(
          `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments?$select=id,name,contentType,size,isInline`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) return [];
        const json = await res.json();
        const list = json.value || [];
        return list.map((a: any) => ({
          attachmentId: a.id,
          filename: a.name || "Unknown",
          fileSize: a.size ?? 0,
          fileType: a.contentType || "application/octet-stream",
          isInline: a.isInline || false,
        }));
      } catch {
        return [];
      }
    };

    // Helper: persist a single Graph message to DB if not already saved (returns true if inserted).
    const persistMessageIfNew = async (
      outlookMessage: any,
      resolvedThreadId: ObjectId | null,
      fromAddr: string,
      threadDoc?: { careerId?: string | null } | Record<string, unknown> | null
    ): Promise<boolean> => {
      if (knownMessageIds.has(outlookMessage.id)) return false;
      const fromName = outlookMessage.from?.emailAddress?.name;
      const fromFormatted = formatRecipient(fromName, fromAddr);
      const toAddresses = (outlookMessage.toRecipients || []).map((r: any) =>
        formatRecipient(r?.emailAddress?.name, r?.emailAddress?.address)
      ).filter(Boolean);
      const ccAddresses = (outlookMessage.ccRecipients || []).map((r: any) =>
        formatRecipient(r?.emailAddress?.name, r?.emailAddress?.address)
      ).filter(Boolean);
      const bccAddresses = (outlookMessage.bccRecipients || []).map((r: any) =>
        formatRecipient(r?.emailAddress?.name, r?.emailAddress?.address)
      ).filter(Boolean);
      const direction = fromAddr === emailSettings.outlookEmail ? "outbound" : "inbound";
      const receivedAt = new Date(outlookMessage.receivedDateTime);
      const now = new Date();
      const { html: bodyHtml, text: bodyText } = getBodyFromMessage(outlookMessage);
      const attachments = outlookMessage.hasAttachments
        ? await fetchAttachmentMetadata(outlookMessage.id)
        : [];
      const messageDoc = {
        modeConversationId: outlookMessage.conversationId,
        threadId: resolvedThreadId,
        from: fromFormatted,
        to: toAddresses,
        cc: ccAddresses,
        bcc: bccAddresses,
        html: bodyHtml,
        text: bodyText,
        attachments,
        direction,
        mode: "outlook",
        modeMessageId: outlookMessage.id,
        internetMessageId: outlookMessage.internetMessageId,
        recruiterId: member._id,
        organizationId: orgObjectId ?? orgIdStr,
        receivedAt,
        sentAt: receivedAt,
        createdAt: now,
        updatedAt: now,
        userId: toIdString(member._id),
      };
      const result = await messagesCollection.insertOne(messageDoc);
      knownMessageIds.add(outlookMessage.id);
      persistedMessages.push({ _id: result.insertedId, ...messageDoc });
      return true;
    };

    // 1) For each Outlook thread we have in DB (with outlookConversationId), fetch the full conversation from Graph; save only new messages
    for (const thread of threads) {
      const convId = (thread as any).outlookConversationId;
      if (!convId) continue;
      const threadIdObj = thread._id instanceof ObjectId ? thread._id : new ObjectId(String(thread._id));
      const convIdEscaped = String(convId).replace(/'/g, "''");
      const convFilter = `conversationId eq '${convIdEscaped}'`;
      try {
        const [inboxRes, sentRes] = await Promise.all([
          fetch(
            `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(convFilter)}&$top=100&$orderby=receivedDateTime asc&$select=${encodeURIComponent(selectParams)}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          ),
          fetch(
            `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$filter=${encodeURIComponent(convFilter)}&$top=100&$orderby=receivedDateTime asc&$select=${encodeURIComponent(selectParams)}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          ),
        ]);
        const inboxJson = inboxRes.ok ? await inboxRes.json() : { value: [] };
        const sentJson = sentRes.ok ? await sentRes.json() : { value: [] };
        const byId = new Map<string, any>();
        [...(inboxJson.value || []), ...(sentJson.value || [])].forEach((m: any) => byId.set(m.id, m));
        const conversationMessages = Array.from(byId.values()).sort(
          (a, b) => new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime()
        );
        for (const m of conversationMessages) {
          const fromEmail = m.from?.emailAddress?.address || "";
          const inserted = await persistMessageIfNew(m, threadIdObj, fromEmail, thread);
          if (inserted) syncedCount++;
        }
      } catch (err) {
        console.warn("Outlook sync: fetch by conversation failed for thread", thread._id, err);
      }
    }

    // 2) Fetch messages since last sync from inbox + sent (for new conversations or threads without conversationId); save only new messages
    const lastSyncedAt = emailSettings.outlookDateSync
      ? new Date(emailSettings.outlookDateSync)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const filterFrom = new Date(lastSyncedAt.getTime() - 60 * 1000);
    const filterQuery = `receivedDateTime ge ${filterFrom.toISOString()}`;

    const inboxResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(filterQuery)}&$top=50&$orderby=receivedDateTime desc&$select=${encodeURIComponent(selectParams)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!inboxResponse.ok) {
      const error = await inboxResponse.text();
      console.error("Microsoft Graph messages fetch failed:", error);
    }

    const { value: inboxMessages = [] } = inboxResponse.ok ? await inboxResponse.json() : { value: [] };
    const sentResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$filter=${encodeURIComponent(filterQuery)}&$top=50&$orderby=receivedDateTime desc&$select=${encodeURIComponent(selectParams)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const sentMessages = sentResponse.ok ? (await sentResponse.json()).value || [] : [];
    const outlookMessages = [...inboxMessages, ...sentMessages];

    for (const outlookMessage of outlookMessages) {
      // Skip if already persisted
      if (knownMessageIds.has(outlookMessage.id)) {
        continue;
      }

      // Attach In-Reply-To and References from headers so relevance check can match
      let inReplyToVal = outlookMessage.inReplyTo ?? null;
      let referencesVal = outlookMessage.references ?? null;
      const headersArr = outlookMessage.internetMessageHeaders;
      if (Array.isArray(headersArr)) {
        for (const h of headersArr) {
          const name = (h.name || "").toLowerCase();
          const val = h.value;
          if (name === "in-reply-to" && val && !inReplyToVal) inReplyToVal = String(val).trim();
          if (name === "references" && val && !referencesVal) referencesVal = String(val).trim();
        }
      }
      outlookMessage.inReplyTo = inReplyToVal ?? outlookMessage.inReplyTo;
      outlookMessage.references = referencesVal ?? outlookMessage.references;

      // Check relevance
      const isRelevant = isRelevantEmailCandidate(
        outlookMessage,
        knownThreads,
        knownMessageIds,
        appSentFromAddresses
      );

      if (!isRelevant) {
        continue;
      }

      // Use In-Reply-To and References (already set from headers above)
      const inReplyTo = outlookMessage.inReplyTo ?? null;
      const references = outlookMessage.references ?? null;

      // Determine thread: by conversationId first, then by inReplyTo/references, then by "we sent to this sender" (reply-from)
      let resolvedThreadId: ObjectId | null = null;
      if (outlookMessage.conversationId && knownThreads.has(outlookMessage.conversationId)) {
        const known = knownThreads.get(outlookMessage.conversationId);
        resolvedThreadId = known._id instanceof ObjectId ? known._id : new ObjectId(String(known._id));
      }
      // If we have conversationId but no thread yet, try to match to a thread we created on send (no outlookConversationId) by outbound message
      if (!resolvedThreadId && outlookMessage.conversationId) {
        const normSubject = (s: string) => (s || "").replace(/^([\s]*(?:re|fw|fwd)[\s]*[:\-\s]*)+/i, "").trim();
        const msgSubjectNorm = normSubject(outlookMessage.subject || "");
        const msgFrom = outlookMessage.from?.emailAddress?.address || "";
        const isOutboundFromUs = msgFrom && emailSettings.outlookEmail && String(msgFrom).toLowerCase() === String(emailSettings.outlookEmail).toLowerCase();
        const toAddresses = (outlookMessage.toRecipients || []).map((r: any) => r?.emailAddress?.address).filter(Boolean);
        const threadsWithoutConvId = await threadsCollection
          .find({
            $and: [
              { organizationId: toIdString(orgID) },
              { mode: "outlook" },
              { $or: [{ outlookConversationId: { $exists: false } }, { outlookConversationId: null }, { outlookConversationId: "" }] },
            ],
          })
          .toArray();
        for (const t of threadsWithoutConvId) {
          const threadIdObj = t._id instanceof ObjectId ? t._id : new ObjectId(String(t._id));
          const outboundInThread = await messagesCollection.findOne({
            threadId: threadIdObj,
            orgID: toIdString(orgID),
            mode: "outlook",
            direction: "outbound",
          } as any);
          if (!outboundInThread) continue;
          const threadSubjectNorm = normSubject((t as any).subject || "");
          const subjectMatch = !msgSubjectNorm || threadSubjectNorm === msgSubjectNorm;
          const toList = (Array.isArray(outboundInThread.to) ? outboundInThread.to : outboundInThread.to ? [outboundInThread.to] : []).map((e: string) => String(e).toLowerCase());
          const toSet = new Set(toList);
          const graphToSet = new Set(toAddresses.map((e: string) => String(e).toLowerCase()));
          const toMatch = toSet.size === graphToSet.size && toList.every((e: string) => graphToSet.has(e));
          if (subjectMatch && (isOutboundFromUs ? toMatch : true)) {
            await threadsCollection.updateOne(
              { _id: threadIdObj },
              { $set: { outlookConversationId: outlookMessage.conversationId, updatedAt: new Date() } }
            );
            knownThreads.set(outlookMessage.conversationId, {
              _id: threadIdObj,
              appThreadId: threadIdObj.toString(),
              mode: "outlook",
              outlookConversationId: outlookMessage.conversationId,
            });
            resolvedThreadId = threadIdObj;
            break;
          }
        }
      }
      if (!resolvedThreadId && (inReplyTo || references)) {
        const idsToCheck: string[] = [];
        if (inReplyTo) {
          const cleaned = String(inReplyTo).replace(/^<|>$/g, "").trim();
          if (cleaned) idsToCheck.push(cleaned);
        }
        if (references) {
          const refs = String(references).split(/\s+/).map((r: string) => r.replace(/^<|>$/g, "").trim()).filter(Boolean);
          idsToCheck.push(...refs);
        }
        for (const refId of idsToCheck) {
          const refMsg = await messagesCollection.findOne({
            $and: [
              {
                $or: [
                  { organizationId: orgObjectId },
                  { organizationId: orgIdStr },
                ],
              },
              {
                $or: [
                  { internetMessageId: refId },
                  { modeMessageId: refId },
                  { outlookMessageId: refId },
                ],
              },
            ],
          });
          if (refMsg && refMsg.threadId) {
            resolvedThreadId = refMsg.threadId instanceof ObjectId ? refMsg.threadId : new ObjectId(String(refMsg.threadId));
            const existingThread = await threadsCollection.findOne({ _id: resolvedThreadId });
            if (outlookMessage.conversationId && (!existingThread?.outlookConversationId || existingThread.outlookConversationId === outlookMessage.conversationId)) {
              await threadsCollection.updateOne(
                { _id: resolvedThreadId },
                { $set: { outlookConversationId: outlookMessage.conversationId, updatedAt: new Date() } }
              );
            }
            break;
          }
        }
      }
      // Fallback: inbound reply (from applicant) – find the right thread (prefer by conversationId, then by subject) so same subject/recipient threads don't mix
      const replyFrom = outlookMessage.from?.emailAddress?.address;
      const isInbound = replyFrom && emailSettings.outlookEmail && String(replyFrom).toLowerCase() !== String(emailSettings.outlookEmail).toLowerCase();
      if (!resolvedThreadId && isInbound && replyFrom) {
        const normSubject = (s: string) => (s || "").replace(/^([\s]*(?:re|fw|fwd)[\s]*[:\-\s]*)+/i, "").trim();
        const replySubjectNorm = normSubject(outlookMessage.subject || "");
        const replyConvId = outlookMessage.conversationId || null;
        const outboundsToSender = await messagesCollection
          .find({
            $and: [
              {
                $or: [
                  { organizationId: orgObjectId },
                  { organizationId: orgIdStr },
                ],
              },
              {mode: "outlook" },
              { direction: "outbound" },
              { $or: [{ to: replyFrom }, { to: { $in: [replyFrom] } }] },
            ],
          })
          .sort({ createdAt: -1 })
          .limit(20)
          .toArray();
        const threadIdsSeen = new Set<string>();
        let bestThread: { _id: ObjectId; outlookConversationId?: string; subject?: string } | null = null;
        for (const msg of outboundsToSender) {
          if (!msg.threadId) continue;
          const tid = msg.threadId instanceof ObjectId ? msg.threadId.toString() : String(msg.threadId);
          if (threadIdsSeen.has(tid)) continue;
          threadIdsSeen.add(tid);
          const t = await threadsCollection.findOne({
            _id: msg.threadId,
            mode: "outlook"
          } as any);
          if (!t) continue;
          const threadConvId = (t as any).outlookConversationId || null;
          const subjectMatch = !replySubjectNorm || normSubject((t as any).subject || "") === replySubjectNorm;
          if (replyConvId && threadConvId === replyConvId) {
            bestThread = t as any;
            break;
          }
          if (!bestThread && subjectMatch && !threadConvId) bestThread = t as any;
          else if (!bestThread && subjectMatch) bestThread = t as any;
        }
        if (bestThread) {
          resolvedThreadId = bestThread._id instanceof ObjectId ? bestThread._id : new ObjectId(String(bestThread._id));
          if (outlookMessage.conversationId && (!bestThread.outlookConversationId || bestThread.outlookConversationId === outlookMessage.conversationId)) {
            await threadsCollection.updateOne(
              { _id: resolvedThreadId },
              { $set: { outlookConversationId: outlookMessage.conversationId, updatedAt: new Date() } }
            );
          }
        }
      }

      // Never insert with threadId null – that creates a synthetic duplicate thread in useEmailThreads (msg.threadId || msg._id)
      if (!resolvedThreadId) {
        continue;
      }

      const direction = outlookMessage.from?.emailAddress?.address === emailSettings.outlookEmail ? "outbound" : "inbound";
      // If this is our outbound from Graph, we may already have it from the send route (modeMessageId outlook_xxx); update that message with Graph ids instead of inserting a duplicate
      if (direction === "outbound") {
        const existingOutbound = await messagesCollection.findOne({
          threadId: resolvedThreadId,
          $and: [
            {
              $or: [
                { organizationId: orgObjectId },
                { organizationId: orgIdStr },
              ],
            },
            { mode: "outlook" },
            { direction: "outbound" },
            {
              $or: [
                { outlookMessageId: outlookMessage.id },
                { modeMessageId: { $regex: /^outlook_/ }, outlookMessageId: null },
                { modeMessageId: { $regex: /^outlook_/ }, outlookMessageId: { $exists: false } },
              ],
            },
          ],
        } as any);
        if (existingOutbound) {
          const msgUpdate: Record<string, unknown> = { updatedAt: new Date() };
          if (outlookMessage.id) msgUpdate.outlookMessageId = outlookMessage.id;
          if (outlookMessage.internetMessageId != null) msgUpdate.internetMessageId = outlookMessage.internetMessageId;
          await messagesCollection.updateOne(
            { _id: existingOutbound._id },
            { $set: msgUpdate }
          );
          knownMessageIds.add(outlookMessage.id);
          syncedCount++;
          continue;
        }
      }

      // Build recipient lists in "display name <email>" format
      const fromAddr = outlookMessage.from?.emailAddress?.address || "";
      const fromName = outlookMessage.from?.emailAddress?.name;
      const fromFormatted = formatRecipient(fromName, fromAddr);
      const toAddresses = (outlookMessage.toRecipients || []).map((r: any) =>
        formatRecipient(r?.emailAddress?.name, r?.emailAddress?.address)
      ).filter(Boolean);
      const ccAddresses = (outlookMessage.ccRecipients || []).map((r: any) =>
        formatRecipient(r?.emailAddress?.name, r?.emailAddress?.address)
      ).filter(Boolean);
      const bccAddresses = (outlookMessage.bccRecipients || []).map((r: any) =>
        formatRecipient(r?.emailAddress?.name, r?.emailAddress?.address)
      ).filter(Boolean);

      // Resolve html/text from body; fetch attachment metadata when hasAttachments
      const { html: bodyHtml, text: bodyText } = getBodyFromMessage(outlookMessage);
      const attachments = outlookMessage.hasAttachments
        ? await fetchAttachmentMetadata(outlookMessage.id)
        : [];

      // Persist message (mailgun-messages collection format, Outlook-applicable fields only)
      const receivedAt = new Date(outlookMessage.receivedDateTime);
      const now = new Date();
      let careerId: string | null = null;
      const t = await threadsCollection.findOne({ _id: resolvedThreadId }, { projection: { careerId: 1 } });
      if (t?.careerId) careerId = String(t.careerId);
      const messageDoc = {
        mode: "outlook",
        modeMessageId: outlookMessage.id,
        internetMessageId: outlookMessage.internetMessageId,
        modeConversationId: outlookMessage.conversationId,
        threadId: resolvedThreadId,
        from: fromFormatted,
        to: toAddresses,
        cc: ccAddresses,
        bcc: bccAddresses,
        html: bodyHtml,
        text: bodyText,
        attachments,
        // careerId,
        direction,
        recruiterId: member._id,
        // applicantId: null,
        organizationId: orgObjectId ?? orgIdStr,
        receivedAt,
        sentAt: receivedAt,
        createdAt: now,
        updatedAt: now,
        orgID: toIdString(orgID),
        userId: toIdString(member._id),
      };

      const result = await messagesCollection.insertOne(messageDoc);
      knownMessageIds.add(outlookMessage.id);

      persistedMessages.push({
        _id: result.insertedId,
        ...messageDoc,
      });

      syncedCount++;
    }

    // Update last synced timestamp
    await db.collection("email-settings").updateOne(
      {
        orgID: toIdString(orgID),
        userID: toIdString(member._id),
      },
      {
        $set: {
          outlookDateSync: new Date().toISOString(),
        },
      }
    );

    return NextResponse.json(
      {
        success: true,
        syncedCount,
        messages: persistedMessages,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Outlook email sync error:", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
