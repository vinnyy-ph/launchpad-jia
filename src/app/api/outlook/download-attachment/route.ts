import { NextRequest, NextResponse } from "next/server";
import backendAuthCheck from "@/lib/firebase/backendAuthCheck";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { toIdString } from "@/lib/utils/dataTransform";
import { decrypt, encrypt } from "@/lib/utils/cryptography";
import { refreshMicrosoftToken } from "@/lib/data/microsoftAuth";

/**
 * GET /api/outlook/download-attachment
 * Download an Outlook email attachment via Microsoft Graph.
 * Query: orgID, messageId (Graph message id), attachmentId, filename (optional)
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
    const messageId = searchParams.get("messageId");
    const attachmentId = searchParams.get("attachmentId");
    const filename = searchParams.get("filename") || "attachment";

    if (!orgID || !messageId || !attachmentId) {
      console.error("[outlook-download-attachment] Missing required data: orgID, messageId, or attachmentId");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    const member = await db.collection("members").findOne({
      orgID: toIdString(orgID),
      email: decodedToken.email,
    });

    if (!member) {
      return new NextResponse("User not found in organization", { status: 403 });
    }

    const emailSettings = await db.collection("email-settings").findOne({
      orgID: toIdString(orgID),
      userID: toIdString(member._id),
      outlookConnected: true,
    });

    if (!emailSettings || !emailSettings.outlookTokens) {
      return new NextResponse("Outlook not connected", { status: 404 });
    }

    let accessToken: string;
    try {
      const decryptedTokens = decrypt(emailSettings.outlookTokens);
      if (!decryptedTokens) throw new Error("Failed to decrypt tokens");
      const parsedTokens = JSON.parse(decryptedTokens);

      if (parsedTokens.expires_at && Date.now() > parsedTokens.expires_at) {
        const refreshed = await refreshMicrosoftToken(parsedTokens.refresh_token);
        parsedTokens.access_token = refreshed.access_token;
        parsedTokens.expires_at = Date.now() + refreshed.expires_in * 1000;
        await db.collection("email-settings").updateOne(
          { orgID: toIdString(orgID), userID: toIdString(member._id) },
          { $set: { outlookTokens: encrypt(JSON.stringify(parsedTokens)) } }
        );
      }

      accessToken = parsedTokens.access_token;
    } catch (err) {
      console.error("Outlook download-attachment: token error", err);
      return new NextResponse("Failed to retrieve credentials", { status: 500 });
    }

    const graphRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!graphRes.ok) {
      const errText = await graphRes.text();
      console.error("Graph attachment fetch failed:", graphRes.status, errText);
      return NextResponse.json(
        { error: "Failed to fetch attachment from Outlook" },
        { status: graphRes.status >= 400 ? graphRes.status : 500 }
      );
    }

    const attachment = await graphRes.json();
    const contentType = attachment.contentType || "application/octet-stream";
    const name = attachment.name || filename;

    // fileAttachment has contentBytes (base64)
    let buffer: Buffer;
    if (attachment.contentBytes) {
      buffer = Buffer.from(attachment.contentBytes, "base64");
    } else {
      // itemAttachment or other types may not have contentBytes
      return NextResponse.json(
        { error: "Attachment content not available (e.g. embedded item)" },
        { status: 400 }
      );
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    console.error("Outlook download-attachment error:", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
