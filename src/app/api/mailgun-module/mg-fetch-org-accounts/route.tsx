import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const url = new URL(req.url);
    const orgId =
      url.searchParams.get("orgId") || url.searchParams.get("orgID");

    if (!orgId || !ObjectId.isValid(orgId)) {
      return NextResponse.json(
        { message: "Invalid or missing orgId" },
        { status: 400 },
      );
    }

    const { db } = await connectMongoDB();

    const userEmail = req.user?.email;
    if (!userEmail) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const orgObjectId = new ObjectId(orgId);

    // Find member in org to check role (admin)
    const memberInOrg = await db.collection("members").findOne({
      email: userEmail,
      $or: [
        { orgID: orgId },
        { orgID: orgObjectId },
        { organizationId: orgId },
        { organizationId: orgObjectId },
      ],
    });

    // User must be a member of the org to fetch any accounts
    if (!memberInOrg) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Org admins get all org Mailgun accounts; hiring managers get only their own
    const isOrgAdmin =
      memberInOrg.role === "admin" || memberInOrg.role === "super_admin";
    const memberId = memberInOrg._id;

    const query: Record<string, unknown> = {
      organizationId: orgObjectId,
      isActive: true,
    };
    if (!isOrgAdmin) {
      // Hiring manager (or other non-admin member): only their accounts
      query.userId = memberId;
    }

    const accounts = await db
      .collection("mailgun-accounts")
      .find(query)
      .toArray();

    // Fetch organization to get display name
    const orgDoc = await db
      .collection("organizations")
      .findOne({ _id: orgObjectId }, { projection: { name: 1 } });

    // Fetch member images and names for each account based on userId
    const memberImagesByUserId: Record<string, string | null> = {};
    const memberNamesByUserId: Record<string, string | null> = {};
    for (const account of accounts) {
      if (account.userId && ObjectId.isValid(String(account.userId))) {
        try {
          const userId = ObjectId.isValid(account.userId)
            ? new ObjectId(account.userId)
            : account.userId;
          const member = await db.collection("members").findOne({
            _id: userId,
          });
          if (member) {
            if (member.image) {
              memberImagesByUserId[String(account.userId)] = member.image;
            }
            if (member.name) {
              memberNamesByUserId[String(account.userId)] = member.name;
            }
          }
        } catch (e) {
          // Ignore errors in fetching individual member images
        }
      }
    }

    const norm = accounts.map((a: any) => ({
      _id: String(a._id),
      userId: a.userId ? String(a.userId) : null,
      organizationId: a.organizationId ? String(a.organizationId) : null,
      email: a.email,
      mailboxName: a.mailboxName,
      domain: a.domain,
      routeId: a.routeId || null,
      isActive: !!a.isActive,
      image: a.userId ? memberImagesByUserId[String(a.userId)] || null : null,
      displayName: a.userId
        ? memberNamesByUserId[String(a.userId)] || null
        : null,
    }));

    return NextResponse.json(
      { accounts: norm, orgName: orgDoc?.name || null },
      { status: 200 },
    );
  } catch (err) {
    console.error("mg-fetch-org-accounts error", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
});
