import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { findTalentVaultProfile } from "@/app/(talent-vault)/lib/server/findTalentVaultProfile";
import {
  createDefaultTalentVaultSetup,
  createDefaultTalentVaultProfile,
  escapeRegex,
  markStepAsDone,
  normalizeSetup,
  recalculateSetupCurrentStep,
  setSetupCurrentStep,
  toNormalizedName,
} from "@/app/(talent-vault)/lib/server/talentVaultProfiles";
import { buildApplicantCvUpdateSet } from "@/app/(talent-vault)/lib/server/applicantCvSync";
import { normalizeStructuredCVInput } from "@/lib/utils/structuredCV";
import { tvErrorResponse } from "@/app/api/talent-vault/lib/tvApiError";
import {
  TALENT_VAULT_ACTIVE_DURATION_DAYS,
  resolveTalentVaultExpiresAt,
  type TalentVaultSetupCurrentStep,
} from "@/app/(talent-vault)/lib/talentVaultStatus";

type UpdateAction =
  | "save_cv_profile"
  | "save_goal_setting"
  | "save_pre_screening_assessment"
  | "save_profile_sections"
  | "reactivate_profile"
  | "set_visibility_status"
  | "set_setup_step_status"
  | "ensure_ai_interview"
  | "retake_ai_interview"
  | "prepare_ai_interview_retake";

type DigitalCvSection = {
  name: string;
  content: string;
};

type MatchingSignals = {
  roleTitles: string[];
  hardSkills: string[];
  domains: string[];
  industries: string[];
  seniority: "intern" | "junior" | "associate" | "mid" | "senior" | null;
  keywords: string[];
  confidence: number | null;
};

const ALLOWED_SETUP_CURRENT_STEPS: TalentVaultSetupCurrentStep[] = [
  "submitCV",
  "verifyProfile",
  "goalSetting",
  "preScreening",
  "aiInterview",
];

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let ensureTvProfilesIndexesPromise: Promise<void> | null = null;
let ensureTvInterviewIndexesPromise: Promise<void> | null = null;

async function ensureTvProfilesIndexes(db: any) {
  if (!ensureTvProfilesIndexesPromise) {
    ensureTvProfilesIndexesPromise = (async () => {
      const profiles = db.collection("tv-profiles");

      try {
        await profiles.createIndex(
          { applicantId: 1 },
          {
            unique: true,
            name: "uniq_tv_profiles_applicant_id",
            partialFilterExpression: {
              applicantId: { $type: "objectId" },
            },
          }
        );
      } catch (error: any) {
        const cannotCreatePartialIndex =
          error?.code === 67 || error?.codeName === "CannotCreateIndex";

        if (!cannotCreatePartialIndex) {
          throw error;
        }

        console.warn(
          "tv-profiles: skipped applicantId unique partial index",
          error?.message || error
        );
      }

      try {
        await profiles.createIndex(
          { "userInfo.email": 1 },
          {
            unique: true,
            name: "uniq_tv_profiles_email",
            partialFilterExpression: {
              "userInfo.email": { $type: "string" },
            },
          }
        );
      } catch (error: any) {
        const canSkipUniqueIndexError =
          error?.code === 67 ||
          error?.codeName === "CannotCreateIndex" ||
          error?.code === 11000 ||
          error?.codeName === "DuplicateKey";

        if (!canSkipUniqueIndexError) {
          throw error;
        }

        console.warn(
          "tv-profiles: skipped email unique partial index",
          error?.message || error
        );
      }

      await profiles.createIndex(
        { updatedAt: -1 },
        { name: "idx_tv_profiles_updated_at_desc" }
      );

      await profiles.createIndex(
        { "profile.goals.selectedSubprogramId": 1, createdAt: 1 },
        { name: "idx_tv_profiles_subprogram_created" }
      );
    })().catch((error) => {
      ensureTvProfilesIndexesPromise = null;
      throw error;
    });
  }

  await ensureTvProfilesIndexesPromise;
}

async function ensureTvInterviewIndexes(db: any) {
  if (!ensureTvInterviewIndexesPromise) {
    ensureTvInterviewIndexesPromise = (async () => {
      const interviews = db.collection("interviews");

      await interviews.createIndex(
        { flow: 1, tvProfileId: 1, updatedAt: -1 },
        { name: "idx_tv_interviews_profile_updated_at_desc" }
      );

      try {
        await interviews.createIndex(
          { flow: 1, tvProfileId: 1 },
          {
            unique: true,
            name: "uniq_tv_interviews_profile_id",
            partialFilterExpression: {
              flow: "talent-vault",
              tvProfileId: { $type: "string" },
            },
          }
        );
      } catch (error: any) {
        const canSkipUniqueIndexError =
          error?.code === 67 ||
          error?.codeName === "CannotCreateIndex" ||
          error?.code === 11000 ||
          error?.codeName === "DuplicateKey";

        if (!canSkipUniqueIndexError) {
          throw error;
        }

        console.warn(
          "tv-profiles: skipped talent-vault interview unique index",
          error?.message || error
        );
      }
    })().catch((error) => {
      ensureTvInterviewIndexesPromise = null;
      throw error;
    });
  }

  await ensureTvInterviewIndexesPromise;
}

function isSetupCurrentStep(value: unknown): value is TalentVaultSetupCurrentStep {
  return (
    typeof value === "string" &&
    ALLOWED_SETUP_CURRENT_STEPS.includes(value as TalentVaultSetupCurrentStep)
  );
}

function isInterviewId(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_REGEX.test(value.trim());
}

type TalentVaultGoalQuestionConfig = {
  title: string;
  questions: string[];
};

const TALENT_VAULT_INTERVIEW_JOB_TITLE = "Talent Vault";

// Legacy: retained for reference
const TALENT_VAULT_GOAL_QUESTION_BANK: Record<
  string,
  TalentVaultGoalQuestionConfig
> = {
  "stability-and-security": {
    title: "Stability and Security",
    questions: [
      "When you say stability, what does that mean to you in your first job, and which part matters most?",
      "What would make you feel secure in your first 90 days, and why?",
      "Tell me about a time you did your best work in a structured environment. What made it work for you?",
      "What trade-off would you accept for stability, and what is a dealbreaker?",
    ],
  },
  "gain-real-world-experience": {
    title: "Gain Real-World Experience",
    questions: [
      "What kind of real-world experience do you most want in your first role, and why?",
      "What would a successful first 3 months look like for you in terms of learning or accomplishments?",
      "Share an example where you learned fastest by doing. What was the task and what did you produce?",
      "What type of tasks would give you the most growth early on, and why?",
    ],
  },
  "mentorship-and-training": {
    title: "Mentorship and Training",
    questions: [
      "What does good mentorship look like to you week to week, and what is most helpful?",
      "How do you prefer to receive feedback when you are learning?",
      "Tell me about a time a mentor, teacher, or teammate helped you improve. What changed afterward?",
      "When you are stuck, what kind of support helps you most?",
    ],
  },
  "build-confidence-and-credibility": {
    title: "Build Confidence and Credibility",
    questions: [
      "What helps you feel confident you did good work, and why?",
      "Tell me about a time you doubted your work. How did you verify it or get reassurance?",
      "What would make you feel credible in your first 60 to 90 days at a job?",
      "When you make mistakes, what helps you recover quickly and keep momentum?",
    ],
  },
  "positive-company-culture": {
    title: "Positive Company Culture",
    questions: [
      "Describe a team environment where you thrive. What behaviors make it feel supportive?",
      "How do you prefer teammates to handle misunderstandings or mistakes?",
      "Tell me about a time you felt comfortable asking questions. What did the team do that made it easier?",
      "What is one culture red flag you want to avoid in your first job?",
    ],
  },
  "career-discovery-and-direction": {
    title: "Career Discovery and Direction",
    questions: [
      "What kinds of work energize you most, and why?",
      "Do you want a role where you deepen one area first or try a few responsibilities, and why?",
      "Tell me about a project or experience that felt most like you. Which parts did you enjoy most?",
      "If you could grow one skill strongly in the next 6 months, what would it be and what role helps you build it?",
    ],
  },
  "earn-fair-pay": {
    title: "Earn Fair Pay",
    questions: [
      "What does fair pay mean to you as an entry-level candidate?",
      "How do you weigh pay versus mentorship versus meaningful work early in your career?",
      "What would make an offer feel transparent and fair even if it is not the highest number?",
      "What is one compensation-related dealbreaker for you?",
    ],
  },
  "build-my-resume": {
    title: "Build My Resume",
    questions: [
      "What achievements would you be proud to put on your resume after 6 months in a role?",
      "What outcomes feel most meaningful for you to showcase to future employers, and why?",
      "Tell me about something you built or contributed to that you would want to highlight. What was your role and the result?",
      "What type of responsibilities would help you create strong, credible accomplishments early on?",
    ],
  },
  "work-life-balance": {
    title: "Work-Life Balance",
    questions: [
      "What does work-life balance mean to you in practice?",
      "When workload spikes, how do you manage your time and communicate limits while staying reliable?",
      "Tell me about a time you had multiple priorities. What system helped you stay on track?",
      "What work style helps you stay healthy and productive long term?",
    ],
  },
};

// Legacy: retained for reference
const TALENT_VAULT_GOAL_TITLE_TO_ID = new Map<string, string>(
  Object.entries(TALENT_VAULT_GOAL_QUESTION_BANK).map(
    ([goalId, goal]) => [goal.title.toLowerCase(), goalId] as [string, string]
  )
);

TALENT_VAULT_GOAL_TITLE_TO_ID.set(
  "career discover and direction",
  "career-discovery-and-direction"
);
TALENT_VAULT_GOAL_TITLE_TO_ID.set(
  "career discovery and direction",
  "career-discovery-and-direction"
);

// Legacy: retained for reference
function getSelectedTalentVaultGoalIds(profile: any) {
  const selectedGoalIds: string[] = [];
  const seenGoalIds = new Set<string>();

  const addGoalId = (goalId: unknown) => {
    const normalizedGoalId = String(goalId || "").trim().toLowerCase();
    if (!normalizedGoalId) return;
    if (!TALENT_VAULT_GOAL_QUESTION_BANK[normalizedGoalId]) return;
    if (seenGoalIds.has(normalizedGoalId)) return;

    seenGoalIds.add(normalizedGoalId);
    selectedGoalIds.push(normalizedGoalId);
  };

  const directGoalIds = Array.isArray(profile?.profile?.goals?.careerGoalIds)
    ? profile.profile.goals.careerGoalIds
    : [];
  directGoalIds.forEach(addGoalId);

  const goalSnapshots = Array.isArray(profile?.profile?.goals?.careerGoalsSnapshot)
    ? profile.profile.goals.careerGoalsSnapshot
    : [];

  goalSnapshots.forEach((goalSnapshot: any) => {
    const normalizedGoalTitle = String(goalSnapshot?.title || "")
      .trim()
      .toLowerCase();
    if (!normalizedGoalTitle) return;

    const mappedGoalId = TALENT_VAULT_GOAL_TITLE_TO_ID.get(normalizedGoalTitle);
    if (!mappedGoalId) return;

    addGoalId(mappedGoalId);
  });

  return selectedGoalIds;
}

// Legacy: retained for reference
function buildTalentVaultInterviewDescription(_profile: any, subprogram?: any) {
  const subprogramTitle = String(subprogram?.title || "").trim();
  const subprogramRoleType = String(subprogram?.roleType || "").trim();
  const identityParts = [subprogramTitle, subprogramRoleType].filter(Boolean);

  return [
    "This is a Talent Vault career interview.",
    identityParts.length > 0
      ? `Subprogram context: ${identityParts.join(" - ")}.`
      : "Subprogram context is not available.",
    "Assess the candidate using examples and preferences aligned with this subprogram.",
  ].join("\n");
}

// Legacy: retained for reference
function buildTalentVaultInterviewQuestions(_profile: any, subprogram?: any) {
  const subprogramInterviewCategories = Array.isArray(subprogram?.interview?.questions)
    ? subprogram.interview.questions
    : [];

  return subprogramInterviewCategories
    .map((cat: any) => {
      const mappedQuestions = Array.isArray(cat?.questions)
        ? cat.questions
            .map((entry: any) => {
              const questionText =
                typeof entry === "string"
                  ? entry.trim()
                  : typeof entry?.question === "string"
                    ? entry.question.trim()
                    : "";

              if (!questionText) {
                return null;
              }

              return {
                question: questionText,
              };
            })
            .filter(Boolean)
        : [];

      if (mappedQuestions.length === 0) {
        return null;
      }

      return {
        category: String(cat?.category || "").trim() || "Interview",
        questionCountToAsk: cat.questionCountToAsk ?? 2,
        questions: mappedQuestions,
      };
    })
    .filter(Boolean);
}

function buildTalentVaultInterviewCoreFields(params: {
  profile: any;
  subprogram?: any;
  email: string;
  fallbackName: string;
}) {
  const { profile, subprogram, email, fallbackName } = params;
  const profileId =
    profile?._id && typeof profile._id.toString === "function"
      ? profile._id.toString()
      : null;
  const subprogramId =
    subprogram?._id && typeof subprogram._id.toString === "function"
      ? subprogram._id.toString()
      : null;
  const aiInterviewLanguage = String(subprogram?.interview?.aiInterviewLanguage || "English")
    .trim();
  const voice =
    typeof subprogram?.interview?.voice === "string" && subprogram.interview.voice.trim()
      ? subprogram.interview.voice.trim()
      : null;
  const requireVideo =
    typeof subprogram?.interview?.requireVideo === "boolean"
      ? subprogram.interview.requireVideo
      : true;
  const walkthroughLanguage = String(subprogram?.interview?.walkthroughLanguage || "english")
    .trim()

  return {
    flow: "talent-vault",
    id: "talent-vault",
    tvProfileId: profileId,
    subprogramId,
    name: String(profile?.userInfo?.name || fallbackName || ""),
    email,
    jobTitle: TALENT_VAULT_INTERVIEW_JOB_TITLE,
    description: buildTalentVaultInterviewDescription(profile, subprogram),
    questions: buildTalentVaultInterviewQuestions(profile, subprogram),
    aiInterviewLanguage,
    voice,
    requireVideo,
    walkthroughLanguage,
  };
}

function createTalentVaultInterviewDoc(params: {
  interviewID: string;
  profile: any;
  subprogram?: any;
  email: string;
  fallbackName: string;
}) {
  const { interviewID } = params;
  const now = Date.now();
  const coreFields = buildTalentVaultInterviewCoreFields(params);

  return {
    interviewID,
    ...coreFields,
    status: "For AI Interview",
    currentStep: "AI Interview",
    stageId: null,
    substageId: null,
    createdAt: now,
    updatedAt: now,
  };
}

async function refreshTalentVaultInterviewCoreFields(
  interviews: any,
  params: {
    interviewID: string;
    profile: any;
    subprogram?: any;
    email: string;
    fallbackName: string;
  }
) {
  const { interviewID } = params;
  const coreFields = buildTalentVaultInterviewCoreFields(params);

  await interviews.updateOne(
    { interviewID },
    {
      $set: {
        ...coreFields,
        updatedAt: Date.now(),
      },
      $unset: {
        jobDescription: "",
      },
    }
  );
}

type TalentVaultInterviewDoc = {
  _id: unknown;
  interviewID?: unknown;
  tvProfileId?: unknown;
  status?: unknown;
  updatedAt?: unknown;
  createdAt?: unknown;
};

type ConsolidatedTalentVaultInterviewResult = {
  canonicalInterview: TalentVaultInterviewDoc | null;
  canonicalInterviewID: string | null;
  deletedDuplicateCount: number;
};

type EnsuredTalentVaultInterviewResult = {
  interviewID: string;
  interviewDoc: TalentVaultInterviewDoc;
  createdInterview: boolean;
  deletedDuplicateCount: number;
};

function toTimestampMs(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value instanceof Date) {
    const parsedDateMs = value.getTime();
    return Number.isNaN(parsedDateMs) ? 0 : parsedDateMs;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsedDateMs = new Date(value).getTime();
    return Number.isNaN(parsedDateMs) ? 0 : parsedDateMs;
  }

  return 0;
}

function getTalentVaultInterviewRecencyMs(interview: TalentVaultInterviewDoc) {
  return Math.max(
    toTimestampMs(interview?.updatedAt),
    toTimestampMs(interview?.createdAt)
  );
}

function getTalentVaultProfileId(profile: any) {
  return profile?._id && typeof profile._id.toString === "function"
    ? profile._id.toString()
    : null;
}

function buildTalentVaultInterviewCandidateQuery(
  profileId: string | null
) {
  if (!profileId) {
    return null;
  }

  return {
    flow: "talent-vault",
    tvProfileId: profileId,
  };
}

async function consolidateTalentVaultInterviewsForProfile(params: {
  db: any;
  interviews: any;
  profile: any;
}): Promise<ConsolidatedTalentVaultInterviewResult> {
  const { db, interviews, profile } = params;
  const profileId = getTalentVaultProfileId(profile);
  const candidateQuery = buildTalentVaultInterviewCandidateQuery(profileId);

  if (!candidateQuery) {
    return {
      canonicalInterview: null,
      canonicalInterviewID: null,
      deletedDuplicateCount: 0,
    };
  }

  const interviewDocs =
    ((await interviews.find(candidateQuery).toArray()) as TalentVaultInterviewDoc[]) || [];

  if (interviewDocs.length === 0) {
    return {
      canonicalInterview: null,
      canonicalInterviewID: null,
      deletedDuplicateCount: 0,
    };
  }

  const sortedInterviews = [...interviewDocs].sort((left, right) => {
    const recencyDifference =
      getTalentVaultInterviewRecencyMs(right) - getTalentVaultInterviewRecencyMs(left);

    if (recencyDifference !== 0) {
      return recencyDifference;
    }

    const leftId = String((left as any)?._id || "");
    const rightId = String((right as any)?._id || "");
    return rightId.localeCompare(leftId);
  });

  const [canonicalInterview, ...duplicates] = sortedInterviews;
  const canonicalInterviewID =
    typeof canonicalInterview?.interviewID === "string" &&
    canonicalInterview.interviewID.trim().length > 0
      ? canonicalInterview.interviewID.trim()
      : null;

  if (duplicates.length > 0) {
    const duplicateObjectIds = duplicates
      .map((interviewDoc) => interviewDoc?._id)
      .filter(Boolean);

    if (duplicateObjectIds.length > 0) {
      await interviews.deleteMany({ _id: { $in: duplicateObjectIds } });
    }

    const duplicateInterviewIDs = duplicates
      .map((interviewDoc) =>
        typeof interviewDoc?.interviewID === "string" && interviewDoc.interviewID.trim().length > 0
          ? interviewDoc.interviewID.trim()
          : ""
      )
      .filter(
        (duplicateInterviewID) =>
          Boolean(duplicateInterviewID) && duplicateInterviewID !== canonicalInterviewID
      );

    if (duplicateInterviewIDs.length > 0) {
      await Promise.all([
        db.collection("transcripts").deleteMany({
          interviewID: { $in: duplicateInterviewIDs },
        }),
        db.collection("feedback").deleteMany({
          interviewID: { $in: duplicateInterviewIDs },
        }),
      ]);
    }
  }

  return {
    canonicalInterview,
    canonicalInterviewID,
    deletedDuplicateCount: duplicates.length,
  };
}

async function fetchAndValidateSelectedSubprogram(db: any, profile: any) {
  const selectedSubprogramId =
    typeof profile?.profile?.goals?.selectedSubprogramId === "string"
      ? profile.profile.goals.selectedSubprogramId.trim()
      : "";

  if (!selectedSubprogramId) {
    return {
      subprogram: null,
      errorResponse: tvErrorResponse(
        400,
        "SELECTED_SUBPROGRAM_REQUIRED",
        "selectedSubprogramId is required"
      ),
    };
  }

  if (!ObjectId.isValid(selectedSubprogramId)) {
    return {
      subprogram: null,
      errorResponse: tvErrorResponse(
        400,
        "SUBPROGRAM_ID_INVALID",
        "selectedSubprogramId is required and must be a valid id"
      ),
    };
  }

  const subprogram = await db.collection("tv-subprograms").findOne(
    {
      _id: new ObjectId(selectedSubprogramId),
      archivedAt: null,
    },
    {
      projection: {
        title: 1,
        roleType: 1,
        status: 1,
        activityStatus: 1,
        interview: 1,
      },
    }
  );

  if (!subprogram) {
    return {
      subprogram: null,
      errorResponse: tvErrorResponse(
        404,
        "SUBPROGRAM_NOT_FOUND",
        "Selected subprogram was not found"
      ),
    };
  }

  const isEligibleSubprogram =
    String(subprogram.status || "").trim().toLowerCase() === "active" &&
    String(subprogram.activityStatus || "").trim() === "Active";

  if (!isEligibleSubprogram) {
    return {
      subprogram: null,
      errorResponse: tvErrorResponse(
        409,
        "SUBPROGRAM_NOT_ELIGIBLE",
        "Selected subprogram is not eligible"
      ),
    };
  }

  const interviewQuestions = Array.isArray(subprogram?.interview?.questions)
    ? subprogram.interview.questions
    : [];
  const totalQuestionCount = interviewQuestions.reduce((count: number, section: any) => {
    if (Array.isArray(section?.questions)) {
      return count + section.questions.length;
    }

    return count;
  }, 0);

  if (interviewQuestions.length === 0 || totalQuestionCount < 1) {
    return {
      subprogram: null,
      errorResponse: tvErrorResponse(
        422,
        "INTERVIEW_CONFIG_INVALID",
        "Selected subprogram interview configuration is invalid"
      ),
    };
  }

  return {
    subprogram,
    errorResponse: null,
  };
}

async function ensureCanonicalTalentVaultInterview(params: {
  db: any;
  interviews: any;
  profile: any;
  subprogram?: any;
  email: string;
  fallbackName: string;
}): Promise<EnsuredTalentVaultInterviewResult> {
  const { db, interviews, profile, subprogram, email, fallbackName } = params;
  const profileId = getTalentVaultProfileId(profile);

  if (!profileId) {
    throw new Error("Unable to resolve Talent Vault interview owner");
  }

  const consolidation = await consolidateTalentVaultInterviewsForProfile({
    db,
    interviews,
    profile,
  });
  let deletedDuplicateCount = consolidation.deletedDuplicateCount;

  let interviewDoc = consolidation.canonicalInterview;
  let interviewID =
    consolidation.canonicalInterviewID &&
    isInterviewId(consolidation.canonicalInterviewID)
      ? consolidation.canonicalInterviewID
      : null;
  let createdInterview = false;

  if (!interviewDoc) {
    const generatedInterviewID = randomUUID();
    const interviewToInsert = createTalentVaultInterviewDoc({
      interviewID: generatedInterviewID,
      profile,
      subprogram,
      email,
      fallbackName,
    });

    const upsertFilter = {
      flow: "talent-vault",
      tvProfileId: profileId,
    };

    const upsertResult = await interviews.updateOne(
      upsertFilter,
      {
        $setOnInsert: interviewToInsert,
      },
      { upsert: true }
    );

    createdInterview = upsertResult.upsertedCount > 0;

    if (createdInterview) {
      interviewDoc = await interviews.findOne({ interviewID: generatedInterviewID });
      interviewID = generatedInterviewID;
    } else {
      const postUpsertConsolidation = await consolidateTalentVaultInterviewsForProfile({
        db,
        interviews,
        profile,
      });
      deletedDuplicateCount += postUpsertConsolidation.deletedDuplicateCount;
      interviewDoc = postUpsertConsolidation.canonicalInterview;
      interviewID =
        postUpsertConsolidation.canonicalInterviewID &&
        isInterviewId(postUpsertConsolidation.canonicalInterviewID)
          ? postUpsertConsolidation.canonicalInterviewID
          : interviewID;
    }
  }

  if (!interviewDoc) {
    throw new Error("Failed to prepare Talent Vault interview");
  }

  if (!interviewID) {
    interviewID = randomUUID();
    await interviews.updateOne(
      { _id: interviewDoc._id },
      {
        $set: {
          interviewID,
          updatedAt: Date.now(),
        },
      }
    );
  }

  // Detect subprogram changes on canonical interview
  if (interviewDoc) {
    const currentSubprogramId =
      subprogram?._id && typeof subprogram._id.toString === "function"
        ? subprogram._id.toString()
        : null;
    const previousSubprogramId = interviewDoc["subprogramId" as keyof typeof interviewDoc];
    if (previousSubprogramId !== currentSubprogramId) {
      console.warn(
        "[TalentVault] Subprogram change detected",
        { previous: previousSubprogramId, current: currentSubprogramId }
      );
    }
  }

  await refreshTalentVaultInterviewCoreFields(interviews, {
    interviewID,
    profile,
    subprogram,
    email,
    fallbackName,
  });

  const refreshedInterviewDoc = await interviews.findOne({ interviewID });

  return {
    interviewID,
    interviewDoc: (refreshedInterviewDoc || interviewDoc) as TalentVaultInterviewDoc,
    createdInterview,
    deletedDuplicateCount,
  };
}

async function prepareTalentVaultInterviewRetake(params: {
  interviews: any;
  interviewID: string;
}) {
  const { interviews, interviewID } = params;
  const now = Date.now();

  await interviews.updateOne(
    { interviewID },
    {
      $set: {
        status: "For AI Interview",
        currentStep: "AI Interview",
        stageId: null,
        substageId: null,
        completedAt: null,
        retakeInProgress: true,
        retakePreparedAt: now,
        interviewParts: [],
        interviewUpload: null,
        retakeRequest: null,
        updatedAt: now,
      },
    }
  );
}

function normalizeDigitalCv(input: unknown): DigitalCvSection[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((section) => section && typeof section === "object")
    .map((section: any) => ({
      name: String(section.name || "").trim(),
      content: String(section.content || "").trim(),
    }))
    .filter((section) => section.name.length > 0);
}

function normalizeEducation(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.map((entry: any) => ({
    institutionId:
      typeof entry?.institutionId === "string"
        ? entry.institutionId.trim() || null
        : null,
    institution:
      typeof entry?.institution === "string" ? entry.institution.trim() || null : null,
    degree: typeof entry?.degree === "string" ? entry.degree.trim() || null : null,
    fieldOfStudy:
      typeof entry?.fieldOfStudy === "string"
        ? entry.fieldOfStudy.trim() || null
        : null,
    startDate:
      typeof entry?.startDate === "string" ? entry.startDate.trim() || null : null,
    endDate: typeof entry?.endDate === "string" ? entry.endDate.trim() || null : null,
  }));
}

function normalizeFileInfo(input: unknown) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const fileInfo = input as {
    name?: unknown;
    size?: unknown;
    type?: unknown;
  };

  const name = String(fileInfo.name || "").trim();
  const parsedSize = Number(fileInfo.size || 0);
  const type = String(fileInfo.type || "").trim();

  if (!name) {
    return null;
  }

  return {
    name,
    size: Number.isFinite(parsedSize) && parsedSize >= 0 ? parsedSize : 0,
    type,
  };
}

function normalizeMatchingSignalsTextList(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return Array.from(
    new Set(
      input
        .map((item) => String(item || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function normalizeMatchingSignals(input: unknown): MatchingSignals | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const payload = input as {
    roleTitles?: unknown;
    hardSkills?: unknown;
    domains?: unknown;
    industries?: unknown;
    seniority?: unknown;
    keywords?: unknown;
    confidence?: unknown;
  };

  const roleTitles = normalizeMatchingSignalsTextList(payload.roleTitles);
  const hardSkills = normalizeMatchingSignalsTextList(payload.hardSkills);
  const domains = normalizeMatchingSignalsTextList(payload.domains);
  const industries = normalizeMatchingSignalsTextList(payload.industries);
  const keywords = normalizeMatchingSignalsTextList(payload.keywords);

  const normalizedSeniority = String(payload.seniority || "").trim().toLowerCase();
  const seniority =
    normalizedSeniority === "intern" ||
    normalizedSeniority === "junior" ||
    normalizedSeniority === "associate" ||
    normalizedSeniority === "mid" ||
    normalizedSeniority === "senior"
      ? normalizedSeniority
      : null;

  const rawConfidence = Number(payload.confidence);
  const confidence = Number.isFinite(rawConfidence)
    ? Math.max(0, Math.min(1, rawConfidence))
    : null;

  const hasAnySignal =
    roleTitles.length > 0 ||
    hardSkills.length > 0 ||
    domains.length > 0 ||
    industries.length > 0 ||
    keywords.length > 0 ||
    seniority !== null;

  if (!hasAnySignal) {
    return null;
  }

  return {
    roleTitles,
    hardSkills,
    domains,
    industries,
    seniority,
    keywords,
    confidence,
  };
}

function extractOtherDegrees(
  input: unknown
): Array<{ name: string; normalizedName: string }> {
  if (!Array.isArray(input)) return [];

  const degreeMap = new Map<string, string>();

  for (const entry of input) {
    const isFromOthers = entry?.degreeFromOthers === true;
    if (!isFromOthers) continue;

    const name = typeof entry?.degree === "string" ? entry.degree.trim() : "";
    if (!name) continue;

    const normalizedName = toNormalizedName(name);
    if (!normalizedName || degreeMap.has(normalizedName)) continue;

    degreeMap.set(normalizedName, name);
  }

  return Array.from(degreeMap.entries()).map(([normalizedName, name]) => ({
    name,
    normalizedName,
  }));
}

function normalizeGoalsForProfileSections(
  input: any,
  existingGoals: any
) {
  const mergedInput = {
    ...(existingGoals && typeof existingGoals === "object" ? existingGoals : {}),
    ...(input && typeof input === "object" ? input : {}),
  };

  const normalizedGoals = normalizeGoals(mergedInput);

  return {
    ...normalizedGoals,
    fieldOfInterests: Array.isArray(normalizedGoals.fieldOfInterests)
      ? normalizedGoals.fieldOfInterests
      : [],
  };
}

function toComparableString(value: unknown) {
  return JSON.stringify(value);
}

type GoalSnapshot = {
  title: string;
  description: string;
};

type SubprogramSnapshot = {
  title: string;
  roleType: string;
};

type NormalizedGoals = {
  workGoals: string[];
  startDatePreference: "Immediate" | "Flexible" | null;
  fieldOfInterests: string[];
  careerGoalIds: string[];
  careerGoalsSnapshot: GoalSnapshot[];
  selectedSubprogramId: string;
  selectedSubprogramSnapshot: SubprogramSnapshot | null;
};

function normalizeGoals(input: any): NormalizedGoals {
  const workGoals = Array.isArray(input?.workGoals)
    ? input.workGoals.filter((workGoal: any) => typeof workGoal === "string")
    : [];

  const startDatePreference =
    input?.startDatePreference === "Immediate" || input?.startDatePreference === "Flexible"
      ? input.startDatePreference
      : null;

  const careerGoalIds = Array.isArray(input?.careerGoalIds)
    ? input.careerGoalIds
        .map((careerGoalId: any) => String(careerGoalId || "").trim())
        .filter(Boolean)
    : [];

  const fieldOfInterests = Array.isArray(input?.fieldOfInterests)
    ? input.fieldOfInterests
        .map((fieldOfInterest: any) => String(fieldOfInterest || "").trim())
        .filter(Boolean)
    : [];

  const careerGoalsSnapshot: GoalSnapshot[] = Array.isArray(input?.careerGoalsSnapshot)
    ? input.careerGoalsSnapshot
        .filter((goal: any) => goal && typeof goal === "object")
        .map((goal: any) => ({
          title: String(goal.title || "").trim(),
          description: String(goal.description || "").trim(),
        }))
        .filter((goal: GoalSnapshot) => goal.title.length > 0)
    : [];

  const selectedSubprogramId =
    typeof input?.selectedSubprogramId === "string"
      ? input.selectedSubprogramId.trim()
      : "";

  const selectedSubprogramSnapshotInput =
    input?.selectedSubprogramSnapshot && typeof input.selectedSubprogramSnapshot === "object"
      ? input.selectedSubprogramSnapshot
      : null;

  const selectedSubprogramSnapshot: SubprogramSnapshot | null = selectedSubprogramSnapshotInput
    ? (() => {
        const title = String(selectedSubprogramSnapshotInput.title || "").trim();
        const roleType = String(selectedSubprogramSnapshotInput.roleType || "").trim();

        if (!title && !roleType) {
          return null;
        }

        return {
          title,
          roleType,
        };
      })()
    : null;

  return {
    workGoals,
    startDatePreference,
    fieldOfInterests: Array.from(new Set(fieldOfInterests)),
    careerGoalIds,
    careerGoalsSnapshot,
    selectedSubprogramId,
    selectedSubprogramSnapshot,
  };
}

function normalizePreScreening(input: unknown) {
  if (!Array.isArray(input)) return [];

  return input
    .filter((question) => question && typeof question === "object")
    .map((question: any) => ({
      id: String(question.id || "").trim(),
      questionType: String(question.questionType || "").trim(),
      question: String(question.question || "").trim(),
      questionFormat: String(question.questionFormat || "").trim(),
      selectedAnswers: Array.isArray(question.selectedAnswers)
        ? question.selectedAnswers
            .filter((selectedAnswer: any) => selectedAnswer && typeof selectedAnswer === "object")
            .map((selectedAnswer: any) => ({
              id: selectedAnswer.id,
              value: selectedAnswer.value,
              type: String(selectedAnswer.type || "").trim(),
            }))
        : [],
      currencyCode:
        typeof question.currencyCode === "string" && question.currencyCode.trim().length > 0
          ? question.currencyCode.trim().toUpperCase()
          : undefined,
    }))
    .filter((question) => question.id.length > 0 && question.questionFormat.length > 0);
}

function getPreScreeningApplicantCvProjection(preScreening: any[]) {
  const updateSet: Record<string, any> = {
    updatedAt: Date.now(),
  };

  const workSetupQuestion = preScreening.find(
    (question) => question.id === "work-setup" || question.questionType === "Work Setup"
  );
  const workSetupValue =
    typeof workSetupQuestion?.selectedAnswers?.[0]?.value === "string"
      ? workSetupQuestion.selectedAnswers[0].value.trim()
      : "";

  if (workSetupValue) {
    updateSet.preferredWorkSetup = workSetupValue;
  }

  const salaryQuestion = preScreening.find(
    (question) =>
      question.id === "expected-monthly-salary" ||
      question.questionType === "Asking Salary"
  );

  if (salaryQuestion && Array.isArray(salaryQuestion.selectedAnswers)) {
    const minAnswer = salaryQuestion.selectedAnswers.find(
      (answer: any) => answer.type === "Minimum"
    );
    const maxAnswer = salaryQuestion.selectedAnswers.find(
      (answer: any) => answer.type === "Maximum"
    );

    const minValue = Number(minAnswer?.value);
    const maxValue = Number(maxAnswer?.value);

    if (!Number.isNaN(minValue) && minValue >= 0) {
      updateSet.askingSalary = minValue;
    }

    if (!Number.isNaN(maxValue) && maxValue >= 0) {
      updateSet.expectedSalary = maxValue;
    }

    if (typeof salaryQuestion.currencyCode === "string" && salaryQuestion.currencyCode) {
      updateSet.salaryCurrency = salaryQuestion.currencyCode;
    }
  }

  return updateSet;
}

async function resolveTalentVaultProfile(
  request: AuthenticatedRequest,
  options?: { createIfMissing?: boolean }
) {
  const { db } = await connectMongoDB();
  const email = request.user.email?.trim().toLowerCase();
  const createIfMissing = options?.createIfMissing === true;

  if (!email) {
    return {
      db,
      profile: null,
      created: false,
      error: tvErrorResponse(400, "USER_EMAIL_MISSING", "User email is missing"),
    };
  }

  await ensureTvProfilesIndexes(db);
  await ensureTvInterviewIndexes(db);

  const applicant = await db
    .collection("applicants")
    .findOne({
      $expr: {
        $eq: [{ $toLower: "$email" }, email],
      },
    });

  const existingProfile = await findTalentVaultProfile(db, {
    applicantId: applicant?._id,
    email,
  });

  if (existingProfile) {
    const normalizedSetup = normalizeSetup(existingProfile.setup);
    const resolvedExpiresAt = resolveTalentVaultExpiresAt(
      existingProfile.expiresAt || existingProfile.expirationDate,
      existingProfile.completedAt
    );
    const updatedUserInfo = {
      name:
        String(applicant?.name || request.user.name || existingProfile.userInfo?.name || "") ||
        "",
      email,
      image: String(
        applicant?.image || request.user.picture || existingProfile.userInfo?.image || ""
      ),
    };

    const normalizedProfilePatch = {
      ...existingProfile,
      applicantId: applicant?._id || existingProfile.applicantId || null,
      userInfo: updatedUserInfo,
      setup: normalizedSetup,
      profile: {
        digitalCV: Array.isArray(existingProfile.profile?.digitalCV)
          ? existingProfile.profile.digitalCV
          : [],
        education: Array.isArray(existingProfile.profile?.education)
          ? existingProfile.profile.education
          : [],
        fileInfo:
          existingProfile.profile?.fileInfo &&
          typeof existingProfile.profile.fileInfo === "object"
            ? {
                name: String(existingProfile.profile.fileInfo.name || ""),
                size: Number(existingProfile.profile.fileInfo.size || 0),
                type: String(existingProfile.profile.fileInfo.type || ""),
              }
            : null,
        matchingSignals: normalizeMatchingSignals(existingProfile.profile?.matchingSignals),
        goals: {
          workGoals: Array.isArray(existingProfile.profile?.goals?.workGoals)
            ? existingProfile.profile.goals.workGoals
            : [],
          startDatePreference:
            existingProfile.profile?.goals?.startDatePreference === "Immediate" ||
            existingProfile.profile?.goals?.startDatePreference === "Flexible"
              ? existingProfile.profile.goals.startDatePreference
              : null,
          fieldOfInterests: Array.isArray(
            existingProfile.profile?.goals?.fieldOfInterests
          )
            ? existingProfile.profile.goals.fieldOfInterests
            : [],
          careerGoalIds: Array.isArray(existingProfile.profile?.goals?.careerGoalIds)
            ? existingProfile.profile.goals.careerGoalIds
            : [],
          careerGoalsSnapshot: Array.isArray(
            existingProfile.profile?.goals?.careerGoalsSnapshot
          )
            ? existingProfile.profile.goals.careerGoalsSnapshot
            : [],
          selectedSubprogramId:
            typeof existingProfile.profile?.goals?.selectedSubprogramId === "string"
              ? existingProfile.profile.goals.selectedSubprogramId.trim()
              : "",
          selectedSubprogramSnapshot:
            existingProfile.profile?.goals?.selectedSubprogramSnapshot &&
            typeof existingProfile.profile.goals.selectedSubprogramSnapshot === "object"
              ? (() => {
                  const title = String(
                    existingProfile.profile.goals.selectedSubprogramSnapshot.title || ""
                  ).trim();
                  const roleType = String(
                    existingProfile.profile.goals.selectedSubprogramSnapshot.roleType || ""
                  ).trim();

                  if (!title && !roleType) {
                    return null;
                  }

                  return {
                    title,
                    roleType,
                  };
                })()
              : null,
        },
        preScreening: Array.isArray(existingProfile.profile?.preScreening)
          ? existingProfile.profile.preScreening
          : [],
      },
      state: typeof existingProfile.state === "string" ? existingProfile.state : "draft",
      status:
        typeof existingProfile.status === "string"
          ? existingProfile.status
          : "inactive",
      schemaVersion:
        typeof existingProfile.schemaVersion === "number"
          ? existingProfile.schemaVersion
          : 1,
      expiresAt: resolvedExpiresAt,
      updatedAt: new Date(),
    };

    await db.collection("tv-profiles").updateOne(
      { _id: existingProfile._id },
      {
        $set: {
          applicantId: normalizedProfilePatch.applicantId,
          userInfo: normalizedProfilePatch.userInfo,
          setup: normalizedProfilePatch.setup,
          profile: normalizedProfilePatch.profile,
          state: normalizedProfilePatch.state,
          status: normalizedProfilePatch.status,
          schemaVersion: normalizedProfilePatch.schemaVersion,
          expiresAt: normalizedProfilePatch.expiresAt,
          updatedAt: normalizedProfilePatch.updatedAt,
        },
      }
    );

    const refreshedProfile = await db
      .collection("tv-profiles")
      .findOne({ _id: existingProfile._id });

    return {
      db,
      profile: refreshedProfile,
      applicant,
      email,
      created: false,
      error: null,
    };
  }

  if (!createIfMissing) {
    return {
      db,
      profile: null,
      applicant,
      email,
      created: false,
      error: null,
    };
  }

  const profileToCreate = createDefaultTalentVaultProfile({
    applicantId: applicant?._id || null,
    name: String(applicant?.name || request.user.name || ""),
    email,
    image: String(applicant?.image || request.user.picture || ""),
  });

  const {
    applicantId: _defaultApplicantId,
    userInfo: _defaultUserInfo,
    updatedAt: _defaultUpdatedAt,
    ...insertOnlyProfile
  } = profileToCreate;

  const profile = await db.collection("tv-profiles").findOneAndUpdate(
    { "userInfo.email": email },
    {
      $setOnInsert: insertOnlyProfile,
      $set: {
        applicantId: applicant?._id || null,
        userInfo: {
          name: String(applicant?.name || request.user.name || ""),
          email,
          image: String(applicant?.image || request.user.picture || ""),
        },
        updatedAt: new Date(),
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  return {
    db,
    profile,
    applicant,
    email,
    created: true,
    error: null,
  };
}

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { db, profile, created, error } = await resolveTalentVaultProfile(request, {
    createIfMissing: false,
  });
  if (error) {
    return error;
  }

  if (!profile) {
    return tvErrorResponse(
      403,
      "CANDIDATE_PROFILE_REQUIRED",
      "Candidate profile is required to access this resource."
    );
  }

  const interviews = db.collection("interviews");
  const profiles = db.collection("tv-profiles");
  const consolidation = await consolidateTalentVaultInterviewsForProfile({
    db,
    interviews,
    profile,
  });

  const currentInterviewID = isInterviewId(profile?.latestAssessment?.aiInterviewAssessmentId)
    ? profile.latestAssessment.aiInterviewAssessmentId.trim()
    : null;
  const canonicalInterviewID = consolidation.canonicalInterviewID;

  if (
    canonicalInterviewID &&
    (currentInterviewID !== canonicalInterviewID || consolidation.deletedDuplicateCount > 0)
  ) {
    const currentPendingInterviewID = isInterviewId(
      profile?.latestAssessment?.pendingAiInterviewAssessmentId
    )
      ? profile.latestAssessment.pendingAiInterviewAssessmentId.trim()
      : null;
    const profilePatch: Record<string, unknown> = {
      "latestAssessment.aiInterviewAssessmentId": canonicalInterviewID,
      updatedAt: new Date(),
    };

    if (currentPendingInterviewID && currentPendingInterviewID !== canonicalInterviewID) {
      profilePatch["latestAssessment.pendingAiInterviewAssessmentId"] = null;
    }

    await profiles.updateOne(
      { _id: profile._id },
      {
        $set: profilePatch,
      }
    );

    const refreshedProfile = await profiles.findOne({ _id: profile._id });

    return NextResponse.json({
      data: refreshedProfile || profile,
      meta: {
        created,
        cleanedDuplicateInterviews: consolidation.deletedDuplicateCount,
      },
    });
  }

  return NextResponse.json({
    data: profile,
    meta: {
      created,
      cleanedDuplicateInterviews: consolidation.deletedDuplicateCount,
    },
  });
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { profile, created, error } = await resolveTalentVaultProfile(request, {
    createIfMissing: true,
  });
  if (error || !profile) {
    return error || tvErrorResponse(404, "PROFILE_NOT_FOUND", "Profile not found");
  }

  return NextResponse.json({ data: profile, meta: { created } });
});

export const PATCH = withAuth(async (request: AuthenticatedRequest) => {
  const body = await request.json();
  const action = body?.action as UpdateAction;
  const payload = body?.payload || {};

  if (!action) {
    return tvErrorResponse(400, "ACTION_REQUIRED", "Action is required");
  }

  const { db, profile, email, error } = await resolveTalentVaultProfile(request, {
    createIfMissing: false,
  });
  if (error) {
    return error;
  }

  if (!profile) {
    return tvErrorResponse(
      403,
      "CANDIDATE_PROFILE_REQUIRED",
      "Candidate profile is required to access this resource."
    );
  }

  if (!email) {
    return tvErrorResponse(400, "USER_EMAIL_MISSING", "User email is missing");
  }

  const profiles = db.collection("tv-profiles");
  const applicantCv = db.collection("applicant-cv");

  if (action === "set_setup_step_status") {
    const currentStep = payload?.currentStep;

    if (!isSetupCurrentStep(currentStep)) {
      return tvErrorResponse(
        400,
        "SETUP_CURRENT_STEP_INVALID",
        "currentStep is required and must be one of submitCV, verifyProfile, goalSetting, preScreening, aiInterview"
      );
    }

    const updatedSetup = setSetupCurrentStep(profile.setup, currentStep);
    const now = new Date();

    await profiles.updateOne(
      { _id: profile._id },
      {
        $set: {
          setup: updatedSetup,
          updatedAt: now,
        },
      }
    );

    const refreshedProfile = await profiles.findOne({ _id: profile._id });
    return NextResponse.json({ data: refreshedProfile });
  }

  if (action === "set_visibility_status") {
    const nextIsActive = payload?.isActive;

    if (typeof nextIsActive !== "boolean") {
      return tvErrorResponse(
        400,
        "VISIBILITY_STATUS_INVALID",
        "isActive is required and must be a boolean"
      );
    }

    const effectiveExpiresAt = resolveTalentVaultExpiresAt(
      profile?.expiresAt || profile?.expirationDate,
      profile?.completedAt
    );
    const isExpiredByDate = Boolean(
      effectiveExpiresAt && effectiveExpiresAt.getTime() < Date.now()
    );
    const normalizedState = String(profile?.state || "").toLowerCase();
    const isExpired = normalizedState === "expired" || isExpiredByDate;

    if (nextIsActive && isExpired) {
      return tvErrorResponse(
        400,
        "PROFILE_REACTIVATION_REQUIRED",
        "This profile is expired and cannot be activated directly. Please reactivate the profile first."
      );
    }

    const nextStatus = nextIsActive ? "active" : "inactive";

    if (String(profile?.status || "").toLowerCase() === nextStatus) {
      return NextResponse.json({
        data: profile,
        meta: {
          updated: false,
          noop: true,
        },
      });
    }

    await profiles.updateOne(
      { _id: profile._id },
      {
        $set: {
          status: nextStatus,
          updatedAt: new Date(),
        },
      }
    );

    const refreshedProfile = await profiles.findOne({ _id: profile._id });
    return NextResponse.json({
      data: refreshedProfile,
      meta: {
        updated: true,
        noop: false,
      },
    });
  }

  if (action === "reactivate_profile") {
    const defaultSetup = createDefaultTalentVaultSetup();
    const isAlreadyReset =
      String(profile?.state || "").toLowerCase() === "draft" &&
      String(profile?.status || "").toLowerCase() === "inactive" &&
      JSON.stringify(profile?.setup || null) === JSON.stringify(defaultSetup) &&
      !profile?.completedAt &&
      !profile?.expiresAt &&
      !profile?.expirationDate &&
      !profile?.latestAssessment?.aiInterviewAssessmentId &&
      !profile?.latestAssessment?.pendingAiInterviewAssessmentId;

    if (isAlreadyReset) {
      return NextResponse.json({
        data: profile,
        meta: {
          updated: false,
          noop: true,
        },
      });
    }

    await profiles.updateOne(
      { _id: profile._id },
      {
        $set: {
          state: "draft",
          status: "inactive",
          setup: defaultSetup,
          completedAt: null,
          expiresAt: null,
          "latestAssessment.preScreeningAssessmentId": null,
          "latestAssessment.aiInterviewAssessmentId": null,
          "latestAssessment.pendingAiInterviewAssessmentId": null,
          updatedAt: new Date(),
        },
      }
    );

    const refreshedProfile = await profiles.findOne({ _id: profile._id });
    return NextResponse.json({
      data: refreshedProfile,
      meta: {
        updated: true,
        noop: false,
      },
    });
  }

  if (action === "ensure_ai_interview") {
    const interviews = db.collection("interviews");
    const { subprogram, errorResponse } = await fetchAndValidateSelectedSubprogram(
      db,
      profile
    );
    if (errorResponse) {
      return errorResponse;
    }
    const {
      interviewID,
      interviewDoc,
      createdInterview,
      deletedDuplicateCount,
    } = await ensureCanonicalTalentVaultInterview({
      db,
      interviews,
      profile,
      subprogram,
      email,
      fallbackName: request.user.name || "",
    });

    const isDraftProfile = String(profile.state || "").toLowerCase() === "draft";

    // When a reactivated (draft) profile proceeds to interview but the
    // existing interview document is already completed, reset it so
    // VoiceAssistantV2 allows entry (it only accepts "For AI Interview"
    // or "For Interview" statuses).
    if (isDraftProfile && !createdInterview && interviewDoc) {
      const interviewStatus = String(
        (interviewDoc as Record<string, unknown>).status || ""
      );
      if (interviewStatus !== "For AI Interview") {
        await prepareTalentVaultInterviewRetake({ interviews, interviewID });
      }
    }

    const normalizedSetup = normalizeSetup(profile.setup);
    const updatedSetup =
      normalizedSetup.aiInterview === "done" && !isDraftProfile
        ? normalizedSetup
        : setSetupCurrentStep(normalizedSetup, "aiInterview");
    const currentPendingInterviewID = isInterviewId(
      profile?.latestAssessment?.pendingAiInterviewAssessmentId
    )
      ? profile.latestAssessment.pendingAiInterviewAssessmentId.trim()
      : null;
    const profilePatch: Record<string, unknown> = {
      setup: updatedSetup,
      "latestAssessment.aiInterviewAssessmentId": interviewID,
      updatedAt: new Date(),
    };

    if (currentPendingInterviewID && currentPendingInterviewID !== interviewID) {
      profilePatch["latestAssessment.pendingAiInterviewAssessmentId"] = null;
    }

    await profiles.updateOne(
      { _id: profile._id },
      {
        $set: profilePatch,
      }
    );

    const refreshedProfile = await profiles.findOne({ _id: profile._id });
    return NextResponse.json({
      data: refreshedProfile,
      meta: {
        interviewID,
        createdInterview,
        reusedInterview: !createdInterview && Boolean(interviewDoc),
        cleanedDuplicateInterviews: deletedDuplicateCount,
      },
    });
  }

  if (action === "retake_ai_interview") {
    const interviews = db.collection("interviews");
    const { subprogram, errorResponse } = await fetchAndValidateSelectedSubprogram(
      db,
      profile
    );
    if (errorResponse) {
      return errorResponse;
    }
    const { interviewID, createdInterview, deletedDuplicateCount } =
      await ensureCanonicalTalentVaultInterview({
        db,
        interviews,
        profile,
        subprogram,
        email,
        fallbackName: request.user.name || "",
      });

    await prepareTalentVaultInterviewRetake({
      interviews,
      interviewID,
    });

    await profiles.updateOne(
      { _id: profile._id },
      {
        $set: {
          "latestAssessment.aiInterviewAssessmentId": interviewID,
          "latestAssessment.pendingAiInterviewAssessmentId": interviewID,
          updatedAt: new Date(),
        },
      }
    );

    const refreshedProfile = await profiles.findOne({ _id: profile._id });
    return NextResponse.json({
      data: refreshedProfile,
      meta: {
        interviewID,
        pendingRetake: true,
        createdInterview,
        cleanedDuplicateInterviews: deletedDuplicateCount,
      },
    });
  }

  if (action === "prepare_ai_interview_retake") {
    const interviews = db.collection("interviews");
    const { subprogram, errorResponse } = await fetchAndValidateSelectedSubprogram(
      db,
      profile
    );
    if (errorResponse) {
      return errorResponse;
    }
    const { interviewID, createdInterview, deletedDuplicateCount } =
      await ensureCanonicalTalentVaultInterview({
        db,
        interviews,
        profile,
        subprogram,
        email,
        fallbackName: request.user.name || "",
      });

    await prepareTalentVaultInterviewRetake({
      interviews,
      interviewID,
    });

    await profiles.updateOne(
      { _id: profile._id },
      {
        $set: {
          "latestAssessment.aiInterviewAssessmentId": interviewID,
          "latestAssessment.pendingAiInterviewAssessmentId": interviewID,
          updatedAt: new Date(),
        },
      }
    );

    const refreshedProfile = await profiles.findOne({ _id: profile._id });
    return NextResponse.json({
      data: refreshedProfile,
      meta: {
        interviewID,
        pendingRetake: true,
        createdInterview,
        cleanedDuplicateInterviews: deletedDuplicateCount,
      },
    });
  }

  if (action === "save_cv_profile") {
    const digitalCV = normalizeDigitalCv(payload?.digitalCV);
    if (digitalCV.length === 0) {
      return tvErrorResponse(400, "DIGITAL_CV_REQUIRED", "digitalCV is required");
    }

    const education = normalizeEducation(payload?.education);
    const otherDegrees = extractOtherDegrees(payload?.education);
    const fileInfo = normalizeFileInfo(payload?.fileInfo);
    const hasMatchingSignalsPayload = Object.prototype.hasOwnProperty.call(
      payload,
      "matchingSignals"
    );
    const matchingSignals = hasMatchingSignalsPayload
      ? normalizeMatchingSignals(payload?.matchingSignals)
      : normalizeMatchingSignals(profile?.profile?.matchingSignals);

    const structuredCV = payload?.structuredCV
      ? normalizeStructuredCVInput(payload.structuredCV)
      : null;

    if (otherDegrees.length > 0) {
      const degrees = db.collection("degrees");
      const now = new Date();

      await Promise.all(
        otherDegrees.map(({ name, normalizedName }) => {
          const exactNameRegex = new RegExp(`^${escapeRegex(name)}$`, "i");

          return degrees.updateOne(
            {
              $or: [
                { normalizedName },
                { name: exactNameRegex },
              ],
            },
            {
              $setOnInsert: {
                name,
                abbr: null,
                others: true,
                normalizedName,
                createdAt: now,
                updatedAt: now,
              },
            },
            { upsert: true }
          );
        })
      );
    }

    const updatedSetup = markStepAsDone(profile.setup, "cvProfile");
    const now = new Date();

    await profiles.updateOne(
      { _id: profile._id },
      {
        $set: {
          profile: {
            ...(profile.profile || {}),
            digitalCV,
            education,
            fileInfo,
            matchingSignals,
            ...(structuredCV != null ? { structuredCV } : {}),
          },
          setup: updatedSetup,
          state: "draft",
          status: "inactive",
          updatedAt: now,
        },
      }
    );

    const applicantCvSet = buildApplicantCvUpdateSet({
      digitalCV,
      fileInfo,
      name: profile.userInfo?.name || request.user.name || null,
      errorRemarks: null,
    });

    await applicantCv.updateOne({ email }, { $set: applicantCvSet }, { upsert: true });

    const refreshedProfile = await profiles.findOne({ _id: profile._id });
    return NextResponse.json({ data: refreshedProfile });
  }

  if (action === "save_goal_setting") {
    const goals = normalizeGoals(payload?.goals);

    if (!goals.startDatePreference) {
      return tvErrorResponse(
        400,
        "START_DATE_PREFERENCE_REQUIRED",
        "startDatePreference is required"
      );
    }

    if (goals.careerGoalIds.length === 0) {
      return tvErrorResponse(400, "CAREER_GOAL_IDS_REQUIRED", "careerGoalIds is required");
    }

    if (!goals.selectedSubprogramId || !ObjectId.isValid(goals.selectedSubprogramId)) {
      return tvErrorResponse(
        400,
        "SUBPROGRAM_ID_INVALID",
        "selectedSubprogramId is required and must be a valid id"
      );
    }

    const subprograms = db.collection("tv-subprograms");
    const subprogramId = ObjectId.createFromHexString(goals.selectedSubprogramId);

    const selectedSubprogram = await subprograms.findOne(
      {
        _id: subprogramId,
        archivedAt: null,
      },
      {
        projection: {
          title: 1,
          roleType: 1,
          status: 1,
          activityStatus: 1,
          preScreeningQuestions: 1,
        },
      }
    );

    if (!selectedSubprogram) {
      return tvErrorResponse(
        404,
        "SUBPROGRAM_NOT_FOUND",
        "Selected subprogram was not found"
      );
    }

    const isEligibleSubprogram =
      String(selectedSubprogram.status || "").trim().toLowerCase() === "active" &&
      String(selectedSubprogram.activityStatus || "").trim() === "Active";

    if (!isEligibleSubprogram) {
      return tvErrorResponse(
        409,
        "SUBPROGRAM_NOT_ELIGIBLE",
        "Selected subprogram is not eligible"
      );
    }

    const selectedSubprogramSnapshot = goals.selectedSubprogramSnapshot
      ? {
          title:
            String(goals.selectedSubprogramSnapshot.title || "").trim() ||
            String(selectedSubprogram.title || "").trim(),
          roleType:
            String(goals.selectedSubprogramSnapshot.roleType || "").trim() ||
            String(selectedSubprogram.roleType || "").trim(),
        }
      : {
          title: String(selectedSubprogram.title || "").trim(),
          roleType: String(selectedSubprogram.roleType || "").trim(),
        };

    const goalsToPersist = {
      ...goals,
      selectedSubprogramId: goals.selectedSubprogramId,
      selectedSubprogramSnapshot,
    };

    const updatedSetup = markStepAsDone(profile.setup, "goalSetting");

    // Detect subprogram change by comparing normalized previous/new selectedSubprogramId
    const previousSubprogramId = String(profile.profile?.goals?.selectedSubprogramId || "").trim();
    const newSubprogramId = String(goals.selectedSubprogramId).trim();
    const subprogramChanged = previousSubprogramId.length > 0 && previousSubprogramId !== newSubprogramId;

    // Clear stale pre-screening data when subprogram changes
    if (subprogramChanged) {
      updatedSetup.preScreening = "pending";
      updatedSetup.aiInterview = "pending";
      Object.assign(updatedSetup, recalculateSetupCurrentStep(updatedSetup));
    }

    // Auto-skip preScreening if subprogram has 0 questions
    const preScreeningQuestionCount = Array.isArray(selectedSubprogram.preScreeningQuestions)
      ? selectedSubprogram.preScreeningQuestions.length
      : 0;

    if (preScreeningQuestionCount === 0) {
      updatedSetup.preScreening = "skipped";
      updatedSetup.aiInterview = "in_progress";
      updatedSetup.currentStep = "aiInterview";
    }
    const now = new Date();

    // Build update operation with conditional preScreening clearing
    const updateOperation: any = {
      $set: {
        "profile.goals": goalsToPersist,
        setup: updatedSetup,
        state: "draft",
        status: "inactive",
        updatedAt: now,
      },
    };

    // Clear old pre-screening answers when subprogram changes
    if (subprogramChanged) {
      updateOperation.$set["profile.preScreening"] = [];
    }

    await profiles.updateOne({ _id: profile._id }, updateOperation);

    await applicantCv.updateOne(
      { email },
      {
        $set: {
          availability: goals.startDatePreference,
          updatedAt: Date.now(),
        },
      },
      { upsert: true }
    );

    const refreshedProfile = await profiles.findOne({ _id: profile._id });
    return NextResponse.json({ data: refreshedProfile });
  }

  if (action === "save_profile_sections") {
    const profileData = profile.profile || {};
    const hasDigitalCvPayload = Object.prototype.hasOwnProperty.call(payload, "digitalCV");
    const hasEducationPayload = Object.prototype.hasOwnProperty.call(payload, "education");
    const hasGoalsPayload = Object.prototype.hasOwnProperty.call(payload, "goals");
    const hasFileInfoPayload = Object.prototype.hasOwnProperty.call(payload, "fileInfo");
    const hasMatchingSignalsPayload = Object.prototype.hasOwnProperty.call(
      payload,
      "matchingSignals"
    );
    const hasStructuredCVPayload = Object.prototype.hasOwnProperty.call(
      payload,
      "structuredCV"
    );

    if (
      !hasDigitalCvPayload &&
      !hasEducationPayload &&
      !hasGoalsPayload &&
      !hasFileInfoPayload &&
      !hasMatchingSignalsPayload &&
      !hasStructuredCVPayload
    ) {
      return tvErrorResponse(
        400,
        "PROFILE_SECTION_PAYLOAD_REQUIRED",
        "At least one of digitalCV, education, goals, fileInfo, matchingSignals, or structuredCV is required"
      );
    }

    const existingDigitalCV = normalizeDigitalCv(profileData.digitalCV);
    const existingEducation = normalizeEducation(profileData.education);
    const existingGoals = normalizeGoals(profileData.goals || {});
    const existingFileInfo = normalizeFileInfo(profileData.fileInfo);
    const existingMatchingSignals = normalizeMatchingSignals(profileData.matchingSignals);
    const existingStructuredCV = profileData.structuredCV || null;

    const nextDigitalCV = hasDigitalCvPayload
      ? normalizeDigitalCv(payload?.digitalCV)
      : existingDigitalCV;
    const nextEducation = hasEducationPayload
      ? normalizeEducation(payload?.education)
      : existingEducation;
    const nextGoals = hasGoalsPayload
      ? normalizeGoalsForProfileSections(payload?.goals, profileData.goals || {})
      : existingGoals;
    const nextFileInfo = hasFileInfoPayload
      ? normalizeFileInfo(payload?.fileInfo)
      : existingFileInfo;
    const nextMatchingSignals = hasMatchingSignalsPayload
      ? normalizeMatchingSignals(payload?.matchingSignals)
      : existingMatchingSignals;
    const nextStructuredCV = hasStructuredCVPayload
      ? (payload?.structuredCV ? normalizeStructuredCVInput(payload.structuredCV) : null)
      : existingStructuredCV;

    const digitalCvChanged =
      hasDigitalCvPayload &&
      toComparableString(nextDigitalCV) !== toComparableString(existingDigitalCV);
    const educationChanged =
      hasEducationPayload &&
      toComparableString(nextEducation) !== toComparableString(existingEducation);
    const goalsChanged =
      hasGoalsPayload &&
      toComparableString(nextGoals) !== toComparableString(existingGoals);
    const fileInfoChanged =
      hasFileInfoPayload &&
      toComparableString(nextFileInfo) !== toComparableString(existingFileInfo);
    const matchingSignalsChanged =
      hasMatchingSignalsPayload &&
      toComparableString(nextMatchingSignals) !== toComparableString(existingMatchingSignals);
    const structuredCVChanged =
      hasStructuredCVPayload &&
      toComparableString(nextStructuredCV) !== toComparableString(existingStructuredCV);

    if (
      !digitalCvChanged &&
      !educationChanged &&
      !goalsChanged &&
      !fileInfoChanged &&
      !matchingSignalsChanged &&
      !structuredCVChanged
    ) {
      return NextResponse.json({
        data: profile,
        meta: {
          updated: false,
          noop: true,
        },
      });
    }

    if (educationChanged) {
      const otherDegrees = extractOtherDegrees(payload?.education);

      if (otherDegrees.length > 0) {
        const degrees = db.collection("degrees");
        const now = new Date();

        await Promise.all(
          otherDegrees.map(({ name, normalizedName }) => {
            const exactNameRegex = new RegExp(`^${escapeRegex(name)}$`, "i");

            return degrees.updateOne(
              {
                $or: [{ normalizedName }, { name: exactNameRegex }],
              },
              {
                $setOnInsert: {
                  name,
                  abbr: null,
                  others: true,
                  normalizedName,
                  createdAt: now,
                  updatedAt: now,
                },
              },
              { upsert: true }
            );
          })
        );
      }
    }

    const now = new Date();
    const refreshedExpiresAt = new Date(
      now.getTime() + TALENT_VAULT_ACTIVE_DURATION_DAYS * 24 * 60 * 60 * 1000
    );
    const setFields: Record<string, any> = {
      updatedAt: now,
      expiresAt: refreshedExpiresAt,
    };

    if (digitalCvChanged) {
      setFields["profile.digitalCV"] = nextDigitalCV;
    }

    if (educationChanged) {
      setFields["profile.education"] = nextEducation;
    }

    if (goalsChanged) {
      setFields["profile.goals"] = nextGoals;
    }

    if (fileInfoChanged) {
      setFields["profile.fileInfo"] = nextFileInfo;
    }

    if (matchingSignalsChanged) {
      setFields["profile.matchingSignals"] = nextMatchingSignals;
    }

    if (structuredCVChanged) {
      setFields["profile.structuredCV"] = nextStructuredCV;
    }

    await profiles.updateOne(
      { _id: profile._id },
      {
        $set: setFields,
      }
    );

    if (digitalCvChanged || fileInfoChanged) {
      const applicantCvSet = buildApplicantCvUpdateSet({
        digitalCV: nextDigitalCV,
        fileInfo: nextFileInfo,
        name: profile.userInfo?.name || request.user.name || null,
        errorRemarks: null,
      });

      await applicantCv.updateOne({ email }, { $set: applicantCvSet }, { upsert: true });
    }

    if (goalsChanged && nextGoals.startDatePreference) {
      await applicantCv.updateOne(
        { email },
        {
          $set: {
            availability: nextGoals.startDatePreference,
            updatedAt: Date.now(),
          },
        },
        { upsert: true }
      );
    }

    const refreshedProfile = await profiles.findOne({ _id: profile._id });
    return NextResponse.json({
      data: refreshedProfile,
      meta: {
        updated: true,
        noop: false,
      },
    });
  }

  if (action === "save_pre_screening_assessment") {
    // Validate subprogram exists, is eligible, and has pre-screening questions
    const selectedSubprogramId =
      typeof profile?.profile?.goals?.selectedSubprogramId === "string"
        ? profile.profile.goals.selectedSubprogramId.trim()
        : "";

    if (!selectedSubprogramId || !ObjectId.isValid(selectedSubprogramId)) {
      return tvErrorResponse(
        400,
        "SELECTED_SUBPROGRAM_REQUIRED",
        "selectedSubprogramId is required and must be a valid id"
      );
    }

    const subprograms = db.collection("tv-subprograms");
    const subprogramId = ObjectId.createFromHexString(selectedSubprogramId);
    const selectedSubprogram = await subprograms.findOne(
      {
        _id: subprogramId,
        archivedAt: null,
      },
      {
        projection: {
          title: 1,
          roleType: 1,
          status: 1,
          activityStatus: 1,
          preScreeningQuestions: 1,
        },
      }
    );

    if (!selectedSubprogram) {
      return tvErrorResponse(
        404,
        "SUBPROGRAM_NOT_FOUND",
        "Selected subprogram was not found or is not eligible"
      );
    }

    const isEligibleSubprogram =
      String(selectedSubprogram.status || "").trim().toLowerCase() === "active" &&
      String(selectedSubprogram.activityStatus || "").trim() === "Active";

    if (!isEligibleSubprogram) {
      return tvErrorResponse(
        404,
        "SUBPROGRAM_NOT_FOUND",
        "Selected subprogram was not found or is not eligible"
      );
    }

    const subprogramPreScreeningQuestions = Array.isArray(
      selectedSubprogram.preScreeningQuestions
    )
      ? selectedSubprogram.preScreeningQuestions
      : [];

    if (subprogramPreScreeningQuestions.length === 0) {
      return tvErrorResponse(
        409,
        "PRE_SCREENING_NOT_APPLICABLE",
        "Selected subprogram does not have pre-screening questions"
      );
    }

    // Normalize and validate payload
    const preScreening = normalizePreScreening(payload?.preScreening);
    if (preScreening.length === 0) {
      return tvErrorResponse(400, "PRE_SCREENING_REQUIRED", "preScreening is required");
    }

    // Validate submitted answers against subprogram questions
    const subprogramQuestionIds = new Set(
      subprogramPreScreeningQuestions.map((q: any) => String(q?.id || "").trim()).filter(Boolean)
    );
    const subprogramQuestionFormats = new Map(
      subprogramPreScreeningQuestions.map((q: any) => [
        String(q?.id || "").trim(),
        String(q?.questionFormat || "").trim(),
      ])
    );

    for (const answeredQuestion of preScreening) {
      const questionId = String(answeredQuestion.id || "").trim();

      if (!subprogramQuestionIds.has(questionId)) {
        return tvErrorResponse(
          422,
          "PRE_SCREENING_VALIDATION_FAILED",
          `Unknown question id: ${questionId}`
        );
      }

      const expectedFormat = subprogramQuestionFormats.get(questionId);
      const actualFormat = String(answeredQuestion.questionFormat || "").trim();

      if (expectedFormat && expectedFormat !== actualFormat) {
        return tvErrorResponse(
          422,
          "PRE_SCREENING_VALIDATION_FAILED",
          `Question format mismatch for question ${questionId}`
        );
      }
    }

    // Ensure all subprogram questions are answered
    const answeredQuestionIds = new Set(
      preScreening.map((q) => String(q.id || "").trim()).filter(Boolean)
    );

    for (const subprogramQuestion of subprogramPreScreeningQuestions) {
      const questionId = String(subprogramQuestion?.id || "").trim();

      if (!questionId) continue;

      if (!answeredQuestionIds.has(questionId)) {
        return tvErrorResponse(
          422,
          "PRE_SCREENING_VALIDATION_FAILED",
          `Missing answer for required question: ${questionId}`
        );
      }
    }

    const salaryQuestion = preScreening.find(
      (question) =>
        question.id === "expected-monthly-salary" ||
        question.questionType === "Asking Salary"
    );

    if (salaryQuestion) {
      const minAnswer = salaryQuestion.selectedAnswers.find(
        (answer: any) => answer.type === "Minimum"
      );
      const maxAnswer = salaryQuestion.selectedAnswers.find(
        (answer: any) => answer.type === "Maximum"
      );

      const minValue = Number(minAnswer?.value);
      const maxValue = Number(maxAnswer?.value);

      if (
        Number.isFinite(minValue) &&
        Number.isFinite(maxValue) &&
        maxValue <= minValue
      ) {
        return tvErrorResponse(
          400,
          "PRE_SCREENING_SALARY_RANGE_INVALID",
          "Maximum salary must be greater than minimum salary."
        );
      }
    }

    const updatedSetup = markStepAsDone(profile.setup, "preScreening");
    const now = new Date();

    await profiles.updateOne(
      { _id: profile._id },
      {
        $set: {
          "profile.preScreening": preScreening,
          setup: updatedSetup,
          state: "draft",
          status: "inactive",
          updatedAt: now,
        },
      }
    );

    await applicantCv.updateOne(
      { email },
      { $set: getPreScreeningApplicantCvProjection(preScreening) },
      { upsert: true }
    );

    const refreshedProfile = await profiles.findOne({ _id: profile._id });
    return NextResponse.json({ data: refreshedProfile });
  }

  return tvErrorResponse(400, "UNSUPPORTED_ACTION", "Unsupported action");
});
