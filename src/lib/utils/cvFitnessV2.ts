// Enhanced CV Fitness V2 — pure logic for structured descriptions and qualification bucketing.
// Kept free of I/O so it is deterministically unit-testable. See CV_FITNESS_V2.md.

export interface StructuredCareerDescription {
  overview: string;
  rolesAndResponsibilities: string;
  requiredQualifications: string[];
  preferredQualifications: string[];
}

export type QualificationStatus = "matched" | "partial" | "missing";
export type QualificationType = "required" | "preferred";
export type AnalysisTab = "all" | QualificationStatus;

export interface QualificationResult {
  type: QualificationType;
  text: string;
  status: QualificationStatus;
  evidence: string;
}

export interface CvAnalysisV2 {
  matchScore: number;
  overallFit: string;
  summary: string;
  qualifications: QualificationResult[];
  generatedAt: number;
}

export interface BucketSummary {
  requiredMatched: number;
  requiredTotal: number;
  preferredMatched: number;
  preferredTotal: number;
  missingCount: number;
}

const stripHtml = (html: string): string => (html || "").replace(/<[^>]*>/g, "").trim();

/** A career can run V2 screening only if it has a structured description with at least one qualification. */
export function hasStructuredQualifications(career: any): boolean {
  const s = career?.structuredDescription;
  if (!s) return false;
  const required = Array.isArray(s.requiredQualifications) ? s.requiredQualifications : [];
  const preferred = Array.isArray(s.preferredQualifications) ? s.preferredQualifications : [];
  return required.length > 0 || preferred.length > 0;
}

/** Re-derive the legacy `description` HTML from the four structured sections so existing readers keep working. */
export function deriveLegacyDescription(s: StructuredCareerDescription): string {
  const parts: string[] = [];
  if (stripHtml(s.overview)) parts.push(`<h3>Overview</h3>${s.overview}`);
  if (stripHtml(s.rolesAndResponsibilities)) parts.push(`<h3>Roles and Responsibilities</h3>${s.rolesAndResponsibilities}`);
  const required = (s.requiredQualifications || []).filter((q) => q && q.trim());
  if (required.length) parts.push(`<h3>Required Qualifications</h3><ul>${required.map((q) => `<li>${q}</li>`).join("")}</ul>`);
  const preferred = (s.preferredQualifications || []).filter((q) => q && q.trim());
  if (preferred.length) parts.push(`<h3>Preferred Qualifications</h3><ul>${preferred.map((q) => `<li>${q}</li>`).join("")}</ul>`);
  return parts.join("");
}

/** Counts for the evaluation-card badges. Matched = status "matched" only; partial is its own bucket. */
export function summarizeBuckets(qualifications: QualificationResult[]): BucketSummary {
  const required = qualifications.filter((q) => q.type === "required");
  const preferred = qualifications.filter((q) => q.type === "preferred");
  return {
    requiredMatched: required.filter((q) => q.status === "matched").length,
    requiredTotal: required.length,
    preferredMatched: preferred.filter((q) => q.status === "matched").length,
    preferredTotal: preferred.length,
    missingCount: qualifications.filter((q) => q.status === "missing").length,
  };
}

export function filterQualificationsByTab(qualifications: QualificationResult[], tab: AnalysisTab): QualificationResult[] {
  if (tab === "all") return qualifications;
  return qualifications.filter((q) => q.status === tab);
}

function coerceStatus(raw: any): QualificationStatus {
  const v = String(raw ?? "").toLowerCase();
  if (v.includes("partial")) return "partial";
  if (v.includes("match")) return "matched";
  if (v.includes("missing")) return "missing";
  return "missing";
}

function coerceType(raw: any): QualificationType {
  return String(raw ?? "").toLowerCase().includes("preferred") ? "preferred" : "required";
}

/** Strip code fences, parse, validate, and coerce the model output into a typed CvAnalysisV2. Throws on malformed JSON. */
export function parseStructuredAnalysis(raw: string, now: number = Date.now()): CvAnalysisV2 {
  const cleaned = String(raw ?? "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleaned); // throws on malformed input
  const rawQuals = Array.isArray(parsed.qualifications) ? parsed.qualifications : [];
  const score = Number(parsed.matchScore);
  return {
    matchScore: Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0)),
    overallFit: String(parsed.overallFit ?? "N/A"),
    summary: String(parsed.summary ?? ""),
    qualifications: rawQuals.map((q: any) => ({
      type: coerceType(q?.type),
      text: String(q?.text ?? ""),
      status: coerceStatus(q?.status),
      evidence: String(q?.evidence ?? ""),
    })),
    generatedAt: now,
  };
}

/** Build the OpenAI prompt that asks the model to bucket each qualification against the CV. */
export function buildStructuredScreeningPrompt(
  s: StructuredCareerDescription,
  parsedCV: string,
  name: string,
  secretPrompt: string,
  basePrompt: string
): string {
  const list = (items: string[]) => (items || []).filter((q) => q && q.trim()).map((q, i) => `  ${i + 1}. ${q}`).join("\n") || "  (none)";
  return `
You are a helpful AI assistant screening a candidate's CV against a structured job description.

Job Overview:
${stripHtml(s.overview)}

Roles and Responsibilities:
${stripHtml(s.rolesAndResponsibilities)}

Required Qualifications:
${list(s.requiredQualifications)}

Preferred Qualifications:
${list(s.preferredQualifications)}

Applicant Name: ${name}
Applicant CV:
${parsedCV}

Processing Steps:
${basePrompt}
${secretPrompt ? `\nAdditional Evaluation Guidelines (Secret Prompt):\n${secretPrompt}` : ""}

For EVERY required and preferred qualification above, classify how well the CV addresses it as exactly one of:
"matched" (clearly met), "partial" (partially met / adjacent experience), or "missing" (no evidence).
Give a short evidence note (max ~20 words) citing the CV for each.

Format your response as JSON ONLY (no prose, no code fences):
{
  "matchScore": <overall 0-100>,
  "overallFit": "<No Fit | Bad Fit | Maybe Fit | Good Fit | Strong Fit>",
  "summary": "<2-3 sentence overall summary>",
  "qualifications": [
    { "type": "<required|preferred>", "text": "<the qualification, verbatim>", "status": "<matched|partial|missing>", "evidence": "<short note>" }
  ]
}
- Include one entry per qualification listed above, preserving its type and text.
- Return only the JSON object, nothing else.
`;
}
