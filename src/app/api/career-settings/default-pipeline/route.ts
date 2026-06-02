import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { verifyUserIsAdmin, verifyUserIsMember } from "@/lib/utils/adminAuth";
import { objectContainsSuspiciousPatterns, sanitizeObject } from "@/lib/utils/sanitizeInput";
import { Db, ObjectId } from "mongodb";

const ALLOWED_AUTO_ENDORSE = [
  "None",
  "Maybe Fit and above",
  "Good Fit and above",
  "Only Strong Fit",
];

const ALLOWED_AUTO_DROP = [
  "None",
  "Bad Fit and below",
  "Maybe Fit and below",
];

const ALLOWED_QUESTION_FORMATS = [
  "Short Answer",
  "Long Answer",
  "Dropdown",
  "Checkboxes",
  "Range",
];

const ALLOWED_RANGE_SCREENING_RULES = [
  "Above maximum only",
  "Below minimum only",
  "Outside the range",
];

const getProjectScopeQuery = (orgID: string, projectID: string) => ({
  orgID,
  scopeType: "project",
  scopeId: projectID,
});

const getOrgScopeQuery = (orgID: string) => ({
  orgID,
  scopeType: "org",
  scopeId: null,
});

const SETTINGS_PROJECTION = {
  _id: 0,
  defaultPipelineStages: 1,
  defaultPreScreeningSuggestions: 1,
  updatedAt: 1,
  updatedBy: 1,
  scopeType: 1,
  scopeId: 1,
};

const trimString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const hasOwnField = (value: any, field: string): boolean =>
  Boolean(value && Object.prototype.hasOwnProperty.call(value, field));

const resolveScopedField = (
  projectScopeSettings: any,
  orgScopeSettings: any,
  field: string
) => {
  if (hasOwnField(projectScopeSettings, field)) {
    return projectScopeSettings[field];
  }

  if (hasOwnField(orgScopeSettings, field)) {
    return orgScopeSettings[field];
  }

  return null;
};

const normalizePipelineAliases = (pipelineStages: any[]) => {
  for (const stage of pipelineStages) {
    if (stage?.id === "1" || stage?.id === "2") {
      const trimmedAlias = stage.alias?.trim() || "";
      if (!trimmedAlias) {
        delete stage.alias;
      } else {
        stage.alias = trimmedAlias;
      }
    }
  }
};

const validatePipelineStages = (pipelineStages: any[]): string | null => {
  if (!Array.isArray(pipelineStages) || pipelineStages.length === 0) {
    return "Default pipeline stages are required";
  }

  const uniquePipelineStages = [...new Set(pipelineStages.map((stage: any) => stage?.name))];
  if (uniquePipelineStages.length !== pipelineStages.length) {
    return "Pipeline stages must be unique";
  }

  const enabledStagesCount = pipelineStages.filter((stage: any) => stage?.enabled !== false).length;
  if (enabledStagesCount === 0) {
    return "At least one pipeline stage must be enabled";
  }

  for (const stage of pipelineStages) {
    if (!Array.isArray(stage?.substages) || stage.substages.length === 0) {
      return "Substages cannot be empty";
    }

    const uniqueSubstages = [...new Set(stage.substages.map((substage: any) => substage?.name))];
    if (uniqueSubstages.length !== stage.substages.length) {
      return "Substages must be unique";
    }

    if (stage.autoEndorse && !ALLOWED_AUTO_ENDORSE.includes(stage.autoEndorse)) {
      return "Invalid auto endorsement value";
    }

    if (stage.autoDrop && !ALLOWED_AUTO_DROP.includes(stage.autoDrop)) {
      return "Invalid auto dropping value";
    }

    if (
      stage.autoEndorse === "Maybe Fit and above" &&
      stage.autoDrop === "Maybe Fit and below"
    ) {
      return "Auto endorsement and auto dropping settings are in conflict";
    }
  }

  return null;
};

const validatePreScreeningSuggestions = (suggestions: any[]): string | null => {
  if (!Array.isArray(suggestions)) {
    return "Default pre-screening suggestions must be an array";
  }

  for (const suggestion of suggestions) {
    const questionId =
      typeof suggestion?.id === "number" || typeof suggestion?.id === "string"
        ? String(suggestion.id).trim()
        : "";
    if (!questionId) {
      return "Each pre-screening question must have an ID";
    }

    if (!trimString(suggestion?.questionType)) {
      return "Each pre-screening question must have a question type";
    }

    if (!trimString(suggestion?.question)) {
      return "Each pre-screening question must have a question";
    }

    const questionFormat = trimString(suggestion?.questionFormat);
    if (!ALLOWED_QUESTION_FORMATS.includes(questionFormat)) {
      return "Invalid pre-screening question format";
    }

    if (!Array.isArray(suggestion?.answers)) {
      return "Each pre-screening question must include answers";
    }

    if (["Dropdown", "Checkboxes"].includes(questionFormat)) {
      if (suggestion.answers.length < 1) {
        return "Choice-based pre-screening questions must include at least one option";
      }

      const hasEmptyOption = suggestion.answers.some((answer: any) => {
        return !String(answer?.value ?? "").trim();
      });
      if (hasEmptyOption) {
        return "Pre-screening options cannot be empty";
      }
    }

    if (questionFormat === "Range") {
      const minimumRaw = suggestion.answers.find(
        (answer: any) => trimString(answer?.type) === "Minimum"
      )?.value;
      const maximumRaw = suggestion.answers.find(
        (answer: any) => trimString(answer?.type) === "Maximum"
      )?.value;

      const isMinimumMissing =
        minimumRaw === "" || minimumRaw === null || minimumRaw === undefined;
      const isMaximumMissing =
        maximumRaw === "" || maximumRaw === null || maximumRaw === undefined;

      if (isMinimumMissing || isMaximumMissing) {
        return "Range pre-screening questions must include minimum and maximum values";
      }

      const minimumValue = Number(minimumRaw);
      const maximumValue = Number(maximumRaw);

      if (!Number.isFinite(minimumValue) || !Number.isFinite(maximumValue)) {
        return "Range pre-screening values must be valid numbers";
      }

      if (minimumValue < 0 || maximumValue < 0) {
        return "Range pre-screening values must be at least 0";
      }

      if (maximumValue < minimumValue) {
        return "Range pre-screening maximum must be greater than or equal to minimum";
      }

      if (suggestion?.isAutoFiltering) {
        const screeningRule = trimString(suggestion?.screeningRule);
        if (!ALLOWED_RANGE_SCREENING_RULES.includes(screeningRule)) {
          return "Invalid range auto-filtering rule";
        }
      }
    }
  }

  return null;
};

const normalizePreScreeningSuggestions = (suggestions: any[]) => {
  for (const suggestion of suggestions) {
    suggestion.id =
      typeof suggestion?.id === "number" || typeof suggestion?.id === "string"
        ? String(suggestion.id).trim()
        : "";
    suggestion.questionType = trimString(suggestion?.questionType);
    suggestion.question = trimString(suggestion?.question);
    suggestion.questionFormat = trimString(suggestion?.questionFormat);

    if (!Array.isArray(suggestion.answers)) {
      suggestion.answers = [];
    }

    suggestion.answers = suggestion.answers.map((answer: any) => {
      const normalizedAnswer = {
        ...answer,
        id:
          typeof answer?.id === "number"
            ? answer.id
            : typeof answer?.id === "string"
              ? answer.id.trim()
              : "",
        type: trimString(answer?.type),
      } as any;

      if (typeof answer?.value === "string") {
        normalizedAnswer.value = answer.value.trim();
      }

      return normalizedAnswer;
    });

    suggestion.isAutoFiltering = Boolean(suggestion?.isAutoFiltering);

    if (!suggestion.isAutoFiltering) {
      delete suggestion.screeningRule;
      suggestion.answers = suggestion.answers.map(({ dropCandidate, ...answer }: any) => answer);
      continue;
    }

    if (suggestion.questionFormat === "Range") {
      suggestion.screeningRule = trimString(suggestion?.screeningRule);
      suggestion.answers = suggestion.answers.map(({ dropCandidate, ...answer }: any) => answer);
      continue;
    }

    delete suggestion.screeningRule;
    suggestion.answers = suggestion.answers.map((answer: any) => ({
      ...answer,
      dropCandidate: Boolean(answer?.dropCandidate),
    }));
  }
};

const ensureProjectInOrg = async (db: Db, orgID: string, projectID: string): Promise<boolean> => {
  if (!ObjectId.isValid(projectID)) {
    return false;
  }

  const project = await db.collection("projects").findOne(
    {
      _id: new ObjectId(projectID),
      orgID,
    },
    {
      projection: { _id: 1 },
    }
  );

  return Boolean(project);
};

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get("orgID");
    const projectID = searchParams.get("projectID")?.trim();
    const email = request.user.email;

    if (!orgID) {
      return NextResponse.json({ error: "Org ID is required" }, { status: 400 });
    }

    const { db } = await connectMongoDB();
    const authResult = await verifyUserIsMember(db, email, orgID);

    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.reason }, { status: 403 });
    }

    let projectScopeSettings = null;
    let orgScopeSettings = null;

    if (projectID) {
      const [projectExists, fetchedProjectScope, fetchedOrgScope] = await Promise.all([
        ensureProjectInOrg(db, orgID, projectID),
        db.collection("career-settings").findOne(
          getProjectScopeQuery(orgID, projectID),
          { projection: SETTINGS_PROJECTION }
        ),
        db.collection("career-settings").findOne(getOrgScopeQuery(orgID), {
          projection: SETTINGS_PROJECTION,
        }),
      ]);

      if (!projectExists) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      projectScopeSettings = fetchedProjectScope;
      orgScopeSettings = fetchedOrgScope;

      const metadataSource = projectScopeSettings || orgScopeSettings;

      return NextResponse.json({
        defaultPipelineStages: resolveScopedField(
          projectScopeSettings,
          orgScopeSettings,
          "defaultPipelineStages"
        ),
        defaultPreScreeningSuggestions: resolveScopedField(
          projectScopeSettings,
          orgScopeSettings,
          "defaultPreScreeningSuggestions"
        ),
        updatedAt: metadataSource?.updatedAt || null,
        updatedBy: metadataSource?.updatedBy || null,
        scopeType: metadataSource?.scopeType || null,
        scopeId: metadataSource?.scopeId || null,
      });
    }

    orgScopeSettings = await db.collection("career-settings").findOne(getOrgScopeQuery(orgID), {
      projection: SETTINGS_PROJECTION,
    });

    return NextResponse.json({
      defaultPipelineStages: hasOwnField(orgScopeSettings, "defaultPipelineStages")
        ? orgScopeSettings.defaultPipelineStages
        : null,
      defaultPreScreeningSuggestions: hasOwnField(
        orgScopeSettings,
        "defaultPreScreeningSuggestions"
      )
        ? orgScopeSettings.defaultPreScreeningSuggestions
        : null,
      updatedAt: orgScopeSettings?.updatedAt || null,
      updatedBy: orgScopeSettings?.updatedBy || null,
      scopeType: orgScopeSettings?.scopeType || null,
      scopeId: orgScopeSettings?.scopeId || null,
    });
  } catch (error) {
    console.error("Error fetching career settings default pipeline:", error);
    return NextResponse.json(
      { error: "Failed to fetch career settings default pipeline" },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const {
      orgID,
      defaultPipelineStages,
      defaultPreScreeningSuggestions,
      projectID: rawProjectID,
    } = await request.json();
    const projectID = typeof rawProjectID === "string" ? rawProjectID.trim() : "";
    const hasPipelinePayload = typeof defaultPipelineStages !== "undefined";
    const hasPreScreeningPayload =
      typeof defaultPreScreeningSuggestions !== "undefined";
    const email = request.user.email;

    if (!orgID) {
      return NextResponse.json({ error: "Org ID is required" }, { status: 400 });
    }

    if (!hasPipelinePayload && !hasPreScreeningPayload) {
      return NextResponse.json(
        { error: "At least one settings field is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    const authResult = await verifyUserIsAdmin(db, email, orgID);

    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.reason }, { status: 403 });
    }

    if (projectID) {
      const projectExists = await ensureProjectInOrg(db, orgID, projectID);
      if (!projectExists) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }

    const payloadForSuspiciousCheck: Record<string, unknown> = {};
    if (hasPipelinePayload) {
      payloadForSuspiciousCheck.defaultPipelineStages = defaultPipelineStages;
    }

    if (hasPreScreeningPayload) {
      payloadForSuspiciousCheck.defaultPreScreeningSuggestions = defaultPreScreeningSuggestions;
    }

    if (objectContainsSuspiciousPatterns(payloadForSuspiciousCheck)) {
      return NextResponse.json(
        {
          error:
            "Input contains potentially dangerous content. Please remove scripts, HTML event handlers, or other executable code.",
        },
        { status: 400 }
      );
    }

    const sanitizedPipelineStages = hasPipelinePayload
      ? sanitizeObject(defaultPipelineStages, "strict")
      : undefined;
    const sanitizedPreScreeningSuggestions = hasPreScreeningPayload
      ? sanitizeObject(defaultPreScreeningSuggestions, "strict")
      : undefined;

    if (hasPipelinePayload) {
      if (Array.isArray(sanitizedPipelineStages)) {
        normalizePipelineAliases(sanitizedPipelineStages);
      }

      const validationError = validatePipelineStages(sanitizedPipelineStages);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    }

    if (hasPreScreeningPayload) {
      const preScreeningValidationError = validatePreScreeningSuggestions(
        sanitizedPreScreeningSuggestions
      );
      if (preScreeningValidationError) {
        return NextResponse.json({ error: preScreeningValidationError }, { status: 400 });
      }

      normalizePreScreeningSuggestions(sanitizedPreScreeningSuggestions);
    }

    const scopeFilter = projectID ? getProjectScopeQuery(orgID, projectID) : getOrgScopeQuery(orgID);
    const scopeOnInsert = projectID
      ? { scopeType: "project", scopeId: projectID }
      : { scopeType: "org", scopeId: null };

    const now = new Date();

    const nextSetPayload: Record<string, any> = {
      updatedAt: now,
      updatedBy: {
        email: request.user.email,
        name: (request.user as any)?.name || "",
        image: (request.user as any)?.picture || (request.user as any)?.image || "",
      },
    };

    if (hasPipelinePayload) {
      nextSetPayload.defaultPipelineStages = sanitizedPipelineStages;
    }

    if (hasPreScreeningPayload) {
      nextSetPayload.defaultPreScreeningSuggestions = sanitizedPreScreeningSuggestions;
    }

    await db.collection("career-settings").updateOne(
      scopeFilter,
      {
        $set: nextSetPayload,
        $setOnInsert: {
          orgID,
          ...scopeOnInsert,
          createdAt: now,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ message: "Career settings saved successfully" });
  } catch (error) {
    console.error("Error saving career settings:", error);
    return NextResponse.json(
      { error: "Failed to save career settings" },
      { status: 500 }
    );
  }
});
