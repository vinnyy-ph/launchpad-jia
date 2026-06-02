import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function normalizeSubject(s: string) {
  if (!s) return "";
  return s.replace(/^([\s]*(?:re|fw|fwd)[\s]*[:\-\s]*)+/i, "").trim();
}

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const {
      fromMailgunId,
      to,
      cc,
      bcc,
      subject,
      html,
      text,
      attachments,
      threadId,
      careerId,
      inReplyTo,
      inReplyToRaw,
      orgId: bodyOrgId,
      draftId: bodyDraftId,
    } = body || {};

    // minimal required: fromMailgunId must be present
    if (!fromMailgunId) {
      return NextResponse.json(
        { error: "Missing fromMailgunId" },
        { status: 400 },
      );
    }

    const { db } = await connectMongoDB();

    // Resolve mailgun account (allow fallback ids like `fallback:...` similar to send route)
    let mgAccount: any = null;
    try {
      if (ObjectId.isValid(String(fromMailgunId))) {
        mgAccount = await db
          .collection("mailgun-accounts")
          .findOne({ _id: new ObjectId(String(fromMailgunId)) });
      }
    } catch (e) {
      // ignore
    }
    if (!mgAccount && String(fromMailgunId || "").startsWith("fallback:")) {
      const email = String(fromMailgunId).split(":")[1] || "";
      mgAccount = {
        _id: String(fromMailgunId),
        email,
        domain: email.split("@")[1] || null,
        organizationId: bodyOrgId || null,
      } as any;
    }

    // Gmail sender: fromMailgunId is "gmail:<email-settings-_id>"
    if (!mgAccount && String(fromMailgunId || "").startsWith("gmail:")) {
      const emailSettingsId = String(fromMailgunId).slice(6).trim();
      if (emailSettingsId) {
        const orClauses: any[] = [{ _id: emailSettingsId }];
        if (ObjectId.isValid(emailSettingsId)) {
          orClauses.unshift({ _id: new ObjectId(emailSettingsId) });
        }
        const emailSettings = await db.collection("email-settings").findOne({
          $or: orClauses,
        });
        if (emailSettings) {
          const orgId =
            emailSettings.orgID != null
              ? String(emailSettings.orgID)
              : bodyOrgId != null
                ? String(bodyOrgId)
                : null;
          const member = await db.collection("members").findOne({
            _id:
              emailSettings.userID instanceof ObjectId
                ? emailSettings.userID
                : new ObjectId(String(emailSettings.userID)),
          });
          const email = member?.email ?? null;
          if (email && orgId) {
            mgAccount = {
              _id: String(fromMailgunId),
              email,
              domain: email.split("@")[1] || null,
              organizationId: orgId,
              displayName: member?.name && String(member.name).trim() ? String(member.name).trim() : null,
            } as any;
          }
        }
      }
    }

    // Outlook sender: fromMailgunId is "outlook:<member-_id>" (same as email-settings.userID)
    // No mailgun-account is involved; we build a synthetic sender from member + email-settings.
    if (!mgAccount && String(fromMailgunId || "").startsWith("outlook:")) {
      const memberIdStr = String(fromMailgunId).slice(8).trim();
      if (memberIdStr) {
        const orClauses: any[] = [{ _id: memberIdStr }];
        if (ObjectId.isValid(memberIdStr)) {
          orClauses.unshift({ _id: new ObjectId(memberIdStr) });
        }
        const member = await db.collection("members").findOne({
          $or: orClauses,
        });

        if (member) {
          let orgId = member.orgID || member.organizationId || bodyOrgId || null;
          if (orgId) orgId = String(orgId);

          const memberObjectId = ObjectId.isValid(memberIdStr)
            ? new ObjectId(memberIdStr)
            : memberIdStr;

          // Find email-settings for this member (try with outlookConnected first, then without)
          let emailSettings = await db.collection("email-settings").findOne({
            userID: memberObjectId,
            outlookConnected: true,
          });
          if (!emailSettings) {
            emailSettings = await db.collection("email-settings").findOne({
              userID: memberObjectId,
            });
          }

          const senderEmail =
            emailSettings?.outlookEmail || member.email || null;
          const outlookDisplayName =
            emailSettings?.outlookUser?.name &&
            String(emailSettings.outlookUser.name).trim()
              ? String(emailSettings.outlookUser.name).trim()
              : (member?.name && String(member.name).trim()
                  ? String(member.name).trim()
                  : null);

          if (senderEmail && orgId) {
            mgAccount = {
              _id: String(fromMailgunId),
              email: senderEmail,
              domain: senderEmail.split("@")[1] || null,
              organizationId: orgId,
              displayName: outlookDisplayName,
            } as any;
          }
        }
      }
    }

    if (!mgAccount) {
      // If fromMailgunId is a valid email, just use it as the sender
      const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
      if (emailRegex.test(String(fromMailgunId))) {
        mgAccount = {
          _id: String(fromMailgunId),
          email: String(fromMailgunId),
          domain: String(fromMailgunId).split("@")[1] || null,
          organizationId: bodyOrgId || null,
        };
      } else {
        console.error("mg-save-draft: Mailgun account not found", {
          fromMailgunId,
          mgAccount,
        });
        return NextResponse.json(
          { error: "Mailgun account not found", fromMailgunId, mgAccount },
          { status: 404 },
        );
      }
    }

    // Determine org context: prefer account organization, then body, then infer from user
    let orgIdStr: string | null = mgAccount.organizationId
      ? String(mgAccount.organizationId)
      : bodyOrgId
        ? String(bodyOrgId)
        : null;

    const userEmail = req.user?.email;
    if (!userEmail)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!orgIdStr) {
      const maybeMember = await db
        .collection("members")
        .findOne({ email: userEmail });
      if (maybeMember)
        orgIdStr = maybeMember.orgID || maybeMember.organizationId || null;
    }
    if (!orgIdStr)
      return NextResponse.json(
        { error: "Mailgun account not linked to an organization" },
        { status: 400 },
      );

    // ensure member is in org
    const memberInOrg = await db.collection("members").findOne({
      email: userEmail,
      $or: [
        { orgID: orgIdStr },
        { orgID: new ObjectId(orgIdStr) },
        { organizationId: orgIdStr },
        { organizationId: new ObjectId(orgIdStr) },
      ],
    });
    if (!memberInOrg)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const orgObjectId = new ObjectId(orgIdStr);

    // Load organization for display name fallback
    let orgDoc: any = null;
    try {
      const orgMatchers2: any[] = [{ _id: orgIdStr }];
      if (orgObjectId) orgMatchers2.push({ _id: orgObjectId });
      orgDoc = await db
        .collection("organizations")
        .findOne({ $or: orgMatchers2 });
    } catch (_) {
      orgDoc = null;
    }

    // Helper: extract emails
    const extractEmails = (input?: any): string[] => {
      if (!input && input !== 0) return [];
      const src = Array.isArray(input) ? input.join(",") : String(input || "");
      const matches =
        src.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
      return Array.from(new Set(matches.map((m) => String(m).trim())));
    };

    // Helper: extract plain email + optional display name (same as mg-send-email)
    const parseEmailParts = (
      value: string | null | undefined,
    ): { email: string; displayName: string | null } => {
      if (!value) return { email: "", displayName: null };

      const trimmed = String(value).trim();
      // Match patterns like "Name" <email@domain>
      const angleMatch = trimmed.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
      if (angleMatch) {
        const candidateName = angleMatch[1]?.trim();
        const candidateEmail = angleMatch[2]?.trim();
        return {
          email: candidateEmail || trimmed,
          displayName: candidateName || null,
        };
      }

      // Fallback: if it's just a quoted string without angle brackets
      const quotedOnly = trimmed.match(/^"([^"]+)"$/);
      if (quotedOnly) {
        return { email: quotedOnly[1].trim(), displayName: null };
      }

      return { email: trimmed, displayName: null };
    };

    // Helper: format from address with display name (same as mg-send-email)
    const formatFromAddress = (
      displayName: string | null | undefined,
      email: string,
    ): string => {
      if (!displayName || displayName.trim() === "") {
        return email;
      }
      // Escape quotes and backslashes in display name
      const escaped = displayName.replace(/\\/g, "\\").replace(/"/g, '\\"');
      // Always quote the display name for proper RFC 5322 compliance
      return `"${escaped}" <${email}>`;
    };

    // Validate: if composing new email (no threadId), require at least one of to, subject, message
    const hasTo = (to && String(to).trim().length > 0) || false;
    const hasSubject = (subject && String(subject).trim().length > 0) || false;
    const hasMessage =
      (html && String(html).trim().length > 0) ||
      (text && String(text).trim().length > 0) ||
      false;

    if (!threadId && !(hasTo || hasSubject || hasMessage)) {
      return NextResponse.json(
        {
          error:
            "At least one of to, subject, or message is required to save a new draft",
        },
        { status: 400 },
      );
    }

    // Prepare draft document fields (used for insert or update)
    // Format sender the same way as mg-send-email does
    const parsedFrom = parseEmailParts(mgAccount.email);
    const orgName = (orgDoc?.name && String(orgDoc.name).trim()) || null;
    const fallbackDisplayName = orgName
      ? String(mgAccount.email || "")
          .toLowerCase()
          .startsWith("no-reply-")
        ? orgName
        : `${orgName} HR`
      : null;
    const fromDisplayNameRaw =
      (mgAccount.displayName && String(mgAccount.displayName).trim()) ||
      parsedFrom.displayName ||
      fallbackDisplayName ||
      null;
    const fromEmail = parsedFrom.email;
    const fromAddress = formatFromAddress(fromDisplayNameRaw, fromEmail);

    // Format recipients as arrays (extractEmails accepts string or array)
    const toList: string[] = extractEmails(to);
    const ccList: string[] = extractEmails(cc);
    const bccList: string[] = extractEmails(bcc);

    const baseDraftFields: any = {
      from:
        fromDisplayNameRaw && fromEmail
          ? `${fromDisplayNameRaw} <${fromEmail}>`
          : fromEmail,
      fromHeader: fromAddress,
      fromMailgunId: fromMailgunId, // Store the prefixed ID for accurate prefilling
      toRaw: to || null, // keep raw display value so UI can show name+email
      toList: toList,
      to: toList,
      cc: ccList,
      bcc: bccList,
      ccRaw: typeof cc === "string" && cc.trim() ? cc : Array.isArray(cc) && cc.length > 0 ? cc.join(", ") : null,
      bccRaw: typeof bcc === "string" && bcc.trim() ? bcc : Array.isArray(bcc) && bcc.length > 0 ? bcc.join(", ") : null,
      subject: subject || null,
      html: html || null,
      text: text || null,
      isDraft: true,
      direction: "draft",
      mailgunAccountId: mgAccount._id,
      recruiterId: memberInOrg?._id
        ? new ObjectId(String(memberInOrg._id))
        : null,
      applicantId: null,
      organizationId: orgObjectId,
      updatedAt: new Date(),
      savedAt: new Date(),
    };

    // Process attachments: only upload new ones (with data but no url/key), keep existing ones
    // Collect all attachments (newly uploaded + already saved) in `newDraftAttachments`
    const newDraftAttachments: any[] = [];
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      try {
        const accessKeyId = process.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
        const accountId = process.env.R2_ACCOUNT_ID;
        const bucketName = process.env.R2_BUCKET_NAME;

        if (!accessKeyId || !secretAccessKey || !accountId || !bucketName) {
          throw new Error("Missing R2 credentials or configuration");
        }

        const s3Client = new S3Client({
          region: "auto",
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });

        for (const att of attachments) {
          try {
            // If attachment already has a url or key, it was already saved - reuse it
            if (att.url || att.key) {
              newDraftAttachments.push({
                filename: att.filename || "attachment",
                mimeType: att.mimeType,
                size: att.size,
                key: att.key,
                url: att.url,
              });
              continue;
            }

            // Only upload if there's base64 data and no existing url/key
            if (att.data) {
              const filename = att.filename || `attachment-${Date.now()}`;
              const mimeType = att.mimeType || "application/octet-stream";
              const data = att.data || ""; // base64
              const buffer = Buffer.from(data, "base64");
              const key = `mailgun-drafts/${Date.now()}-${filename}`;

              const cmd = new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: key,
                Body: buffer,
                ContentType: mimeType,
              });
              await s3Client.send(cmd);

              const url = `https://${
                process.env.R2_ACCOUNT_ID
              }.r2.cloudflarestorage.com/${
                process.env.R2_BUCKET_NAME
              }/${encodeURIComponent(key)}`;

              newDraftAttachments.push({
                filename,
                mimeType,
                size: buffer.length,
                key,
                url,
              });
            }
          } catch (e) {
            console.warn("mg-save-draft: failed to upload attachment", e);
          }
        }
      } catch (e) {
        console.warn("mg-save-draft: R2 upload failed", e);
      }
    }

    // Resolve or create thread for the draft
    let resolvedThread: any = null;

    // If threadId is provided, try to find the existing thread
    if (threadId) {
      try {
        const threadQuery: any = ObjectId.isValid(String(threadId))
          ? { _id: new ObjectId(String(threadId)) }
          : { threadId: String(threadId) };
        resolvedThread = await db
          .collection("mailgun-threads")
          .findOne(threadQuery);
        if (resolvedThread) {
          baseDraftFields.threadId = resolvedThread._id;
        } else {
          // If provided threadId doesn't exist, treat as new draft
          resolvedThread = null;
        }
      } catch (e) {
        console.warn("mg-save-draft: failed to resolve provided threadId", e);
        resolvedThread = null;
      }
    }

    // If no thread found and this is a new draft (not a reply), create a new thread
    if (!resolvedThread && !threadId) {
      const normSubject = normalizeSubject(subject || "");
      const threadIdStr = new ObjectId().toHexString();
      const insertThread = {
        applicantId: null,
        organizationId: orgObjectId,
        subject: subject || null,
        normalizedSubject: normSubject,
        threadId: threadIdStr,
        careerId: careerId
          ? ObjectId.isValid(String(careerId))
            ? new ObjectId(String(careerId))
            : careerId
          : null,
        lastUpdated: new Date(),
        participants: [
          typeof mgAccount._id === "object"
            ? mgAccount._id
            : String(mgAccount._id),
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
      const tRes = await db
        .collection("mailgun-threads")
        .insertOne(insertThread);
      resolvedThread = await db
        .collection("mailgun-threads")
        .findOne({ _id: tRes.insertedId });
      if (resolvedThread) {
        baseDraftFields.threadId = resolvedThread._id;
      }
    }

    if (careerId) {
      try {
        baseDraftFields.careerId = ObjectId.isValid(String(careerId))
          ? new ObjectId(String(careerId))
          : careerId;
      } catch (e) {
        baseDraftFields.careerId = careerId;
      }
    }

    if (inReplyToRaw) baseDraftFields.inReplyToRaw = inReplyToRaw;
    else if (inReplyTo) baseDraftFields.inReplyTo = inReplyTo;

    // If client provided an existing draftId, attempt to update that draft (avoid creating duplicates)
    const draftIdToUpdate = bodyDraftId ?? body?.draftId;
    if (draftIdToUpdate) {
      try {
        const providedId =
          typeof draftIdToUpdate === "string"
            ? draftIdToUpdate.trim()
            : String(draftIdToUpdate);
        if (!providedId) throw new Error("draftId empty");

        const messagesColl = db.collection("mailgun-messages");
        // Try ObjectId first (normal case), then string _id (legacy)
        let existing = await messagesColl.findOne({
          _id: ObjectId.isValid(providedId)
            ? new ObjectId(providedId)
            : (providedId as unknown as import("mongodb").ObjectId),
        } as import("mongodb").Filter<import("mongodb").Document>);
        if (!existing && ObjectId.isValid(providedId)) {
          existing = await messagesColl.findOne({
            _id: providedId as unknown as import("mongodb").ObjectId,
          } as import("mongodb").Filter<import("mongodb").Document>);
        }
        const query = existing
          ? { _id: existing._id }
          : {
              _id: ObjectId.isValid(providedId)
                ? new ObjectId(providedId)
                : (providedId as unknown as import("mongodb").ObjectId),
            };

        if (existing) {
          // Ensure the existing draft belongs to the same org (safety) and is a draft
          const existingOrgId = existing.organizationId
            ? String(existing.organizationId)
            : existing.orgID || existing.orgId || null;
          if (
            existing.isDraft &&
            String(existingOrgId) === String(orgObjectId)
          ) {
            // If existing draft doesn't have a threadId, create one
            let draftThreadId = existing.threadId;
            if (!draftThreadId && !threadId) {
              const normSubject = normalizeSubject(
                subject || existing.subject || "",
              );
              const threadIdStr = new ObjectId().toHexString();
              const insertThread = {
                applicantId: null,
                organizationId: orgObjectId,
                subject: subject || existing.subject || null,
                normalizedSubject: normSubject,
                threadId: threadIdStr,
                careerId: careerId
                  ? ObjectId.isValid(String(careerId))
                    ? new ObjectId(String(careerId))
                    : careerId
                  : existing.careerId || null,
                lastUpdated: new Date(),
                participants: [
                  typeof mgAccount._id === "object"
                    ? mgAccount._id
                    : String(mgAccount._id),
                ],
                createdAt: new Date(),
                updatedAt: new Date(),
              } as any;
              const tRes = await db
                .collection("mailgun-threads")
                .insertOne(insertThread);
              const newThread = await db
                .collection("mailgun-threads")
                .findOne({ _id: tRes.insertedId });
              if (newThread) {
                draftThreadId = newThread._id;
              }
            } else if (threadId && resolvedThread) {
              draftThreadId = resolvedThread._id;
            }

            // Merge attachments, avoiding duplicates based on url or key
            const existingAttachments = existing.draftAttachments || [];
            const existingUrls = new Set(
              existingAttachments
                .map((a: any) => a.url || a.key)
                .filter(Boolean),
            );

            // Only add new attachments that don't already exist
            const uniqueNewAttachments = newDraftAttachments.filter(
              (att) => !existingUrls.has(att.url || att.key),
            );

            const updatedDraftAttachments = [
              ...existingAttachments,
              ...uniqueNewAttachments,
            ];

            const updateDoc: any = {
              $set: Object.assign({}, baseDraftFields, {
                updatedAt: new Date(),
                threadId: draftThreadId || baseDraftFields.threadId,
              }),
              $setOnInsert: { createdAt: existing.createdAt || new Date() },
            };
            // If there are attachments, ensure draftAttachments is updated
            if (updatedDraftAttachments.length > 0) {
              updateDoc.$set.draftAttachments = updatedDraftAttachments;
            }
            await messagesColl.updateOne(query, updateDoc);
            const returnedId =
              existing._id instanceof ObjectId
                ? existing._id.toString()
                : String(existing._id);
            return NextResponse.json({
              success: true,
              data: { draftId: returnedId },
            });
          }
        }
      } catch (e) {
        console.debug(
          "mg-save-draft: failed to update existing draft, will insert new",
          e,
        );
      }
    }

    // Insert new draft doc
    const draftDoc: any = Object.assign({}, baseDraftFields, {
      draftAttachments: newDraftAttachments,
      createdAt: new Date(),
    });

    const res = await db.collection("mailgun-messages").insertOne(draftDoc);

    return NextResponse.json({
      success: true,
      data: { draftId: res.insertedId },
    });
  } catch (err) {
    console.error("mg-save-draft error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});
