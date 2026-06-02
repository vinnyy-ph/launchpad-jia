import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, type AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { tvErrorResponse } from "@/app/api/talent-vault/lib/tvApiError";
import {
  objectContainsSuspiciousPatterns,
  sanitizeObject,
  sanitizeString,
} from "@/lib/utils/sanitizeInput";
import { toNormalizedName } from "@/app/(talent-vault)/lib/server/talentVaultProfiles";
import { normalizeNullableString } from "@/app/(talent-vault)/lib/server/applicantCvSync";

const SUBPROGRAM_COLLECTION = "tv-subprograms";
const MIN_REQUIRED_INTERVIEW_QUESTIONS = 5;

const SUPPORTED_PRE_SCREENING_FORMATS = new Set([
  "Short Answer",
  "Long Answer",
  "Dropdown",
  "Checkboxes",
  "Date",
  "Range",
]);

type SubProgramAction = "publish" | "unpublish" | "activate" | "deactivate";

type UserMetadata = {
  image: string;
  name: string;
  email: string;
};

function sanitizeNullableString(
  value: unknown,
  mode: "strict" | "moderate" = "strict"
) {
  if (typeof value !== "string") {
    return null;
  }

  return normalizeNullableString(sanitizeString(value, mode));
}

function normalizeAction(value: unknown): SubProgramAction | null {
  const action = sanitizeString(String(value || ""), "strict").trim().toLowerCase();

  if (
    action === "publish" ||
    action === "unpublish" ||
    action === "activate" ||
    action === "deactivate"
  ) {
    return action;
  }

  return null;
}

function normalizeStatus(value: unknown): "active" | "inactive" {
  return String(value || "")
    .trim()
    .toLowerCase() === "inactive"
    ? "inactive"
    : "active";
}

function normalizeActivityStatus(value: unknown): "Active" | "Inactive" {
  return String(value || "").trim() === "Inactive" ? "Inactive" : "Active";
}


function countInterviewQuestions(questionGroups: unknown) {
  if (!Array.isArray(questionGroups)) {
    return 0;
  }

  return questionGroups.reduce((count, group) => {
    const groupQuestions = Array.isArray((group as any)?.questions)
      ? (group as any).questions
      : [];
    return count + groupQuestions.length;
  }, 0);
}

function validateInterviewPayload(
  interview: Record<string, unknown>,
  enforceMinimumQuestions: boolean
) {
  if (!Array.isArray(interview.questions)) {
    return "Interview questions must be an array.";
  }

  const totalQuestions = countInterviewQuestions(interview.questions);

  if (enforceMinimumQuestions && totalQuestions < MIN_REQUIRED_INTERVIEW_QUESTIONS) {
    return "AI interview must contain at least 5 questions to publish.";
  }

  for (let groupIndex = 0; groupIndex < interview.questions.length; groupIndex += 1) {
    const group = interview.questions[groupIndex] as any;
    const category = String(group?.category || "").trim();

    if (!category) {
      return `Interview question group #${groupIndex + 1} is missing category.`;
    }

    if (!Array.isArray(group?.questions)) {
      return `Interview question group '${category}' must include a questions array.`;
    }

    for (let questionIndex = 0; questionIndex < group.questions.length; questionIndex += 1) {
      const question = String(group.questions[questionIndex]?.question || "").trim();
      if (!question) {
        return `Interview question #${questionIndex + 1} in '${category}' cannot be empty.`;
      }
    }
  }

  const aiInterviewLanguage = String(interview.aiInterviewLanguage || "").trim();
  if (!aiInterviewLanguage) {
    return "AI interview language is required.";
  }

  const walkthroughLanguage = String(interview.walkthroughLanguage || "english")
    .trim()
    .toLowerCase();
  if (walkthroughLanguage !== "english" && walkthroughLanguage !== "tagalog") {
    return "Walkthrough language must be either english or tagalog.";
  }

  return null;
}

function validatePreScreeningQuestions(preScreeningQuestions: unknown) {
  if (!Array.isArray(preScreeningQuestions)) {
    return "Pre-screening questions must be an array.";
  }

  for (let questionIndex = 0; questionIndex < preScreeningQuestions.length; questionIndex += 1) {
    const question = preScreeningQuestions[questionIndex] as any;

    if (!question || typeof question !== "object") {
      return `Pre-screening question #${questionIndex + 1} is invalid.`;
    }

    const id = String(question.id || "").trim();
    const questionType = String(question.questionType || "").trim();
    const questionText = String(question.question || "").trim();
    const questionFormat = String(question.questionFormat || "").trim();

    if (!id) {
      return `Pre-screening question #${questionIndex + 1} is missing an id.`;
    }

    if (!questionType) {
      return `Pre-screening question #${questionIndex + 1} is missing question type.`;
    }

    if (!questionText) {
      return `Pre-screening question #${questionIndex + 1} cannot be empty.`;
    }

    if (!SUPPORTED_PRE_SCREENING_FORMATS.has(questionFormat)) {
      return `Pre-screening question #${questionIndex + 1} has unsupported format '${questionFormat}'.`;
    }

    const answers = Array.isArray(question.answers) ? question.answers : [];

    if (questionFormat === "Dropdown" || questionFormat === "Checkboxes") {
      if (answers.length < 1) {
        return `${questionType} must include at least one answer option.`;
      }

      const hasEmptyAnswer = answers.some(
        (answer) => !String((answer as any)?.value ?? "").trim()
      );

      if (hasEmptyAnswer) {
        return `${questionType} contains an empty answer option.`;
      }
    }

    if (questionFormat === "Range") {
      const hasMinimum = answers.some(
        (answer) => String((answer as any)?.type || "").trim() === "Minimum"
      );
      const hasMaximum = answers.some(
        (answer) => String((answer as any)?.type || "").trim() === "Maximum"
      );

      if (!hasMinimum || !hasMaximum) {
        return `${questionType} must include both minimum and maximum answers.`;
      }
    }
  }

  return null;
}

function sanitizeInterviewInput(input: unknown) {
  const interviewInput =
    input && typeof input === "object" && !Array.isArray(input) ? input : {};

  const sanitizedInterviewInput = sanitizeObject(interviewInput, "strict") as Record<
    string,
    unknown
  >;

  return {
    questions: Array.isArray(sanitizedInterviewInput.questions)
      ? sanitizedInterviewInput.questions
      : [],
    aiInterviewLanguage:
      sanitizeString(
        String(sanitizedInterviewInput.aiInterviewLanguage || "English"),
        "strict"
      ) || "English",
    voice: sanitizeNullableString(sanitizedInterviewInput.voice, "strict"),
    requireVideo: Boolean(sanitizedInterviewInput.requireVideo),
    walkthroughLanguage:
      String(sanitizedInterviewInput.walkthroughLanguage || "english")
        .trim()
        .toLowerCase() === "tagalog"
        ? "tagalog"
        : "english",
    interviewSecretPrompt: sanitizeNullableString(
      sanitizedInterviewInput.interviewSecretPrompt,
      "moderate"
    ),
  };
}

async function resolveUserMetadata(
  db: any,
  request: AuthenticatedRequest
): Promise<UserMetadata> {
  const email = String(request.user?.email || "")
    .trim()
    .toLowerCase();

  if (!email) {
    return {
      email: "",
      name: "Unknown user",
      image: "",
    };
  }

  const admin = await db
    .collection("admins")
    .findOne({ email }, { projection: { name: 1, email: 1, image: 1 } });

  const source = admin || null;
  const name =
    String(source?.name || request.user?.name || "").trim() ||
    email ||
    "Unknown user";
  const image = String(source?.image || request.user?.picture || "").trim();

  return {
    email,
    name,
    image,
  };
}

function mapSubprogramForResponse(subprogram: any) {
  return {
    _id: subprogram._id.toString(),
    title: String(subprogram.title || "").trim(),
    roleType: String(subprogram.roleType || "").trim(),
    status: normalizeStatus(subprogram.status),
    activityStatus: normalizeActivityStatus(subprogram.activityStatus),
    registered: 0,
    completed: 0,
    invited: 0,
    hired: 0,
    secretPrompt:
      typeof subprogram.secretPrompt === "string"
        ? subprogram.secretPrompt
        : subprogram.secretPrompt || null,
    preScreeningQuestions: Array.isArray(subprogram.preScreeningQuestions)
      ? subprogram.preScreeningQuestions
      : [],
    interview:
      subprogram.interview && typeof subprogram.interview === "object"
        ? subprogram.interview
        : {
            questions: [],
            aiInterviewLanguage: "English",
            voice: null,
            requireVideo: true,
            walkthroughLanguage: "english",
            interviewSecretPrompt: null,
          },
    createdBy: {
      email: String(subprogram?.createdBy?.email || "").trim(),
      name: String(subprogram?.createdBy?.name || "").trim(),
      image: String(subprogram?.createdBy?.image || "").trim(),
    },
    updatedBy: {
      email: String(subprogram?.updatedBy?.email || "").trim(),
      name: String(subprogram?.updatedBy?.name || "").trim(),
      image: String(subprogram?.updatedBy?.image || "").trim(),
    },
    createdAt: subprogram.createdAt || null,
    updatedAt: subprogram.updatedAt || null,
    publishedAt: subprogram.publishedAt || null,
  };
}

export const GET = withAuth(
  async (
    request: AuthenticatedRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await context.params;
      if (!id || !ObjectId.isValid(id)) {
        return tvErrorResponse(400, "SUBPROGRAM_ID_INVALID", "Invalid subprogram id.");
      }

      const { db } = await connectMongoDB();

      // Admin enforcement
      const userEmail = String(request.user?.email || "").trim().toLowerCase();
      if (!userEmail) {
        return tvErrorResponse(401, "UNAUTHORIZED", "Authentication required.");
      }

      const admin = await db.collection("admins").findOne({ email: userEmail });
      if (!admin) {
        return tvErrorResponse(403, "ADMIN_ACCESS_REQUIRED", "Admin access required.");
      }

      const subprogramCollection = db.collection(SUBPROGRAM_COLLECTION);

      const subprogram = await subprogramCollection.findOne({
        _id: new ObjectId(id),
        archivedAt: null,
      });

      if (!subprogram) {
        return tvErrorResponse(404, "SUBPROGRAM_NOT_FOUND", "Subprogram not found.");
      }

      return NextResponse.json({
        subprogram: mapSubprogramForResponse(subprogram),
      });
    } catch (error) {
      console.error("Error fetching talent vault subprogram:", error);
      return tvErrorResponse(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to fetch talent vault subprogram."
      );
    }
  }
);

export const PUT = withAuth(
  async (
    request: AuthenticatedRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await context.params;
      if (!id || !ObjectId.isValid(id)) {
        return tvErrorResponse(400, "SUBPROGRAM_ID_INVALID", "Invalid subprogram id.");
      }

      const { db } = await connectMongoDB();

      // Admin enforcement
      const userEmail = String(request.user?.email || "").trim().toLowerCase();
      if (!userEmail) {
        return tvErrorResponse(401, "UNAUTHORIZED", "Authentication required.");
      }

      const admin = await db.collection("admins").findOne({ email: userEmail });
      if (!admin) {
        return tvErrorResponse(403, "ADMIN_ACCESS_REQUIRED", "Admin access required.");
      }

      const payload = await request.json();
      const suspiciousInputData = {
        title: payload?.title,
        roleType: payload?.roleType,
        secretPrompt: payload?.secretPrompt,
        preScreeningQuestions: payload?.preScreeningQuestions,
        interview: payload?.interview,
      };

      if (objectContainsSuspiciousPatterns(suspiciousInputData)) {
        return tvErrorResponse(
          400,
          "SUSPICIOUS_INPUT_DETECTED",
          "Input contains potentially dangerous content. Please remove scripts, HTML event handlers, or other executable code."
        );
      }

      const title = sanitizeString(String(payload?.title || ""), "strict");
      const roleType = sanitizeString(String(payload?.roleType || ""), "strict");
      const secretPrompt = sanitizeNullableString(payload?.secretPrompt, "moderate");

      const preScreeningQuestions = sanitizeObject(
        Array.isArray(payload?.preScreeningQuestions)
          ? payload.preScreeningQuestions
          : [],
        "strict"
      ) as any[];

      const interview = sanitizeInterviewInput(payload?.interview);

      if (!title) {
        return tvErrorResponse(400, "TITLE_REQUIRED", "Program title is required.");
      }

      if (!roleType) {
        return tvErrorResponse(400, "ROLE_TYPE_REQUIRED", "Role type is required.");
      }

      const preScreeningValidationError = validatePreScreeningQuestions(
        preScreeningQuestions
      );
      if (preScreeningValidationError) {
        return tvErrorResponse(
          400,
          "PRE_SCREENING_VALIDATION_FAILED",
          preScreeningValidationError
        );
      }

      const subprogramCollection = db.collection(SUBPROGRAM_COLLECTION);
      const subprogramId = new ObjectId(id);

      const existingSubprogram = await subprogramCollection.findOne({
        _id: subprogramId,
        archivedAt: null,
      });

      if (!existingSubprogram) {
        return tvErrorResponse(404, "SUBPROGRAM_NOT_FOUND", "Subprogram not found.");
      }

      const interviewValidationError = validateInterviewPayload(
        interview,
        normalizeStatus(existingSubprogram.status) === "active"
      );
      if (interviewValidationError) {
        return tvErrorResponse(
          400,
          "INTERVIEW_CONFIG_INVALID",
          interviewValidationError
        );
      }

      const normalizedTitle = toNormalizedName(title);
      const duplicateSubprogram = await subprogramCollection.findOne({
        _id: { $ne: subprogramId },
        normalizedTitle,
        archivedAt: null,
      });

      if (duplicateSubprogram) {
        return tvErrorResponse(
          409,
          "DUPLICATE_TITLE",
          "A program with the same title already exists."
        );
      }

      const actor = await resolveUserMetadata(db, request);
      const now = new Date();

      let updatedSubprogram: any;
      try {
        await subprogramCollection.updateOne(
          {
            _id: subprogramId,
            archivedAt: null,
          },
          {
            $set: {
              title,
              normalizedTitle,
              roleType,
              secretPrompt,
              preScreeningQuestions,
              interview,
              updatedAt: now,
              updatedBy: actor,
            },
          }
        );

        updatedSubprogram = await subprogramCollection.findOne({
          _id: subprogramId,
          archivedAt: null,
        });
      } catch (error: any) {
        if (error?.code === 11000) {
          return tvErrorResponse(
            409,
            "DUPLICATE_TITLE",
            "A program with the same title already exists."
          );
        }

        throw error;
      }

      if (!updatedSubprogram) {
        return tvErrorResponse(404, "SUBPROGRAM_NOT_FOUND", "Subprogram not found.");
      }

      return NextResponse.json({
        subprogram: mapSubprogramForResponse(updatedSubprogram),
      });
    } catch (error) {
      console.error("Error updating talent vault subprogram:", error);
      return tvErrorResponse(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to update talent vault subprogram."
      );
    }
  }
);

export const PATCH = withAuth(
  async (
    request: AuthenticatedRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    try {
      const { id } = await context.params;
      if (!id || !ObjectId.isValid(id)) {
        return tvErrorResponse(400, "SUBPROGRAM_ID_INVALID", "Invalid subprogram id.");
      }

      const { db } = await connectMongoDB();

      // Admin enforcement
      const userEmail = String(request.user?.email || "").trim().toLowerCase();
      if (!userEmail) {
        return tvErrorResponse(401, "UNAUTHORIZED", "Authentication required.");
      }

      const admin = await db.collection("admins").findOne({ email: userEmail });
      if (!admin) {
        return tvErrorResponse(403, "ADMIN_ACCESS_REQUIRED", "Admin access required.");
      }

      const payload = await request.json();
      const action = normalizeAction(payload?.action);

      if (!action) {
        return tvErrorResponse(
          400,
          "INVALID_ACTION",
          "Invalid action. Supported actions: publish, unpublish, activate, deactivate."
        );
      }

      const subprogramCollection = db.collection(SUBPROGRAM_COLLECTION);

      const subprogramId = new ObjectId(id);
      const existingSubprogram = await subprogramCollection.findOne({
        _id: subprogramId,
        archivedAt: null,
      });

      if (!existingSubprogram) {
        return tvErrorResponse(404, "SUBPROGRAM_NOT_FOUND", "Subprogram not found.");
      }

      if (action === "publish") {
        const title = String(existingSubprogram.title || "").trim();
        const roleType = String(existingSubprogram.roleType || "").trim();

        if (!title) {
          return tvErrorResponse(
            400,
            "TITLE_REQUIRED",
            "Program title is required before publishing."
          );
        }

        if (!roleType) {
          return tvErrorResponse(
            400,
            "ROLE_TYPE_REQUIRED",
            "Role type is required before publishing."
          );
        }

        const preScreeningValidationError = validatePreScreeningQuestions(
          existingSubprogram.preScreeningQuestions
        );
        if (preScreeningValidationError) {
          return tvErrorResponse(
            400,
            "PRE_SCREENING_VALIDATION_FAILED",
            preScreeningValidationError
          );
        }

        const interviewValidationError = validateInterviewPayload(
          existingSubprogram.interview || {},
          true
        );

        if (interviewValidationError) {
          return tvErrorResponse(
            400,
            "INTERVIEW_CONFIG_INVALID",
            interviewValidationError
          );
        }
      }

      const actor = await resolveUserMetadata(db, request);
      const now = new Date();
      const updateFields: Record<string, unknown> = {
        updatedAt: now,
        updatedBy: actor,
      };

      if (action === "publish") {
        updateFields.status = "active";
        updateFields.publishedAt = existingSubprogram.publishedAt || now;
      }

      if (action === "unpublish") {
        updateFields.status = "inactive";
      }

      if (action === "activate") {
        updateFields.activityStatus = "Active";
      }

      if (action === "deactivate") {
        updateFields.activityStatus = "Inactive";
      }

      await subprogramCollection.updateOne(
        {
          _id: subprogramId,
          archivedAt: null,
        },
        {
          $set: updateFields,
        }
      );

      const updatedSubprogram = await subprogramCollection.findOne(
        {
          _id: subprogramId,
          archivedAt: null,
        }
      );

      if (!updatedSubprogram) {
        return tvErrorResponse(404, "SUBPROGRAM_NOT_FOUND", "Subprogram not found.");
      }

      return NextResponse.json({
        subprogram: mapSubprogramForResponse(updatedSubprogram),
      });
    } catch (error) {
      console.error("Error updating talent vault subprogram:", error);
      return tvErrorResponse(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to update talent vault subprogram."
      );
    }
  }
);
