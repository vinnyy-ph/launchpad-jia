import { ObjectId } from "mongodb";
import {
  getTalentVaultInProgressStep,
  isTalentVaultSetupComplete,
  resolveTalentVaultExpiresAt,
  type TalentVaultSetupCurrentStep,
  type TalentVaultSetupStepKey,
  type TalentVaultSetupState,
} from "@/app/(talent-vault)/lib/talentVaultStatus";

type SetupData = Record<TalentVaultSetupStepKey, TalentVaultSetupState> & {
  currentStep: TalentVaultSetupCurrentStep | null;
};

const SETUP_STATUS_KEYS: TalentVaultSetupStepKey[] = [
  "cvProfile",
  "goalSetting",
  "preScreening",
  "aiInterview",
];

function toCurrentStepFromStatusStep(
  statusStep: TalentVaultSetupStepKey | null
): TalentVaultSetupCurrentStep | null {
  if (statusStep === "cvProfile") {
    return "submitCV";
  }

  if (statusStep === "goalSetting") {
    return "goalSetting";
  }

  if (statusStep === "preScreening") {
    return "preScreening";
  }

  if (statusStep === "aiInterview") {
    return "aiInterview";
  }

  return null;
}

function toStatusStepFromCurrentStep(
  currentStep: TalentVaultSetupCurrentStep
): TalentVaultSetupStepKey {
  if (currentStep === "submitCV" || currentStep === "verifyProfile") {
    return "cvProfile";
  }

  return currentStep;
}

function getNormalizedCurrentStep(
  inputCurrentStep: unknown,
  inProgressStep: TalentVaultSetupStepKey | null
): TalentVaultSetupCurrentStep | null {
  if (!inProgressStep) {
    return null;
  }

  if (inProgressStep === "cvProfile") {
    if (inputCurrentStep === "submitCV" || inputCurrentStep === "verifyProfile") {
      return inputCurrentStep;
    }

    return "submitCV";
  }

  return toCurrentStepFromStatusStep(inProgressStep);
}

type CreateProfileParams = {
  applicantId: ObjectId | null;
  name: string;
  email: string;
  image: string;
};

export function createDefaultTalentVaultSetup(): SetupData {
  return {
    cvProfile: "in_progress",
    goalSetting: "pending",
    preScreening: "pending",
    aiInterview: "pending",
    currentStep: "submitCV",
  };
}

export function createDefaultTalentVaultProfile({
  applicantId,
  name,
  email,
  image,
}: CreateProfileParams) {
  const now = new Date();

  return {
    applicantId,
    userInfo: {
      name,
      email,
      image,
    },
    state: "draft",
    status: "inactive",
    completedAt: null,
    expiresAt: null,
    counters: {
      employerRequests: 0,
      profileViews: 0,
    },
    setup: createDefaultTalentVaultSetup(),
    profile: {
      digitalCV: [],
      education: [],
      matchingSignals: null,
      goals: {
        workGoals: [],
        startDatePreference: null,
        fieldOfInterests: [],
        careerGoalIds: [],
        careerGoalsSnapshot: [],
      },
      preScreening: [],
    },
    latestAssessment: {
      preScreeningAssessmentId: null,
      aiInterviewAssessmentId: null,
      pendingAiInterviewAssessmentId: null,
    },
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeSetup(input: any): SetupData {
  const setup = createDefaultTalentVaultSetup();

  for (const key of SETUP_STATUS_KEYS) {
    const value = input?.[key];
    if (value === "pending" || value === "in_progress" || value === "done" || value === "skipped") {
      setup[key] = value;
    }
  }

  const inProgressStep = getTalentVaultInProgressStep(setup);

  if (inProgressStep && setup[inProgressStep] === "pending") {
    setup[inProgressStep] = "in_progress";
  }

  setup.currentStep = getNormalizedCurrentStep(input?.currentStep, inProgressStep);

  return setup;
}

export function markStepAsDone(inputSetup: any, step: TalentVaultSetupStepKey) {
  const setup = normalizeSetup(inputSetup);
  setup[step] = "done";

  const inProgressStep = getTalentVaultInProgressStep(setup);

  if (inProgressStep && setup[inProgressStep] === "pending") {
    setup[inProgressStep] = "in_progress";
  }

  setup.currentStep = toCurrentStepFromStatusStep(inProgressStep);

  return setup;
}

export function recalculateSetupCurrentStep(inputSetup: any) {
  const setup = normalizeSetup(inputSetup);
  const inProgressStep = getTalentVaultInProgressStep(setup);

  if (inProgressStep && setup[inProgressStep] === "pending") {
    setup[inProgressStep] = "in_progress";
  }

  setup.currentStep = toCurrentStepFromStatusStep(inProgressStep);
  return setup;
}

export function setSetupCurrentStep(
  inputSetup: any,
  currentStep: TalentVaultSetupCurrentStep
) {
  const setup = normalizeSetup(inputSetup);
  const statusStep = toStatusStepFromCurrentStep(currentStep);

  if (statusStep === "cvProfile" && setup.cvProfile === "done") {
    const inProgressStep = getTalentVaultInProgressStep(setup);
    setup.currentStep = toCurrentStepFromStatusStep(inProgressStep);
    return setup;
  }

  if (setup[statusStep] === "skipped") {
    const inProgressStep = getTalentVaultInProgressStep(setup);
    setup.currentStep = toCurrentStepFromStatusStep(inProgressStep);
    return setup;
  }

  if (setup[statusStep] === "pending") {
    setup[statusStep] = "in_progress";
  }

  setup.currentStep = currentStep;

  return setup;
}

export function toTimestampMs(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value instanceof Date) {
    const dateMs = value.getTime();
    return Number.isNaN(dateMs) ? null : dateMs;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const dateMs = new Date(value).getTime();
    return Number.isNaN(dateMs) ? null : dateMs;
  }

  return null;
}

type HandleTalentVaultInterviewCompletionParams = {
  db: any;
  interviewObjectId: ObjectId;
  interviewDoc: any;
  completedInterviewID: string;
};

export function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function toNormalizedName(input: string) {
  return input.toLowerCase().trim().replace(/\s+/g, " ");
}

export async function handleTalentVaultInterviewCompletion({
  db,
  interviewObjectId,
  interviewDoc,
  completedInterviewID,
}: HandleTalentVaultInterviewCompletionParams) {
  const isTalentVaultRetakeCompletion = interviewDoc?.retakeInProgress === true;
  const retakePreparedAtMs = isTalentVaultRetakeCompletion
    ? toTimestampMs(interviewDoc?.retakePreparedAt)
    : null;

  let cleanedLegacyTranscriptCount = 0;
  let clearedLegacyRecording = false;

  if (isTalentVaultRetakeCompletion && completedInterviewID) {
    if (retakePreparedAtMs !== null) {
      const transcriptDocs = await db
        .collection("transcripts")
        .find(
          { interviewID: completedInterviewID },
          {
            projection: {
              _id: 1,
              time: 1,
            },
          }
        )
        .toArray();

      const legacyTranscriptIds = transcriptDocs
        .filter((transcriptDoc: any) => {
          const transcriptTimeMs = toTimestampMs(transcriptDoc?.time);
          return transcriptTimeMs !== null && transcriptTimeMs < retakePreparedAtMs;
        })
        .map((transcriptDoc: any) => transcriptDoc?._id)
        .filter(Boolean);

      cleanedLegacyTranscriptCount = legacyTranscriptIds.length;

      if (legacyTranscriptIds.length > 0) {
        await db.collection("transcripts").deleteMany({
          _id: { $in: legacyTranscriptIds },
        });
      }

      await db.collection("feedback").deleteMany({
        interviewID: completedInterviewID,
      });
    }

    const latestInterviewDoc = await db.collection("interviews").findOne({
      _id: interviewObjectId,
    });
    const recordingUpdatedAtMs = toTimestampMs(latestInterviewDoc?.interviewRecordingUpdatedAt);
    const shouldClearLegacyRecording =
      retakePreparedAtMs === null ||
      recordingUpdatedAtMs === null ||
      recordingUpdatedAtMs < retakePreparedAtMs;
    const retakeFinalizationUpdate: Record<string, unknown> = {
      retakeInProgress: false,
      retakePreparedAt: null,
      updatedAt: Date.now(),
    };

    if (shouldClearLegacyRecording) {
      retakeFinalizationUpdate.interviewRecording = null;
      retakeFinalizationUpdate.interviewRecordingUpdatedAt = null;
      clearedLegacyRecording = true;
    }

    await db.collection("interviews").updateOne(
      { _id: interviewObjectId },
      {
        $set: retakeFinalizationUpdate,
      }
    );
  }

  const profiles = db.collection("tv-profiles");
  let tvProfile = null;
  const interviewProfileId =
    typeof interviewDoc.tvProfileId === "string"
      ? interviewDoc.tvProfileId.trim()
      : "";

  if (interviewProfileId && ObjectId.isValid(interviewProfileId)) {
    tvProfile = await profiles.findOne({
      _id: new ObjectId(interviewProfileId),
    });
  }

  if (!tvProfile && interviewDoc.email) {
    const normalizedEmail = String(interviewDoc.email).trim().toLowerCase();
    if (normalizedEmail) {
      tvProfile = await profiles.findOne({
        "userInfo.email": normalizedEmail,
      });
    }
  }

  if (tvProfile) {
    const updatedSetup = markStepAsDone(tvProfile.setup, "aiInterview");
    const pendingInterviewID =
      typeof tvProfile?.latestAssessment?.pendingAiInterviewAssessmentId === "string"
        ? tvProfile.latestAssessment.pendingAiInterviewAssessmentId.trim()
        : "";
    const profileUpdate: any = {
      setup: updatedSetup,
      updatedAt: new Date(),
    };

    if (completedInterviewID && pendingInterviewID === completedInterviewID) {
      profileUpdate["latestAssessment.aiInterviewAssessmentId"] = completedInterviewID;
      profileUpdate["latestAssessment.pendingAiInterviewAssessmentId"] = null;
    }

    if (isTalentVaultSetupComplete(updatedSetup)) {
      const parsedCompletedAt = tvProfile.completedAt
        ? new Date(tvProfile.completedAt)
        : null;
      const completedAt =
        parsedCompletedAt && !Number.isNaN(parsedCompletedAt.getTime())
          ? parsedCompletedAt
          : new Date();

      profileUpdate.state = "completed";
      profileUpdate.status = "active";
      profileUpdate.completedAt = completedAt;
      profileUpdate.expiresAt = resolveTalentVaultExpiresAt(
        tvProfile.expiresAt || tvProfile.expirationDate,
        completedAt
      );
    }

    await profiles.updateOne(
      { _id: tvProfile._id },
      {
        $set: profileUpdate,
      }
    );
  }

  return {
    message: "Successfully Completed Interview",
    flow: "talent-vault",
    talentVault: {
      aiInterviewCompleted: Boolean(tvProfile),
      cleanedLegacyTranscriptCount,
      clearedLegacyRecording,
    },
  };
}
