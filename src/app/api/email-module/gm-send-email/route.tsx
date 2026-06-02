import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { decrypt, encrypt } from "@/lib/utils/cryptography";
import { ObjectId } from "mongodb";
import { toIdString } from "@/lib/utils/dataTransform";
import { logActivity } from "@/lib/utils/activityLogger";

// Function to refresh access token
async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh access token");
  }

  const data = await response.json();
  return data.access_token;
}

// Get valid access token using encrypted Google OAuth tokens from email-settings
async function getValidAccessTokenForOrgUser(
  req: AuthenticatedRequest,
  orgID: string
) {
  const userEmail = req.user?.email;
  if (!userEmail) {
    throw new Error("Unauthorized");
  }

  const { db } = await connectToDatabase();

  // Verify the requester is a member of the org and get userID
  const orgIdStr = toIdString(orgID);
  const member = await db.collection("members").findOne({
    email: userEmail.toLowerCase(),
    $or: [
      { orgID: orgIdStr },
      { orgID: new ObjectId(orgID) },
      { organizationId: orgIdStr },
      { organizationId: new ObjectId(orgID) },
    ],
  });

  if (!member?._id) {
    throw new Error("Forbidden - user not in organization");
  }

  // Load encrypted token payload from email-settings
  const settings = await db.collection("email-settings").findOne({
    orgID: orgIdStr,
    userID: toIdString(member._id),
  });

  if (!settings?.tokens) {
    throw new Error(
      "Gmail is not connected. Please enable Gmail sending in the settings page."
    );
  }

  const decrypted = decrypt(settings.tokens);
  if (!decrypted) {
    throw new Error("Failed to decrypt Gmail tokens");
  }

  const tokens = JSON.parse(decrypted) as {
    access_token?: string;
    refresh_token?: string;
    expiry_date?: number; // ms since epoch
  };

  if (!tokens.refresh_token) {
    throw new Error("Missing refresh token. Please reconnect Gmail.");
  }

  const now = Date.now();
  const isExpired =
    !tokens.access_token ||
    !tokens.expiry_date ||
    now >= Number(tokens.expiry_date) - 60_000; // refresh 1 min early

  if (isExpired) {
    const newToken = await refreshAccessToken(tokens.refresh_token);
    const expiresIn = 3600; // default 1h when not provided

    const updated = {
      ...tokens,
      access_token: newToken,
      expiry_date: now + expiresIn * 1000,
    };

    const reEncrypted = encrypt(JSON.stringify(updated));
    if (!reEncrypted) {
      throw new Error("Failed to encrypt updated tokens");
    }

    await db
      .collection("email-settings")
      .updateOne(
        { orgID: orgIdStr, userID: toIdString(member._id) },
        { $set: { tokens: reEncrypted, dateUpdated: new Date().toString() } }
      );

    return newToken;
  }

  return tokens.access_token!;
}

// Function to get or create thread ID for a subject-recipient combination
async function getOrCreateThreadId(
  accessToken: string,
  subject: string,
  toEmail: string,
  fromEmail: string
) {
  const { db } = await connectToDatabase();

  try {
    // First, check if we have a stored threadId for this subject-recipient combination
    const threadDoc = await db.collection("email-threads").findOne({
      subject: subject,
      toEmail: toEmail.toLowerCase(),
      fromEmail: fromEmail.toLowerCase(),
    });

    if (threadDoc && threadDoc.threadId) {
      console.log("Found stored threadId:", threadDoc.threadId);

      // Verify the thread still exists in Gmail
      const verifyResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadDoc.threadId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (verifyResponse.ok) {
        console.log("Verified existing thread:", threadDoc.threadId);
        return threadDoc.threadId;
      } else {
        console.log("Stored thread no longer exists, will create new one");
        // Remove the invalid thread record
        await db.collection("email-threads").deleteOne({
          _id: threadDoc._id,
        });
      }
    }

    // If no stored thread or it's invalid, search Gmail for existing threads
    const query = `subject:"${subject}" to:${toEmail}`;
    const searchResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(
        query
      )}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();

      if (searchData.threads && searchData.threads.length > 0) {
        // Use the most recent thread
        const threadId = searchData.threads[0].id;
        console.log("Found existing Gmail thread:", threadId);

        // Store this threadId for future use
        await db.collection("email-threads").updateOne(
          {
            subject: subject,
            toEmail: toEmail.toLowerCase(),
            fromEmail: fromEmail.toLowerCase(),
          },
          {
            $set: {
              threadId: threadId,
              lastUsed: new Date(),
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );

        return threadId;
      }
    }

    // No existing thread found, will create a new one
    console.log("No existing thread found, will create new thread");
    return null;
  } catch (error) {
    console.error("Error managing thread ID:", error);
    return null;
  }
}

// Function to store thread ID after successful email send
async function storeThreadId(
  subject: string,
  toEmail: string,
  fromEmail: string,
  threadId: string
) {
  const { db } = await connectToDatabase();

  try {
    await db.collection("email-threads").updateOne(
      {
        subject: subject,
        toEmail: toEmail.toLowerCase(),
        fromEmail: fromEmail.toLowerCase(),
      },
      {
        $set: {
          threadId: threadId,
          lastUsed: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    console.log("Stored threadId for future use:", threadId);
  } catch (error) {
    console.error("Error storing thread ID:", error);
  }
}

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { fromEmail, toEmail, subject, message, threadId, isReply, orgID } =
      await request.json();
    if (!orgID) {
      return NextResponse.json({ error: "Missing orgID" }, { status: 400 });
    }

    // Validate required fields
    if (!fromEmail || !toEmail || !subject || !message) {
      console.error("[gm-send-email] Missing required fields: fromEmail, toEmail, subject, or message");
      return NextResponse.json(
        {
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fromEmail) || !emailRegex.test(toEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Get valid access token for this org + authenticated user
    const accessToken = await getValidAccessTokenForOrgUser(request, orgID);

    // Get or create thread ID for this subject-recipient combination
    let finalThreadId = threadId;
    if (!finalThreadId) {
      finalThreadId = await getOrCreateThreadId(
        accessToken,
        subject,
        toEmail,
        fromEmail
      );
    }

    // Create email message with proper MIME headers for HTML content
    const emailContent = [
      `From: ${fromEmail}`,
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "",
      message,
    ].join("\r\n");

    // Encode the email content
    const encodedEmail = Buffer.from(emailContent)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Prepare the request body
    const requestBody: any = {
      raw: encodedEmail,
    };

    // Include thread ID if available (either provided or found)
    if (finalThreadId) {
      requestBody.threadId = finalThreadId;
      console.log("Using thread ID:", finalThreadId);
    } else {
      console.log("No existing thread found, creating new thread");
    }

    console.log("Sending email with request body:", {
      hasThreadId: !!requestBody.threadId,
      threadId: finalThreadId,
      subject,
    });

    // Send email via Gmail API
    const gmailResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!gmailResponse.ok) {
      const errorData = await gmailResponse.text();
      console.error("Gmail API error:", {
        status: gmailResponse.status,
        statusText: gmailResponse.statusText,
        error: errorData,
        requestBody: requestBody,
      });

      // Handle specific error cases
      if (gmailResponse.status === 404) {
        throw new Error(
          "Thread not found. The original email may have been deleted or moved."
        );
      } else if (gmailResponse.status === 400) {
        throw new Error(
          "Invalid request. Please check the email format and try again."
        );
      } else {
        throw new Error(
          `Gmail API Error: ${gmailResponse.status} - ${errorData}`
        );
      }
    }

    const result = await gmailResponse.json();

    // Store the threadId for future use (whether it was provided or created)
    const actualThreadId = result.threadId || finalThreadId;
    if (actualThreadId) {
      await storeThreadId(subject, toEmail, fromEmail, actualThreadId);
    }

    // Log activity for emailing candidate
    try {
      const { db } = await connectToDatabase();
      
      // Try to find an interview for this candidate email
      const interview = await db.collection("interviews").findOne({
        email: toEmail.toLowerCase(),
        orgID,
      });

      if (interview) {
        // Fetch career for job information
        const career = await db.collection("careers").findOne({
          id: interview.id,
        });

        // Get member details for actor
        const member = await db.collection("members").findOne({
          email: fromEmail.toLowerCase(),
          orgID,
        });

        await logActivity({
          db,
          kind: "recruiter_emailed_candidate",
          interview,
          career,
          actor: {
            type: "recruiter",
            id: member?.uid || member?._id?.toString(),
            email: fromEmail,
            name: member?.name || fromEmail,
            image: member?.image || member?.photoURL,
          },
          extraMetadata: {
            emailSubject: subject,
          },
        });
      }
    } catch (logError) {
      console.error("Error logging email activity:", logError);
      // Don't fail the email send if logging fails
    }

    return NextResponse.json({
      success: true,
      data: {
        messageId: result.id,
        threadId: actualThreadId,
        sentAt: new Date().toISOString(),
      },
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Error in gm-send-email route:", error);

    return NextResponse.json(
      {
        error: "Failed to send email",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      { status: 500 }
    );
  }
});
