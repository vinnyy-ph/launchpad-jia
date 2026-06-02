import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import backendAuthCheck from "@/lib/firebase/backendAuthCheck";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { toIdString } from "@/lib/utils/dataTransform";

/**
 * GET /api/outlook/threads/messages?threadId=...&orgID=...
 * Messages for one Outlook thread. Lazy-loaded when user expands a thread.
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
    const threadIdParam = searchParams.get("threadId");
    const orgID = searchParams.get("orgID");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 100);

    if (!threadIdParam || !orgID) {
      return new NextResponse("Missing threadId or orgID", { status: 400 });
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

    const orgIdStr = toIdString(orgID);
    let thread: { _id: ObjectId; threadId?: string; subject?: string } | null = null;

    if (ObjectId.isValid(threadIdParam)) {
      thread = await db.collection("mailgun-threads").findOne({
        _id: new ObjectId(threadIdParam),
        organizationId: orgIdStr,
        mode: "outlook",
      } as any);
    }
    if (!thread) {
      thread = await db.collection("mailgun-threads").findOne({
        threadId: threadIdParam,
        organizationId: orgIdStr,
        mode: "outlook",
      } as any);
    }

    if (!thread) {
      return new NextResponse("Thread not found", { status: 404 });
    }

    const messages = await db
      .collection("mailgun-messages")
      .find({ threadId: thread._id })
      .sort({ sentAt: 1, createdAt: 1 })
      .limit(limit)
      .toArray();

    return NextResponse.json(
      {
        thread: {
          _id: thread._id,
          threadId: thread.threadId ?? thread._id.toString(),
          subject: thread.subject ?? "",
        },
        messages,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Outlook thread messages error:", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
