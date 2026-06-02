import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { DEFAULT_JOB_PIPELINE } from "../../../lib/utils/constants";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

function resolveInterviewConfig(settings: any, flow: unknown) {
  if (!settings || typeof settings !== "object") {
    return settings;
  }

  if (flow !== "talent-vault") {
    return settings;
  }

  const talentVaultSettings =
    settings.talentVault && typeof settings.talentVault === "object"
      ? settings.talentVault
      : {};

  return {
    ...settings,
    traits_prompt: talentVaultSettings.traits_prompt || settings.traits_prompt,
    analysis_prompt: talentVaultSettings.analysis_prompt || settings.analysis_prompt,
    summary_prompt: talentVaultSettings.summary_prompt || settings.summary_prompt,
  };
}

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { id, orgID, searchBy } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Interview ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    let query: any = {};
    
    if (searchBy === "_id") {
      try {
        query._id = ObjectId.createFromHexString(id);
      } catch (e) {
        return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
      }
    } else {
      query.interviewID = id;
    }

    if (orgID) {
      query.orgID = orgID;
    }

    let interview = await db.collection("interviews").findOne(query);

    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    if (interview.flow === "talent-vault") {
      const userEmail = request.user.email?.trim().toLowerCase();
      if (userEmail) {
        const tvProfile = await db.collection("tv-profiles").findOne({
          "userInfo.email": userEmail,
        });
        const profileId = tvProfile?._id?.toString() || null;
        const interviewProfileId = String(interview.tvProfileId || "").trim();

        if (!profileId || !interviewProfileId || interviewProfileId !== profileId) {
          return NextResponse.json(
            { error: "Interview not found" },
            { status: 404 }
          );
        }
      }
    }

    const settings = await db.collection("global-settings").findOne({
      name: "global-settings",
    });

    if (interview.flow === "talent-vault") {
      if (!Array.isArray(interview.questions)) {
        interview.questions = [];
      }

      if (typeof interview.jobTitle !== "string" || interview.jobTitle.trim().length === 0) {
        interview.jobTitle = "Talent Vault";
      }

      if (
        typeof interview.description !== "string" ||
        interview.description.trim().length === 0
      ) {
        interview.description =
          "Talent Vault interview focused on the candidate's profile and career goals.";
      }

      if (typeof interview.status !== "string" || interview.status.trim().length === 0) {
        interview.status = "For AI Interview";
      }
    } else {
      const career = await db.collection("careers").findOne({ id: interview.id });

      if (career) {
        interview.careerID = career._id;
        interview.pipelineStages = career.pipelineStages || DEFAULT_JOB_PIPELINE;
        interview.aiInterviewLanguage = career.aiInterviewLanguage || "English";

        // Override global voice with career-specific voice if it exists
        if (career.voice) {
          settings.voice = career.voice;
        }
      }
    }

    interview.config = resolveInterviewConfig(settings, interview.flow);

    return NextResponse.json(interview);
  } catch (error) {
    console.error("Error fetching interview:", error);
    return NextResponse.json(
      { error: "Failed to fetch career data" },
      { status: 500 }
    );
  }
});
