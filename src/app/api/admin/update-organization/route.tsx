import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { getInvitationEmailTemplate } from "@/lib/Utils";
import { sendEmail } from "@/lib/Email";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { PlanHistoryEntry } from "@/lib/types/organization";
import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";

// Local implementations to avoid dependency on adminSeatValidation.ts
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


async function getOrgAdminSeatLimit(
  db: any,
  organization: any
): Promise<{ limit: number | null }> {
  // Fetch credit-based plan if assigned using nested structure
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

  // Fetch premium plan if assigned using nested structure
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


export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { orgID, update, members, planChange, skipAdminSeatValidation, replaceFiles } = await request.json();
  if (!orgID) {
    return NextResponse.json({ error: "Organization ID and status are required" }, { status: 400 });
  }

  try {
    const { db } = await connectMongoDB();
    const organization = await db.collection("organizations").findOne({ _id: new ObjectId(orgID) });
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (
      update &&
      typeof update.projectsEnabled === "boolean" &&
      typeof update.guestPortalEnabled !== "boolean"
    ) {
      update.guestPortalEnabled = update.projectsEnabled;
    }

    if (planChange) {
      const { planId, startDate, endDate, action, appliedBy } = planChange;

      if (planId) {
        const plan = await db.collection("organization-plans").findOne({ _id: new ObjectId(planId) });
        if (!plan) {
          return NextResponse.json({ error: "Plan not found" }, { status: 404 });
        }

        const appliedByEmail = (appliedBy as string | undefined) || request.user?.email || "unknown";
        const appliedByProfile = appliedByEmail && appliedByEmail !== "unknown"
          ? await db.collection("members").findOne({ email: appliedByEmail })
          : null;

        const appliedByName =
          appliedByProfile?.name ||
          (appliedBy && !appliedBy.toString().includes("@") ? appliedBy : undefined) ||
          (request.user as any)?.name ||
          (request.user as any)?.display_name ||
          (request.user as any)?.displayName ||
          appliedByEmail.split("@")[0] ||
          "Unknown User";

        const appliedByAvatar =
          appliedByProfile?.image ||
          (request.user as any)?.picture ||
          (request.user as any)?.photo_url ||
          (request.user as any)?.photoURL ||
          undefined;

        // Check if this is a future-dated plan assignment
        const now = new Date();
        const BUFFER_MS = 14 * 60 * 60 * 1000;
        // Parse dates as pure UTC to prevent timezone contamination
        const start = startDate 
          ? parseUTCDate(startDate)!
          : new Date(Date.UTC(
              new Date().getUTCFullYear(),
              new Date().getUTCMonth(),
              new Date().getUTCDate(),
              0, 0, 0, 0
            ));
        const end = parseUTCDate(endDate);
        const isFuturePlan = start.getTime() > (now.getTime() + BUFFER_MS);

        const historyEntry: PlanHistoryEntry = {
          planId,
          planName: plan.name,
          schemaType: plan.schema || "credit-based",
          startDate: start,
          endDate: end || new Date(),
          action: (action === "schedule_edited" ? "Edited Plan Schedule" : "Applied Plan"),
          appliedBy: appliedByName,
          appliedByAvatar,
          appliedAt: new Date(),
        };

        // Set plan fields based on plan schema using nested structure
        if (plan.schema === "credit-based") {
          update.creditBasedPlan = {
            planId,
            startDate: historyEntry.startDate,
            endDate: historyEntry.endDate,
            creditsRemaining: action === "applied" ? (plan.creditsPerMonth || 0) : (organization.creditBasedPlan?.creditsRemaining || 0),
          };
        } else if (plan.schema === "premium") {
          update.premiumPlan = {
            planId,
            startDate: historyEntry.startDate,
            endDate: historyEntry.endDate,
            jobSlotAdjustment: organization.premiumPlan?.jobSlotAdjustment || 0,
          };
        }

        // Set initial credits for credit-based plans
        if (plan.schema === "credit-based" && action === "applied") {
          update.creditBalanceAtRenewal = plan.creditsPerMonth || 0;

          // Calculate next renewal date (1 month from start)
          const nextRenewal = new Date(historyEntry.startDate);
          nextRenewal.setMonth(nextRenewal.getMonth() + 1);
          update.nextRenewalDate = nextRenewal;
        }

        // Add to plan history ONLY if plan is not starting in the future
        if (!isFuturePlan) {
          await db.collection("organizations").updateOne(
            { _id: new ObjectId(orgID) },
            { $push: { planHistory: historyEntry } } as any
          );
        }
      }
    }

    if (members) {
      // Check if organization has an active plan
      const now = new Date();
      const BUFFER_MS = 14 * 60 * 60 * 1000;
      const nowWithBuffer = new Date(now.getTime() + BUFFER_MS);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const creditBasedPlan = organization.creditBasedPlan;
      const premiumPlan = organization.premiumPlan;

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
          {
            error: "This organization does not have an active plan.",
          },
          { status: 403 }
        );
      }

      // Validate unique emails
      const uniqueEmails = [...new Set(members.map((member: any) => member.email))];
      if (uniqueEmails.length !== members.length) {
        return NextResponse.json({ message: "Duplicate email addresses found" }, { status: 400 });
      }

      const existingMembers = await db.collection("members").find({ orgID: orgID }).toArray();
      const emails = members.map((m: any) => m.email);

      // Calculate the projected admin count after all changes
      // Count admins in the new members list
      const projectedAdminCount = members.filter((m: any) => m.role === "admin").length;

      // Get current admin count from existing members
      const currentAdminCount = existingMembers.filter((m) => m.role === "admin").length;

      // Validate admin seat limit (unless explicitly skipped by super admin)
      if (!skipAdminSeatValidation) {
        // Get admin seat limit using nested plan structure
        const { limit } = await getOrgAdminSeatLimit(db, organization as { premiumPlan?: { planId?: string }; creditBasedPlan?: { planId?: string } });

        // If limit is not null (not unlimited) and projected count exceeds limit
        if (limit !== null && projectedAdminCount > limit) {
          return NextResponse.json(
            {
              error: `Admin seat limit exceeded. Your plan allows ${limit} admin seats, but you're trying to have ${projectedAdminCount}.`,
              code: "ADMIN_SEAT_LIMIT_EXCEEDED"
            },
            { status: 400 }
          );
        }
      }

      // Removed members
      const removedMembers = existingMembers.filter((m) => !emails.includes(m.email));
      if (removedMembers?.length > 0) {
        await db.collection("members").deleteMany({ _id: { $in: removedMembers.map((m) => m._id) } })
      }
      // New members
      const existingEmails = existingMembers.map((m) => m.email);
      const newMembers = members.filter((m: any) => !existingEmails.includes(m.email));
      if (newMembers?.length > 0) {
        await db.collection("members").insertMany(newMembers.map((member: any) => ({
          image: `https://api.dicebear.com/9.x/shapes/svg?seed=${member.email}`,
          name:
            member.email.split("@")[0].charAt(0).toUpperCase() +
            member.email.split("@")[0].slice(1),
          email: member.email,
          orgID: organization._id.toString(),
          role: member.role,
          careers: [],
          addedAt: new Date(),
          lastLogin: null,
          status: "invited",
        })));

        // Send email to new members
        await Promise.all(newMembers.map((member: any) => sendEmail({
          recipient: member.email,
          html: getInvitationEmailTemplate(member.email, organization.name, member.role),
        })));
      }
      // Updated members
      const updatedMembers = existingMembers.filter((m) => emails.includes(m.email));
      if (updatedMembers?.length > 0) {
        await db.collection("members").bulkWrite(updatedMembers.map((m) => {
          const updatedMember = members.find((member: any) => member.email === m.email);
          return {
            updateOne: {
              filter: { _id: m._id },
              update: { $set: { role: updatedMember.role } }
            }
          }
        }));
      }
    }

    if (replaceFiles) {
      const filesToDelete = [];
      if (replaceFiles.includes(organization.image) && organization.image?.includes("https://cdn.hellojia.ai/")) {
        filesToDelete.push(organization.image.split("https://cdn.hellojia.ai/")?.[1]);
      }
  
      if (replaceFiles.includes(organization.coverImage) && organization.coverImage?.includes("https://cdn.hellojia.ai/")) {
        filesToDelete.push(organization.coverImage.split("https://cdn.hellojia.ai/")?.[1]);
      }

      for (const document of organization.documents) {
        if (replaceFiles.includes(document.filePath) && document.filePath) {
          filesToDelete.push(document.filePath);
        }
      }
      await deleteFilesFromR2(filesToDelete);
    }


    await db.collection("organizations").updateOne({ _id: new ObjectId(orgID) }, { $set: { ...update, updatedAt: new Date(), } });
    return NextResponse.json({ message: "Organization status updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json({ error: "Error updating organization" }, { status: 500 });
  }
});

const deleteFilesFromR2 = async (files: string[]) => {
  if (files.length === 0) return;
  try {
    const s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    const command = new DeleteObjectsCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Delete: {
        Objects: files.map((file) => ({ Key: file })),
      },
    });
    await s3Client.send(command);
  } catch (error) {
    console.error("Error deleting files from R2:", error);
  }
}