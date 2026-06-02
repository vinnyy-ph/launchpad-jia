const TALENT_VAULT_SELECTED_FIELDS = [
  "Management",
  "Technology",
  "Finance",
  "Creatives",
  "Design",
] as const;

const TALENT_VAULT_SENIORITY = [
  "intern",
  "junior",
  "associate",
  "mid",
  "senior",
] as const;

type TalentVaultSelectedField = (typeof TALENT_VAULT_SELECTED_FIELDS)[number];
type TalentVaultSeniority = (typeof TALENT_VAULT_SENIORITY)[number];

type TalentVaultAnalysisItem = {
  title: string;
  description: string;
};

type TalentVaultWorkStyleItem = {
  title: string;
  description: string;
  quality: string;
};

type TalentVaultMatchingSignals = {
  roleTitles: string[];
  hardSkills: string[];
  domains: string[];
  industries: string[];
  seniority: TalentVaultSeniority | null;
  keywords: string[];
  confidence: number;
};

export type TalentVaultAnalysisOutput = {
  selectedFields: TalentVaultSelectedField[];
  strengths: TalentVaultAnalysisItem[];
  bestJobFit: TalentVaultAnalysisItem[];
  workStyle: TalentVaultWorkStyleItem[];
  values: TalentVaultAnalysisItem[];
  feedback: {
    positive: string;
    improvements: string;
  };
  matchingSignals: TalentVaultMatchingSignals;
};

const TALENT_VAULT_SELECTED_FIELDS_MAP = new Map<string, TalentVaultSelectedField>(
  TALENT_VAULT_SELECTED_FIELDS.map((value) => [value.toLowerCase(), value])
);

const TALENT_VAULT_ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    selectedFields: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "string",
        enum: TALENT_VAULT_SELECTED_FIELDS,
      },
    },
    strengths: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["title", "description"],
      },
    },
    bestJobFit: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["title", "description"],
      },
    },
    workStyle: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          quality: { type: "string" },
        },
        required: ["title", "description", "quality"],
      },
    },
    values: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["title", "description"],
      },
    },
    feedback: {
      type: "object",
      additionalProperties: false,
      properties: {
        positive: { type: "string" },
        improvements: { type: "string" },
      },
      required: ["positive", "improvements"],
    },
    matchingSignals: {
      type: "object",
      additionalProperties: false,
      properties: {
        roleTitles: {
          type: "array",
          items: { type: "string" },
        },
        hardSkills: {
          type: "array",
          items: { type: "string" },
        },
        domains: {
          type: "array",
          items: { type: "string" },
        },
        industries: {
          type: "array",
          items: { type: "string" },
        },
        seniority: {
          anyOf: [
            {
              type: "string",
              enum: TALENT_VAULT_SENIORITY,
            },
            {
              type: "null",
            },
          ],
        },
        keywords: {
          type: "array",
          items: { type: "string" },
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },
      },
      required: [
        "roleTitles",
        "hardSkills",
        "domains",
        "industries",
        "seniority",
        "keywords",
        "confidence",
      ],
    },
  },
  required: [
    "selectedFields",
    "strengths",
    "bestJobFit",
    "workStyle",
    "values",
    "feedback",
    "matchingSignals",
  ],
} as const;

export const talentVaultAnalysisResponseFormat = {
  type: "json_schema",
  name: "talent_vault_interview_analysis",
  strict: true,
  schema: TALENT_VAULT_ANALYSIS_SCHEMA,
} as const;

function stripCodeFence(rawValue: string) {
  return rawValue.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLowercaseList(input: unknown, maxItems: number) {
  if (!Array.isArray(input)) {
    return [];
  }

  const unique = new Set<string>();

  for (const item of input) {
    const normalized = String(item || "").trim().toLowerCase();
    if (!normalized) continue;
    unique.add(normalized);
    if (unique.size >= maxItems) {
      break;
    }
  }

  return Array.from(unique);
}

function normalizeAnalysisItemList(input: unknown, maxItems: number): TalentVaultAnalysisItem[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => ({
      title: normalizeString((item as any)?.title),
      description: normalizeString((item as any)?.description),
    }))
    .filter((item) => item.title.length > 0 || item.description.length > 0)
    .slice(0, maxItems);
}

function normalizeWorkStyleList(input: unknown): TalentVaultWorkStyleItem[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => ({
      title: normalizeString((item as any)?.title),
      description: normalizeString((item as any)?.description),
      quality: normalizeString((item as any)?.quality),
    }))
    .filter(
      (item) =>
        item.title.length > 0 || item.description.length > 0 || item.quality.length > 0
    )
    .slice(0, 5);
}

function normalizeSelectedFields(input: unknown): TalentVaultSelectedField[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const selected: TalentVaultSelectedField[] = [];
  const seen = new Set<TalentVaultSelectedField>();

  for (const value of input) {
    const mapped = TALENT_VAULT_SELECTED_FIELDS_MAP.get(
      String(value || "").trim().toLowerCase()
    );

    if (!mapped || seen.has(mapped)) {
      continue;
    }

    seen.add(mapped);
    selected.push(mapped);

    if (selected.length >= 3) {
      break;
    }
  }

  return selected;
}

function normalizeTalentVaultMatchingSignals(
  input: unknown
): TalentVaultMatchingSignals {
  const payload = input && typeof input === "object" ? (input as any) : {};
  const normalizedSeniority = normalizeString(payload.seniority).toLowerCase();
  const seniority =
    normalizedSeniority === "intern" ||
    normalizedSeniority === "junior" ||
    normalizedSeniority === "associate" ||
    normalizedSeniority === "mid" ||
    normalizedSeniority === "senior"
      ? (normalizedSeniority as TalentVaultSeniority)
      : null;

  const rawConfidence = Number(payload.confidence);
  const confidence = Number.isFinite(rawConfidence)
    ? Math.max(0, Math.min(1, rawConfidence))
    : 0;

  return {
    roleTitles: normalizeLowercaseList(payload.roleTitles, 8),
    hardSkills: normalizeLowercaseList(payload.hardSkills, 18),
    domains: normalizeLowercaseList(payload.domains, 8),
    industries: normalizeLowercaseList(payload.industries, 6),
    seniority,
    keywords: normalizeLowercaseList(payload.keywords, 15),
    confidence,
  };
}

function normalizeTalentVaultAnalysis(input: unknown): TalentVaultAnalysisOutput {
  const payload = input && typeof input === "object" ? (input as any) : {};

  return {
    selectedFields: normalizeSelectedFields(payload.selectedFields),
    strengths: normalizeAnalysisItemList(payload.strengths, 5),
    bestJobFit: normalizeAnalysisItemList(payload.bestJobFit, 5),
    workStyle: normalizeWorkStyleList(payload.workStyle),
    values: normalizeAnalysisItemList(payload.values, 5),
    feedback: {
      positive: normalizeString(payload?.feedback?.positive),
      improvements: normalizeString(payload?.feedback?.improvements),
    },
    matchingSignals: normalizeTalentVaultMatchingSignals(payload.matchingSignals),
  };
}

export function parseTalentVaultAnalysis(rawValue: string): TalentVaultAnalysisOutput {
  const cleanedResponse = stripCodeFence(rawValue);
  const parsed = JSON.parse(cleanedResponse);
  return normalizeTalentVaultAnalysis(parsed);
}
