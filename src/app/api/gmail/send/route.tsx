import { getOAuth2Client } from "@/lib/data/google";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { decrypt, encrypt } from "@/lib/utils/cryptography";
import { logActivity } from "@/lib/utils/activityLogger";
import { recordActivityHistory } from "@/lib/utils/activityHistoryHelpers";
import { google } from "googleapis";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.to) {
      return NextResponse.json(
        { error: "Missing required field: 'to' email address" },
        { status: 400 }
      );
    }

    if (!body.subject) {
      return NextResponse.json(
        { error: "Missing required field: 'subject'" },
        { status: 400 }
      );
    }

    // Validate and format the 'to' field
    let toEmails: string[];
    if (Array.isArray(body.to)) {
      toEmails = body.to;
    } else if (typeof body.to === "string") {
      // Handle comma-separated emails
      toEmails = body.to.split(",").map((email: string) => email.trim());
    } else {
      return NextResponse.json(
        {
          error:
            "Invalid 'to' field format. Expected string or array of email addresses.",
        },
        { status: 400 }
      );
    }

    // Filter out empty strings and validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    toEmails = toEmails.filter((email) => {
      if (!email || email.trim() === "") return false;
      if (!emailRegex.test(email.trim())) {
        console.warn(`Invalid email format: ${email}`);
        return false;
      }
      return true;
    });

    if (toEmails.length === 0) {
      return NextResponse.json(
        { error: "No valid email addresses found in 'to' field" },
        { status: 400 }
      );
    }

    // Join emails with commas for the header
    const toHeader = toEmails.join(", ");

    const { db } = await connectMongoDB();
    const emailSettingsModel = db.collection("email-settings");

    // Fetch email settings for the selected sender (userID represents the sender)
    const result = await emailSettingsModel.findOne({ userID: body.userID });

    if (!result) {
      return NextResponse.json(
        { error: "Email settings not found for user" },
        { status: 404 }
      );
    }

    const decryptTokens = decrypt(result.tokens);
    if (!decryptTokens) {
      return NextResponse.json(
        {
          error: "Gmail tokens not found. Please reconnect your Gmail account.",
        },
        { status: 401 }
      );
    }

    const parsedTokens = JSON.parse(decryptTokens);
    const oAuth2Client = getOAuth2Client();
    oAuth2Client.setCredentials({
      access_token: parsedTokens.access_token,
      refresh_token: parsedTokens.refresh_token,
    });

    if (Date.now() > parsedTokens.expiry_date) {
      console.log("Token expired");
      const { credentials } = await oAuth2Client.refreshAccessToken();
      oAuth2Client.setCredentials(credentials);

      await emailSettingsModel.updateOne(
        { userID: body.userID },
        { $set: { tokens: encrypt(JSON.stringify(credentials)) } }
      );
    }
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    const profile = await gmail.users.getProfile({ userId: "me" });
    const userEmail = profile.data.emailAddress;

    const email = createEmail(
      toHeader,
      body.subject || "",
      body.body || "",
      result.signature,
      body.attachments,
      body.inReplyTo,
      body.references
    );

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: email,
      },
    });

    // Get orgID: prefer from request body, fallback to email settings
    let orgIdForGmail: string | null = body.orgID || result.orgID || null;

    // Normalize orgID to ObjectId if valid
    const normalizedOrgId =
      orgIdForGmail && ObjectId.isValid(String(orgIdForGmail))
        ? new ObjectId(String(orgIdForGmail))
        : orgIdForGmail;

    // Save to gmail-subject collection (use upsert to prevent duplicates)
    if (body.subject && normalizedOrgId && userEmail) {
      try {
        const subjectStr = String(body.subject).trim();
        const senderEmailStr = String(userEmail).toLowerCase();

        // Use upsert to prevent duplicates based on orgID + senderEmail + subject
        const updatePayload: any = {
          $set: {
            userId: body.userID,
            careerId: body.careerId || null,
            campaignId: body.campaignId || null,
            date: new Date(),
            updatedAt: new Date(),
          },
          $setOnInsert: {
            subject: subjectStr,
            orgID: normalizedOrgId,
            senderEmail: senderEmailStr,
            createdAt: new Date(),
          },
        };

        const updatedSubject = await db.collection("gmail-subject").findOneAndUpdate(
          {
            orgID: normalizedOrgId,
            senderEmail: senderEmailStr,
            subject: subjectStr,
          },
          updatePayload,
          { upsert: true, returnDocument: "after" }
        );

        if (updatedSubject) {
            // override the gmail threadId with our internal subject id
            res.data.threadId = updatedSubject._id.toString(); 
        }

      } catch (saveErr) {
        console.error("Failed to save to gmail-subject collection", saveErr);
        // Don't fail the request if save fails
      }
    }

    // Log "Emailed Candidate" to activity-history (for ActivityTracker)
    const orgIDStr =
      normalizedOrgId?.toString?.() || (orgIdForGmail && String(orgIdForGmail)) || null;
    if (orgIDStr && toEmails.length > 0 && body.subject != null) {
      try {
        const parseEmails = (input: any): string[] => {
          if (!input) return [];
          const arr = Array.isArray(input) ? input : String(input).split(",").map((s: string) => s.trim());
          return arr.filter((e) => emailRegex.test(e)).map((e) => e.trim().toLowerCase());
        };
        const toListLog = toEmails.map((e) => e.trim().toLowerCase());
        const ccListLog = parseEmails(body.cc);
        const bccListLog = parseEmails(body.bcc);
        const allRecipientEmails = [...new Set([...toListLog, ...ccListLog, ...bccListLog])];
        const nameMap = new Map<string, string>();
        if (allRecipientEmails.length > 0) {
          const interviews = await db
            .collection("interviews")
            .find(
              {
                $or: [
                  { orgID: orgIDStr },
                  ...(ObjectId.isValid(orgIDStr) ? [{ orgID: new ObjectId(orgIDStr) }] : []),
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

        const recipientEmail = toListLog[0];
        const careerId = body.careerId ?? null;
        const member = await db.collection("members").findOne({
          orgID: orgIDStr,
          email: userEmail?.toLowerCase?.() || userEmail,
        });
        let interview = null;
        let career = null;
        if (careerId) {
          interview = await db.collection("interviews").findOne({
            id: String(careerId),
            email: recipientEmail,
          });
          career = await db.collection("careers").findOne({
            $or: [
              ...(ObjectId.isValid(String(careerId)) ? [{ _id: new ObjectId(String(careerId)) }] : []),
              { id: String(careerId) },
            ],
          });
        }
        const actorName = member?.name || userEmail || "Recruiter";
        if (interview && career && member) {
          await logActivity({
            db,
            kind: "recruiter_emailed_candidate",
            interview,
            career,
            orgID: orgIDStr,
            actor: {
              type: "recruiter",
              id: member?.uid || member?._id?.toString(),
              email: member?.email || userEmail,
              name: actorName,
              image: member?.image || member?.photoURL,
            },
            extraMetadata: {
              emailSubject: body.subject,
              ...(recipients.length > 0 && { recipients }),
            },
          });
        } else if (member) {
          const applicantNameFromOrg = nameMap.get(recipientEmail);
          const displayName = applicantNameFromOrg || recipientEmail;
          await recordActivityHistory(db, {
            orgID: orgIDStr,
            ...(career && { careerId: career._id?.toString?.() || career?.id }),
            action: "Emailed Candidate",
            source: "manual",
            actor: {
              type: "recruiter",
              id: member?.uid || member?._id?.toString(),
              email: member?.email || userEmail,
              name: actorName,
              image: member?.image || member?.photoURL,
            },
            metadata: {
              applicant: { email: recipientEmail, name: applicantNameFromOrg ?? undefined },
              emailSubject: body.subject,
              message: `${actorName} emailed ${displayName}`,
              ...(recipients.length > 0 && { recipients }),
            },
          });
        }
      } catch (logErr) {
        console.error("Failed to log Gmail send activity:", logErr);
      }
    }

    return NextResponse.json({
      message: "Email sent successfully!",
      id: res.data.id,
      threadId: res.data.threadId,
      data: res.data,
    });
  } catch (err: any) {
    console.error("Gmail send error:", err);

    // Provide more specific error messages
    if (err?.response?.data?.error) {
      const gmailError = err.response.data.error;
      if (gmailError.message?.includes("Invalid To header")) {
        return NextResponse.json(
          {
            error: "Invalid email address format. Please check the 'to' field.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: gmailError.message || "Gmail API error" },
        { status: err.response.status || 500 }
      );
    }

    if (err?.message) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Email sending failed. Please try again." },
      { status: 500 }
    );
  }
}

function createEmail(
  to: string,
  subject: string,
  body: string,
  signature?: string,
  attachments?: {
    filename: string;
    mimeType: string;
    data: string; // base64 only
  }[],
  inReplyTo?: string,
  references?: string
) {
  // Validate inputs
  if (!to || typeof to !== "string" || to.trim() === "") {
    throw new Error("Invalid 'to' field: must be a non-empty string");
  }

  if (!subject || typeof subject !== "string") {
    throw new Error("Invalid 'subject' field: must be a non-empty string");
  }

  // Sanitize and format headers
  const toHeader = to.trim();
  const subjectHeader = subject.trim().replace(/\r?\n/g, " "); // Remove newlines from subject

  // Ensure body is a string (signature is now already included in body from frontend)
  const bodyContent = typeof body === "string" ? body : String(body || "");
  const fullBody = bodyContent;

  // Build headers array
  const headers: string[] = [
    `To: ${toHeader}`,
    `Subject: ${subjectHeader}`,
  ];

  // Add thread headers if provided
  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
  }
  if (references) {
    headers.push(`References: ${references}`);
  }

  headers.push("MIME-Version: 1.0");

  // ----------------------------
  // NO ATTACHMENTS
  // ----------------------------
  if (!attachments || attachments.length === 0) {
    headers.push('Content-Type: text/html; charset="UTF-8"');
    headers.push(""); // Empty line before body

    const message = [
      ...headers,
      fullBody,
    ].join("\r\n");

    return Buffer.from(message).toString("base64url");
  }

  // ----------------------------
  // WITH ATTACHMENTS
  // ----------------------------
  const boundary = `----=_Part_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 15)}`;

  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  headers.push(""); // Empty line before boundary

  let message = [
    ...headers,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    fullBody,
  ].join("\r\n");

  for (const file of attachments) {
    if (!file.filename || !file.mimeType || !file.data) {
      console.warn("Skipping invalid attachment:", file);
      continue;
    }

    // Sanitize filename for header
    const sanitizedFilename = file.filename
      .replace(/[^\x20-\x7E]/g, "")
      .replace(/"/g, "'");

    message += [
      "",
      `--${boundary}`,
      `Content-Type: ${file.mimeType}; name="${sanitizedFilename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${sanitizedFilename}"`,
      "",
      file.data,
    ].join("\r\n");
  }

  message += `\r\n--${boundary}--`;

  return Buffer.from(message).toString("base64url");
}
