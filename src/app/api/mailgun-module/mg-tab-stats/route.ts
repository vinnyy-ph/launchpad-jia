import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

/**
 * Lightweight stats for a tab (Inbox/Sent/Drafts): total threads, total messages,
 * automated/direct counts, unread thread count. Uses same filters as mg-fetch-messages
 * (org, campaignId, tab, hiring_manager). No message bodies loaded.
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const url = new URL(req.url);
    const orgId =
      url.searchParams.get("orgId") || url.searchParams.get("orgID");
    const campaignId = url.searchParams.get("campaignId");
    const tab = url.searchParams.get("tab") || "";

    if (!orgId || !ObjectId.isValid(orgId)) {
      return NextResponse.json(
        { message: "Invalid or missing orgId" },
        { status: 400 },
      );
    }

    const { db } = await connectMongoDB();

    const userEmail = req.user?.email;
    if (!userEmail)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const orgObjectId = new ObjectId(orgId);

    const memberInOrg = await db.collection("members").findOne({
      email: userEmail,
      $or: [
        { orgID: orgId },
        { orgID: orgObjectId },
        { organizationId: orgId },
        { organizationId: orgObjectId },
      ],
    });
    if (!memberInOrg)
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const userRole = memberInOrg.role || null;
    const isHiringManager = userRole === "hiring_manager";
    const userUid = (req.user as any)?.uid ?? String(memberInOrg._id);
    const memberIdStr = String(memberInOrg._id);

    const allAccounts = await db
      .collection("mailgun-accounts")
      .find({ organizationId: orgObjectId })
      .toArray();

    const userMailgunEmails: string[] = [];
    if (isHiringManager) {
      const userAccounts = allAccounts.filter((acc: any) => {
        if (!acc.userId) return false;
        return String(acc.userId) === String(memberInOrg._id);
      });
      for (const acc of userAccounts) {
        if (acc.email) userMailgunEmails.push(String(acc.email).toLowerCase());
      }
      if (userEmail) userMailgunEmails.push(String(userEmail).toLowerCase());
    }

    let messageQuery: any = { organizationId: orgObjectId };
    if (campaignId) messageQuery.campaignId = campaignId;
    if (isHiringManager && userMailgunEmails.length > 0) {
      const userEmailConditions: any[] = [];
      for (const email of userMailgunEmails) {
        const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        userEmailConditions.push({
          from: { $regex: new RegExp(escaped, "i") },
        });
      }
      for (const email of userMailgunEmails) {
        const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        userEmailConditions.push(
          { to: { $regex: new RegExp(escaped, "i") } },
          { toRaw: { $regex: new RegExp(escaped, "i") } },
          { toList: { $in: [email] } },
        );
      }
      userEmailConditions.push({ recruiterId: memberInOrg._id });
      messageQuery.$and = [
        { organizationId: orgObjectId },
        { $or: userEmailConditions },
      ];
    }

    let tabFilter: any = {};
    if (tab === "Inbox") tabFilter = { direction: "inbound" };
    else if (tab === "Sent") tabFilter = { direction: "outbound" };
    else if (tab === "Drafts") {
      tabFilter = {
        $or: [
          { isDraft: true },
          { is_draft: true },
          { draft: true },
          { status: "draft" },
          { direction: "draft" },
        ],
      };
    }

    const threadIdMatch = {
      ...messageQuery,
      threadId: { $exists: true, $ne: null },
      ...tabFilter,
    };

    const coll = db.collection("mailgun-messages");
    const threadsColl = db.collection("mailgun-threads");

    const [threadCountRes, threadIdsList] = await Promise.all([
      coll
        .aggregate([
          { $match: threadIdMatch },
          { $group: { _id: "$threadId" } },
          { $count: "total" },
        ])
        .toArray(),
      coll
        .aggregate([
          { $match: threadIdMatch },
          { $group: { _id: "$threadId" } },
          { $limit: 50000 },
          { $project: { threadId: "$_id" } },
        ])
        .toArray(),
    ]);

    const totalThreadCount =
      threadCountRes.length > 0 && typeof threadCountRes[0].total === "number"
        ? threadCountRes[0].total
        : 0;

    const threadIdsRaw = threadIdsList.map((t: any) => t._id).filter(Boolean);
    const threadIdFilter =
      threadIdsRaw.length === 0
        ? { _id: { $in: [] } }
        : {
            threadId: {
              $in: threadIdsRaw.map((id: any) =>
                ObjectId.isValid(String(id)) ? new ObjectId(String(id)) : id,
              ),
            },
          };

    const messagesMatch = { ...messageQuery, ...threadIdFilter };

    const [totalMessageCount, automatedCount, directCount] = await Promise.all([
      threadIdsRaw.length === 0
        ? 0
        : coll.countDocuments(messagesMatch),
      threadIdsRaw.length === 0
        ? 0
        : coll.countDocuments({ ...messagesMatch, isAutomated: true }),
      threadIdsRaw.length === 0
        ? 0
        : coll.countDocuments({
            ...messagesMatch,
            $or: [
              { isAutomated: { $ne: true } },
              { isAutomated: { $exists: false } },
              { isAutomated: null },
            ],
          }),
    ]);

    let unreadThreadCount = 0;
    if (threadIdsRaw.length > 0 && tab === "Inbox") {
      const lastMsgPerThread = await coll
        .aggregate([
          { $match: threadIdMatch },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: "$threadId",
              lastMsg: { $first: "$$ROOT" },
            },
          },
          { $match: { "lastMsg.direction": "inbound" } },
          {
            $lookup: {
              from: "mailgun-threads",
              localField: "_id",
              foreignField: "_id",
              as: "thread",
            },
          },
          { $unwind: { path: "$thread", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              threadId: "$_id",
              lastCreated: "$lastMsg.createdAt",
              readBy: "$lastMsg.readBy",
              readMap: "$thread.readMap",
            },
          },
        ])
        .toArray();

      const userEmailLower = (userEmail || "").toLowerCase();
      for (const row of lastMsgPerThread) {
        const readMap = row.readMap || {};
        const readAt = readMap[userUid] || readMap[memberIdStr];
        const readAtTs = readAt ? new Date(readAt).getTime() : 0;
        const lastTs = row.lastCreated
          ? new Date(row.lastCreated).getTime()
          : 0;
        const readByList = Array.isArray(row.readBy)
          ? row.readBy.map((e: string) => String(e || "").toLowerCase())
          : [];
        const markedRead =
          (readAtTs > 0 && lastTs > 0 && readAtTs >= lastTs) ||
          readByList.includes(userEmailLower);
        if (!markedRead) unreadThreadCount += 1;
      }
    }

    return NextResponse.json(
      {
        totalThreadCount,
        totalMessageCount,
        automatedCount,
        directCount,
        unreadThreadCount,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("mg-tab-stats error", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
});
