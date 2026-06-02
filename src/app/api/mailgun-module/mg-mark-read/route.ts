import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const { threadId } = body || {};
    if (!threadId) {
      return NextResponse.json(
        { message: "Missing threadId" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    const user = req.user;
    if (!user || !user.uid) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Build filter supporting both ObjectId _id and string threadId
    const filter: any = ObjectId.isValid(String(threadId))
      ? { _id: new ObjectId(String(threadId)) }
      : { threadId: String(threadId) };

    const now = new Date().toISOString();

    // Update embedded readMap for the user
    const update: any = { $set: { [`readMap.${user.uid}`]: now } };
    await db.collection("mailgun-threads").updateOne(filter, update);

    // Also mark the most recent message in this thread as read for the user's email
    try {
      const userEmail = (user.email || "").toLowerCase();
      const msgFilter: any = ObjectId.isValid(String(threadId))
        ? {
            $or: [
              { threadId: new ObjectId(String(threadId)) },
              { threadId: String(threadId) },
            ],
          }
        : { threadId: String(threadId) };

      const latest = await db
        .collection("mailgun-messages")
        .find(msgFilter)
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray();

      if (latest && latest[0]) {
        await db
          .collection("mailgun-messages")
          .updateOne(
            { _id: latest[0]._id },
            { $addToSet: { readBy: userEmail } }
          );
      }
    } catch (innerErr) {
      console.error("mg-mark-read: failed updating message readBy", innerErr);
    }

    return NextResponse.json(
      { success: true, threadId, lastReadAt: now },
      { status: 200 }
    );
  } catch (err) {
    console.error("mg-mark-read error", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
});
