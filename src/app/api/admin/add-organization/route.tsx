import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { sendEmail } from "@/lib/Email";
import { getInvitationEmailTemplate } from "@/lib/Utils";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { ObjectId } from "mongodb";
import { PlanHistoryEntry } from "@/lib/types/organization";

// Local implementation to avoid dependency on adminSeatValidation.ts
function isAdminRole(role: string): boolean {
  return role === "admin";
}

/**
 * Parse a date input and normalize it to UTC midnight (00:00:00).
 */
function parseUTCDate(dateInput: string | Date | null | undefined): Date | undefined {
  if (!dateInput) return undefined;
  
  const date = new Date(dateInput);
  // Return a new Date object set to UTC midnight
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0
  ));
}

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const {
    name,
    image,
    coverImage,
    description,
    status,
    organizationType = "enterprise", // Default to enterprise
    members,
    planId,
    planStartDate,
    planEndDate,
    premiumJobSlotAdjustment, // Only premium plans have job slot adjustments
    country,
    province,
    city,
    address,
    documents,
    lastEditedBy,
    createdBy,
    projectsEnabled,
    guestPortalEnabled,
    skipAdminSeatValidation,
    companySlug,
    companyDomains,
    brandedJobPortalSubdomain,
    brandedPortalEnabled,
    locations, // Array of { country, address, isHQ }
    globalHiringEnabled,
    linkedCareersEnabled,
  } = await request.json();

  const normalizedProjectsEnabled = !!projectsEnabled;
  const normalizedGuestPortalEnabled =
    typeof guestPortalEnabled === "boolean"
      ? guestPortalEnabled
      : normalizedProjectsEnabled;
  const normalizedBrandedPortalEnabled = !!brandedPortalEnabled;
  const normalizedGlobalHiringEnabled = !!globalHiringEnabled;
  const normalizedLinkedCareersEnabled = !!linkedCareersEnabled;

  // Map locations to organizationAddress
  const organizationAddress = Array.isArray(locations)
    ? locations.map((loc: any) => ({
      country: loc.country,
      location: loc.address,
      isMarkedHQ: loc.isHQ,
    }))
    : [];

  try {
    const { db } = await connectMongoDB();

    const existingOrganization = await db.collection("organizations").findOne({ name });
    if (existingOrganization) {
      return NextResponse.json({ message: "Organization already exists" }, { status: 400 });
    }

    // Fetch plan details if planId is provided to set initial credits
    let initialCredits = 0;
    let plan: any = null;
    if (planId) {
      plan = await db.collection("organization-plans").findOne({ _id: new ObjectId(planId) });
      if (plan && plan.schema === "credit-based") {
        initialCredits = plan.creditsPerMonth || 0;
      }
    }

    // Validate admin seat limit against plan before creating org (unless skipped by super admin)
    if (!skipAdminSeatValidation && members && Array.isArray(members)) {
      const adminCount = members.filter((m: any) => isAdminRole(m.role)).length;

      // Get admin seat limit from plan (if any)
      let maxAdminSeats: number | null = plan?.maxAdminSeats ?? 5; // Default to 5 if no plan

      // If limit is not null (not unlimited) and admin count exceeds limit
      if (maxAdminSeats !== null && adminCount > maxAdminSeats) {
        return NextResponse.json(
          {
            error: `Admin seat limit exceeded. The selected plan allows ${maxAdminSeats} admin seats, but you're trying to add ${adminCount} admins.`,
            code: "ADMIN_SEAT_LIMIT_EXCEEDED",
          },
          { status: 400 }
        );
      }
    }

    // Save organization with nested plan structure
    const orgData: Record<string, unknown> = {
      creator: createdBy?.email,
      name,
      description,
      status,
      tier: organizationType,
      country,
      province,
      city,
      address,
      companySlug,
      companyDomains,
      brandedJobPortalSubdomain,
      brandedPortalEnabled: normalizedBrandedPortalEnabled,
      createdAt: new Date(),
      updatedAt: new Date(),
      image,
      coverImage,
      documents,
      lastEditedBy,
      createdBy,
      projectsEnabled: normalizedProjectsEnabled,
      guestPortalEnabled: normalizedGuestPortalEnabled,
      globalHiringEnabled: normalizedGlobalHiringEnabled,
      linkedCareersEnabled: normalizedLinkedCareersEnabled,
      organizationAddress,
    };

    // Set nested plan structure based on plan schema
    if (plan && planId) {
      // Parse dates as pure UTC to prevent timezone contamination
      const startDate = planStartDate 
        ? parseUTCDate(planStartDate)! 
        : new Date(Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate(),
            0, 0, 0, 0
          ));
      const endDate = parseUTCDate(planEndDate);

      const actualNow = new Date();
      const BUFFER_MS = 14 * 60 * 60 * 1000;
      const isFuturePlan = startDate.getTime() > (actualNow.getTime() + BUFFER_MS);

      if (isFuturePlan) {
        // Future plan: Store in pending fields with creator info for history
        if (plan.schema === "credit-based") {
          orgData.pendingCreditBasedPlanId = planId;
          orgData.pendingCreditBasedPlanIdStartDate = startDate;
          orgData.pendingCreditBasedPlanIdEndDate = endDate;
          orgData.pendingCredits = initialCredits;
          // Store creator info for plan history when activated
          orgData.pendingCreditBasedPlanCreatedBy = createdBy?.name || createdBy?.email?.split("@")[0] || "Unknown User";
          orgData.pendingCreditBasedPlanCreatedByAvatar = createdBy?.image;
        } else if (plan.schema === "premium") {
          orgData.pendingPremiumPlanId = planId;
          orgData.pendingPremiumPlanIdStartDate = startDate;
          orgData.pendingPremiumPlanIdEndDate = endDate;
          // Store creator info for plan history when activated
          orgData.pendingPremiumPlanCreatedBy = createdBy?.name || createdBy?.email?.split("@")[0] || "Unknown User";
          orgData.pendingPremiumPlanCreatedByAvatar = createdBy?.image;
        }
      } else {
        // Current/Past plan: Activate immediately
        if (plan.schema === "credit-based") {
          orgData.creditBasedPlan = {
            planId,
            startDate,
            endDate,
            creditsRemaining: initialCredits,
          };
          // Initialize renewal info for active credit plans
          orgData.creditBalanceAtRenewal = initialCredits;
          const nextRenewal = new Date(startDate);
          nextRenewal.setMonth(nextRenewal.getMonth() + 1);
          orgData.nextRenewalDate = nextRenewal;
        } else if (plan.schema === "premium") {
          orgData.premiumPlan = {
            planId,
            startDate,
            endDate,
            jobSlotAdjustment: premiumJobSlotAdjustment || 0,
          };
        }
      }

      // Create plan history entry ONLY if not a future plan
      if (!isFuturePlan) {
        const appliedByName =
          createdBy?.name ||
          createdBy?.email?.split("@")[0] ||
          "Unknown User";

        const historyEntry: PlanHistoryEntry = {
          planId,
          planName: plan.name,
          schemaType: plan.schema,
          startDate,
          endDate: endDate || new Date(),
          action: "Applied Plan",
          appliedBy: appliedByName,
          appliedByAvatar: createdBy?.image,
          appliedAt: new Date(),
        };

        orgData.planHistory = [historyEntry];
      }
    }

    const organization = await db.collection("organizations").insertOne(orgData);

    // Validate unique emails
    const uniqueEmails = [...new Set(members.map((member: any) => member.email))];
    if (uniqueEmails.length !== members.length) {
      return NextResponse.json({ message: "Duplicate email addresses found" }, { status: 400 });
    }

    // Save members if any
    if (members && Array.isArray(members) && members.length > 0) {
      await db.collection("members").insertMany(members.map((member: any) => ({
        image: `https://api.dicebear.com/9.x/shapes/svg?seed=${member.email}`,
        name:
          member.email.split("@")[0].charAt(0).toUpperCase() +
          member.email.split("@")[0].slice(1),
        email: member.email,
        orgID: organization.insertedId.toString(),
        role: member.role,
        careers: [],
        addedAt: new Date(),
        lastLogin: null,
        status: "invited",
      })));

      // Send email to new members
      await Promise.all(members.map((member: any) => sendEmail({
        recipient: member.email,
        html: getInvitationEmailTemplate(member.email, name, member.role),
      })));
    }
    return NextResponse.json({ orgID: organization.insertedId.toString() });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Failed to add organization" }, { status: 500 });
  }
});