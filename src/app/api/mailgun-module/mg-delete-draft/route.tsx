import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const { draftId } = body || {};

    if (!draftId) {
      return NextResponse.json({ error: "Missing draftId" }, { status: 400 });
    }

    const { db } = await connectMongoDB();

    const userEmail = req.user?.email;
    if (!userEmail)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Find the draft document by object id or string id
    let query: any = { _id: String(draftId) };
    if (ObjectId.isValid(String(draftId)))
      query = { _id: new ObjectId(String(draftId)) };

    const draft = await db.collection("mailgun-messages").findOne(query);
    if (!draft)
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });

    // Ensure this is a draft
    if (!draft.isDraft && !draft.draft && draft.direction !== "draft") {
      return NextResponse.json({ error: "Not a draft" }, { status: 400 });
    }

    // Determine organization id of the draft (string form)
    const draftOrgId = draft.organizationId
      ? String(draft.organizationId)
      : draft.orgID || draft.orgId || null;

    // Try to validate that the requesting user belongs to the same org
    let memberInOrg = null;
    if (draftOrgId) {
      memberInOrg = await db.collection("members").findOne({
        email: userEmail,
        $or: [
          { orgID: draftOrgId },
          { orgID: new ObjectId(draftOrgId) },
          { organizationId: draftOrgId },
          { organizationId: new ObjectId(draftOrgId) },
        ],
      });
    }

    // If we couldn't verify membership by draft org, attempt to infer user's org and compare
    if (!memberInOrg) {
      const maybeMember = await db
        .collection("members")
        .findOne({ email: userEmail });
      if (maybeMember) {
        const userOrg = maybeMember.orgID || maybeMember.organizationId || null;
        if (userOrg && draftOrgId && String(userOrg) === String(draftOrgId)) {
          memberInOrg = maybeMember;
        }
      }
    }

    if (!memberInOrg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete the draft document
    await db.collection("mailgun-messages").deleteOne(query);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("mg-delete-draft error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
