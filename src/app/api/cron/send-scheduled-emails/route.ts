import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import Mailgun from "mailgun.js";
import formData from "form-data";
import { decrypt, encrypt } from "@/lib/utils/cryptography";
import { ObjectId } from "mongodb";
import { toIdString } from "@/lib/utils/dataTransform";

/**
 * Send Scheduled Emails Cron Job API
 * 
 * Processes scheduled emails from the schedule-email collection.
 * Finds emails where sendDate has passed and status is "active",
 * sends them via the configured mode (mailgun/gmail), and updates status.
 * 
 * Should be triggered frequently (e.g., every minute) via Vercel cron.
 */
export async function GET() {
  try {
    const { db } = await connectMongoDB();
    const scheduleEmailCollection = db.collection("schedule-email");

    console.log("Starting scheduled email processing...");
    console.log(`Timestamp: ${new Date().toISOString()}`);

    const now = new Date();

    // Find all active scheduled emails where sendDate has passed
    const scheduledEmails = await scheduleEmailCollection
      .find({
        status: "active",
        sendDate: { $lte: now },
      })
      .toArray();

    console.log(`Found ${scheduledEmails.length} scheduled emails to process`);

    let successCount = 0;
    let errorCount = 0;
    const results: Array<{
      emailId: string;
      to: string;
      subject: string;
      status: "sent" | "failed";
      error?: string;
    }> = [];

    // Process each scheduled email
    for (const scheduledEmail of scheduledEmails) {
      try {
        const emailId = scheduledEmail._id.toString();
        const { to, subject, body, sender, mode } = scheduledEmail;

        // Validate required fields
        if (!to || !subject || !body) {
          console.error(`Email ${emailId} missing required fields:`, {
            hasTo: !!to,
            hasSubject: !!subject,
            hasBody: !!body,
          });

          await scheduleEmailCollection.updateOne(
            { _id: scheduledEmail._id },
            {
              $set: {
                status: "failed",
                error: "Missing required data",
                updatedAt: new Date(),
              },
            }
          );

          errorCount++;
          results.push({
            emailId,
            to: to || "unknown",
            subject: subject || "unknown",
            status: "failed",
            error: "Missing required fields",
          });
          continue;
        }

        console.log(`Processing scheduled email ${emailId} to ${to}`);

        if (mode === "mailgun") {
          // Send via Mailgun
          const mailgun = new Mailgun(formData);
          const mg = mailgun.client({
            username: "api",
            key: process.env.MAILGUN_API_KEY,
          });

          const messageData = {
            from: sender || "noreply@hellojia.ai",
            to: to,
            subject: subject,
            html: body,
          };

          const mailgunResponse = await mg.messages.create("hellojia.ai", messageData);

          // Update status to "sent"
          await scheduleEmailCollection.updateOne(
            { _id: scheduledEmail._id },
            {
              $set: {
                status: "sent",
                sentAt: new Date(),
                mailgunId: mailgunResponse.id,
                updatedAt: new Date(),
              },
            }
          );

          console.log(`Email ${emailId} sent successfully via Mailgun`);
          successCount++;
          results.push({
            emailId,
            to,
            subject,
            status: "sent",
          });
        } else if (mode === "gmail") {
          // Send via Gmail
          try {
            if (!scheduledEmail.userId) {
              throw new Error("User ID is required for Gmail sending");
            }

            const userId = scheduledEmail.userId;
            const orgID = scheduledEmail.orgID;

            // Get email settings for the user
            const emailSettings = await db.collection("email-settings").findOne({
              userID: toIdString(userId),
              orgID: orgID,
            });

            if (!emailSettings?.tokens) {
              throw new Error("Gmail tokens not found. Please reconnect Gmail account.");
            }

            // Decrypt and refresh tokens if needed
            const decrypted = decrypt(emailSettings.tokens);
            if (!decrypted) {
              throw new Error("Failed to decrypt Gmail tokens");
            }

            const tokens = JSON.parse(decrypted) as {
              access_token?: string;
              refresh_token?: string;
              expiry_date?: number;
            };

            if (!tokens.refresh_token) {
              throw new Error("Missing refresh token. Please reconnect Gmail.");
            }

            // Refresh token if expired
            let accessToken = tokens.access_token;
            const now = Date.now();
            const isExpired =
              !tokens.access_token ||
              !tokens.expiry_date ||
              now >= Number(tokens.expiry_date) - 60_000; // refresh 1 min early

            if (isExpired) {
              const clientId = process.env.GOOGLE_CLIENT_ID;
              const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

              if (!clientId || !clientSecret) {
                throw new Error("Google OAuth credentials not configured");
              }

              const refreshResponse = await fetch(
                "https://oauth2.googleapis.com/token",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    refresh_token: tokens.refresh_token,
                    grant_type: "refresh_token",
                  }),
                }
              );

              if (!refreshResponse.ok) {
                throw new Error("Failed to refresh access token");
              }

              const refreshData = await refreshResponse.json();
              accessToken = refreshData.access_token;

              // Update stored tokens
              const updatedTokens = {
                ...tokens,
                access_token: refreshData.access_token,
                expiry_date: Date.now() + (refreshData.expires_in * 1000),
              };

              await db.collection("email-settings").updateOne(
                { userID: toIdString(userId), orgID: orgID },
                { $set: { tokens: encrypt(JSON.stringify(updatedTokens)) } }
              );
            }

            // Create email message
            const emailContent = [
              `From: ${sender}`,
              `To: ${to}`,
              `Subject: ${subject}`,
              "MIME-Version: 1.0",
              "Content-Type: text/html; charset=UTF-8",
              "",
              body,
            ].join("\r\n");

            // Encode the email content
            const encodedEmail = Buffer.from(emailContent)
              .toString("base64")
              .replace(/\+/g, "-")
              .replace(/\//g, "_")
              .replace(/=+$/, "");

            // Send via Gmail API
            const gmailResponse = await fetch(
              "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  raw: encodedEmail,
                }),
              }
            );

            if (!gmailResponse.ok) {
              const errorData = await gmailResponse.text();
              throw new Error(`Gmail API Error: ${gmailResponse.status} - ${errorData}`);
            }

            const gmailResult = await gmailResponse.json();

            // Update status to "sent"
            await scheduleEmailCollection.updateOne(
              { _id: scheduledEmail._id },
              {
                $set: {
                  status: "sent",
                  sentAt: new Date(),
                  gmailMessageId: gmailResult.id || gmailResult.messageId,
                  updatedAt: new Date(),
                },
              }
            );

            console.log(`Email ${emailId} sent successfully via Gmail`);
            successCount++;
            results.push({
              emailId,
              to,
              subject,
              status: "sent",
            });
          } catch (error: any) {
            console.error(`Error sending Gmail email ${emailId}:`, error);

            // Update status to "failed"
            await scheduleEmailCollection.updateOne(
              { _id: scheduledEmail._id },
              {
                $set: {
                  status: "failed",
                  error: error?.message || "Gmail sending failed",
                  updatedAt: new Date(),
                },
              }
            );

            errorCount++;
            results.push({
              emailId,
              to,
              subject,
              status: "failed",
              error: error?.message || "Gmail sending failed",
            });
          }
        } else {
          // Unknown mode
          await scheduleEmailCollection.updateOne(
            { _id: scheduledEmail._id },
            {
              $set: {
                status: "failed",
                error: `Unknown email mode: ${mode}`,
                updatedAt: new Date(),
              },
            }
          );

          console.error(`Email ${emailId} failed: Unknown mode ${mode}`);
          errorCount++;
          results.push({
            emailId,
            to,
            subject,
            status: "failed",
            error: `Unknown email mode: ${mode}`,
          });
        }
      } catch (error: any) {
        const emailId = scheduledEmail._id.toString();
        console.error(`Error processing scheduled email ${emailId}:`, error);

        // Update status to "failed"
        await scheduleEmailCollection.updateOne(
          { _id: scheduledEmail._id },
          {
            $set: {
              status: "failed",
              error: error?.message || "Unknown error",
              updatedAt: new Date(),
            },
          }
        );

        errorCount++;
        results.push({
          emailId,
          to: scheduledEmail.to,
          subject: scheduledEmail.subject,
          status: "failed",
          error: error?.message || "Unknown error",
        });
      }
    }

    const summary = {
      message: "Scheduled email processing complete",
      timestamp: new Date().toISOString(),
      totalFound: scheduledEmails.length,
      successCount,
      errorCount,
      results,
    };

    console.log(`\nScheduled email processing complete:`);
    console.log(`  Total found: ${scheduledEmails.length}`);
    console.log(`  Success: ${successCount}`);
    console.log(`  Errors: ${errorCount}`);

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error("Scheduled email processing failed:", error);
    return NextResponse.json(
      {
        error: "Scheduled email processing failed",
        details: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
