import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { getOAuth2Client } from "@/lib/data/google";
import { decrypt } from "@/lib/utils/cryptography";
import { google } from "googleapis";
import { ObjectId } from "mongodb";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("messageId");
    const attachmentId = searchParams.get("attachmentId");
    const filename = searchParams.get("filename");
    const orgID = searchParams.get("orgID");
    const userId = searchParams.get("userId");

    console.log("[Gmail Download] Params:", { messageId, attachmentId, filename, orgID, userId });

    if (!messageId || !attachmentId) {
      console.error("[Gmail Download] Missing messageId or attachmentId");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    if (!orgID || !userId) {
      console.error("[Gmail Download] Missing orgID or userId");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Get email settings for the user
    const emailSettingsCollection = db.collection("email-settings");
    console.log("[Gmail Download] Querying email settings with:", { userID: userId, orgID: orgID });
    
    // Build query to handle both string and ObjectId formats for orgID
    const orgIdObjectId = ObjectId.isValid(String(orgID)) ? new ObjectId(String(orgID)) : null;
    
    const emailSettingsQuery: any = {
      userID: userId, // Note: capital D in userID
    };
    
    if (orgIdObjectId) {
      emailSettingsQuery.$or = [
        { orgID: String(orgID) },
        { orgID: orgIdObjectId },
      ];
    } else {
      emailSettingsQuery.orgID = orgID;
    }

    console.log("[Gmail Download] Query:", JSON.stringify(emailSettingsQuery));
    
    const emailSettings = await emailSettingsCollection.findOne(emailSettingsQuery);

    console.log("[Gmail Download] Email settings found:", !!emailSettings);

    if (!emailSettings || !emailSettings.tokens) {
      console.error("[Gmail Download] No email settings or tokens found");
      return NextResponse.json(
        { error: "Gmail credentials not found" },
        { status: 404 }
      );
    }

    // Decrypt and parse tokens
    const decryptedTokens = decrypt(emailSettings.tokens);
    if (!decryptedTokens) {
      console.error("[Gmail Download] Failed to decrypt tokens");
      return NextResponse.json(
        { error: "Failed to decrypt Gmail tokens" },
        { status: 500 }
      );
    }

    console.log("[Gmail Download] Tokens decrypted successfully");
    const parsedTokens = JSON.parse(decryptedTokens);
    const oAuth2Client = getOAuth2Client();
    oAuth2Client.setCredentials({
      access_token: parsedTokens.access_token,
      refresh_token: parsedTokens.refresh_token,
    });

    // Check if token is expired and refresh if needed
    if (Date.now() > parsedTokens.expiry_date) {
      console.log("[Gmail Download] Token expired, refreshing...");
      try {
        const { credentials } = await oAuth2Client.refreshAccessToken();
        oAuth2Client.setCredentials(credentials);

        // Update email settings with new tokens
        const encryptedNewTokens = require("@/lib/utils/cryptography").encrypt(
          JSON.stringify(credentials)
        );
        await emailSettingsCollection.updateOne(
          { userID: userId, orgID: new ObjectId(orgID) },
          { $set: { tokens: encryptedNewTokens } }
        );
        console.log("[Gmail Download] Token refreshed successfully");
      } catch (refreshErr: any) {
        console.error("[Gmail Download] Failed to refresh Gmail token:", refreshErr);
        return NextResponse.json(
          { error: "Failed to refresh Gmail token" },
          { status: 401 }
        );
      }
    }

    // Download attachment from Gmail
    console.log("[Gmail Download] Fetching attachment from Gmail API...");
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    
    try {
      const messageResponse = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
      });
      console.log("[Gmail Download] Message fetched successfully");

      const response = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId: messageId,
        id: attachmentId,
      });
      console.log("[Gmail Download] Attachment fetched from Gmail API");

      const attachmentData = response.data.data;
      if (!attachmentData) {
        console.error("[Gmail Download] No attachment data in response");
        return NextResponse.json(
          { error: "Attachment data not found" },
          { status: 404 }
        );
      }

      // Get mimeType from message part headers
      const mimeType = messageResponse.data.payload?.parts?.find(
        (part: any) => part.body?.attachmentId === attachmentId
      )?.mimeType || "application/octet-stream";

      // Decode base64 attachment data
      const buffer = Buffer.from(attachmentData, "base64");

      console.log("[Gmail Download] Returning attachment, size:", buffer.length, "mimeType:", mimeType);

      // Return attachment with proper headers
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Length": buffer.length.toString(),
          "Content-Disposition": `attachment; filename="${filename || "attachment"}"`,
        },
      });
    } catch (gmailErr: any) {
      console.error("[Gmail Download] Gmail API error:", gmailErr.message);
      throw gmailErr;
    }
  } catch (error: any) {
    console.error("Error downloading Gmail attachment:", error);
    return NextResponse.json(
      { error: "Failed to download attachment" },
      { status: 500 }
    );
  }
}
