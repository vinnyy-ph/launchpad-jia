import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { guid } from "@/lib/Utils";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { logActivity } from "@/lib/utils/activityLogger";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const {
      jobTitle,
      headcount,
      project,
      description,
      questions,
      lastEditedBy,
      createdBy,
      screeningSetting,
      orgID,
      requireVideo,
      location,
      workSetup,
      status,
      salaryNegotiable,
      minimumSalary,
      maximumSalary,
      country,
      province,
      employmentType,
      teamMembers,
      preScreeningQuestions,
      pipelineStages,
      cvSecretPrompt,
      interviewSecretPrompt,
      parentCareerID,
      jobPostType,
      careerPostType,
      voice,
      salaryUnit,
      salaryCurrency,
      showSalaryToApplicants,
      globalHiringEnabled,
      aiInterviewLanguage,
      walkthroughLanguage,
    } = await request.json();
    // Validate required fields
    if (!jobTitle || !description || !questions || !location || !workSetup) {
      console.error("[add-career] Missing required data: jobTitle, description, questions, location, or workSetup");
      return NextResponse.json(
        {
          error: "Missing required data",
        },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Validate parentCareerID if provided
    if (parentCareerID) {
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

    // Enforce per-type job post limits when a typed plan is configured.
    // Falls back to legacy org-level jobLimit when per-type info is unavailable.
    const isPremiumPost = jobPostType === "premium";
    const isCreditBasedPost = jobPostType === "credit-based";
    let perTypeLimitHandled = false;

    if (isPremiumPost || isCreditBasedPost) {
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

          const usedForType = await careersCollection.countDocuments({
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
        // If baseMaxActiveJobPosts is null/undefined, the plan is unlimited - no limit check needed
      }
    }

    if (!perTypeLimitHandled) {
      const totalActiveCareers = await careersCollection.countDocuments({
        orgID,
        status: "active",
      });

      const totalAdjustment =
        (organization.creditBasedPlan?.jobSlotAdjustment || 0) +
        (organization.premiumPlan?.jobSlotAdjustment || 0);

      if (
        totalActiveCareers >=
        (organization.plan?.jobLimit || 0) + totalAdjustment
      ) {
        const hasAnyActivePlan = organization.plan?.jobLimit !== undefined && organization.plan?.jobLimit !== null;
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

    // Ensure creator is added as Job Owner if not already in team members
    let finalTeamMembers = teamMembers || [];
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
        },
        ...finalTeamMembers,
      ];
    }

    const career = {
      id: guid(),
      jobTitle,
      headcount,
      project,
      description,
      questions,
      location,
      workSetup,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedBy,
      createdBy,
      status: status || "active",
      screeningSetting,
      orgID,
      requireVideo,
      lastActivityAt: new Date(),
      salaryNegotiable,
      minimumSalary,
      maximumSalary,
      country,
      province,
      employmentType,
      teamMembers: finalTeamMembers,
      preScreeningQuestions: preScreeningQuestions || [],
      pipelineStages: pipelineStages || [],
      cvSecretPrompt: cvSecretPrompt || "",
      interviewSecretPrompt: interviewSecretPrompt || "",
      parentCareerID: parentCareerID || null,
      jobPostType: jobPostType || null,
      careerPostType: careerPostType || null,
      voice: voice || null,
      salaryUnit: salaryUnit || "Monthly",
      salaryCurrency: salaryCurrency || "PHP",
      showSalaryToApplicants: showSalaryToApplicants ?? true,
      globalHiringEnabled: globalHiringEnabled ?? false,
      aiInterviewLanguage: aiInterviewLanguage || "English",
      walkthroughLanguage: walkthroughLanguage === "tagalog" ? "tagalog" : "english",
    };

    const insertResult = await db.collection("careers").insertOne(career);

    // Log career creation activity 
    try {
      const isPublished = (status || "active") === "active";
      // For new careers, all fields are "changed" 
      const changedFields = Object.keys(career).filter(key => career[key as keyof typeof career] !== null && career[key as keyof typeof career] !== undefined);
      const careerIdForActivity = insertResult.insertedId?.toString();

      await logActivity({
        db,
        kind: isPublished ? "recruiter_published_career" : "recruiter_edited_career_details",
        career: { ...career, id: career.id, _id: insertResult.insertedId },
        orgID,
        careerId: careerIdForActivity,
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
    } catch (logError) {
      console.error("Failed to log career activity:", logError);
    }

    return NextResponse.json({
      message: "Career added successfully",
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
