import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, type AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { tvErrorResponse } from "@/app/api/talent-vault/lib/tvApiError";
import {
  escapeRegex,
  toNormalizedName,
} from "@/app/(talent-vault)/lib/server/talentVaultProfiles";
import { normalizeNullableString } from "@/app/(talent-vault)/lib/server/applicantCvSync";
import {
  objectContainsSuspiciousPatterns,
  sanitizeObject,
  sanitizeString,
} from "@/lib/utils/sanitizeInput";

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

let ensureSubprogramIndexesPromise: Promise<void> | null = null;

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

async function ensureSubprogramIndexes(db: any) {
  if (!ensureSubprogramIndexesPromise) {
    ensureSubprogramIndexesPromise = (async () => {
      const subprograms = db.collection(SUBPROGRAM_COLLECTION);

      await subprograms.createIndex(
        { normalizedTitle: 1 },
        {
          name: "uniq_tv_subprograms_normalized_title_active",
          unique: true,
          partialFilterExpression: { archivedAt: null },
        }
      );

      await subprograms.createIndex(
        { status: 1, updatedAt: -1 },
        { name: "idx_tv_subprograms_status_updated_at" }
      );

      await subprograms.createIndex(
        { "createdBy.email": 1 },
        { name: "idx_tv_subprograms_created_by_email" }
      );
    })().catch((error) => {
      ensureSubprogramIndexesPromise = null;
      throw error;
    });
  }

  await ensureSubprogramIndexesPromise;
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

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { db } = await connectMongoDB();

    // Admin role enforcement
    const userEmail = String(request.user?.email || "").trim().toLowerCase();
    if (!userEmail) {
      return tvErrorResponse(
        401,
        "AUTHENTICATION_REQUIRED",
        "Authentication is required to access this resource."
      );
    }

    const admin = await db.collection("admins").findOne(
      { email: userEmail },
      { projection: { _id: 1 } }
    );

    if (!admin) {
      return tvErrorResponse(
        403,
        "ADMIN_ACCESS_REQUIRED",
        "Admin access is required to view subprograms."
      );
    }

    const { searchParams } = new URL(request.url);

    const search = String(searchParams.get("search") || "").trim();
    const statusParam = String(searchParams.get("status") || "").trim().toLowerCase();
    const activityStatusParam = String(searchParams.get("activityStatus") || "").trim();
    const roleTypeParam = String(searchParams.get("roleType") || "").trim();

    const dateFromParam = searchParams.get("dateFrom");
    const dateToParam = searchParams.get("dateTo");
    const includeTimeSeries = searchParams.get("timeSeries") === "daily";
    const dateFrom =
      dateFromParam && !isNaN(new Date(dateFromParam).getTime())
        ? new Date(dateFromParam)
        : null;
    const dateTo =
      dateToParam && !isNaN(new Date(dateToParam).getTime())
        ? new Date(dateToParam)
        : null;
    await ensureSubprogramIndexes(db);

    const filter: Record<string, unknown> = { archivedAt: null };

    // Status filter (supports comma-separated: "active,inactive")
    const validStatuses = new Set(["active", "inactive"]);
    const statusValues = statusParam
      ? statusParam.split(",").filter((s) => validStatuses.has(s))
      : [];
    if (statusValues.length === 1) {
      filter.status = statusValues[0];
    } else if (statusValues.length > 1) {
      filter.status = { $in: statusValues };
    }

    // Activity status filter (supports comma-separated: "Active,Inactive")
    const validActivityStatuses = new Set(["Active", "Inactive"]);
    const activityStatusValues = activityStatusParam
      ? activityStatusParam.split(",").filter((s) => validActivityStatuses.has(s))
      : [];
    if (activityStatusValues.length === 1) {
      filter.activityStatus = activityStatusValues[0];
    } else if (activityStatusValues.length > 1) {
      filter.activityStatus = { $in: activityStatusValues };
    }

    // Role type filter (supports comma-separated: "Full-time,Internship")
    const roleTypeValues = roleTypeParam
      ? roleTypeParam.split(",").map((r) => r.trim()).filter(Boolean)
      : [];
    if (roleTypeValues.length === 1) {
      filter.roleType = roleTypeValues[0];
    } else if (roleTypeValues.length > 1) {
      filter.roleType = { $in: roleTypeValues };
    }

    if (search) {
      filter.title = { $regex: escapeRegex(search), $options: "i" };
    }

    const collection = db.collection(SUBPROGRAM_COLLECTION);
    const profilesCollection = db.collection("tv-profiles");

    const aggregationMatch: Record<string, unknown> = {
      "profile.goals.selectedSubprogramId": { $exists: true, $ne: null },
    };
    if (dateFrom || dateTo) {
      const createdAtFilter: Record<string, Date> = {};
      if (dateFrom) createdAtFilter.$gte = dateFrom;
      if (dateTo) createdAtFilter.$lte = dateTo;
      aggregationMatch.createdAt = createdAtFilter;
    }

    let comparisonMatch: Record<string, unknown> | null = null;
    if (dateFrom) {
      const windowEnd = dateTo || new Date();
      const durationMs = windowEnd.getTime() - dateFrom.getTime();
      const prevStart = new Date(dateFrom.getTime() - durationMs);
      comparisonMatch = {
        "profile.goals.selectedSubprogramId": { $exists: true, $ne: null },
        createdAt: { $gte: prevStart, $lt: dateFrom },
      };
    }

    const [subprogramDocs, totalSubprograms, profileMetrics, timeSeriesDocs, comparisonDocs] = await Promise.all([
      collection
        .find(filter, {
          projection: {
            title: 1,
            roleType: 1,
            status: 1,
            activityStatus: 1,
            createdBy: 1,
            updatedBy: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        })
        .sort({ updatedAt: -1, _id: -1 })
        .toArray(),
      collection.countDocuments(filter),
      profilesCollection
        .aggregate([
          { $match: aggregationMatch },
          {
            $project: {
              _id: 0,
              subprogramId: "$profile.goals.selectedSubprogramId",
              isCompleted: { $eq: ["$setup.aiInterview", "done"] },
            },
          },
          {
            $group: {
              _id: "$subprogramId",
              registered: { $sum: 1 },
              completed: { $sum: { $cond: ["$isCompleted", 1, 0] } },
            },
          },
        ])
        .toArray(),
      includeTimeSeries
        ? profilesCollection
            .aggregate([
              { $match: aggregationMatch },
              {
                $project: {
                  _id: 0,
                  subprogramId: "$profile.goals.selectedSubprogramId",
                  isCompleted: { $eq: ["$setup.aiInterview", "done"] },
                  date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                },
              },
              {
                $group: {
                  _id: { subprogramId: "$subprogramId", date: "$date" },
                  registered: { $sum: 1 },
                  completed: { $sum: { $cond: ["$isCompleted", 1, 0] } },
                },
              },
              { $sort: { "_id.date": 1 } },
            ])
            .toArray()
        : Promise.resolve([]),
      comparisonMatch
        ? profilesCollection
            .aggregate([
              { $match: comparisonMatch },
              {
                $project: {
                  _id: 0,
                  subprogramId: "$profile.goals.selectedSubprogramId",
                  isCompleted: { $eq: ["$setup.aiInterview", "done"] },
                },
              },
              {
                $group: {
                  _id: "$subprogramId",
                  registered: { $sum: 1 },
                  completed: { $sum: { $cond: ["$isCompleted", 1, 0] } },
                },
              },
            ])
            .toArray()
        : Promise.resolve([]),
    ]);

    const metricsMap = new Map<
      string,
      { registered: number; completed: number }
    >();
    for (const entry of profileMetrics as any[]) {
      if (entry._id) {
        metricsMap.set(String(entry._id), {
          registered: entry.registered ?? 0,
          completed: entry.completed ?? 0,
        });
      }
    }

    const subprograms = subprogramDocs.map((subprogram: any) => {
      const id = subprogram._id.toString();
      const metrics = metricsMap.get(id) ?? { registered: 0, completed: 0 };
      return {
        _id: id,
        title: String(subprogram.title || "").trim(),
        roleType: String(subprogram.roleType || "").trim(),
        status: normalizeStatus(subprogram.status),
        activityStatus: normalizeActivityStatus(subprogram.activityStatus),
        registered: metrics.registered,
        completed: metrics.completed,
        invited: 0,
        hired: 0,
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
      };
    });
    const timeSeriesMetrics = timeSeriesDocs.map((doc: any) => ({
      subprogramId: String(doc._id?.subprogramId || ""),
      date: String(doc._id?.date || ""),
      registered: doc.registered ?? 0,
      completed: doc.completed ?? 0,
    }));

    const comparisonMetrics = (comparisonDocs as any[]).map((doc) => ({
      subprogramId: String(doc._id || ""),
      registered: doc.registered ?? 0,
      completed: doc.completed ?? 0,
    }));

    return NextResponse.json({
      subprograms,
      totalSubprograms,
      ...(includeTimeSeries ? { timeSeriesMetrics } : {}),
      ...(comparisonMetrics.length > 0 ? { comparisonMetrics } : {}),
    });
  } catch (error) {
    console.error("Error fetching talent vault subprograms:", error);
    return tvErrorResponse(
      500,
      "FETCH_SUBPROGRAMS_FAILED",
      "Failed to fetch talent vault subprograms."
    );
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { db } = await connectMongoDB();

    // Admin role enforcement
    const userEmail = String(request.user?.email || "").trim().toLowerCase();
    if (!userEmail) {
      return tvErrorResponse(
        401,
        "AUTHENTICATION_REQUIRED",
        "Authentication is required to access this resource."
      );
    }

    const admin = await db.collection("admins").findOne(
      { email: userEmail },
      { projection: { _id: 1 } }
    );

    if (!admin) {
      return tvErrorResponse(
        403,
        "ADMIN_ACCESS_REQUIRED",
        "Admin access is required to create subprograms."
      );
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
    const status = normalizeStatus(payload?.status);
    const activityStatus = normalizeActivityStatus(payload?.activityStatus);

    const preScreeningQuestions = sanitizeObject(
      Array.isArray(payload?.preScreeningQuestions) ? payload.preScreeningQuestions : [],
      "strict"
    ) as any[];

    const interviewInput =
      payload?.interview &&
      typeof payload.interview === "object" &&
      !Array.isArray(payload.interview)
        ? payload.interview
        : {};

    const sanitizedInterviewInput = sanitizeObject(interviewInput, "strict") as Record<
      string,
      unknown
    >;

    const interview = {
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

    if (!title) {
      return tvErrorResponse(
        400,
        "TITLE_REQUIRED",
        "Program title is required."
      );
    }

    if (!roleType) {
      return tvErrorResponse(
        400,
        "ROLE_TYPE_REQUIRED",
        "Role type is required."
      );
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

    const interviewValidationError = validateInterviewPayload(
      interview,
      status === "active"
    );
    if (interviewValidationError) {
      return tvErrorResponse(
        400,
        "INTERVIEW_VALIDATION_FAILED",
        interviewValidationError
      );
    }


    await ensureSubprogramIndexes(db);

    const actor = await resolveUserMetadata(db, request);
    const now = new Date();
    const normalizedTitle = toNormalizedName(title);

    const subprogramToInsert = {
      title,
      normalizedTitle,
      roleType,
      status,
      activityStatus,
      secretPrompt,
      preScreeningQuestions,
      interview,
      createdBy: actor,
      updatedBy: actor,
      createdAt: now,
      updatedAt: now,
      publishedAt: status === "active" ? now : null,
      archivedAt: null,
    };

    let insertResult: any;
    try {
      insertResult = await db.collection(SUBPROGRAM_COLLECTION).insertOne(subprogramToInsert);
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

    return NextResponse.json(
      {
        subprogram: {
          _id: insertResult.insertedId.toString(),
          ...subprogramToInsert,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating talent vault subprogram:", error);
    return tvErrorResponse(
      500,
      "CREATE_SUBPROGRAM_FAILED",
      "Failed to create talent vault subprogram."
    );
  }
});
