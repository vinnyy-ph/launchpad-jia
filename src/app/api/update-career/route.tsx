import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { verifyUserIsAdmin } from "@/lib/utils/adminAuth";
import {
  triggerCareerStatusNotification,
  triggerCareerUpdateNotification,
  triggerCareerOwnershipNotification,
  triggerTeamMembershipNotification,
} from "@/lib/utils/notificationTriggers";
import { SYNCABLE_CAREER_FIELDS } from "@/lib/utils/constants";
import { sanitizeObject } from "@/lib/utils/sanitizeInput";
import { validatePipelineMutationsAgainstInterviews } from "@/lib/utils/pipelineMutationValidation";
import { migrateZeroMovementCandidatesToNewFirstStage } from "@/lib/utils/firstStageMigration";
import { logActivity } from "@/lib/utils/activityLogger";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    let requestData = await request.json();
    const { _id } = requestData;

    // Validate required fields
    if (!_id) {
      return NextResponse.json(
        { error: "Job Object ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // First, fetch the career to check access
    const existingCareer = await db
      .collection("careers")
      .findOne({ _id: new ObjectId(_id) });

    if (!existingCareer) {
      return NextResponse.json({ error: "Career not found" }, { status: 404 });
    }

    const userEmail = request.user?.email;
    const orgID = existingCareer.orgID; // Assuming orgID exists on the career document

    // 1. Check if user is the Job Owner
    const isJobOwner = existingCareer.teamMembers?.some(
      (member: any) => member.email === userEmail && member.role === "Job Owner"
    );

    // 2. Check if user is an Admin or Super Admin
    let isAdminOrSuperAdmin = false;
    if (userEmail && orgID) {
      const authResult = await verifyUserIsAdmin(db, userEmail, orgID);
      isAdminOrSuperAdmin = authResult.authorized;
    }

    // Allow access if either condition is true
    if (!isJobOwner && !isAdminOrSuperAdmin) {
      return NextResponse.json(
        { error: "Only Job Owners or Admins can update this career" },
        { status: 403 }
      );
    }

    // Archived careers keep their forced unpublished/inactive state. Reject status
    // flips until the career is restored (the archived banner promises exactly this);
    // otherwise an archived career could go live on the public portal while staying
    // hidden from the recruiter list and analytics.
    if (existingCareer.archived === true) {
      const wantsStatusChange =
        requestData.status !== undefined && requestData.status !== existingCareer.status;
      const wantsActivityChange =
        requestData.activityStatus !== undefined &&
        requestData.activityStatus !== existingCareer.activityStatus;
      if (wantsStatusChange || wantsActivityChange) {
        return NextResponse.json(
          { error: "This career is archived. Restore it before changing its status." },
          { status: 409 }
        );
      }
    }

    // Enforce job post limits only when publishing (inactive -> active) OR changing job post type
    if ((requestData.status === "active" && existingCareer.status !== "active") || (requestData.jobPostType !== existingCareer.jobPostType)) {
      const orgDetails = await db
        .collection("organizations")
        .findOne({ _id: new ObjectId(orgID) });

      if (orgDetails) {
        const jobPostType = requestData.jobPostType || existingCareer.jobPostType;
        const isPremiumPost = jobPostType === "premium";
        const isCreditBasedPost = jobPostType === "credit-based";
        let perTypeLimitHandled = false;

        if (isPremiumPost || isCreditBasedPost) {
          const nestedPlanField = isPremiumPost ? "premiumPlan" : "creditBasedPlan";
          const planId = (orgDetails as any)[nestedPlanField]?.planId as string | undefined;

          if (planId) {
            const plan = await db
              .collection("organization-plans")
              .findOne({ _id: new ObjectId(planId) });

            // Mark that we've handled per-type limit check when a plan exists
            // This prevents the legacy fallback check from running
            if (plan) {
              perTypeLimitHandled = true;
            }

            const baseMaxActiveJobPosts = (plan as any)?.maxActiveJobPosts as number | null | undefined;

            // Only enforce limit if it's a positive number (null/undefined = unlimited)
            if (typeof baseMaxActiveJobPosts === "number" && baseMaxActiveJobPosts > 0) {
              // Use nested plan field: premiumPlan.jobSlotAdjustment or creditBasedPlan.jobSlotAdjustment
              const slotAdjustment = isPremiumPost
                ? (orgDetails.premiumPlan?.jobSlotAdjustment || 0)
                : (orgDetails.creditBasedPlan?.jobSlotAdjustment || 0);
              const effectiveMaxJobPosts = baseMaxActiveJobPosts + slotAdjustment;

              const usedForType = await db.collection("careers").countDocuments({
                orgID,
                status: "active",
                jobPostType,
              });

              if (usedForType >= effectiveMaxJobPosts) {
                const typeLabel = isPremiumPost ? "premium" : "credit-based";
                return NextResponse.json(
                  {
                    error: `You have reached the maximum number of ${typeLabel} job posts for your plan`,
                  },
                  { status: 400 }
                );
              }
            }
          }
        }

        // Fallback: enforce org-level jobLimit when per-type limits are not available
        if (!perTypeLimitHandled) {
          const totalActiveCareers = await db.collection("careers").countDocuments({
            orgID,
            status: "active",
          });

          const totalAdjustment =
            (orgDetails.creditBasedPlan?.jobSlotAdjustment || 0) +
            (orgDetails.premiumPlan?.jobSlotAdjustment || 0);

          if (
            totalActiveCareers >=
            (orgDetails.plan?.jobLimit || 0) + totalAdjustment
          ) {
            const hasAnyActivePlan = orgDetails.plan?.jobLimit !== undefined && orgDetails.plan?.jobLimit !== null;
            const typeLabel = isPremiumPost ? "Premium" : isCreditBasedPost ? "Credit-based" : "";
            const planSpecificMsg = typeLabel ? ` active ${typeLabel} plan` : "n active plan";

            return NextResponse.json(
              {
                error: hasAnyActivePlan
                  ? "You have reached the maximum number of jobs for your plan"
                  : `This organization does not have a${planSpecificMsg}. Please assign a plan to publish job posts.`,
              },
              { status: 400 }
            );
          }
        }
      }
    }

    const statusChangedFields = Array.isArray(requestData.statusChangedFields)
      ? requestData.statusChangedFields
      : undefined;

    let dataUpdates = { ...requestData };

    delete dataUpdates._id;
    delete dataUpdates.statusChangedFields;

    // Sanitize and normalize pipelineStages if being updated
    if (dataUpdates.pipelineStages) {
      const sanitizedPipelineStages = sanitizeObject(dataUpdates.pipelineStages, "strict");
      
      // Normalize alias for stages 1 and 2 (CV Screening and AI Interview)
      if (sanitizedPipelineStages?.length > 0) {
        for (const stage of sanitizedPipelineStages) {
          if (stage.id === "1" || stage.id === "2") {
            // Trim and remove alias if empty
            const trimmedAlias = stage.alias?.trim() || "";
            if (!trimmedAlias) {
              delete stage.alias;
            }
          }
        }
      }
      
      dataUpdates.pipelineStages = sanitizedPipelineStages;
    }

    // Validate parentCareerID if provided (must reference a parent post)
    if (dataUpdates.parentCareerID !== undefined) {
      const parentCareerID = dataUpdates.parentCareerID;

      if (parentCareerID) {
        // Prevent self-referencing
        if (parentCareerID === existingCareer.id) {
          return NextResponse.json(
            { error: "A job post cannot be its own parent" },
            { status: 400 }
          );
        }

        const parentCareer = await db.collection("careers").findOne({
          id: parentCareerID,
          orgID: orgID,
        });

        if (!parentCareer) {
          return NextResponse.json(
            { error: "Parent job post not found" },
            { status: 400 }
          );
        }

        // Prevent referencing a career that already has a parent (one-level depth)
        if (parentCareer.parentCareerID) {
          return NextResponse.json(
            { error: "Cannot set a child job post as parent. Only one level of hierarchy is allowed." },
            { status: 400 }
          );
        }
      }
    }

    const career = {
      ...dataUpdates,
      updatedAt: new Date(),
    };

    if (existingCareer.id && Array.isArray(career.pipelineStages)) {
      const pipelineValidation = await validatePipelineMutationsAgainstInterviews({
        db,
        careerId: existingCareer.id,
        previousPipeline: existingCareer.pipelineStages || [],
        nextPipeline: career.pipelineStages,
      });

      if (pipelineValidation.ok === false) {
        return NextResponse.json(
          { error: pipelineValidation.message },
          { status: 400 }
        );
      }
    }

    await db
      .collection("careers")
      .updateOne({ _id: new ObjectId(_id) }, { $set: career });

    await migrateZeroMovementCandidatesToNewFirstStage({
      db,
      careerId: existingCareer.id,
      careerObjectId: existingCareer._id,
      previousPipeline: existingCareer.pipelineStages || [],
      nextPipeline: career.pipelineStages || existingCareer.pipelineStages || [],
      updatedBy: {
        name: request.user?.name,
        email: request.user?.email,
        image: request.user?.image,
      },
    });

    // Sync interviews.currentStepAlias for stages 1 and 2 when alias changes
    if (existingCareer.id && career.pipelineStages) {
      const currentPipelineStages = existingCareer.pipelineStages || [];
      
      for (const stageId of ["1", "2"]) {
        const oldStage = currentPipelineStages.find((s: any) => s.id === stageId);
        const newStage = career.pipelineStages?.find((s: any) => s.id === stageId);
        
        if (oldStage && newStage) {
          const oldAlias = oldStage.alias?.trim() || "";
          const newAlias = newStage.alias?.trim() || "";
          
          // If alias changed, update currentStepAlias for all interviews in this stage
          if (oldAlias !== newAlias) {
            const updateFields: any = newAlias 
              ? { currentStepAlias: newAlias }
              : { $unset: { currentStepAlias: "" } };
            
            await db.collection("interviews").updateMany(
              {
                id: existingCareer.id,
                stageId: stageId,
              },
              newAlias ? { $set: updateFields } : updateFields
            );
          }
        }
      }
    }

    // Sync career fields to all related interviews
    if (existingCareer.id) {
      const interviewUpdateFields = SYNCABLE_CAREER_FIELDS.reduce((acc, field) => {
        if (career[field] !== undefined) {
          acc[field] = career[field];
        }
        return acc;
      }, {} as Record<string, any>);

      if (Object.keys(interviewUpdateFields).length > 0) {
        await db.collection("interviews").updateMany(
          { id: existingCareer.id },
          { $set: interviewUpdateFields }
        );
      }
    }

    // Trigger notifications for career changes
    const actorEmail = request.user?.email;

    try {
      // 1. Check for status changes (published/unpublished)
      if (existingCareer.status !== career.status) {
        const isPublished = career.status === "active";
        const teamMemberIds =
          (career.teamMembers || existingCareer.teamMembers)
            ?.map((m: any) => m.email)
            .filter(Boolean) || [];

        await triggerCareerStatusNotification(db, {
          careerId: existingCareer.id || _id.toString(),
          careerTitle: career.jobTitle || existingCareer.jobTitle,
          isPublished,
          actorId: actorEmail,
          recipientIds: teamMemberIds,
          orgID,
        });
      }

      // 2. Check for team member changes (if teamMembers are provided in the update)
      if (career.teamMembers) {
        const oldTeamEmails = new Set(
          existingCareer.teamMembers?.map((m: any) => m.email) || []
        );
        const newTeamEmails = new Set(
          career.teamMembers?.map((m: any) => m.email) || []
        );

        // Find added members
        const addedMembers =
          career.teamMembers?.filter(
            (m: any) => m.email && !oldTeamEmails.has(m.email)
          ) || [];

        // Find removed members
        const removedMembers =
          existingCareer.teamMembers?.filter(
            (m: any) => m.email && !newTeamEmails.has(m.email)
          ) || [];

        // Trigger notifications for added members
        if (addedMembers.length > 0) {
          for (const member of addedMembers) {
            await triggerTeamMembershipNotification(db, {
              entityId: existingCareer.id || _id.toString(),
              entityType: "career",
              entityName: career.jobTitle || existingCareer.jobTitle,
              action: "added",
              actorId: actorEmail,
              affectedUserIds: [member.email],
              orgID,
              metadata: {
                role: member.role,
              },
            });
          }
        }

        // Trigger notifications for removed members
        if (removedMembers.length > 0) {
          await triggerTeamMembershipNotification(db, {
            entityId: existingCareer.id || _id.toString(),
            entityType: "career",
            entityName: career.jobTitle || existingCareer.jobTitle,
            action: "removed",
            actorId: actorEmail,
            affectedUserIds: removedMembers.map((m: any) => m.email),
            orgID,
          });
        }

        // 3. Check for ownership transfer
        const oldOwner = existingCareer.teamMembers?.find(
          (m: any) => m.role === "Job Owner"
        );
        const newOwner = career.teamMembers?.find(
          (m: any) => m.role === "Job Owner"
        );

        if (oldOwner && newOwner && oldOwner.email !== newOwner.email) {
          await triggerCareerOwnershipNotification(db, {
            careerId: existingCareer.id || _id.toString(),
            careerTitle: career.jobTitle || existingCareer.jobTitle,
            newOwnerId: newOwner.email,
            previousOwnerId: oldOwner.email,
            actorId: actorEmail,
            orgID,
          });
        }
      }

      // 4. Check for general career updates (non-status, non-team changes)
      if (
        !career.teamMembers ||
        career.teamMembers.length === existingCareer.teamMembers?.length
      ) {
        const hasContentChanges =
          (career.jobTitle && existingCareer.jobTitle !== career.jobTitle) ||
          (career.description &&
            existingCareer.description !== career.description) ||
          (career.location && existingCareer.location !== career.location);

        if (hasContentChanges && existingCareer.status !== career.status) {
          const teamMemberIds =
            (career.teamMembers || existingCareer.teamMembers)
              ?.map((m: any) => m.email)
              .filter(Boolean) || [];

          await triggerCareerUpdateNotification(db, {
            careerId: existingCareer.id || _id.toString(),
            careerTitle: career.jobTitle || existingCareer.jobTitle,
            actorId: actorEmail,
            recipientIds: teamMemberIds,
            orgID,
          });
        }
      }
    } catch (notificationError) {
      // Log but don't fail the career update
      console.error(
        "[update-career] Failed to trigger notifications:",
        notificationError
      );
    }

    // Log career activity
    const careerForLog = {
      ...career,
      jobTitle: career.jobTitle ?? existingCareer.jobTitle,
      id: existingCareer.id,
      _id: existingCareer._id,
    };
    const actorPayload = {
      type: "recruiter" as const,
      id: request.user?.uid,
      email: request.user?.email,
      name: request.user?.name || request.user?.email || "Recruiter",
      image: (request.user as any)?.picture,
    };

    try {
      const oldStatus = String(existingCareer.status ?? "").toLowerCase();
      const newStatus = String(career.status ?? "").toLowerCase();
      const statusChanged = oldStatus !== newStatus;
      const isPublishUnpublishChange =
        statusChanged &&
        ["active", "inactive"].includes(oldStatus) &&
        ["active", "inactive"].includes(newStatus);

      if (Array.isArray(statusChangedFields) && statusChangedFields.length > 0) {
        // From Update Status modal: log one activity per changed field
        if (statusChangedFields.includes("status") && isPublishUnpublishChange) {
          const isPublished = newStatus === "active";
          await logActivity({
            db,
            kind: isPublished ? "recruiter_published_career" : "recruiter_unpublished_career",
            career: careerForLog,
            orgID,
            careerId: existingCareer._id?.toString(),
            actor: actorPayload,
          });
        }
        if (statusChangedFields.includes("activityStatus")) {
          await logActivity({
            db,
            kind: "recruiter_updated_activity_status",
            career: careerForLog,
            orgID,
            careerId: existingCareer._id?.toString(),
            actor: actorPayload,
            extraMetadata: { newStatus: career.activityStatus },
          });
        }
        if (statusChangedFields.includes("jobPostType")) {
          await logActivity({
            db,
            kind: "recruiter_updated_subscription_plan",
            career: careerForLog,
            orgID,
            careerId: existingCareer._id?.toString(),
            actor: actorPayload,
            extraMetadata: { newPlan: career.jobPostType },
          });
        }
      } else {
        // Not from modal: single log (publish/unpublish or edited details)
        if (isPublishUnpublishChange) {
          const isPublished = newStatus === "active";
          await logActivity({
            db,
            kind: isPublished ? "recruiter_published_career" : "recruiter_unpublished_career",
            career: careerForLog,
            orgID,
            careerId: existingCareer._id?.toString(),
            actor: actorPayload,
          });
        } else {
          const changedFields = Object.keys(career).filter(
            (key) => JSON.stringify(career[key]) !== JSON.stringify(existingCareer[key])
          );
          await logActivity({
            db,
            kind: "recruiter_edited_career_details",
            career: { ...career, id: existingCareer.id, _id: existingCareer._id },
            orgID,
            careerId: existingCareer._id?.toString(),
            actor: actorPayload,
            extraMetadata: { changedFields },
          });
        }
      }
    } catch (logError) {
      console.error("Failed to log career activity:", logError);
    }

    return NextResponse.json({
      message: "Career updated successfully",
      career,
    }, { status: 200 });
  } catch (error) {
    console.error("Error adding career:", error);
    return NextResponse.json(
      { error: "Failed to add career" },
      { status: 500 }
    );
  }
});
