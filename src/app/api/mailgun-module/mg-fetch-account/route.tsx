import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const url = new URL(req.url);
    const orgId =
      url.searchParams.get("orgId") || url.searchParams.get("orgID");

    const { db } = await connectMongoDB();

    const userEmail = req.user?.email;
    if (!userEmail) {
      return NextResponse.json({ account: null }, { status: 200 });
    }

    // If orgId provided, prefer finding a member record for this email scoped to that org
    if (orgId && ObjectId.isValid(orgId)) {
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

      // If the logged-in email is not a member of the requested org, do NOT use a cross-org userId.
      if (!memberInOrg) {
        return NextResponse.json(
          { account: null, memberId: null, orgId: String(orgId) },
          { status: 200 }
        );
      }

      const account = await db.collection("mailgun-accounts").findOne({
        userId: memberInOrg._id,
        organizationId: orgObjectId,
      });

      const norm = account
        ? {
            _id: String(account._id),
            userId: account.userId ? String(account.userId) : null,
            organizationId: account.organizationId
              ? String(account.organizationId)
              : null,
            email: account.email,
            mailboxName: account.mailboxName,
            domain: account.domain,
            routeId: account.routeId || null,
            isActive: !!account.isActive,
          }
        : null;

      return NextResponse.json(
        {
          account: norm,
          memberId: String(memberInOrg._id),
          orgId: String(orgObjectId),
          memberImage: memberInOrg.image || null,
          role: memberInOrg.role || "hiring_manager",
        },
        { status: 200 }
      );
    }

    // Fallback: No orgId provided (or invalid)
    const memberAny = await db
      .collection("members")
      .findOne({ email: userEmail });
    if (!memberAny) {
      return NextResponse.json(
        { account: null, member: null },
        { status: 200 }
      );
    }

    const account = await db
      .collection("mailgun-accounts")
      .findOne({ userId: memberAny._id });
    const norm = account
      ? {
          _id: String(account._id),
          userId: account.userId ? String(account.userId) : null,
          organizationId: account.organizationId
            ? String(account.organizationId)
            : null,
          email: account.email,
          mailboxName: account.mailboxName,
          domain: account.domain,
          routeId: account.routeId || null,
          isActive: !!account.isActive,
        }
      : null;

    return NextResponse.json(
      {
        account: norm,
        memberId: String(memberAny._id),
        orgId: memberAny.orgID ? String(memberAny.orgID) : null,
        memberImage: memberAny.image || null,
        role: memberAny.role || "hiring_manager",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("mg-fetch-account error", err);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
});
