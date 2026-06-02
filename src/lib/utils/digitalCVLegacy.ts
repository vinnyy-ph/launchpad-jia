import {
  deriveStructuredCVFields,
  normalizeStructuredCVInput,
} from "@/lib/utils/structuredCV";

interface LegacyDigitalCVSection {
  name: string;
  content: string;
}

const NONE_LISTED = "- None listed.";
const NOT_PROVIDED = "Not provided";
const NOT_AVAILABLE = "Not available";

function scalarToText(input: unknown): string {
  if (input == null) return "";
  if (typeof input === "string") return input.trim();
  if (typeof input === "number" || typeof input === "boolean") return String(input);
  return "";
}

function normalizeDate(dateValue: any): string {
  if (!dateValue || typeof dateValue !== "object") return "";
  const month = scalarToText(dateValue.month);
  const year = scalarToText(dateValue.year);
  if (!month && !year) return "";
  return [month, year].filter(Boolean).join(" ");
}

function parseMaybeJson(input: string): unknown {
  const raw = input.trim();
  if (!raw) return "";
  if (!/^[\[{]/.test(raw)) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function uniqueText(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const text = scalarToText(value);
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(text);
  });

  return result;
}

function lineToBullet(text: string): string {
  const clean = text.replace(/^[-*+]\s*/, "").trim();
  return clean ? `- ${clean}` : "";
}

function inferWebsiteType(url: string): string {
  if (/github\.com/i.test(url)) return "GitHub";
  if (/twitter\.com|x\.com/i.test(url)) return "Twitter";
  if (/linkedin\.com/i.test(url)) return "LinkedIn";
  return "Website";
}

function normalizeUrl(url: string): string {
  const clean = scalarToText(url);
  if (!clean) return "";
  if (/^mailto:/i.test(clean)) return clean;
  if (/^https?:\/\//i.test(clean)) return clean;
  return `https://${clean.replace(/^\/+/, "")}`;
}

function toLinkLabel(url: string): string {
  return scalarToText(url)
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
}

function formatDescriptionPoints(input: unknown): string[] {
  if (Array.isArray(input)) {
    return uniqueText(input);
  }

  const raw = scalarToText(input).replace(/\r/g, "");
  if (!raw) return [];

  const lines = raw
    .split("\n")
    .map((line) => line.replace(/^[-*+]\s*/, "").trim())
    .filter(Boolean);

  if (lines.length > 1) return lines;
  if (lines.length === 1) return lines;

  return [];
}

function formatIntroduction(value: unknown): string {
  const text = scalarToText(value);
  if (!text) return NONE_LISTED;

  const cleaned = text
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .replace(/^[-*+]\s*/, "")
    .trim();

  return cleaned ? `- ${cleaned}` : NONE_LISTED;
}

function formatCurrentPosition(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const fromObject = [scalarToText(obj.currentPosition), scalarToText(obj.company)]
      .filter(Boolean)
      .join(" at ");
    if (fromObject) return `- ${fromObject}`;
  }

  const text = scalarToText(value).replace(/^[-*+]\s*/, "");
  return text ? `- ${text}` : "- Not provided";
}

function formatContactInfo(value: unknown): string {
  const obj =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const websites = Array.isArray(obj.websites)
    ? obj.websites.filter((site) => site && typeof site === "object")
    : [];

  const name = scalarToText(obj.name || obj.fullName || obj.fullname);
  const email = scalarToText(obj.email);
  const phone = scalarToText(obj.phone);
  const countryCode = scalarToText(obj.countryCode);
  const address = scalarToText(obj.address);
  const linkedinRaw = scalarToText(obj.linkedin);
  const linkedinUrl = normalizeUrl(linkedinRaw);
  const phoneDisplay = [countryCode, phone].filter(Boolean).join(" ").trim();

  const websiteByType = new Map<string, string>();

  websites.forEach((site) => {
    const entry = site as Record<string, unknown>;
    const urlRaw = scalarToText(entry.url);
    if (!urlRaw) return;
    const normalized = normalizeUrl(urlRaw);
    const typeRaw = scalarToText(entry.type);
    const type = typeRaw || inferWebsiteType(normalized);
    if (!websiteByType.has(type.toLowerCase())) {
      websiteByType.set(type.toLowerCase(), `${type}|${normalized}`);
    }
  });

  const github = scalarToText(obj.github);
  const twitter = scalarToText(obj.twitter || obj.x);
  if (github && !websiteByType.has("github")) {
    websiteByType.set("github", `GitHub|${normalizeUrl(github)}`);
  }
  if (twitter && !websiteByType.has("twitter")) {
    websiteByType.set("twitter", `Twitter|${normalizeUrl(twitter)}`);
  }

  const lines = [
    `- **Name:** ${name || NOT_PROVIDED}`,
    `- **Email:** ${email ? `[${email}](mailto:${email})` : NOT_PROVIDED}`,
    `- **Phone:** ${phoneDisplay || NOT_PROVIDED}`,
    `- **Address:** ${address || NOT_PROVIDED}`,
    `- **LinkedIn:** ${
      linkedinUrl ? `[${toLinkLabel(linkedinUrl)}](${linkedinUrl})` : NOT_AVAILABLE
    }`,
  ];

  const addWebsiteLine = (type: string, fallbackLabel: string) => {
    const entry = websiteByType.get(type.toLowerCase());
    if (!entry) {
      lines.push(`- **${fallbackLabel}:** ${NOT_AVAILABLE}`);
      return;
    }

    const [label, url] = entry.split("|");
    const finalLabel = label || fallbackLabel;
    const finalUrl = scalarToText(url);
    lines.push(
      `- **${finalLabel}:** ${
        finalUrl ? `[${toLinkLabel(finalUrl)}](${finalUrl})` : NOT_AVAILABLE
      }`
    );
  };

  addWebsiteLine("github", "GitHub");
  addWebsiteLine("twitter", "Twitter");

  websiteByType.forEach((entry, key) => {
    if (key === "github" || key === "twitter" || key === "linkedin") return;
    const [label, url] = entry.split("|");
    const finalLabel = label || "Website";
    const finalUrl = scalarToText(url);
    lines.push(
      `- **${finalLabel}:** ${
        finalUrl ? `[${toLinkLabel(finalUrl)}](${finalUrl})` : NOT_AVAILABLE
      }`
    );
  });

  return lines.join("\n");
}

function formatSkills(value: unknown): string {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
    ? value
        .split(/[\n,]/)
        .map((line) => line.replace(/^[-*+]\s*/, "").trim())
        .filter((line) => line && !/^skills?$/i.test(line))
    : [];

  const skills = uniqueText(Array.isArray(source) ? source : []);
  if (skills.length === 0) return NONE_LISTED;
  return skills.map((skill) => lineToBullet(skill)).filter(Boolean).join("\n");
}

function formatDateRange(
  startDate: unknown,
  endDate: unknown,
  isCurrent: boolean
): string {
  const start = normalizeDate(startDate);
  const end = isCurrent ? "Present" : normalizeDate(endDate);
  return [start, end].filter(Boolean).join(" - ");
}

function formatExperience(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return NONE_LISTED;

  const lines: string[] = [];
  value.forEach((entryRaw) => {
    if (!entryRaw || typeof entryRaw !== "object") return;
    const entry = entryRaw as Record<string, unknown>;
    const title = scalarToText(entry.title) || "Role";
    const company = scalarToText(entry.company);
    const location = scalarToText(entry.location);
    const details = [company, location].filter(Boolean).join(" - ");
    const dateRange = formatDateRange(
      entry.startDate,
      entry.endDate,
      Boolean(entry.isCurrentRole)
    );

    let heading = `**${title}**`;
    if (details) heading += `, ${details}`;
    if (dateRange) heading += ` (${dateRange})`;
    lines.push(`- ${heading}`);

    const detailLines = formatDescriptionPoints(
      entry.description || entry.responsibilities || entry.highlights
    );
    detailLines.forEach((detail) => lines.push(`  - ${detail}`));
  });

  return lines.length > 0 ? lines.join("\n") : NONE_LISTED;
}

function formatEducation(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return NONE_LISTED;

  const lines: string[] = [];
  value.forEach((entryRaw) => {
    if (!entryRaw || typeof entryRaw !== "object") return;
    const entry = entryRaw as Record<string, unknown>;
    const school = scalarToText(entry.school) || "Institution";
    const dateRange = formatDateRange(entry.startDate, entry.endDate, false);
    let heading = `**${school}**`;
    if (dateRange) heading += ` (${dateRange})`;
    lines.push(`- ${heading}`);

    const degree = scalarToText(entry.degree);
    const field = scalarToText(entry.fieldOfStudy);
    const degreeLine = [degree, field].filter(Boolean).join(" in ");
    if (degreeLine) lines.push(`  - ${degreeLine}`);

    formatDescriptionPoints(entry.description).forEach((detail) => {
      lines.push(`  - ${detail}`);
    });
  });

  return lines.length > 0 ? lines.join("\n") : NONE_LISTED;
}

function formatProjects(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return NONE_LISTED;

  const lines: string[] = [];
  value.forEach((entryRaw) => {
    if (!entryRaw || typeof entryRaw !== "object") return;
    const entry = entryRaw as Record<string, unknown>;
    const name = scalarToText(entry.name) || "Project";
    const dateRange = formatDateRange(
      entry.startDate,
      entry.endDate,
      Boolean(entry.isCurrent)
    );
    let heading = `**${name}**`;
    if (dateRange) heading += ` (${dateRange})`;
    lines.push(`- ${heading}`);

    formatDescriptionPoints(entry.description).forEach((detail) => {
      lines.push(`  - ${detail}`);
    });
  });

  return lines.length > 0 ? lines.join("\n") : NONE_LISTED;
}

function formatCertifications(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return NONE_LISTED;

  const lines: string[] = [];
  value.forEach((entryRaw) => {
    if (!entryRaw || typeof entryRaw !== "object") return;
    const entry = entryRaw as Record<string, unknown>;

    const name = scalarToText(entry.name) || "Certification";
    const issuer = scalarToText(entry.issuingOrganization);
    const issued = normalizeDate(entry.issueDate);
    const expires = normalizeDate(entry.expirationDate);
    const metadata = [
      issued ? `Issued: ${issued}` : "",
      expires ? `Expires: ${expires}` : "",
    ].filter(Boolean);

    let heading = `**${name}**`;
    if (issuer) heading += `, ${issuer}`;
    if (metadata.length > 0) heading += ` (${metadata.join("; ")})`;
    lines.push(`- ${heading}`);

    const credentialId = scalarToText(entry.credentialId);
    const credentialUrl = normalizeUrl(scalarToText(entry.credentialUrl));
    if (credentialId) lines.push(`  - Credential ID: ${credentialId}`);
    if (credentialUrl) {
      lines.push(
        `  - Credential URL: [${toLinkLabel(credentialUrl)}](${credentialUrl})`
      );
    }
  });

  return lines.length > 0 ? lines.join("\n") : NONE_LISTED;
}

function formatAwards(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return NONE_LISTED;

  const lines: string[] = [];
  value.forEach((entryRaw) => {
    if (!entryRaw || typeof entryRaw !== "object") return;
    const entry = entryRaw as Record<string, unknown>;

    const title = scalarToText(entry.title) || "Award";
    const issuer = scalarToText(entry.issuer);
    const issueDate = normalizeDate(entry.issueDate);
    let heading = title;
    if (issuer) heading += `, ${issuer}`;
    if (issueDate) heading += ` (${issueDate})`;
    lines.push(`- ${heading}`);

    formatDescriptionPoints(entry.description).forEach((detail) => {
      lines.push(`  - ${detail}`);
    });
  });

  return lines.length > 0 ? lines.join("\n") : NONE_LISTED;
}

function formatGeneric(value: unknown): string {
  if (Array.isArray(value)) {
    const items = uniqueText(value);
    return items.length > 0
      ? items.map((item) => lineToBullet(item)).filter(Boolean).join("\n")
      : NONE_LISTED;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => `${key}: ${scalarToText(entry)}`.trim())
      .filter((line) => line !== ":" && !line.endsWith(":"));
    return entries.length > 0
      ? entries.map((line) => lineToBullet(line)).filter(Boolean).join("\n")
      : NONE_LISTED;
  }

  const text = scalarToText(value);
  return text ? lineToBullet(text) || NONE_LISTED : NONE_LISTED;
}

export function toLegacyMarkdown(name: string, value: unknown): string {
  const normalizedValue =
    typeof value === "string" ? parseMaybeJson(value) : value;

  switch (name) {
    case "Introduction":
      return formatIntroduction(normalizedValue);
    case "Current Position":
      return formatCurrentPosition(normalizedValue);
    case "Contact Info":
      return formatContactInfo(normalizedValue);
    case "Skills":
      return formatSkills(normalizedValue);
    case "Experience":
      return formatExperience(normalizedValue);
    case "Education":
      return formatEducation(normalizedValue);
    case "Projects":
      return formatProjects(normalizedValue);
    case "Certifications":
      return formatCertifications(normalizedValue);
    case "Awards":
      return formatAwards(normalizedValue);
    default:
      return formatGeneric(normalizedValue);
  }
}

export function normalizeLegacyDigitalCVSections(sections: unknown): LegacyDigitalCVSection[] {
  if (!Array.isArray(sections)) return [];

  return sections
    .filter((section) => section && typeof section === "object")
    .map((section: any) => {
      const rawName = typeof section?.name === "string" ? section.name.trim() : "";
      const rawContent = section?.content;
      const content = toLegacyMarkdown(rawName, rawContent);

      return {
        ...section,
        name: rawName,
        content,
      };
    })
    .filter((section) => section.name.length > 0);
}

export function buildLegacyDigitalCVFromStructuredCV(
  structuredCVInput: unknown,
  existingDigitalCVInput?: unknown
): LegacyDigitalCVSection[] {
  const structuredCV = normalizeStructuredCVInput(structuredCVInput);
  const derived = deriveStructuredCVFields(structuredCV);
  const existing = normalizeLegacyDigitalCVSections(existingDigitalCVInput);
  const existingByName = new Map(existing.map((section) => [section.name, section]));
  const currentPositionContent = [derived.currentPosition, derived.company]
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .join(" at ");

  const structuredSections: LegacyDigitalCVSection[] = [
    { name: "Introduction", content: toLegacyMarkdown("Introduction", structuredCV.introduction) },
    { name: "Current Position", content: currentPositionContent },
    { name: "Contact Info", content: toLegacyMarkdown("Contact Info", structuredCV.contactInfo) },
    { name: "Skills", content: toLegacyMarkdown("Skills", structuredCV.skills || []) },
    { name: "Experience", content: toLegacyMarkdown("Experience", structuredCV.experience || []) },
    { name: "Education", content: toLegacyMarkdown("Education", structuredCV.education || []) },
    { name: "Projects", content: toLegacyMarkdown("Projects", structuredCV.projects || []) },
    {
      name: "Certifications",
      content: toLegacyMarkdown("Certifications", structuredCV.certifications || []),
    },
    { name: "Awards", content: toLegacyMarkdown("Awards", structuredCV.awards || []) },
  ];

  const merged: LegacyDigitalCVSection[] = [];
  const usedNames = new Set<string>();

  structuredSections.forEach((section) => {
    const existingSection = existingByName.get(section.name);
    usedNames.add(section.name);
    merged.push({
      name: section.name,
      content: section.content || existingSection?.content || "",
    });
  });

  existing.forEach((section) => {
    if (!usedNames.has(section.name)) {
      merged.push(section);
    }
  });

  return merged;
}
