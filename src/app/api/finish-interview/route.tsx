import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { sendEmail } from "@/lib/Email";
import { DEFAULT_JOB_PIPELINE } from "@/lib/utils/constants";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { sendEmailV2 } from "@/lib/utils/emailAutomation";
import { logActivity } from "@/lib/utils/activityLogger";
import { handleTalentVaultInterviewCompletion } from "@/app/(talent-vault)/lib/server/talentVaultProfiles";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { data } = await request.json();
    const interviewData = { ...data };

    if (!interviewData?._id) {
      return NextResponse.json(
        { error: "Interview _id is required" },
        { status: 400 }
      );
    }

    const interviewObjectId = new ObjectId(interviewData._id);
    const { db } = await connectMongoDB();

    const interviewDoc = await db.collection("interviews").findOne({
      _id: interviewObjectId,
    });

    if (!interviewDoc) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    const flow = interviewDoc.flow || interviewData.flow;

    if (
      flow === "talent-vault"
    ) {
      const userEmail = request.user.email?.trim().toLowerCase();
      if (userEmail) {
        const tvProfile = await db.collection("tv-profiles").findOne({
          "userInfo.email": userEmail,
        });
        const profileId = tvProfile?._id?.toString() || null;
        const interviewProfileId = String(interviewDoc.tvProfileId || "").trim();

        if (!profileId || !interviewProfileId || interviewProfileId !== profileId) {
          return NextResponse.json({ error: "Interview not found" }, { status: 404 });
        }
      }
    }

    const now = Date.now();
    const completedInterviewID =
      typeof interviewDoc.interviewID === "string" ? interviewDoc.interviewID.trim() : "";
    const interviewUpdate: any = {
      interviewCompleted: true,
      aiInterviewCompletedAt: now,
      tabSwitchCount: interviewData.switchTabCount,
      completedAt: now,
      updatedAt: now,
      status: "For AI Interview Review",
      currentStep: "AI Interview",
    };

    if (flow !== "talent-vault") {
      interviewUpdate.stageId = DEFAULT_JOB_PIPELINE?.[1]?.id;
      interviewUpdate.substageId = DEFAULT_JOB_PIPELINE?.[1]?.substages?.[1]?.id;
    }

    await db.collection("interviews").updateOne(
      {
        _id: interviewObjectId,
      },
      {
        $set: interviewUpdate,
      }
    );

    // Clean up session continuity context now that interview is complete
    if (interviewDoc?.interviewID) {
      await db
        .collection("interview-session-context")
        .deleteOne({ interviewID: interviewDoc.interviewID });
    }

    if (flow === "talent-vault") {
      const result = await handleTalentVaultInterviewCompletion({
        db,
        interviewObjectId,
        interviewDoc,
        completedInterviewID,
      });

      return NextResponse.json(result);
    }

    // await sendEmail({
    //   recipient: interviewData.email,
    //   html: `
    //     <div>
    //       <p>Dear ${interviewData.name},</p>
    //       <p>Your interview has been successfully completed.</p>
    //       <p>Please wait for the result of your interview as it will be screened and graded.</p>
    //     </div>
    //   `,
    // });

    // Update career lastActivityAt to current date
    if (interviewData.id) {
      await db
        .collection("careers")
        .updateOne(
          { id: interviewData.id },
          { $set: { lastActivityAt: new Date() } }
        );
    }
    const career = await db
      .collection("careers")
      .findOne({ id: interviewData.id });

    const toStageName = `${DEFAULT_JOB_PIPELINE?.[1]?.name}: ${DEFAULT_JOB_PIPELINE?.[1]?.substages?.[1]?.name}`;
    const interviewTransaction = {
      interviewUID: interviewData._id.toString(),
      careerId: career?._id?.toString(),
      fromStage: "Pending AI Interview",
      toStage: toStageName,
      fromStageId: DEFAULT_JOB_PIPELINE?.[1]?.id,
      fromSubstageId: DEFAULT_JOB_PIPELINE?.[1]?.substages?.[0]?.id,
      toStageId: DEFAULT_JOB_PIPELINE?.[1]?.id,
      toSubstageId: DEFAULT_JOB_PIPELINE?.[1]?.substages?.[1]?.id,
      action: "Auto-Promoted",
      updatedBy: {
        name: "Jia",
      },
    };

    await db.collection("interview-history").insertOne({
      ...interviewTransaction,
      createdAt: Date.now(),
    });

    // Log that candidate completed the AI interview
    await logActivity({
      db,
      kind: "candidate_completed_ai_interview",
      interview: interviewData,
      career,
      actor: {
        type: "candidate",
        name: interviewData.name || "Candidate",
        email: interviewData.email,
      },
    });

    // Record activity history for AI interview auto-promotion
    await logActivity({
      db,
      kind: "system_endorsed",
      interview: interviewData,
      career,
      extraMetadata: {
        message: "AI interview completed and auto-promoted",
        fromStage: "Pending AI Interview",
        toStage: toStageName,
        toStageName,
      },
    });

    sendEmailV2({
      email: interviewData.email,
      stage_id: DEFAULT_JOB_PIPELINE?.[1]?.id,
      substage_id: DEFAULT_JOB_PIPELINE?.[1]?.substages?.[1]?.id,
      trigger_on_event: "Endorse",
      from_stage: `${DEFAULT_JOB_PIPELINE?.[1]?.name}: ${DEFAULT_JOB_PIPELINE?.[1]?.substages?.[0]?.name}`,
      to_stage: `${DEFAULT_JOB_PIPELINE?.[1]?.name}: ${DEFAULT_JOB_PIPELINE?.[1]?.substages?.[1]?.name}`,
      careerId: career?._id?.toString(),
      orgID: career?.orgID,
      userId: null,
    });

    return NextResponse.json({
      message: "Successfully Completed Interview",
    });
  } catch (error) {
    console.error("Error finishing interview:", error);
    return NextResponse.json(
      { error: "Failed to complete interview" },
      { status: 500 }
    );
  }
});
