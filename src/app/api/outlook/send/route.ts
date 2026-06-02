import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import backendAuthCheck from "@/lib/firebase/backendAuthCheck";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { toIdString } from "@/lib/utils/dataTransform";
import { decrypt, encrypt } from "@/lib/utils/cryptography";
import { refreshMicrosoftToken } from "@/lib/data/microsoftAuth";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { logActivity } from "@/lib/utils/activityLogger";
import { recordActivityHistory } from "@/lib/utils/activityHistoryHelpers";

/**
 * POST /api/outlook/send
 * Send email via Outlook using Microsoft Graph
 * Attach internal thread metadata and persist thread + message
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!authToken) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const decodedToken = await backendAuthCheck(authToken);
    if (!decodedToken) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { db } = await connectMongoDB();
    const body = await request.json();
    const {
      orgID,
      to,
      cc,
      bcc,
      subject,
      body: messageBody,
      threadId,
      careerId: bodyCareerId,
      attachments: bodyAttachments,
    } = body;

    if (!orgID || !to || !subject || !messageBody) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Helper functions for token processing (mirrored from Mailgun route)
    const extractTokens = (content: string): string[] => {
      if (!content) return [];
      const tokens: string[] = [];
      const plainTokenRegex = /\[\[([^\]]+)\]\]/g;
      let match;
      while ((match = plainTokenRegex.exec(content)) !== null) {
        if (!tokens.includes(match[1])) tokens.push(match[1]);
      }
      const htmlTokenRegex =
        /<span[^>]*data-token="(?:\[\[)?([^\]"]+)(?:\]\])?"[^>]*>([^<]*)<\/span>/g;
      while ((match = htmlTokenRegex.exec(content)) !== null) {
        if (!tokens.includes(match[1])) tokens.push(match[1]);
      }
      return tokens;
    };

    const replaceTokens = (
      content: string,
      tokenValues: Record<string, string>,
    ): string => {
      if (!content) return content;
      let result = content;
      const normalizeTokenName = (tokenName: string): string => {
        const prefixMatch = tokenName.match(/^[A-Za-z]+-(.+)$/);
        return prefixMatch ? prefixMatch[1] : tokenName;
      };

      // Replace HTML span token format
      result = result.replace(
        /<span[^>]*data-token="(?:\[\[)?([^\]"]+)(?:\]\])?"[^>]*>([^<]*)<\/span>/g,
        (match, tokenName, displayText) => {
          const cleanTokenName = tokenName.replace(/[\[\]]/g, "");
          const normalizedName = normalizeTokenName(cleanTokenName);
          return tokenValues[normalizedName] ?? displayText;
        },
      );

      // Replace [[Token Name]] plain text format
      for (const [tokenName, tokenValue] of Object.entries(tokenValues)) {
        const regex = new RegExp(
          `\\[\\[${tokenName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\]`,
          "g",
        );
        result = result.replace(regex, tokenValue);
      }
      return result;
    };

    const decodeHtmlEntities = (text: string): string => {
      if (!text) return text;
      return text
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'");
    };

    // Extract tokens
    const tokensInSubject = extractTokens(subject);
    const tokensInBody = extractTokens(messageBody);
    const allTokens = Array.from(
      new Set([...tokensInSubject, ...tokensInBody]),
    );

    let processedSubject = subject;
    let processedBody = messageBody;

    if (allTokens.length > 0) {
      try {
        console.log("[outlook-send] Tokens found:", allTokens);

        // Determine applicantEmail from 'to'
        const toRawList = Array.isArray(to) ? to : [to];
        // Parse the first email address from the list
        const parseEmail = (val: string) => {
          const match = String(val).match(
            /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
          );
          return match ? match[0] : null;
        };
        const applicantEmail = parseEmail(toRawList[0]);

        // Call resolve-email-tokens API
        const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/mailgun-module/resolve-email-tokens`;
        const tokenResponse = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            careerId: bodyCareerId || null,
            orgId: orgID,
            applicantEmail: applicantEmail,
            threadId: threadId || null,
            tokensUsed: allTokens,
          }),
        });

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          if (tokenData.success && tokenData.tokens) {
            console.log(
              "[outlook-send] Token values fetched:",
              tokenData.tokens,
            );

            processedSubject = replaceTokens(subject, tokenData.tokens);
            processedSubject = decodeHtmlEntities(processedSubject);
            processedBody = replaceTokens(messageBody, tokenData.tokens);

            // Validation: Ensure critical tokens are replaced
            const normalizeForCheck = (name: string): string => {
              if (!name) return name;
              const cleaned = String(name).replace(/^[\[]\[|\]\]$/g, "");
              const m = cleaned.match(/^[A-Za-z]+-(.+)$/);
              return m ? m[1] : cleaned;
            };

            const missingByMap = allTokens
              .map((t) => normalizeForCheck(t))
              .filter((t) => {
                const val = tokenData.tokens[t];
                return val === undefined || String(val).trim() === "";
              });

            if (missingByMap.length > 0) {
              const hasJobToken = missingByMap.some(
                (t) =>
                  t.toLowerCase().includes("job") ||
                  t.toLowerCase().includes("career"),
              );
              const hasOrgToken = missingByMap.some(
                (t) =>
                  t.toLowerCase().includes("organization") ||
                  t.toLowerCase().includes("employer"),
              );
              const hasCandidateToken = missingByMap.some((t) =>
                t.toLowerCase().includes("candidate"),
              );

              const missingData: string[] = [];
              if (hasJobToken) missingData.push("Job/Career information");
              if (hasOrgToken) missingData.push("Organization information");
              if (hasCandidateToken) missingData.push("Candidate information");

              return NextResponse.json(
                {
                  error:
                    "Cannot send email: Some template tokens could not be replaced with actual data",
                  unreplacedTokens: Array.from(new Set(missingByMap)),
                  missingData:
                    missingData.length > 0
                      ? missingData
                      : ["Required data not found"],
                  details:
                    "Please ensure all required data exists before sending this email.",
                },
                { status: 400 },
              );
            }
          }
        } else {
          const errorData = await tokenResponse.json();
          console.error("[outlook-send] Failed to resolve tokens:", errorData);
          return NextResponse.json(
            {
              error: "Failed to resolve email tokens",
              details: errorData.error || "Token resolution service error",
            },
            { status: 400 },
          );
        }
      } catch (tokenError) {
        console.error(
          "[outlook-send] Error during token replacement:",
          tokenError,
        );
        return NextResponse.json(
          {
            error: "Error during token replacement",
            details:
              tokenError instanceof Error
                ? tokenError.message
                : String(tokenError),
          },
          { status: 500 },
        );
      }
    }

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
        console.error("Decryption returned null/undefined");
        throw new Error("Failed to decrypt tokens");
      }
      
      console.log("Decrypted tokens length:", decryptedTokens.length);
      const parsedTokens = JSON.parse(decryptedTokens);
      
      if (!parsedTokens.access_token) {
        console.error("No access_token in parsed tokens:", Object.keys(parsedTokens));
        throw new Error("No access token found in stored credentials");
      }
      
      console.log("Access token starts with:", parsedTokens.access_token?.substring(0, 20));
      console.log("Access token length:", parsedTokens.access_token?.length);
      console.log("Token expires_at:", parsedTokens.expires_at, "Current time:", Date.now());
      
      // Check if token is expired or missing expires_at (old token) - refresh if needed
      if (!parsedTokens.expires_at || Date.now() > parsedTokens.expires_at) {
        console.log("Token expired or missing expires_at, refreshing...");
        
        if (!parsedTokens.refresh_token) {
          throw new Error("No refresh token available");
        }
        
        try {
          const refreshed = await refreshMicrosoftToken(parsedTokens.refresh_token);
          console.log("Refreshed token starts with:", refreshed.access_token?.substring(0, 20));
          console.log("Refreshed token length:", refreshed.access_token?.length);
          
          parsedTokens.access_token = refreshed.access_token;
          parsedTokens.expires_at = Date.now() + (refreshed.expires_in * 1000);
          
          // Update token in database
          const encryptedTokens = encrypt(JSON.stringify(parsedTokens));
          await db.collection("email-settings").updateOne(
            { orgID: toIdString(orgID), userID: toIdString(member._id) },
            { $set: { outlookTokens: encryptedTokens } }
          );
          
          console.log("Token refreshed and saved");
        } catch (refreshErr: any) {
          // If refresh fails with invalid_grant, user needs to reconnect
          if (refreshErr.message?.includes("invalid_grant") || refreshErr.message?.includes("AADSTS")) {
            return NextResponse.json(
              { 
                error: "Outlook authentication expired. Please reconnect your Outlook account in Settings.",
                code: "OUTLOOK_AUTH_EXPIRED"
              },
              { status: 401 }
            );
          }
          throw refreshErr;
        }
      }
      
      accessToken = parsedTokens.access_token;
      
      if (!accessToken || typeof accessToken !== 'string') {
        throw new Error("Access token is invalid");
      }
    } catch (err) {
      console.error("Failed to decrypt/refresh Outlook token:", err);
      return new NextResponse("Failed to retrieve credentials", { status: 500 });
    }

    // Parse "Display Name <email@domain.com>" or plain "email@domain.com"
    const parseEmailParts = (
      value: string | null | undefined
    ): { email: string; displayName: string | null } => {
      if (!value) return { email: "", displayName: null };
      const trimmed = String(value).trim();
      const angleMatch = trimmed.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
      if (angleMatch) {
        const candidateName = angleMatch[1]?.trim();
        const candidateEmail = angleMatch[2]?.trim();
        return {
          email: candidateEmail || trimmed,
          displayName: candidateName || null,
        };
      }
      const quotedOnly = trimmed.match(/^"([^"]+)"$/);
      if (quotedOnly) {
        return { email: quotedOnly[1].trim(), displayName: null };
      }
      return { email: trimmed, displayName: null };
    };

    // Format as "display name <email@domain.com>" for storage/display 
    const formatDisplayAddress = (
      displayName: string | null | undefined,
      email: string
    ): string => {
      if (!email) return "";
      if (!displayName || displayName.trim() === "") return email;
      return `${displayName.trim()} <${email}>`;
    };

    const toRaw = Array.isArray(to) ? to : [to];
    const ccRaw = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
    const bccRaw = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];

    const toRecipients = toRaw.map((v: string) => {
      const { email: address, displayName } = parseEmailParts(v);
      return {
        emailAddress: {
          name: displayName || address,
          address,
        },
      };
    });

    const ccRecipients = ccRaw.map((v: string) => {
      const { email: address, displayName } = parseEmailParts(v);
      return {
        emailAddress: {
          name: displayName || address,
          address,
        },
      };
    });

    const bccRecipients = bccRaw.map((v: string) => {
      const { email: address, displayName } = parseEmailParts(v);
      return {
        emailAddress: {
          name: displayName || address,
          address,
        },
      };
    });

    // Process attachments: upload to R2 (like Mailgun) and build Graph fileAttachment list
    const uploadedAttachments: Array<{
      filename: string;
      url: string;
      mimeType?: string;
      size?: number;
    }> = [];
    const graphAttachments: Array<{
      "@odata.type": string;
      name: string;
      contentType: string;
      contentBytes: string;
    }> = [];

    const attachments = Array.isArray(bodyAttachments) ? bodyAttachments : [];
    if (
      attachments.length > 0 &&
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
    ) {
      const s3Client = new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      });

      for (const att of attachments) {
        try {
          const filename = att.filename || `attachment-${Date.now()}`;
          const mimeType = att.mimeType || "application/octet-stream";
          const data = att.data || "";
          const buffer = Buffer.from(data, "base64");

          const key = `mailgun-attachments/${Date.now()}-${filename}`;
          await s3Client.send(
            new PutObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: key,
              Body: buffer,
              ContentType: mimeType,
            })
          );

          const url = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${encodeURIComponent(key)}`;
          uploadedAttachments.push({ filename, url, mimeType, size: buffer.length });
          graphAttachments.push({
            "@odata.type": "#microsoft.graph.fileAttachment",
            name: filename,
            contentType: mimeType,
            contentBytes: data,
          });
        } catch (err) {
          console.error("Outlook send: attachment upload failed", err);
        }
      }
    }

    const messagePayload: Record<string, unknown> = {
      subject: processedSubject,
      body: {
        contentType: "HTML",
        content: processedBody,
      },
      toRecipients,
      ccRecipients,
      bccRecipients,
      internetMessageHeaders: [
        {
          name: "X-App-Thread-Id",
          value: threadId || "",
        },
      ],
    };
    if (graphAttachments.length > 0) {
      messagePayload.attachments = graphAttachments;
    }

    const mailPayload = {
      message: messagePayload,
      saveToSentItems: true,
    };

    // Send via Microsoft Graph
    const sendResponse = await fetch(
      "https://graph.microsoft.com/v1.0/me/sendMail",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mailPayload),
      }
    );

    if (!sendResponse.ok) {
      const error = await sendResponse.text();
      console.error("Microsoft Graph sendMail failed:", error);
      return new NextResponse("Failed to send email", { status: 500 });
    }

    // After successful send, persist thread and message in DB (same pattern as mg-send-email)
    const messagesCollection = db.collection("mailgun-messages");
    const threadsCollection = db.collection("mailgun-threads");

    // Normalize subject for thread matching (same as Mailgun)
    function normalizeSubject(s: string) {
      if (!s) return "";
      return s.replace(/^([\s]*(?:re|fw|fwd)[\s]*[:\-\s]*)+/i, "").trim();
    }

    const orgIdStr = toIdString(orgID);
    const orgObjectId = ObjectId.isValid(orgIdStr) ? new ObjectId(orgIdStr) : null;
    const normSubject = normalizeSubject(subject);

    // Resolve or create thread (mirror mg-send-email)
    let thread: { _id: ObjectId; threadId?: string } | null = null;

    if (threadId) {
      try {
        if (ObjectId.isValid(String(threadId))) {
          thread = await threadsCollection.findOne({
            _id: new ObjectId(String(threadId)),
          } as any);
        }
        if (!thread) {
          thread = await threadsCollection.findOne({
            threadId: String(threadId),
          } as any);
        }
      } catch (e) {
        console.warn("Outlook send: failed to resolve provided threadId", e);
      }
    }

    if (!thread) {
      const threadIdStr = new ObjectId().toHexString();
      const insertThread = {
        organizationId: orgObjectId || orgIdStr,
        subject: processedSubject,
        normalizedSubject: normSubject,
        threadId: threadIdStr,
        careerId: bodyCareerId ?? null,
        lastUpdated: new Date(),
        mode: "outlook",
        participants: [emailSettings._id],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const tRes = await threadsCollection.insertOne(insertThread as any);
      thread = await threadsCollection.findOne({ _id: tRes.insertedId }) as any;
    } else {
      const threadUpdateSet: Record<string, unknown> = {
        lastUpdated: new Date(),
        updatedAt: new Date(),
        mode: "outlook",
      };
      if (bodyCareerId != null && bodyCareerId !== "") {
        threadUpdateSet.careerId = bodyCareerId;
      }
      await threadsCollection.updateOne(
        { _id: thread._id },
        {
          $set: threadUpdateSet,
          $addToSet: { participants: emailSettings._id },
        }
      );
    }

    const fromEmail = emailSettings.outlookEmail || decodedToken.email;
    const fromDisplayName =
      (emailSettings as any).outlookUser?.name ?? null;
    const fromFormatted = formatDisplayAddress(fromDisplayName, fromEmail);

    const toListFormatted = toRaw.map((v: string) => {
      const { email: address, displayName } = parseEmailParts(v);
      return formatDisplayAddress(displayName, address);
    });
    const ccListFormatted = ccRaw.map((v: string) => {
      const { email: address, displayName } = parseEmailParts(v);
      return formatDisplayAddress(displayName, address);
    });
    const bccListFormatted = bccRaw.map((v: string) => {
      const { email: address, displayName } = parseEmailParts(v);
      return formatDisplayAddress(displayName, address);
    });

    const toList = toRaw.map((v: string) => parseEmailParts(v).email);
    const ccList = ccRaw.map((v: string) => parseEmailParts(v).email);
    const bccList = bccRaw.map((v: string) => parseEmailParts(v).email);
    const modeMessageId = `outlook_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Message document aligned with mailgun-messages collection format (Outlook-applicable fields only)
    const now = new Date();
    const messageDoc = {
      threadId: thread._id,
      mode: "outlook",
      modeMessageId,
      direction: "outbound",
      subject: processedSubject,
      from: fromFormatted,
      to: toListFormatted,
      cc: ccListFormatted,
      bcc: bccListFormatted,
      html: processedBody,
      text: null,
      // body: messageBody,
      attachments: uploadedAttachments,
      careerId: bodyCareerId ?? (thread as any).careerId ?? null,
      organizationId: orgObjectId || orgIdStr,
      recruiterId: member._id,
      // applicantId: null,
      receivedAt: null,
      sentAt: now,
      createdAt: now,
      updatedAt: now,
      campaignId: body.campaignId || null,
    };

    const insertedMessage = await messagesCollection.insertOne(messageDoc as any);

    // Backfill conversationId from the message we actually sent (filter by subject + to + recent) so different threads with same subject get different conversationIds
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const subjectEscaped = (subject || "").replace(/'/g, "''");
      const filterParts = [`sentDateTime ge ${twoMinutesAgo}`];
      if (subjectEscaped) filterParts.push(`subject eq '${subjectEscaped}'`);
      const filterQuery = filterParts.join(" and ");
      const sentRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$filter=${encodeURIComponent(filterQuery)}&$top=10&$orderby=sentDateTime desc`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (sentRes.ok) {
        const sentData = await sentRes.json();
        const sentMessages = sentData.value || [];
        const toSet = new Set((toList as string[]).map((e: string) => String(e).toLowerCase().trim()));
        const sent = Array.isArray(sentMessages)
          ? sentMessages.find((m: any) => {
              const recipients = m.toRecipients || [];
              const recSet = new Set(recipients.map((r: any) => String(r?.emailAddress?.address || "").toLowerCase().trim()));
              if (recSet.size !== toSet.size) return false;
              for (const e of toSet) if (!recSet.has(e)) return false;
              return true;
            })
          : null;
        if (sent) {
          const conversationId = sent.conversationId;
          if (conversationId) {
            await threadsCollection.updateOne(
              { _id: thread._id },
              {
                $set: {
                  outlookConversationId: conversationId,
                  updatedAt: new Date(),
                },
              }
            );
          }
          const graphMessageId = sent.id;
          const internetMessageId = sent.internetMessageId ?? null;
          if (graphMessageId || internetMessageId) {
            const msgUpdate: Record<string, unknown> = { updatedAt: new Date() };
            if (graphMessageId) msgUpdate.outlookMessageId = graphMessageId;
            if (internetMessageId) msgUpdate.internetMessageId = internetMessageId;
            await messagesCollection.updateOne(
              { _id: insertedMessage.insertedId },
              { $set: msgUpdate }
            );
          }
        }
      }
    } catch (backfillErr) {
      console.warn("Outlook send: backfill conversationId failed (replies may not link to thread)", backfillErr);
    }

    // Automatically mark the logged-in user as having read the thread and message (same as mg-send-email)
    const userUid = (decodedToken as any)?.uid ?? null;
    const userEmail = decodedToken.email ?? null;
    if (userEmail) {
      const now = new Date();
      if (userUid) {
        try {
          await threadsCollection.updateOne(
            { _id: thread._id },
            { $set: { ["readMap." + userUid]: now } },
          );
        } catch (e) {
          console.error("Outlook send: failed to update readMap in mailgun-threads", e);
        }
      }
      try {
        await messagesCollection.updateOne(
          { _id: insertedMessage.insertedId },
          { $addToSet: { readBy: userEmail } },
        );
      } catch (e) {
        console.error("Outlook send: failed to update readBy in mailgun-messages", e);
      }
    }

    // Log activity for emailing candidate
    try {
      if (bodyCareerId) {
        const extractEmail = (emailField: string | string[]): string | null => {
          const emailStr = Array.isArray(emailField) ? emailField[0] : emailField;
          const match = String(emailStr).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
          return match ? match[0].toLowerCase() : null;
        };
        const extractEmailsForLog = (input: any): string[] => {
          if (!input && input !== 0) return [];
          const src = Array.isArray(input) ? input.join(",") : String(input || "");
          const matches = src.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
          return Array.from(new Set(matches.map((m) => String(m).trim().toLowerCase())));
        };
        const toListLog = extractEmailsForLog(to);
        const ccListLog = extractEmailsForLog(cc);
        const bccListLog = extractEmailsForLog(bcc);
        const allRecipientEmails = [...new Set([...toListLog, ...ccListLog, ...bccListLog])];
        const orgIdForLookup = toIdString(orgID);
        const nameMap = new Map<string, string>();
        if (orgID && allRecipientEmails.length > 0) {
          const interviews = await db
            .collection("interviews")
            .find(
              {
                $or: [
                  { orgID: orgIdForLookup },
                  ...(ObjectId.isValid(orgIdForLookup) ? [{ orgID: new ObjectId(orgIdForLookup) }] : []),
                ],
                email: { $in: allRecipientEmails },
              },
              { projection: { email: 1, name: 1 } }
            )
            .toArray();
          for (const i of interviews) {
            if (i.email && i.name) nameMap.set(String(i.email).toLowerCase(), i.name);
          }
        }
        const buildRecipients = (
          emails: string[],
          type: "to" | "cc" | "bcc"
        ): { email: string; name?: string; type: "to" | "cc" | "bcc" }[] =>
          emails.map((email) => ({ email, name: nameMap.get(email), type }));
        const recipients = [
          ...buildRecipients(toListLog, "to"),
          ...buildRecipients(ccListLog, "cc"),
          ...buildRecipients(bccListLog, "bcc"),
        ];

        const recipientEmail = extractEmail(to);
        if (recipientEmail) {
          const interview = await db.collection("interviews").findOne({
            id: bodyCareerId,
            email: recipientEmail,
          });

          if (interview) {
            const career = await db.collection("careers").findOne({
              id: bodyCareerId,
            });

            await logActivity({
              db,
              kind: "recruiter_emailed_candidate",
              interview,
              career,
              actor: {
                type: "recruiter",
                id: member?.uid || member?._id?.toString(),
                email: decodedToken.email,
                name: member?.name || decodedToken.email,
                image: member?.image || member?.photoURL,
              },
              extraMetadata: {
                emailSubject: processedSubject || subject,
                ...(recipients.length > 0 && { recipients }),
              },
            });
          } else {
            const career = await db.collection("careers").findOne({
              id: bodyCareerId,
            });
            if (career && orgID) {
              const actorName = member?.name || decodedToken.email || "Recruiter";
              const applicantNameFromOrg = nameMap.get(recipientEmail);
              const displayName = applicantNameFromOrg || recipientEmail;
              await recordActivityHistory(db, {
                orgID: orgIdForLookup,
                careerId: career._id?.toString?.() || career?.id,
                action: "Emailed Candidate",
                source: "manual",
                actor: {
                  type: "recruiter",
                  id: member?.uid || member?._id?.toString(),
                  email: decodedToken.email,
                  name: actorName,
                  image: member?.image || member?.photoURL,
                },
                metadata: {
                  applicant: { email: recipientEmail, name: applicantNameFromOrg ?? undefined },
                  emailSubject: processedSubject || subject,
                  message: `${actorName} emailed ${displayName}`,
                  ...(recipients.length > 0 && { recipients }),
                },
              });
            }
          }
        }
      }
    } catch (logError) {
      console.error("Error logging email activity:", logError);
      // Don't fail the email send if logging fails
    }

    return NextResponse.json(
      {
        success: true,
        messageId: insertedMessage.insertedId,
        threadId: thread.threadId || thread._id.toString(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Outlook send error:", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
