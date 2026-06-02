import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { verifyUserIsAdmin } from "@/lib/utils/adminAuth";
import { ObjectId } from "mongodb";


// Local implementations to avoid dependency on adminSeatValidation.ts
interface AdminSeatValidationResult {
  valid: boolean;
  currentCount: number;
  limit: number | null;
  error?: string;
  code?: string;
}

function isAdminRole(role: string): boolean {
  return role === "admin";
}

async function countOrgAdmins(db: any, orgId: string): Promise<number> {
  return db.collection("members").countDocuments({
    orgID: orgId,
    role: "admin",
  });
}

async function getOrgAdminSeatLimit(
  db: any,
  organization: any
): Promise<{ limit: number | null }> {
  // Fetch credit-based plan if assigned (using nested structure)
  let creditBasedPlan: { maxAdminSeats?: number | null } | null = null;
  if (organization?.creditBasedPlan?.planId) {
    try {
      const plan = await db
        .collection("organization-plans")
        .findOne({ _id: new ObjectId(organization.creditBasedPlan.planId) });
      creditBasedPlan = plan as { maxAdminSeats?: number | null } | null;
    } catch {
      // Invalid ObjectId, ignore
    }
  }

  // Fetch premium plan if assigned (using nested structure)
  let premiumPlan: { maxAdminSeats?: number | null } | null = null;
  if (organization?.premiumPlan?.planId) {
    try {
      const plan = await db
        .collection("organization-plans")
        .findOne({ _id: new ObjectId(organization.premiumPlan.planId) });
      premiumPlan = plan as { maxAdminSeats?: number | null } | null;
    } catch {
      // Invalid ObjectId, ignore
    }
  }

  const creditBasedSeats = creditBasedPlan?.maxAdminSeats;
  const premiumSeats = premiumPlan?.maxAdminSeats;

  // Treat undefined and null as unlimited
  const creditIsUnlimited = creditBasedSeats === null || creditBasedSeats === undefined;
  const premiumIsUnlimited = premiumSeats === null || premiumSeats === undefined;

  let limit: number | null;

  // Both are unlimited
  if (creditIsUnlimited && premiumIsUnlimited) {
    limit = null;
  }
  // Only credit is unlimited, use premium limit
  else if (creditIsUnlimited && !premiumIsUnlimited) {
    limit = premiumSeats!;
  }
  // Only premium is unlimited, use credit limit
  else if (!creditIsUnlimited && premiumIsUnlimited) {
    limit = creditBasedSeats!;
  }
  // Both have limits, add them
  else {
    limit = (creditBasedSeats || 0) + (premiumSeats || 0);
  }

  return { limit };
}

async function validateAdminSeatLimit(
  db: any,
  orgId: string,
  additionalAdminCount: number,
  organization?: any | null
): Promise<AdminSeatValidationResult> {
  // Fetch organization if not provided
  let org = organization;
  if (!org) {
    try {
      const fetchedOrg = await db.collection("organizations").findOne({ _id: new ObjectId(orgId) });
      org = fetchedOrg as any | null;
    } catch {
      // Invalid ObjectId
      return {
        valid: false,
        currentCount: 0,
        limit: null,
        error: "Invalid organization ID",
        code: "INVALID_ORG_ID",
      };
    }
  }

  if (!org) {
    return {
      valid: false,
      currentCount: 0,
      limit: null,
      error: "Organization not found",
      code: "ORG_NOT_FOUND",
    };
  }

  // Get current admin count
  const currentCount = await countOrgAdmins(db, orgId);

  // Get admin seat limit
  const { limit } = await getOrgAdminSeatLimit(db, org);

  // If limit is null, seats are unlimited
  if (limit === null) {
    return {
      valid: true,
      currentCount,
      limit,
    };
  }

  // Check if adding new admins would exceed limit
  const projectedCount = currentCount + additionalAdminCount;

  if (projectedCount > limit) {
    return {
      valid: false,
      currentCount,
      limit,
      error: `Admin seat limit exceeded. Your plan allows ${limit} admin seats, and you currently have ${currentCount}.`,
      code: "ADMIN_SEAT_LIMIT_EXCEEDED",
    };
  }

  return {
    valid: true,
    currentCount,
    limit,
  };
}


export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { email, orgID, role, careers } = await request.json();

    // Validate required fields
    if (!email || !orgID || !role) {
      console.error("[update-member] Missing required data: email, orgID, or role");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Security Check: Verify if the requester is an admin
    const requesterEmail = request.user.email;
    if (!requesterEmail) {
      return NextResponse.json(
        { error: "User email not found in token" },
        { status: 401 }
      );
    }

    const authResult = await verifyUserIsAdmin(db, requesterEmail, orgID);
    if (!authResult.authorized) {
      return NextResponse.json(
        { error: authResult.reason },
        { status: 403 }
      );
    }

    // Check if member exists
    const member = await db.collection("members").findOne({ email, orgID });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Fetch organization to check projectsEnabled flag
    const org = await db
      .collection("organizations")
      .findOne({ _id: new ObjectId(orgID) });

    const guestPortalEnabledEffective =
      typeof org?.guestPortalEnabled === "boolean"
        ? org.guestPortalEnabled
        : !!org?.projectsEnabled;

    // Check if organization has an active plan
    const now = new Date();
    const BUFFER_MS = 14 * 60 * 60 * 1000;
    const nowWithBuffer = new Date(now.getTime() + BUFFER_MS);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const creditBasedPlan = org?.creditBasedPlan;
    const premiumPlan = org?.premiumPlan;

    const isCreditActive =
      creditBasedPlan?.planId &&
      creditBasedPlan.startDate &&
      new Date(creditBasedPlan.startDate) <= nowWithBuffer &&
      (!creditBasedPlan.endDate || new Date(creditBasedPlan.endDate) >= todayStart);

    const isPremiumActive =
      premiumPlan?.planId &&
      premiumPlan.startDate &&
      new Date(premiumPlan.startDate) <= nowWithBuffer &&
      (!premiumPlan.endDate || new Date(premiumPlan.endDate) >= todayStart);

    if (!isCreditActive && !isPremiumActive) {
      return NextResponse.json(
        { error: "This organization does not have an active plan." },
        { status: 403 }
      );
    }

    // When Guest Portal is disabled, prevent changing role TO guest, but allow
    // existing guest members to be saved without changing their role.
    if (
      role === "guest" &&
      !guestPortalEnabledEffective &&
      member.role !== "guest"
    ) {
      return NextResponse.json(
        {
          error:
            "Guest role is only available when Guest Portal is enabled for this organization.",
          code: "GUEST_ROLE_REQUIRES_PROJECTS_ENABLED",
        },
        { status: 422 }
      );
    }

    // Enforce admin seat limit for admin/super_admin roles
    if (isAdminRole(role)) {
      // Check if member already exists with an admin role
      const wasAdmin = member.role === "admin";

      // Only validate if this is a change from non-admin to admin
      if (!wasAdmin) {
        const validation = await validateAdminSeatLimit(db, orgID, 1, org);
        if (!validation.valid) {
          return NextResponse.json(
            {
              error: validation.error,
              code: validation.code,
            },
            { status: 400 }
          );
        }
      }
    }

    // Prepare update data
    const updateData: any = {
      role,
      updatedAt: new Date(),
    };

    // Only include careers if role is hiring_manager
    if (role === "hiring_manager" && careers) {
      updateData.careers = careers;
    } else {
      updateData.careers = [];
    }

    // Update member
    await db
      .collection("members")
      .updateOne({ email, orgID }, { $set: updateData });

    return NextResponse.json(
      { message: "Member updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 }
    );
  }
});
