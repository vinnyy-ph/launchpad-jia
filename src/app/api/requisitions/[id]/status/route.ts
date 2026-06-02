import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import {
  RequisitionStatus,
  guardStatusUpdate,
  createAuthError,
  sanitizeStatusUpdatePayload,
  isValidObjectId,
} from "@/lib/utils/requisitionAuthGuard";
import { guid } from "@/lib/Utils";
import { sanitizeString } from "@/lib/utils/sanitizeInput";
import { sendEmail } from "@/lib/Email";
import { triggerRequisitionNotification } from '@/lib/utils/notificationTriggers';

function getCareerPublishMissingFields(career: any): string[] {
  const missing: string[] = [];

  const jobTitle = typeof career?.jobTitle === "string" ? career.jobTitle.trim() : "";
  const description = typeof career?.description === "string" ? career.description.trim() : "";
  const workSetup = typeof career?.workSetup === "string" ? career.workSetup.trim() : "";
  const location = typeof career?.location === "string" ? career.location.trim() : "";

  if (!jobTitle) missing.push("Job title");
  if (!description) missing.push("Description");
  if (!workSetup) missing.push("Work setup");
  if (!location) missing.push("Location");

  const questions = career?.questions;
  let totalQuestions = 0;
  if (Array.isArray(questions)) {
    for (const q of questions) {
      if (Array.isArray((q as any)?.questions)) {
        totalQuestions += (q as any).questions.length;
      } else {
        totalQuestions += 1;
      }
    }
  }
  if (totalQuestions < 5) missing.push("Interview questions (minimum 5)");

  return missing;
}

// Helper function to format relative time from a date
function formatRelativeDate(date: Date | string | undefined): string {
  if (!date) return "Unknown";
  
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Unknown";
  
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// PATCH /api/requisitions/[id]/status - Update requisition status
export const PATCH = withAuth(async (
  req: AuthenticatedRequest,
  context: any
) => {
  try {
    const { db } = await connectMongoDB();
    const params = await context.params;
    const { id } = params;
    const body = await req.json();

    // SECURITY: Validate ObjectId format (prevents injection via ID)
    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, message: "Invalid requisition ID format" },
        { status: 400 }
      );
    }

    // SECURITY: Sanitize and validate input payload
    const sanitizationResult = sanitizeStatusUpdatePayload(body);
    if (!sanitizationResult.valid) {
      return NextResponse.json(
        { success: false, message: sanitizationResult.error },
        { status: 400 }
      );
    }

    const { status, metadata } = sanitizationResult.sanitized;

    // Validate status value
    const validStatuses: RequisitionStatus[] = [
      "In Review",
      "Requires More Info",
      "Active",
      "On Hold",
      "Cancelled",
      "Request to Cancel",
    ];

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: "Invalid status value" },
        { status: 400 }
      );
    }

    // Fetch existing requisition
    const existingRequisition = await db
      .collection("requisitions")
      .findOne({ _id: new ObjectId(id) });

    if (!existingRequisition) {
      return NextResponse.json(
        { success: false, message: "Requisition not found" },
        { status: 404 }
      );
    }

    // FEATURE GATE: Block updates when Guest Portal/Requisitions are disabled for the org
    const requisitionOrgId = (existingRequisition as any)?.orgID as string | undefined;
    if (!requisitionOrgId || !isValidObjectId(requisitionOrgId)) {
      return NextResponse.json(
        { success: false, message: "Invalid organization ID on requisition" },
        { status: 400 }
      );
    }
    const org = await db
      .collection("organizations")
      .findOne({ _id: new ObjectId(requisitionOrgId) });
    if (!org) {
      return NextResponse.json(
        { success: false, message: "Organization not found" },
        { status: 404 }
      );
    }
    const guestPortalEnabledEffective =
      typeof (org as any)?.guestPortalEnabled === "boolean"
        ? Boolean((org as any).guestPortalEnabled)
        : Boolean((org as any)?.projectsEnabled);
    if (!guestPortalEnabledEffective) {
      return NextResponse.json(
        { success: false, message: "Requisitions are disabled for this organization" },
        { status: 403 }
      );
    }

    // SECURITY: Validate org membership and role-based status transition
    const authResult = await guardStatusUpdate(db, req.user, existingRequisition, status);
    if (!authResult.authorized) {
      const error = createAuthError(authResult);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }

    const approverMember = authResult.member;
    const currentStatus = existingRequisition.status as RequisitionStatus;

    const isApprovalHold =
      currentStatus === "On Hold" &&
      Boolean((existingRequisition as any).approvalCareerId);

    if (isApprovalHold) {
      const isCareerPublishActivation =
        status === "Active" && metadata?.triggeredBy === "career_publish";

      const isCancelRequisition =
        status === "Cancelled" && metadata?.triggeredBy === "requisition_cancel";

      if (!isCareerPublishActivation && !isCancelRequisition) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This requisition is on hold pending career publishing and cannot be updated from this page.",
          },
          { status: 400 }
        );
      }
    }

    if (
      currentStatus === "On Hold" &&
      status === "Active" &&
      metadata?.triggeredBy === "career_publish"
    ) {
      const linkedCareer = await db
        .collection("careers")
        .findOne({ requisitionId: id });

      if (!linkedCareer) {
        // No linked career exists - this requisition was put on hold before approval.
        // Return a specific code so frontend can show appropriate modal.
        const previousStatus = (existingRequisition as any).previousStatus as RequisitionStatus | undefined;
        return NextResponse.json(
          {
            success: false,
            code: "NO_CAREER_LINKED",
            message: "This requisition has not been approved yet. Please approve it first to create a career draft.",
            previousStatus: previousStatus || "In Review",
          },
          { status: 409 }
        );
      }

      const missingFields = getCareerPublishMissingFields(linkedCareer);
      if (missingFields.length > 0) {
        return NextResponse.json(
          {
            success: false,
            code: "CAREER_INCOMPLETE",
            message:
              "Career draft is incomplete. Please complete the career draft before making this requisition Active.",
            careerId: linkedCareer.id || null,
            missingFields,
          },
          { status: 409 }
        );
      }

      await db.collection("careers").updateOne(
        { _id: linkedCareer._id },
        {
          $set: {
            status: "active",
            updatedAt: new Date(),
          },
        }
      );
    }

    // Build update document
    const updateDoc: any = {
      $set: {
        status,
        updatedAt: new Date(),
      },
    };

    // Track previous status when moving into On Hold so we can resume later
    if (status === "On Hold" && metadata?.triggeredBy !== "decline_cancel_request") {
      updateDoc.$set.previousStatus = currentStatus;
    } else if (currentStatus === "On Hold" && (existingRequisition as any).previousStatus) {
      // Clear previousStatus when leaving On Hold
      if (!updateDoc.$unset) {
        updateDoc.$unset = {};
      }
      updateDoc.$unset.previousStatus = "";
    }

    // Track status before a cancel request so recruiters/admins can decline and revert.
    // This is separate from previousStatus (which is used for On Hold resume flows).
    if (status === "Request to Cancel") {
      updateDoc.$set.cancelRequestPreviousStatus = currentStatus;
    } else if (
      currentStatus === "Request to Cancel" &&
      (existingRequisition as any).cancelRequestPreviousStatus
    ) {
      if (!updateDoc.$unset) {
        updateDoc.$unset = {};
      }
      updateDoc.$unset.cancelRequestPreviousStatus = "";
    }

    if (
      currentStatus === "On Hold" &&
      status !== "On Hold" &&
      (existingRequisition as any).approvalCareerId
    ) {
      if (!updateDoc.$unset) {
        updateDoc.$unset = {};
      }
      updateDoc.$unset.approvalCareerId = "";
    }

    // If resuming from On Hold via "Make Active", restore the previous status instead of forcing Active
    if (
      currentStatus === "On Hold" &&
      status === "Active" &&
      (existingRequisition as any).previousStatus &&
      metadata?.triggeredBy !== "career_publish"
    ) {
      updateDoc.$set.status = (existingRequisition as any).previousStatus as RequisitionStatus;
    }

    // Handle status-specific metadata
    if (status === "Requires More Info" && metadata?.moreInfoReason) {
      updateDoc.$set.moreInfoReason = metadata.moreInfoReason;
      updateDoc.$set.moreInfoBy = metadata.moreInfoBy || approverMember?.name || req.user?.name || "Admin";

      // Persist approver email & avatar so Guest Portal can render Google-style avatar
      const approverEmail = approverMember?.email || req.user?.email || "";
      if (approverEmail) {
        updateDoc.$set.moreInfoByEmail = approverEmail;
      }

      const memberImage = (approverMember as any)?.image as string | undefined;
      const userImage = (req.user as any)?.image || (req.user as any)?.picture;
      const resolvedAvatar =
        memberImage ||
        userImage ||
        (approverEmail
          ? `https://api.dicebear.com/9.x/shapes/svg?seed=${approverEmail}`
          : undefined);

      if (resolvedAvatar) {
        updateDoc.$set.moreInfoByAvatar = resolvedAvatar;
      }
    } else if (status !== "Requires More Info") {
      // Clear moreInfo fields if status is not "Requires More Info"
      if (!updateDoc.$unset) {
        updateDoc.$unset = {};
      }
      updateDoc.$unset.moreInfoReason = "";
      updateDoc.$unset.moreInfoBy = "";
      updateDoc.$unset.moreInfoByEmail = "";
      updateDoc.$unset.moreInfoByAvatar = "";
    }

    if (
      (status === "Request to Cancel" || status === "Cancelled") &&
      metadata?.cancelReason
    ) {
      updateDoc.$set.cancelReason = metadata.cancelReason;
    } else if (status !== "Request to Cancel" && status !== "Cancelled") {
      // Clear cancelReason if status is not cancel-related
      if (!updateDoc.$unset) {
        updateDoc.$unset = {};
      }
      updateDoc.$unset.cancelReason = "";
    }

    // If moving from "In Review" to "Active", automatically create a draft career
    let createdCareerId: string | null = null;
    if (status === "Active" && existingRequisition.status === "In Review") {
      try {
        createdCareerId = await createDraftCareerFromRequisition(
          db,
          existingRequisition,
          req.user
        );
      } catch (error: any) {
        console.error("Error creating draft career from requisition:", error);
        return NextResponse.json(
          {
            success: false,
            message: "Failed to create career from requisition",
          },
          { status: 500 }
        );
      }
    }

    if (
      existingRequisition.status === "Active" &&
      status === "On Hold" &&
      metadata?.triggeredBy === "requisition_put_on_hold"
    ) {
      const linkedCareer = await db
        .collection("careers")
        .findOne({ requisitionId: id });

      if (linkedCareer) {
        await db.collection("careers").updateOne(
          { _id: linkedCareer._id },
          {
            $set: {
              status: "inactive",
              updatedAt: new Date(),
            },
          }
        );
        createdCareerId = (linkedCareer as any).id || null;
      }

      // Trigger notification for admins and guest about requisition put on hold
      try {
        const admins = await db.collection('members').find({
          orgID: existingRequisition.orgID,
          role: 'admin'
        }).toArray();

        const adminEmails = admins.map((admin: any) => admin.email).filter(Boolean);

        // Add guest to recipients
        let allRecipients = [...adminEmails];
        const guestEmail = existingRequisition.submittedBy?.email;
        if (guestEmail) {
          // Verify guest is still an active member
          const guestMember = await db.collection('members').findOne({
            email: guestEmail,
            orgID: existingRequisition.orgID,
            role: 'guest',
            status: { $in: ['joined', 'invited'] }
          });
          if (guestMember) {
            allRecipients.push(guestEmail);
          }
        }

        // Filter out the actor from recipients
        const filteredRecipients = allRecipients.filter((email: string) => email !== req.user.email);

        if (filteredRecipients.length > 0) {

          await triggerRequisitionNotification(db, {
            requisitionId: id,
            type: 'hold',
            actorId: req.user.email,
            recipientIds: filteredRecipients,
            orgID: existingRequisition.orgID,
            metadata: {
              positionName: existingRequisition.positionName,
              referenceNo: existingRequisition.referenceNo,
              careerId: createdCareerId,
            },
          });
        }
      } catch (notificationError) {
        console.error('Failed to trigger requisition on hold notification:', notificationError);
      }
    }

    if (
      existingRequisition.status === "On Hold" &&
      status === "Cancelled" &&
      metadata?.triggeredBy === "requisition_cancel"
    ) {
      const linkedCareer = await db
        .collection("careers")
        .findOne({ requisitionId: id });

      if (linkedCareer) {
        await db.collection("careers").updateOne(
          { _id: linkedCareer._id },
          {
            $set: {
              status: "cancelled",
              updatedAt: new Date(),
            },
          }
        );
        createdCareerId = (linkedCareer as any).id || null;
      }
    }

    if (
      existingRequisition.status === "Active" &&
      status === "Cancelled" &&
      metadata?.triggeredBy === "requisition_cancel"
    ) {
      const linkedCareer = await db
        .collection("careers")
        .findOne({ requisitionId: id });

      if (linkedCareer) {
        await db.collection("careers").updateOne(
          { _id: linkedCareer._id },
          {
            $set: {
              status: "cancelled",
              updatedAt: new Date(),
            },
          }
        );
        createdCareerId = (linkedCareer as any).id || null;
      }
    }

    if (
      status === "On Hold" &&
      existingRequisition.status === "In Review" &&
      metadata?.triggeredBy === "approve"
    ) {
      try {
        createdCareerId = await createDraftCareerFromRequisition(
          db,
          existingRequisition,
          req.user
        );

        updateDoc.$set.approvalCareerId = createdCareerId;

        // Trigger notification for admins and guest about approval
        try {
          const admins = await db.collection('members').find({
            orgID: existingRequisition.orgID,
            role: 'admin'
          }).toArray();

          const adminEmails = admins.map((admin: any) => admin.email).filter(Boolean);

          // Add guest to recipients
          let allRecipients = [...adminEmails];
          const guestEmail = existingRequisition.submittedBy?.email;
          if (guestEmail) {
            // Verify guest is still an active member
            const guestMember = await db.collection('members').findOne({
              email: guestEmail,
              orgID: existingRequisition.orgID,
              role: 'guest',
              status: { $in: ['joined', 'invited'] }
            });
            if (guestMember) {
              allRecipients.push(guestEmail);
            }
          }

          // Filter out the actor from recipients
          const filteredRecipients = allRecipients.filter((email: string) => email !== req.user.email);

          if (filteredRecipients.length > 0) {

            await triggerRequisitionNotification(db, {
              requisitionId: id,
              type: 'approved',
              actorId: req.user.email,
              recipientIds: filteredRecipients,
              orgID: existingRequisition.orgID,
              metadata: {
                positionName: existingRequisition.positionName,
                referenceNo: existingRequisition.referenceNo,
                careerId: createdCareerId,
              },
            });
          }
        } catch (notificationError) {
          console.error('Failed to trigger requisition approval notification:', notificationError);
        }
      } catch (error: any) {
        console.error(
          "Error creating draft career from approved requisition:",
          error
        );
        return NextResponse.json(
          {
            success: false,
            message: "Failed to create career from requisition",
          },
          { status: 500 }
        );
      }
    }

    // Update requisition
    const result = await db
      .collection("requisitions")
      .findOneAndUpdate(
        { _id: new ObjectId(id) },
        updateDoc,
        { returnDocument: "after" }
      );

    if (!result) {
      return NextResponse.json(
        { success: false, message: "Failed to update requisition status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      requisition: {
        id: result._id.toString(),
        positionName: result.positionName,
        referenceNo: result.referenceNo,
        dateSubmitted: formatRelativeDate(result.createdAt),
        status: result.status,
        submittedBy: result.submittedBy,
        formData: result.formData,
        moreInfoReason: result.moreInfoReason,
        moreInfoBy: result.moreInfoBy,
        moreInfoByEmail: (result as any).moreInfoByEmail,
        moreInfoByAvatar: (result as any).moreInfoByAvatar,
        cancelReason: result.cancelReason,
        previousStatus: (result as any).previousStatus,
        cancelRequestPreviousStatus: (result as any).cancelRequestPreviousStatus,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      },
      careerId: createdCareerId,
      message: `Requisition status updated to ${status}`,
    });
  } catch (error: any) {
    console.error("Error updating requisition status:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update requisition status" },
      { status: 500 }
    );
  }
});

// Guest invitation email template (same as in /api/add-member)
const getGuestInvitationTemplate = (
  name: string,
  companyName: string,
  inviterEmail: string,
  inviterName: string,
  orgId: string,
  redirectTo: 'careers' | 'requisitions' = 'careers'
): string => {
  const JIA_LOGO_URL = "https://cdn.hellojia.ai/public-assets/jia-logo-header.png";
  const WHITECLOAK_LOGO_URL =
    "https://cdn.hellojia.ai/public-assets/whitecloak-logo.png";
  const HANDS_ICON_URL =
    "https://cdn.hellojia.ai/public-assets/hands-thumbs-up.png";
  
  // Build magic link through /auth/callback for Google SSO login
  const baseUrl = process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN 
    ? `https://${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN}` 
    : 'http://localhost:3000';
  const redirectPath = `/guest-portal/${redirectTo}?orgId=${orgId}`;
  const LOGIN_URL = `${baseUrl}/auth/callback?redirect=${encodeURIComponent(redirectPath)}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jia Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif; background-color: #F8F9FC; padding: 40px 20px; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F8F9FC;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; padding: 24px;">
          <tr>
            <td align="center" style="background: linear-gradient(90deg, #A8C5E8 0%, #E8B5D0 100%); padding: 40px 24px; text-align: center; border-radius: 8px; height: 120px;">
              <img src="${JIA_LOGO_URL}" alt="Jia Logo" style="height: 60px; width: auto; display: block; margin: 0 auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 24px; text-align: center;">
              <h1 style="font-size: 24px; font-weight: 700; color: #1A1625; margin: 0 0 24px 0;">Hi ${name}!</h1>
              <div style="margin: 20px 0;">
                <img src="${WHITECLOAK_LOGO_URL}" alt="Company" style="width: 128px; height: 32px; display: block; margin: 0 auto;" />
              </div>
              <div style="font-size: 20px; font-weight: 700; color: #1A1625; margin: 0;">${companyName}</div>
              <p style="font-size: 18px; color: #717680; margin: 0 0 32px 0; font-weight: 500;">has invited you to join Jia</p>
              <div style="margin: 24px 0;">
                <img src="${HANDS_ICON_URL}" alt="Hands Icon" style="height: 120px; width: auto; display: block; margin: 0 auto;">
              </div>
              <h2 style="font-size: 24px; font-weight: 700; color: #1A1625; margin: 0 0 16px 0;">Welcome to Jia!</h2>
              <p style="font-size: 16px; color: #717680; margin: 0 0 16px 0; line-height: 1.6;">
                ${inviterName} (${inviterEmail}) has invited you as a guest at ${companyName} on Jia.
              </p>
              <p style="font-size: 16px; color: #717680; margin: 0 0 16px 0; line-height: 1.6;">
                If you have any questions, please contact our support team.
              </p>
              <p style="font-size: 16px; color: #717680; margin: 0 0 24px 0; line-height: 1.6;">
                Best regards,<br>
                Jia Team
              </p>
              <a href="${LOGIN_URL}" style="display: inline-block; background-color: #181D27; color: #ffffff; padding: 12px 120px; border: 1px solid #999999; border-radius: 50px; text-decoration: none; font-size: 17px; font-weight: 550;">Log In</a>
            </td>
          </tr>
        </table>
        <div style="margin-top: 24px; text-align: center;">
          <div style="font-weight: 600; margin-bottom: 4px; font-size: 12px; color: #717680;">© Jia</div>
          <p style="margin: 0; font-size: 12px; color: #717680;">Please do not reply to this email. This is a system generated email.</p>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

async function createDraftCareerFromRequisition(
  db: any,
  requisition: any,
  user: any
) {
  const formData = requisition.formData || {};
  const officeLocation = formData.officeLocation || {};
  const salaryRange = formData.salaryRange || {};

  const workArrangement: string = formData.workArrangement || "";
  let workSetup: string;

  switch (workArrangement) {
    case "Remote":
      workSetup = "Fully Remote";
      break;
    case "On-site":
    case "Onsite":
      workSetup = "Onsite";
      break;
    case "Hybrid":
      workSetup = "Hybrid";
      break;
    default:
      workSetup = "Onsite";
      break;
  }

  const jobTitleRaw =
    formData.positionName || requisition.positionName || "Untitled Role";
  const descriptionRaw = formData.jobDescription || formData.reason || "";

  const sanitizedJobTitle = sanitizeString(jobTitleRaw, "strict");
  const sanitizedDescription = sanitizeString(descriptionRaw, "moderate");

  const country = officeLocation.country || "Philippines";
  const province = officeLocation.stateProvince || "";
  const city = officeLocation.city || "";

  const location = sanitizeString(city || province || country, "strict");

  const minSalaryNumber =
    typeof salaryRange.min === "string" && salaryRange.min.trim() !== ""
      ? Number(salaryRange.min)
      : null;
  const maxSalaryNumber =
    typeof salaryRange.max === "string" && salaryRange.max.trim() !== ""
      ? Number(salaryRange.max)
      : null;

  const minimumSalary =
    typeof minSalaryNumber === "number" && !Number.isNaN(minSalaryNumber)
      ? minSalaryNumber
      : null;
  const maximumSalary =
    typeof maxSalaryNumber === "number" && !Number.isNaN(maxSalaryNumber)
      ? maxSalaryNumber
      : null;

  const now = new Date();
  const careerId = guid();

  const creatorEmail = requisition.submittedBy?.email;
  const creatorName = requisition.submittedBy?.name;
  const creatorImage = requisition.submittedBy?.avatar;

  const approverEmail = user?.email;
  const approverName = (user as any)?.name || (user as any)?.displayName;
  const approverImage =
    (user as any)?.image || (user as any)?.picture || undefined;

  const teamMembers: any[] = [];

  if (approverEmail) {
    teamMembers.push({
      email: approverEmail,
      name: approverName || approverEmail,
      image:
        approverImage ||
        `https://api.dicebear.com/9.x/shapes/svg?seed=${approverEmail}`,
      role: "Job Owner",
    });
  }

  if (creatorEmail) {
    const alreadyInTeam = teamMembers.some(
      (member) => member.email === creatorEmail
    );
    if (!alreadyInTeam) {
      teamMembers.push({
        email: creatorEmail,
        name: creatorName || creatorEmail,
        image:
          creatorImage ||
          `https://api.dicebear.com/9.x/shapes/svg?seed=${creatorEmail}`,
        role: "Guest",
      });
    }

    // Check if the submitter already exists as a member in this org
    // If not, create a new guest member record and send invitation email
    const existingMember = await db.collection("members").findOne({
      email: creatorEmail,
      orgID: requisition.orgID,
    });

    if (!existingMember) {
      // Get org details for email
      const org = await db
        .collection("organizations")
        .findOne({ _id: new ObjectId(requisition.orgID) });

      // Create new guest member
      const newMember = {
        image:
          creatorImage ||
          `https://api.dicebear.com/9.x/shapes/svg?seed=${creatorEmail}`,
        name:
          creatorName ||
          creatorEmail.split("@")[0].charAt(0).toUpperCase() +
            creatorEmail.split("@")[0].slice(1),
        email: creatorEmail,
        orgID: requisition.orgID,
        role: "guest",
        careers: undefined,
        addedAt: new Date(),
        lastLogin: null,
        status: "invited",
      };

      await db.collection("members").insertOne(newMember);
      console.log(
        `[Requisition Approve] Created new guest member: ${creatorEmail} for org ${requisition.orgID}`
      );

      // Send guest invitation email
      try {
        const inviterEmail = user?.email || "";
        const inviterName =
          (user as any)?.name || (user as any)?.displayName || "Recruiter";
        const companyName = org?.name || "Your Company";

        const htmlContent = getGuestInvitationTemplate(
          newMember.name,
          companyName,
          inviterEmail,
          inviterName,
          requisition.orgID
        );

        await sendEmail({
          recipient: creatorEmail,
          html: htmlContent,
          subject: `Jia | ${companyName} has invited you to join`,
        });

        console.log(
          `[Requisition Approve] Sent invitation email to: ${creatorEmail}`
        );
      } catch (emailError: any) {
        console.error(
          "[Requisition Approve] Failed to send guest invitation email:",
          emailError?.message || emailError
        );
        // Don't fail the entire operation if email fails
      }
    } else {
      console.log(
        `[Requisition Approve] Member already exists: ${creatorEmail} in org ${requisition.orgID}`
      );
    }
  }

  const headcountStr: string = formData.headcount || "";
  const headcountNumber =
    headcountStr.trim() !== "" && !Number.isNaN(Number(headcountStr))
      ? Number(headcountStr)
      : null;

  const careerDoc: any = {
    id: careerId,
    requisitionId: requisition._id?.toString?.() || undefined,
    jobTitle: sanitizedJobTitle,
    headcount: headcountNumber,
    project: null,
    description: sanitizedDescription,
    questions: [],
    preScreeningQuestions: [],
    pipelineStages: undefined,
    location,
    workSetup,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    lastEditedBy: approverEmail
      ? {
          email: approverEmail,
          name: approverName || approverEmail,
          image:
            approverImage ||
            `https://api.dicebear.com/9.x/shapes/svg?seed=${approverEmail}`,
        }
      : undefined,
    createdBy: creatorEmail
      ? {
          email: creatorEmail,
          name: creatorName || creatorEmail,
          image:
            creatorImage ||
            `https://api.dicebear.com/9.x/shapes/svg?seed=${creatorEmail}`,
        }
      : undefined,
    status: "inactive", // Draft / unpublished career
    screeningSetting: "Good Fit and above",
    orgID: requisition.orgID,
    requireVideo: true,
    salaryNegotiable: true,
    minimumSalary,
    maximumSalary,
    country,
    province,
    employmentType: formData.employmentType || "",
    teamMembers,
    cvSecretPrompt: "",
    interviewSecretPrompt: "",
  };

  await db.collection("careers").insertOne(careerDoc);

  return careerId;
}

