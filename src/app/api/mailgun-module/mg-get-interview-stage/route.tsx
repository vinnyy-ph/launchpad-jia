import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { getCurrentPipelineStage } from "@/lib/Utils";
import { DEFAULT_JOB_PIPELINE } from "@/lib/utils/constants";

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const url = new URL(req.url);
    const applicantEmail = url.searchParams.get("applicantEmail");
    const careerId = url.searchParams.get("careerId");
    const orgId = url.searchParams.get("orgId");

    if (!applicantEmail) {
      return NextResponse.json(
        { error: "Applicant email is required" },
        { status: 400 }
      );
    }

    if (!careerId) {
      return NextResponse.json(
        { error: "Career ID is required" },
        { status: 400 }
      );
    }

    if (!orgId || !ObjectId.isValid(orgId)) {
      return NextResponse.json(
        { error: "Valid organization ID is required" },
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

    // Normalize email for comparison
    const normalizedEmail = String(applicantEmail).toLowerCase().trim();

    // Find interview for this applicant and career
    const interview = await db.collection("interviews").findOne({
      email: normalizedEmail,
      id: careerId, // careerId in interviews collection is stored in the 'id' field
      orgID: orgId,
      // Only include active applications
      $or: [
        { applicationStatus: "Ongoing" },
        { applicationStatus: null },
        { applicationStatus: { $exists: false } },
      ],
    });

    if (!interview) {
      return NextResponse.json({ stage: null });
    }

    // Fetch career to get pipeline stages
    const career = await db.collection("careers").findOne({
      id: careerId,
      orgID: orgId,
    });

    const pipelineStages =
      career?.pipelineStages || DEFAULT_JOB_PIPELINE;

    // Get current stage using the utility function
    const currentStage = getCurrentPipelineStage(pipelineStages, {
      status: interview.status || "",
      currentStep: interview.currentStep || "",
      stageId: interview.stageId,
      substageId: interview.substageId,
    });

    let stageLabel = "Unknown";

    if (currentStage) {
      stageLabel = `${currentStage.stage.name} - ${currentStage.substage.name}`;
    } else {
      // Fallback: use currentStep and status directly
      stageLabel = `${interview.currentStep || "Unknown"} - ${
        interview.status || "Unknown"
      }`;
    }

    return NextResponse.json({ stage: stageLabel });
  } catch (error: any) {
    console.error("Error fetching interview stage:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch interview stage",
        details: error.message,
      },
      { status: 500 }
    );
  }
});
