import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { DEFAULT_JOB_PIPELINE, SYNCABLE_CAREER_FIELDS } from "@/lib/utils/constants";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { logActivity } from "@/lib/utils/activityLogger";
import {
  objectContainsSuspiciousPatterns,
  sanitizeString,
  sanitizeQuestions,
  sanitizeObject,
} from "@/lib/utils/sanitizeInput";
import {
  triggerCareerStatusNotification,
  triggerCareerUpdateNotification,
  triggerTeamMembershipNotification,
} from '@/lib/utils/notificationTriggers';
import { validatePipelineMutationsAgainstInterviews } from "@/lib/utils/pipelineMutationValidation";
import { migrateZeroMovementCandidatesToNewFirstStage } from "@/lib/utils/firstStageMigration";
import { DUPLICATE_CHILD_TITLE_ERROR } from "@/lib/utils/careerValidation";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const {
      id,
      jobTitle,
      headcount,
      description,
      structuredDescription,
      questions,
      lastEditedBy,
      createdBy,
      screeningSetting,
      orgID,
      requireVideo,
      location,
      workSetup,
      status,
      requisitionId,
      salaryNegotiable,
      minimumSalary,
      maximumSalary,
      country,
      province,
      city,
      employmentType,
      preScreeningQuestions,
      accomplishedStep,
      pipelineStages,
      teamMembers,
      cvSecretPrompt,
      interviewSecretPrompt,
      parentCareerID,
      jobPostType,
      careerPostType,
      childTitle,
      voice,
      salaryUnit,
      salaryCurrency,
      showSalaryToApplicants,
      globalHiringEnabled,
      aiInterviewLanguage,
      activityStatus,

      locationCountryCode,
      walkthroughLanguage,
    } = await request.json();
    // Validate required fields
    if (
      !jobTitle ||
      !description ||
      !questions ||
      !workSetup ||
      !id
    ) {
      return NextResponse.json(
        {
          error:
            "Job title, description, questions and work setup are required",
        },
        { status: 400 }
      );
    }

    if (workSetup !== "Fully Remote" && (!location || !country)) {
      return NextResponse.json(
        {
          error:
            "Location and country are required",
        },
        { status: 400 }
      );
    }

    // Check for suspicious patterns before processing
    const inputData = {
      jobTitle,
      description,
      questions,
      preScreeningQuestions,
      pipelineStages,
    };

    if (objectContainsSuspiciousPatterns(inputData)) {
      return NextResponse.json(
        {
          error:
            "Input contains potentially dangerous content. Please remove scripts, HTML event handlers, or other executable code.",
        },
        { status: 400 }
      );
    }

    // Sanitize all text inputs
    const sanitizedJobTitle = sanitizeString(jobTitle, "strict");
    const sanitizedDescription = sanitizeString(description, "moderate"); // Allow basic formatting
    const sanitizedStructuredDescription = structuredDescription
      ? sanitizeObject(structuredDescription, "moderate")
      : null;
    const sanitizedQuestions = sanitizeQuestions(questions);
    const sanitizedLocation = sanitizeString(location, "strict");
    const sanitizedPreScreeningQuestions = preScreeningQuestions
      ? sanitizeObject(preScreeningQuestions, "strict")
      : preScreeningQuestions;
    const sanitizedPipelineStages = pipelineStages
      ? sanitizeObject(pipelineStages, "strict")
      : pipelineStages;
    const sanitizedCvSecretPrompt = cvSecretPrompt
      ? sanitizeString(cvSecretPrompt, "moderate")
      : cvSecretPrompt;
    const sanitizedInterviewSecretPrompt = interviewSecretPrompt
      ? sanitizeString(interviewSecretPrompt, "moderate")
      : interviewSecretPrompt;
    const sanitizedLocationCountryCode = locationCountryCode ? sanitizeString(locationCountryCode, "strict") : locationCountryCode;

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

    // Validate unique pipeline stages
    if (pipelineStages?.length > 0) {
      const uniquePipelineStages = [
        ...new Set(pipelineStages.map((stage) => stage.name)),
      ];
      if (uniquePipelineStages.length !== pipelineStages.length) {
        return NextResponse.json(
          { error: "Pipeline stages must be unique" },
          { status: 400 }
        );
      }

      // Validate at least one stage is enabled
      const enabledStagesCount = pipelineStages.filter(
        (stage: any) => stage.enabled !== false
      ).length;
      if (enabledStagesCount === 0) {
        return NextResponse.json(
          { error: "At least one pipeline stage must be enabled" },
          { status: 400 }
        );
      }

      // Validate unique substages
      for (const stage of pipelineStages) {
        if (stage.substages.length === 0) {
          return NextResponse.json(
            { error: "Substages cannot be empty" },
            { status: 400 }
          );
        }
        const uniqueSubstages = [
          ...new Set(stage.substages.map((substage) => substage.name)),
        ];
        if (uniqueSubstages.length !== stage.substages.length) {
          return NextResponse.json(
            { error: "Substages must be unique" },
            { status: 400 }
          );
        }

        // Validate auto endorsement and auto dropping
        if (
          stage.autoEndorse &&
          ![
            "None",
            "Maybe Fit and above",
            "Good Fit and above",
            "Only Strong Fit",
          ].includes(stage.autoEndorse)
        ) {
          return NextResponse.json(
            { error: "Invalid auto endorsement value" },
            { status: 400 }
          );
        }
        if (
          stage.autoDrop &&
          !["None", "Bad Fit and below", "Maybe Fit and below"].includes(
            stage.autoDrop
          )
        ) {
          return NextResponse.json(
            { error: "Invalid auto dropping value" },
            { status: 400 }
          );
        }
        if (
          stage.autoEndorse === "Maybe Fit and above" &&
          stage.autoDrop === "Maybe Fit and below"
        ) {
          return NextResponse.json(
            {
              error:
                "Auto endorsement and auto dropping settings are in conflict",
            },
            { status: 400 }
          );
        }
      }
    }

    const { db } = await connectMongoDB();

    // Validate parentCareerID if provided
    if (parentCareerID) {
      // Prevent self-referencing
      if (parentCareerID === id) {
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

    if (
      careerPostType === "receiving_pool" &&
      parentCareerID &&
      childTitle
    ) {
      const existingSibling = await db.collection("careers").findOne(
        {
          orgID,
          parentCareerID,
          childTitle,
          id: { $ne: id },
        },
        {
          projection: { _id: 1 },
        },
      );

      if (existingSibling) {
        return NextResponse.json(
          { error: DUPLICATE_CHILD_TITLE_ERROR },
          { status: 400 },
        );
      }
    }

    const orgDetails = await db
      .collection("organizations")
      .aggregate([
        {
          $match: {
            _id: new ObjectId(orgID),
          },
        },
      ])
      .toArray();

    if (!orgDetails || orgDetails.length === 0) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const organization = orgDetails[0];
    const careersCollection = db.collection("careers");

    // Enforce per-type job post limits when a typed plan is configured.
    // Falls back to legacy org-level jobLimit when per-type info is unavailable.
    const isPremiumPost = jobPostType === "premium";
    const isCreditBasedPost = jobPostType === "credit-based";
    let perTypeLimitHandled = false;

    // Only check per-type job post limits when trying to publish (status === "active")
    if ((isPremiumPost || isCreditBasedPost) && status === "active") {
      // Use nested structure: organization.creditBasedPlan?.planId or organization.premiumPlan?.planId
      const nestedPlanField = isPremiumPost ? "premiumPlan" : "creditBasedPlan";
      const planId = (organization as any)[nestedPlanField]?.planId as string | undefined;

      if (planId) {
        const plan = await db
          .collection("organization-plans")
          .findOne({ _id: new ObjectId(planId) });

        // Mark that we've handled per-type limit check when a plan exists
        // This prevents the legacy fallback check from running
        if (plan) {
          perTypeLimitHandled = true;
        }

        const baseMaxActiveJobPosts = (plan as any)?.maxActiveJobPosts as
          | number
          | null
          | undefined;

        // Only enforce limit if it's a positive number (null/undefined = unlimited)
        if (typeof baseMaxActiveJobPosts === "number" && baseMaxActiveJobPosts > 0) {
          // Include per-org slot adjustment based on plan type
          // Use nested plan field: premiumPlan.jobSlotAdjustment or creditBasedPlan.jobSlotAdjustment
          const slotAdjustment = isPremiumPost
            ? (organization.premiumPlan?.jobSlotAdjustment || 0)
            : (organization.creditBasedPlan?.jobSlotAdjustment || 0);
          const effectiveMaxJobPosts = baseMaxActiveJobPosts + slotAdjustment;

          // Count active careers for this type, excluding the current career id
          const usedForType = await careersCollection.countDocuments({
            orgID,
            status: "active",
            jobPostType,
            id: { $ne: id },
          });

          const newActiveCareer = 1; // status is "active" at this point

          if (usedForType + newActiveCareer > effectiveMaxJobPosts) {
            const typeLabel = isPremiumPost ? "premium" : "credit-based";
            const schemaLabel =
              (plan as any)?.schema === "credit-based" ? "Credit-based" : "Premium";
            const planName = (plan as any)?.name || "this";

            const errorMessage = effectiveMaxJobPosts === 0
              ? `Your current plan does not include ${typeLabel} job posts. Please upgrade your plan to publish.`
              : `You have reached the maximum number of ${typeLabel} job posts for your plan`;

            return NextResponse.json(
              {
                error: errorMessage,
                jobPostLimitInfo: {
                  maxActiveJobPosts: effectiveMaxJobPosts,
                  planName,
                  schema: (plan as any)?.schema || typeLabel,
                  schemaLabel,
                  jobPostType: typeLabel,
                },
              },
              { status: 400 }
            );
          }
        }
        // If baseMaxActiveJobPosts is null/undefined, the plan is unlimited - no limit check needed
      }
    } else if (isPremiumPost || isCreditBasedPost) {
      // If saving as inactive, still mark perTypeLimitHandled if plan exists
      const nestedPlanField = isPremiumPost ? "premiumPlan" : "creditBasedPlan";
      const planId = (organization as any)[nestedPlanField]?.planId as string | undefined;

      if (planId) {
        const plan = await db
          .collection("organization-plans")
          .findOne({ _id: new ObjectId(planId) });

        if (plan) {
          perTypeLimitHandled = true;
        }
      }
    }

    // Fallback: enforce org-level jobLimit when per-type limits
    // are not available (e.g., no typed plan assigned).
    // Only check limits when trying to publish/activate a career.
    if (!perTypeLimitHandled && status === "active") {
      // Check if the org actually has a plan - check both new-style and legacy structures
      const orgJobLimit = organization.plan?.jobLimit;
      const hasLegacyPlan = orgJobLimit !== undefined && orgJobLimit !== null;

      // Check for new-style plans (premiumPlan/creditBasedPlan)
      const hasPremiumPlan = !!organization.premiumPlan?.planId;
      const hasCreditBasedPlan = !!organization.creditBasedPlan?.planId;
      const hasNewStylePlan = hasPremiumPlan || hasCreditBasedPlan;

      // Organization has an active plan if either legacy or new-style plan exists
      const hasActivePlan = hasLegacyPlan || hasNewStylePlan;

      // Exclude the current career from the count
      const totalActiveCareers = await careersCollection.countDocuments({
        orgID,
        status: "active",
        id: { $ne: id },
      });
      const newActiveCareer = 1; // status is "active" at this point

      const totalAdjustment =
        (organization.creditBasedPlan?.jobSlotAdjustment || 0) +
        (organization.premiumPlan?.jobSlotAdjustment || 0);

      const effectiveJobLimit = (orgJobLimit || 0) + totalAdjustment;

      if (totalActiveCareers + newActiveCareer > effectiveJobLimit) {
        // Differentiate error message based on whether there's an active plan
        const typeLabel = jobPostType === "credit-based" ? "Credit-based" : "Premium";
        const errorMessage = hasActivePlan
          ? "You have reached the maximum number of jobs for your plan"
          : `This organization does not have an active ${typeLabel} plan. Please assign a plan to publish job posts.`;

        return NextResponse.json(
          {
            error: errorMessage,
            jobPostLimitInfo: {
              noPlan: !hasActivePlan,
              jobPostType: jobPostType || "premium", // Default to premium if not specified
            },
          },
          { status: 400 }
        );
      }
    }

    // Ensure creator is added as Job Owner if not already in team members
    let finalTeamMembers = (teamMembers || []).map((member: any) => ({
      ...member,
      // Preserve existing isViewed if present, otherwise default to false
      isViewed: member.isViewed !== undefined ? member.isViewed : false,
    }));

    const creatorEmail = createdBy?.email || request.user?.email;
    const creatorInTeam = finalTeamMembers.some(
      (member: any) => member.email === creatorEmail
    );

    if (!creatorInTeam && creatorEmail) {
      finalTeamMembers = [
        {
          email: creatorEmail,
          name: createdBy?.name || request.user?.name,
          image: createdBy?.image || request.user?.image,
          role: "Job Owner",
          isViewed: true, // Creator has implicitly viewed
        },
        ...finalTeamMembers,
      ];
    }

    const career = {
      jobTitle: sanitizedJobTitle,
      headcount,
      description: sanitizedDescription,
      structuredDescription: sanitizedStructuredDescription,
      questions: sanitizedQuestions,
      location: sanitizedLocation,
      workSetup,
      lastEditedBy,
      createdBy,
      status: status || "active",
      screeningSetting,
      orgID,
      requisitionId,
      requireVideo,
      salaryNegotiable,
      minimumSalary,
      maximumSalary,
      country,
      province,
      city,
      employmentType,
      preScreeningQuestions: sanitizedPreScreeningQuestions,
      accomplishedStep,
      pipelineStages: sanitizedPipelineStages,
      teamMembers: finalTeamMembers,
      cvSecretPrompt: sanitizedCvSecretPrompt,
      interviewSecretPrompt: sanitizedInterviewSecretPrompt,
      parentCareerID: parentCareerID || null,
      jobPostType: jobPostType || null,
      careerPostType: careerPostType || null,
      childTitle: childTitle || null,
      voice: voice || null,
      salaryUnit: salaryUnit || "Monthly",
      salaryCurrency: salaryCurrency || "PHP",
      showSalaryToApplicants: showSalaryToApplicants ?? true,
      globalHiringEnabled: globalHiringEnabled ?? false,
      aiInterviewLanguage: aiInterviewLanguage || "English",
      activityStatus: activityStatus || "Active",
      locationCountryCode: sanitizedLocationCountryCode || null,
      walkthroughLanguage: walkthroughLanguage === "tagalog" ? "tagalog" : "english",
    };

    const existingCareer = await db.collection("careers").findOne({ id });
    if (existingCareer) {
      if (Array.isArray(career.pipelineStages)) {
        const pipelineValidation = await validatePipelineMutationsAgainstInterviews({
          db,
          careerId: id,
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

      // Update current progress
      await db.collection("careers").updateOne(
        { id },
        {
          $set: {
            ...career,
            updatedAt: new Date(),
          },
        }
      );

      // Log career details edit activity
      try {
        const statusChanged = existingCareer.status !== career.status;
        
        // Log status change if applicable
        if (statusChanged) {
          const isPublished = career.status === "active";
          await logActivity({
            db,
            kind: isPublished ? "recruiter_published_career" : "recruiter_unpublished_career",
            career: { ...career, id, _id: existingCareer._id },
            orgID,
            careerId: existingCareer._id?.toString(),
            actor: {
              type: "recruiter",
              id: request.user?.uid,
              email: request.user?.email,
              name: request.user?.name || request.user?.email || "Recruiter",
              image: (request.user as any)?.picture,
            },
          });
        } else {
          // Log general edit activity with changed fields
          const changedFields = Object.keys(career).filter(
            (key) => JSON.stringify(career[key]) !== JSON.stringify(existingCareer[key])
          );
          
          await logActivity({
            db,
            kind: "recruiter_edited_career_details",
            career: { ...career, id, _id: existingCareer._id },
            orgID,
            careerId: existingCareer._id?.toString(),
            actor: {
              type: "recruiter",
              id: request.user?.uid,
              email: request.user?.email,
              name: request.user?.name || request.user?.email || "Recruiter",
              image: (request.user as any)?.picture,
            },
            extraMetadata: {
              changedFields,
            },
          });
        }
      } catch (logError) {
        console.error("Failed to log career activity:", logError);
      }

      await migrateZeroMovementCandidatesToNewFirstStage({
        db,
        careerId: id,
        careerObjectId: existingCareer._id,
        previousPipeline: existingCareer.pipelineStages || DEFAULT_JOB_PIPELINE,
        nextPipeline: career.pipelineStages || DEFAULT_JOB_PIPELINE,
        updatedBy: {
          name: request.user?.name,
          email: request.user?.email,
          image: request.user?.image,
        },
      });
      
      // Sync interviews.currentStepAlias for stages 1 and 2 when alias changes
      const currentPipelineStages =
        existingCareer.pipelineStages || DEFAULT_JOB_PIPELINE;
      
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
                id: id,
                stageId: stageId,
              },
              newAlias ? { $set: updateFields } : updateFields
            );
          }
        }
      }
      
      // Handle updated pipeline stages - sync applicant status/currentStep when stages are modified
      const existingEditableStages = currentPipelineStages?.filter(
        (s: any) => s.type === "custom" || s.stageEditable
      );
      if (existingEditableStages?.length > 0) {
        const updatedEditableStages = career.pipelineStages.filter(
          (s: any) => s.type === "custom" || s.stageEditable
        );
        // Check every editable stage of existing pipeline
        for (const existingStage of existingEditableStages) {
          const matchedUpdatedStage = updatedEditableStages.find(
            (s: any) => s.id === existingStage.id
          );
          if (matchedUpdatedStage) {
            // Check if stage name changed - update all applicants in this stage
            if (matchedUpdatedStage.name !== existingStage.name) {
              await db.collection("interviews").updateMany(
                {
                  id: id,
                  stageId: existingStage.id,
                },
                {
                  $set: {
                    currentStep: matchedUpdatedStage.name,
                  },
                }
              );
            }

            // Check if substages have been renamed
            for (const existingSubstage of existingStage.substages) {
              const matchedUpdatedSubstage =
                matchedUpdatedStage.substages.find(
                  (s: any) => s.id === existingSubstage.id
                );
              if (
                matchedUpdatedSubstage &&
                (matchedUpdatedSubstage.status !== existingSubstage.status ||
                  matchedUpdatedSubstage.currentStep !==
                  existingSubstage.currentStep)
              ) {
                // Update applicants in this substage with new status/currentStep
                await db.collection("interviews").updateMany(
                  {
                    id: id,
                    stageId: existingStage.id,
                    substageId: existingSubstage.id,
                  },
                  {
                    $set: {
                      status: matchedUpdatedSubstage.status,
                      currentStep: matchedUpdatedSubstage.currentStep,
                    },
                  }
                );
              }
            }
          }
        }
      }

      // Sync all career-related fields to all interviews for this career
      const careerData: Record<string, any> = {
        jobTitle: sanitizedJobTitle,
        headcount,
        description: sanitizedDescription,
        structuredDescription: sanitizedStructuredDescription,
        questions: sanitizedQuestions,
        location: sanitizedLocation,
        workSetup,
        screeningSetting,
        requisitionId,
        requireVideo,
        salaryNegotiable,
        minimumSalary,
        maximumSalary,
        country,
        province,
        city,
        employmentType,
        preScreeningQuestions: sanitizedPreScreeningQuestions,
        pipelineStages: sanitizedPipelineStages,
        cvSecretPrompt: sanitizedCvSecretPrompt,
        interviewSecretPrompt: sanitizedInterviewSecretPrompt,
        voice: voice || null,
      };

      const interviewUpdateFields = SYNCABLE_CAREER_FIELDS.reduce((acc, field) => {
        if (careerData[field] !== undefined) {
          acc[field] = careerData[field];
        }
        return acc;
      }, {} as Record<string, any>);

      await db.collection("interviews").updateMany(
        { id: id },
        { $set: interviewUpdateFields }
      );

      // Trigger notifications for career changes
      const actorEmail = request.user?.email;

      try {
        // 1. Check for status changes (published/unpublished)
        if (existingCareer.status !== career.status) {
          const isPublished = career.status === 'active';
          const teamMemberIds = career.teamMembers?.map((m: any) => m.email).filter(Boolean) || [];

          await triggerCareerStatusNotification(db, {
            careerId: id,
            careerTitle: sanitizedJobTitle,
            isPublished,
            actorId: actorEmail,
            recipientIds: teamMemberIds,
            orgID,
          });
        }

        // 2. Check for team member changes
        const oldTeamEmails = new Set(existingCareer.teamMembers?.map((m: any) => m.email) || []);
        const newTeamEmails = new Set(career.teamMembers?.map((m: any) => m.email) || []);

        // Find added members
        const addedMembers = career.teamMembers?.filter(
          (m: any) => m.email && !oldTeamEmails.has(m.email)
        ) || [];

        // Find removed members
        const removedMembers = existingCareer.teamMembers?.filter(
          (m: any) => m.email && !newTeamEmails.has(m.email)
        ) || [];

        // Trigger notifications for added members
        if (addedMembers.length > 0) {
          // Get all existing team members to notify them about new additions
          const existingMemberEmails = existingCareer.teamMembers?.map((m: any) => m.email).filter(Boolean) || [];

          for (const member of addedMembers) {
            // Notify the new member about being added
            await triggerTeamMembershipNotification(db, {
              entityId: id,
              entityType: 'career',
              entityName: sanitizedJobTitle,
              action: 'added',
              actorId: actorEmail,
              affectedUserIds: [member.email],
              orgID,
              metadata: {
                role: member.role,
              },
            });

            // Notify existing team members about the new addition
            if (existingMemberEmails.length > 0) {
              await triggerCareerUpdateNotification(db, {
                careerId: id,
                careerTitle: sanitizedJobTitle,
                actorId: actorEmail,
                recipientIds: existingMemberEmails,
                orgID,
                changes: [`${member.role} added`],
              });
            }
          }
        }

        // Trigger notifications for removed members
        if (removedMembers.length > 0) {
          // Get all remaining team members to notify them about removals
          const remainingMemberEmails = career.teamMembers?.map((m: any) => m.email).filter(Boolean) || [];

          for (const member of removedMembers) {
            // Notify the removed member
            await triggerTeamMembershipNotification(db, {
              entityId: id,
              entityType: 'career',
              entityName: sanitizedJobTitle,
              action: 'removed',
              actorId: actorEmail,
              affectedUserIds: [member.email],
              orgID,
              metadata: {
                role: member.role,
              },
            });

            // Notify remaining team members about the removal
            if (remainingMemberEmails.length > 0) {
              await triggerCareerUpdateNotification(db, {
                careerId: id,
                careerTitle: sanitizedJobTitle,
                actorId: actorEmail,
                recipientIds: remainingMemberEmails,
                orgID,
                changes: [`${member.role} removed`],
              });
            }
          }
        }

        // 4. Check for general career updates (non-status, non-team changes)
        const hasContentChanges =
          existingCareer.jobTitle !== sanitizedJobTitle ||
          existingCareer.description !== sanitizedDescription ||
          existingCareer.location !== sanitizedLocation ||
          JSON.stringify(existingCareer.questions) !== JSON.stringify(sanitizedQuestions);

        if (hasContentChanges && !addedMembers.length && !removedMembers.length) {
          const teamMemberIds = career.teamMembers?.map((m: any) => m.email).filter(Boolean) || [];

          await triggerCareerUpdateNotification(db, {
            careerId: id,
            careerTitle: sanitizedJobTitle,
            actorId: actorEmail,
            recipientIds: teamMemberIds,
            orgID,
          });
        }
      } catch (notificationError) {
        // Log but don't fail the career update
        console.error('[upsert-career] Failed to trigger notifications:', notificationError);
      }

      const updatedCareer = await db.collection("careers").findOne({ id });
      return NextResponse.json({
        message: "Career updated successfully",
        career: updatedCareer,
      }, { status: 200 });
    }
    // Create new career
    const newCareer = await db.collection("careers").insertOne({
      ...career,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActivityAt: new Date(),
    });

    // Trigger notifications for new career creation
    const actorEmail = request.user?.email;
    try {
      // If the new career is published (status: 'active'), send published notification
      if (career.status === 'active') {
        const teamMemberIds = career.teamMembers
          ?.map((m: any) => m.email)
          .filter((email: string) => email && email !== actorEmail) || [];

        if (teamMemberIds.length > 0) {
          await triggerCareerStatusNotification(db, {
            careerId: id,
            careerTitle: sanitizedJobTitle,
            isPublished: true,
            actorId: actorEmail,
            recipientIds: teamMemberIds,
            orgID,
          });
        }
      } else {
        // If unpublished, notify team members that they were added to the career
        if (teamMembers.length > 0) {
          for (const member of teamMembers) {
            if (member.email && member.email !== actorEmail) {
              await triggerTeamMembershipNotification(db, {
                entityId: id,
                entityType: 'career',
                entityName: sanitizedJobTitle,
                action: 'added',
                actorId: actorEmail,
                affectedUserIds: [member.email],
                orgID,
                metadata: {
                  role: member.role,
                },
              });
            }
          }
        }
      }
    } catch (notificationError) {
      // Log but don't fail the career creation
      console.error('[upsert-career] Failed to trigger new career notifications:', notificationError);
    }

    return NextResponse.json({
      message: "Career added successfully",
      career: newCareer,
    }, { status: 200 });
  } catch (error) {
    console.error("Error adding career:", error);
    return NextResponse.json(
      { error: "Failed to add career" },
      { status: 500 }
    );
  }
});
