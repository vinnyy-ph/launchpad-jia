// Pure helpers for the "Generate Introduction" feature. No network or DOM here
// so they can be unit-tested and reused by the API route + the client guard.

import { htmlToPlainText, sanitizeRichText } from "./sanitizeRichText";
import type { StructuredCV } from "./structuredCV";

// True when there is at least one professional section to summarise. Contact
// info is intentionally excluded (no PII in the summary).
export function hasProfileContentForIntro(profile: StructuredCV): boolean {
  return Boolean(
    profile.experience?.length ||
      profile.skills?.length ||
      profile.education?.length ||
      profile.projects?.length ||
      profile.certifications?.length ||
      profile.awards?.length,
  );
}

function joinNonEmpty(parts: Array<string | undefined>, sep: string): string {
  return parts.map((p) => (p ?? "").trim()).filter(Boolean).join(sep);
}

export function buildIntroductionPrompt(profile: StructuredCV): string {
  const lines: string[] = [];

  if (profile.experience?.length) {
    lines.push("Experience:");
    for (const e of profile.experience) {
      const head = joinNonEmpty([e.title, e.company], " at ");
      const desc = htmlToPlainText(e.description);
      lines.push(`- ${head}${desc ? `: ${desc}` : ""}`);
    }
  }

  if (profile.skills?.length) {
    lines.push(`Skills: ${profile.skills.join(", ")}`);
  }

  if (profile.education?.length) {
    lines.push("Education:");
    for (const ed of profile.education) {
      lines.push(`- ${joinNonEmpty([ed.degree, ed.school], " at ")}`);
    }
  }

  if (profile.projects?.length) {
    lines.push("Projects:");
    for (const p of profile.projects) {
      const desc = htmlToPlainText(p.description);
      lines.push(`- ${p.name}${desc ? `: ${desc}` : ""}`);
    }
  }

  if (profile.certifications?.length) {
    lines.push("Certifications:");
    for (const c of profile.certifications) {
      lines.push(`- ${joinNonEmpty([c.name, c.issuingOrganization], " — ")}`);
    }
  }

  if (profile.awards?.length) {
    lines.push("Awards:");
    for (const a of profile.awards) {
      lines.push(`- ${joinNonEmpty([a.title, a.issuer], " — ")}`);
    }
  }

  return [
    "You are helping a job candidate write the introduction on their profile.",
    "Write a concise, professional introduction that summarises the candidate's background, experience, and strengths.",
    "Rules:",
    "- Use ONLY the details below. Do not invent employers, dates, skills, titles, or achievements.",
    '- Write in the first person ("I").',
    "- A single paragraph of 3-5 sentences. No markdown, no headings, no bullet lists, no line breaks.",
    "- Return ONLY the paragraph text, with no preamble and no surrounding quotation marks.",
    "",
    "Candidate details:",
    lines.join("\n"),
  ].join("\n");
}

// Turn raw model output into one safe <p> for the rich-text editor: strip code
// fences/quotes, collapse to a single paragraph, escape, then sanitise.
export function shapeIntroductionHtml(raw: string): string {
  let text = `${raw || ""}`.trim();
  if (!text) return "";

  text = text
    .replace(/^```(?:\w+)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
    .replace(/^["'“”]+/, "")
    .replace(/["'“”]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";

  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return sanitizeRichText(`<p>${escaped}</p>`);
}
