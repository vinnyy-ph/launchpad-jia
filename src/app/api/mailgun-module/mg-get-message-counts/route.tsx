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
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    const userEmail = req.user?.email;
    if (!userEmail) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const orgObjectId = new ObjectId(orgId);

    // Verify membership
    const memberInOrg = await db.collection("members").findOne({
      email: userEmail,
      $or: [
        { orgID: orgId },
        { orgID: orgObjectId },
        { organizationId: orgId },
        { organizationId: orgObjectId },
      ],
    });

    if (!memberInOrg) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const userRole = memberInOrg.role || null;
    const isHiringManager = userRole === "hiring_manager";

    // Build base query for organization
    let messageQuery: any = { organizationId: orgObjectId };

    // If user is a hiring_manager, filter to only their own messages
    if (isHiringManager) {
      // Fetch all mailgun accounts for the organization
      const allAccounts = await db
        .collection("mailgun-accounts")
        .find({ organizationId: orgObjectId })
        .toArray();

      const userMailgunEmails: string[] = [];
      // Find accounts belonging to this user
      const userAccounts = allAccounts.filter((acc: any) => {
        if (!acc.userId) return false;
        return String(acc.userId) === String(memberInOrg._id);
      });
      // Extract email addresses
      for (const acc of userAccounts) {
        if (acc.email) {
          userMailgunEmails.push(String(acc.email).toLowerCase());
        }
      }
      // Also include the user's direct email as a fallback
      if (userEmail) {
        userMailgunEmails.push(String(userEmail).toLowerCase());
      }

      if (userMailgunEmails.length > 0) {
        // Build flat array of conditions: user is sender OR recipient
        const userEmailConditions: any[] = [];

        // User is the sender (from field matches user's email)
        for (const email of userMailgunEmails) {
          const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          userEmailConditions.push({
            from: { $regex: new RegExp(escapedEmail, "i") },
          });
        }

        // User is a recipient (to field contains user's email)
        for (const email of userMailgunEmails) {
          const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          userEmailConditions.push(
            { to: { $regex: new RegExp(escapedEmail, "i") } },
            { toRaw: { $regex: new RegExp(escapedEmail, "i") } },
            { toList: { $in: [email] } }
          );
        }

        // Also check recruiterId matches user's member _id (for outbound messages)
        userEmailConditions.push({ recruiterId: memberInOrg._id });

        // Combine: message must be in organization AND (user is sender OR recipient)
        messageQuery.$and = [
          { organizationId: orgObjectId },
          { $or: userEmailConditions },
        ];
      }
    }

    // Count total messages
    const totalCount = await db
      .collection("mailgun-messages")
      .countDocuments(messageQuery);

    // Count automated messages (isAutomated === true)
    const automatedQuery = {
      ...messageQuery,
      isAutomated: true,
    };
    const automatedCount = await db
      .collection("mailgun-messages")
      .countDocuments(automatedQuery);

    // Count direct messages (isAutomated !== true or isAutomated is null/undefined)
    const directQuery = {
      ...messageQuery,
      $or: [
        { isAutomated: { $ne: true } },
        { isAutomated: { $exists: false } },
        { isAutomated: null },
      ],
    };
    const directCount = await db
      .collection("mailgun-messages")
      .countDocuments(directQuery);

    return NextResponse.json({
      success: true,
      counts: {
        total: totalCount,
        automated: automatedCount,
        direct: directCount,
      },
    });
  } catch (error: any) {
    console.error("Failed to fetch message counts:", error);
    return NextResponse.json(
      { error: "Failed to fetch message counts", details: String(error) },
      { status: 500 }
    );
  }
});
