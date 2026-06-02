import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

/**
 * Delete all drafts for the current organization.
 * POST body: { orgID: string }
 * Verifies the user is a member of that org, then deletes all mailgun-messages
 * that are drafts and belong to that org.
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const orgId = body?.orgID ?? body?.orgId ?? null;

    if (!orgId || typeof orgId !== "string" || !ObjectId.isValid(orgId)) {
      return NextResponse.json(
        { error: "Missing or invalid orgID" },
        { status: 400 },
      );
    }

    const { db } = await connectMongoDB();

    const userEmail = req.user?.email;
    if (!userEmail)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgObjectId = new ObjectId(orgId);

    const memberInOrg = await db.collection("members").findOne({
      email: userEmail,
      $or: [
        { orgID: orgId },
        { orgID: orgObjectId },
      ],
    });

    if (!memberInOrg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const draftMatch = {
      $and: [
        {
          $or: [
            { organizationId: orgObjectId },
            { organizationId: orgId },
            { orgID: orgId },
            { orgID: orgObjectId },
          ],
        },
        {
          $or: [
            { isDraft: true },
          ],
        },
      ],
    };

    const result = await db
      .collection("mailgun-messages")
      .deleteMany(draftMatch);

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("mg-delete-all-drafts error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});
