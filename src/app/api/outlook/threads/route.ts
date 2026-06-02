import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import backendAuthCheck from "@/lib/firebase/backendAuthCheck";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { toIdString } from "@/lib/utils/dataTransform";

/**
 * GET /api/outlook/threads
 * List Outlook threads for the org (threads created/sent from the app).
 * Efficient: threads only, optional messageCount; messages loaded per thread on expand.
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "25", 10) || 25, 100);

    if (!orgID) {
      return new NextResponse("Missing orgID", { status: 400 });
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
    const threadQuery: Record<string, unknown> = {
      organizationId: orgIdStr,
      mode: "outlook",
    };

    // Optional: only threads where current user is participant (threads I created/sent in app)
    const onlyMine = searchParams.get("onlyMine");
    if (onlyMine === "true" && emailSettings._id) {
      threadQuery.participants = emailSettings._id;
    }

    const threads = await db
      .collection("mailgun-threads")
      .find(threadQuery)
      .sort({ lastUpdated: -1 })
      .limit(limit)
      .toArray();

    const threadIds = threads.map((t: { _id: ObjectId }) => t._id);
    if (threadIds.length === 0) {
      return NextResponse.json({ threads: [] }, { status: 200 });
    }

    const messageCounts = await db
      .collection("mailgun-messages")
      .aggregate([
        { $match: { threadId: { $in: threadIds } } },
        { $group: { _id: "$threadId", count: { $sum: 1 } } },
      ])
      .toArray();

    const countByThreadId: Record<string, number> = {};
    for (const row of messageCounts) {
      const id = row._id instanceof ObjectId ? row._id.toString() : String(row._id);
      countByThreadId[id] = row.count;
    }

    const threadsWithCount = threads.map((t: { _id: ObjectId; threadId?: string; subject?: string; lastUpdated?: Date; createdAt?: Date }) => ({
      _id: t._id,
      threadId: t.threadId ?? t._id.toString(),
      subject: t.subject ?? "",
      lastUpdated: t.lastUpdated ?? t.createdAt ?? null,
      messageCount: countByThreadId[t._id.toString()] ?? 0,
    }));

    return NextResponse.json({ threads: threadsWithCount }, { status: 200 });
  } catch (err) {
    console.error("Outlook threads list error:", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
