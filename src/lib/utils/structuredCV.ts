export const STRUCTURED_CV_SCHEMA_VERSION = 1;

export const DIGITAL_CV_SECTION_NAMES = [
  "Introduction",
  "Contact Info",
  "Experience",
  "Skills",
  "Education",
  "Projects",
  "Certifications",
  "Awards",
] as const;

export type DigitalCVSectionName = (typeof DIGITAL_CV_SECTION_NAMES)[number];

export interface DigitalCVSection {
  name: string;
  content: string;
}

export interface CVDatePart {
  month: string;
  year: string;
}

export interface ContactWebsite {
  id: string;
  url: string;
  type: string;
}

export interface ContactInfoSection {
  email: string;
  phone: string;
  isPhoneVerified?: boolean;
  countryCode: string;
  address: string;
  linkedin: string;
  websites: ContactWebsite[];
}

export interface ExperienceSectionItem {
  id: string;
  title: string;
  company: string;
  companyDomain?: string;
  companyLogoUrl?: string;
  employmentType: string;
  location: string;
  workSetup: string;
  startDate: CVDatePart;
  endDate: CVDatePart;
  isCurrentRole: boolean;
  description: string;
}

export interface EducationSectionItem {
  id: string;
  school: string;
  schoolDomain?: string;
  schoolLogoUrl?: string;
  degree: string;
  fieldOfStudy: string;
  startDate: CVDatePart;
  endDate: CVDatePart;
  description: string;
}

export interface ProjectSectionItem {
  id: string;
  name: string;
  isCurrent: boolean;
  startDate: CVDatePart;
  endDate: CVDatePart;
  description: string;
}

export interface CertificationSectionItem {
  id: string;
  name: string;
  issuingOrganization: string;
  issuingOrganizationDomain?: string;
  issuingOrganizationLogoUrl?: string;
  issueDate: CVDatePart;
  expirationDate: CVDatePart;
  credentialId: string;
  credentialUrl: string;
}

export interface AwardSectionItem {
  id: string;
  title: string;
  issuer: string;
  issuerDomain?: string;
  issuerLogoUrl?: string;
  issueDate: CVDatePart;
  description: string;
}

export interface ReferenceSectionItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  countryCode: string;
  company: string;
  position: string;
  relation: string;
}

export interface StructuredCV {
  introduction: string;
  contactInfo: ContactInfoSection;
  experience: ExperienceSectionItem[];
  skills: string[];
  education: EducationSectionItem[];
  projects: ProjectSectionItem[];
  certifications: CertificationSectionItem[];
  awards: AwardSectionItem[];
  references?: ReferenceSectionItem[];
}

export interface StructuredCVDerivedFields {
  phone: string | null;
  location: string | null;
  currentPosition: string | null;
  company: string | null;
  numExperienceMonths: number | null;
  numExperienceLabel: string | null;
}

const DEFAULT_DATE: CVDatePart = { month: "", year: "" };

const DEFAULT_CONTACT_INFO: ContactInfoSection = {
  email: "",
  phone: "",
  isPhoneVerified: false,
  countryCode: "",
  address: "",
  linkedin: "",
  websites: [],
};

const EMPTY_STRUCTURED_CV: StructuredCV = {
  introduction: "",
  contactInfo: DEFAULT_CONTACT_INFO,
  experience: [],
  skills: [],
  education: [],
  projects: [],
  certifications: [],
  awards: [],
};

const MONTH_TO_INDEX: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function toTrimmedString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function cleanPlainSectionContent(value: unknown, sectionLabel?: string): string {
  if (typeof value !== "string") return "";

  let cleaned = value.replace(/\r/g, "").trim();

  if (!cleaned) return "";

  cleaned = cleaned
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .trim();

  if (sectionLabel) {
    const escapedLabel = sectionLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned.replace(
      new RegExp(`^${escapedLabel}\\s*:?[\\s\\n]*`, "i"),
      ""
    );
  }

  return cleaned.trim();
}

function toNullableString(value: unknown): string | null {
  const parsed = toTrimmedString(value);
  return parsed.length > 0 ? parsed : null;
}

function toBoolean(value: unknown): boolean {
  if (value === true) return true;

  if (typeof value === "number") {
    return value > 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "verified";
  }

  return false;
}

function safeParseJSON<T>(value: unknown): T | null {
  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getSectionContent(
  digitalCV: Array<{ name?: unknown; content?: unknown }> | undefined,
  sectionName: DigitalCVSectionName
): string {
  if (!Array.isArray(digitalCV)) return "";

  const section = digitalCV.find(
    (item) =>
      typeof item?.name === "string" && item.name.trim() === sectionName
  );

  if (!section) return "";
  if (typeof section.content === "string") return section.content.trim();

  if (section.content == null) return "";

  return String(section.content).trim();
}

function parseLinksFromMarkdown(raw: string): string[] {
  if (!raw) return [];

  const links = new Set<string>();
  const markdownLinkRegex = /\[[^\]]+\]\((https?:\/\/[^)]+)\)/gi;
  const plainLinkRegex = /https?:\/\/[^\s)]+/gi;

  let markdownMatch: RegExpExecArray | null = null;
  while ((markdownMatch = markdownLinkRegex.exec(raw)) !== null) {
    if (markdownMatch[1]) links.add(markdownMatch[1].trim());
  }

  const rawWithoutMarkdownWrappers = raw.replace(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/gi, "$1");
  const plainMatches: string[] =
    rawWithoutMarkdownWrappers.match(plainLinkRegex) || [];
  plainMatches.forEach((url) => links.add(url.trim()));

  return Array.from(links);
}

function normalizeLinkedin(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("linkedin.com/")) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

function parseContactInfoFromText(raw: string): ContactInfoSection {
  const clean = raw
    .replace(/\*\*/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .trim();

  const email =
    clean.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.trim() || "";
  const linkedinMatch = clean.match(
    /(https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s)]+|linkedin\.com\/in\/[^\s)]+)/i
  );

  const addressMatch =
    clean.match(/Address:\s*([^\n\r]+)/i) ||
    clean.match(/Location:\s*([^\n\r]+)/i) ||
    clean.match(/City:\s*([^\n\r]+)/i);

  const phoneMatch =
    clean.match(/Phone:\s*([^\n\r]+)/i) ||
    clean.match(/Mobile:\s*([^\n\r]+)/i) ||
    clean.match(/Tel:\s*([^\n\r]+)/i) ||
    clean.match(/(\+?\d[\d()\s\-]{7,}\d)/);

  const allLinks = parseLinksFromMarkdown(clean);
  const websites = allLinks
    .filter((url) => !/linkedin\.com/i.test(url))
    .map((url, index) => ({
      id: `link-${index + 1}`,
      url,
      type: "Website",
    }));

  return {
    email,
    phone: phoneMatch?.[1]?.trim() || "",
    isPhoneVerified: false,
    countryCode: "",
    address: addressMatch?.[1]?.trim() || "",
    linkedin: normalizeLinkedin(linkedinMatch?.[1] || ""),
    websites,
  };
}

function normalizeContactInfo(raw: unknown): ContactInfoSection {
  if (!raw) return { ...DEFAULT_CONTACT_INFO };

  if (typeof raw === "string") {
    const parsed = safeParseJSON<Record<string, unknown>>(raw);
    if (!parsed) {
      return parseContactInfoFromText(raw);
    }
    return normalizeContactInfo(parsed);
  }

  if (typeof raw !== "object") {
    return { ...DEFAULT_CONTACT_INFO };
  }

  const obj = raw as Record<string, unknown>;
  const rawWebsites = Array.isArray(obj.websites) ? obj.websites : [];

  return {
    email: toTrimmedString(obj.email),
    phone: toTrimmedString(obj.phone),
    isPhoneVerified: toBoolean(obj.isPhoneVerified),
    countryCode: toTrimmedString(obj.countryCode),
    address: toTrimmedString(obj.address),
    linkedin: normalizeLinkedin(toTrimmedString(obj.linkedin)),
    websites: rawWebsites.map((website, index) => {
      const site = (website || {}) as Record<string, unknown>;
      return {
        id: toTrimmedString(site.id) || `website-${index + 1}`,
        url: toTrimmedString(site.url),
        type: toTrimmedString(site.type),
      };
    }),
  };
}

function normalizeDatePart(value: unknown): CVDatePart {
  if (!value || typeof value !== "object") return { ...DEFAULT_DATE };
  const obj = value as Record<string, unknown>;
  return {
    month: toTrimmedString(obj.month),
    year: toTrimmedString(obj.year),
  };
}

function normalizeExperienceItem(value: unknown, index: number): ExperienceSectionItem {
  const obj = (value || {}) as Record<string, unknown>;
  return {
    id: toTrimmedString(obj.id) || `${index + 1}`,
    title: toTrimmedString(obj.title),
    company: toTrimmedString(obj.company),
    companyDomain: toTrimmedString(obj.companyDomain),
    companyLogoUrl: toTrimmedString(obj.companyLogoUrl),
    employmentType: toTrimmedString(obj.employmentType),
    location: toTrimmedString(obj.location),
    workSetup: toTrimmedString(obj.workSetup),
    startDate: normalizeDatePart(obj.startDate),
    endDate: normalizeDatePart(obj.endDate),
    isCurrentRole: Boolean(obj.isCurrentRole),
    description: cleanPlainSectionContent(obj.description),
  };
}

function normalizeEducationItem(value: unknown, index: number): EducationSectionItem {
  const obj = (value || {}) as Record<string, unknown>;
  return {
    id: toTrimmedString(obj.id) || `${index + 1}`,
    school: toTrimmedString(obj.school),
    schoolDomain: toTrimmedString(obj.schoolDomain),
    schoolLogoUrl: toTrimmedString(obj.schoolLogoUrl),
    degree: toTrimmedString(obj.degree),
    fieldOfStudy: toTrimmedString(obj.fieldOfStudy),
    startDate: normalizeDatePart(obj.startDate),
    endDate: normalizeDatePart(obj.endDate),
    description: cleanPlainSectionContent(obj.description),
  };
}

function normalizeProjectItem(value: unknown, index: number): ProjectSectionItem {
  const obj = (value || {}) as Record<string, unknown>;
  return {
    id: toTrimmedString(obj.id) || `${index + 1}`,
    name: toTrimmedString(obj.name),
    isCurrent: Boolean(obj.isCurrent),
    startDate: normalizeDatePart(obj.startDate),
    endDate: normalizeDatePart(obj.endDate),
    description: cleanPlainSectionContent(obj.description),
  };
}

function normalizeCertificationItem(
  value: unknown,
  index: number
): CertificationSectionItem {
  const obj = (value || {}) as Record<string, unknown>;
  return {
    id: toTrimmedString(obj.id) || `${index + 1}`,
    name: toTrimmedString(obj.name),
    issuingOrganization: toTrimmedString(obj.issuingOrganization),
    issuingOrganizationDomain: toTrimmedString(obj.issuingOrganizationDomain),
    issuingOrganizationLogoUrl: toTrimmedString(obj.issuingOrganizationLogoUrl),
    issueDate: normalizeDatePart(obj.issueDate),
    expirationDate: normalizeDatePart(obj.expirationDate),
    credentialId: toTrimmedString(obj.credentialId),
    credentialUrl: toTrimmedString(obj.credentialUrl),
  };
}

function normalizeAwardItem(value: unknown, index: number): AwardSectionItem {
  const obj = (value || {}) as Record<string, unknown>;
  return {
    id: toTrimmedString(obj.id) || `${index + 1}`,
    title: toTrimmedString(obj.title),
    issuer: toTrimmedString(obj.issuer),
    issuerDomain: toTrimmedString(obj.issuerDomain),
    issuerLogoUrl: toTrimmedString(obj.issuerLogoUrl),
    issueDate: normalizeDatePart(obj.issueDate),
    description: cleanPlainSectionContent(obj.description),
  };
}

function normalizeReferenceItem(input: unknown): ReferenceSectionItem | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const name = toTrimmedString(o.name);
  const company = toTrimmedString(o.company);
  if (!name && !company && !toTrimmedString(o.email) && !toTrimmedString(o.phone)) return null;
  return {
    id: typeof o.id === "string" && o.id ? o.id : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    email: toTrimmedString(o.email),
    phone: toTrimmedString(o.phone),
    countryCode: toTrimmedString(o.countryCode),
    company,
    position: toTrimmedString(o.position),
    relation: toTrimmedString(o.relation),
  };
}

function normalizeArrayFromSection<T>(
  rawSectionContent: unknown,
  normalizer: (value: unknown, index: number) => T
): T[] {
  let source: unknown = rawSectionContent;

  if (typeof source === "string") {
    const parsed = safeParseJSON<unknown>(source);
    source = parsed ?? [];
  }

  if (!Array.isArray(source)) return [];
  return source.map((item, index) => normalizer(item, index));
}

function normalizeSkills(rawSectionContent: unknown): string[] {
  if (!rawSectionContent) return [];

  if (Array.isArray(rawSectionContent)) {
    return rawSectionContent
      .map((item) => toTrimmedString(item))
      .filter((skill) => skill.length > 0);
  }

  if (typeof rawSectionContent === "string") {
    const parsed = safeParseJSON<unknown>(rawSectionContent);

    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => toTrimmedString(item))
        .filter((skill) => skill.length > 0);
    }

    return rawSectionContent
      .split("\n")
      .map((line) => line.replace(/^[-*+]\s*/, "").trim())
      .filter((line) => line.length > 0 && !/^skills?$/i.test(line));
  }

  return [];
}

export function normalizeStructuredCVInput(input: unknown): StructuredCV {
  if (!input || typeof input !== "object") {
    return { ...EMPTY_STRUCTURED_CV, contactInfo: { ...DEFAULT_CONTACT_INFO } };
  }

  const obj = input as Record<string, unknown>;

  return {
    introduction: cleanPlainSectionContent(obj.introduction, "Introduction"),
    contactInfo: normalizeContactInfo(obj.contactInfo),
    experience: normalizeArrayFromSection<ExperienceSectionItem>(
      obj.experience,
      normalizeExperienceItem
    ),
    skills: normalizeSkills(obj.skills),
    education: normalizeArrayFromSection<EducationSectionItem>(
      obj.education,
      normalizeEducationItem
    ),
    projects: normalizeArrayFromSection<ProjectSectionItem>(
      obj.projects,
      normalizeProjectItem
    ),
    certifications: normalizeArrayFromSection<CertificationSectionItem>(
      obj.certifications,
      normalizeCertificationItem
    ),
    awards: normalizeArrayFromSection<AwardSectionItem>(obj.awards, normalizeAwardItem),
    references: normalizeArrayFromSection<ReferenceSectionItem | null>(
      obj.references,
      (item) => normalizeReferenceItem(item)
    ).filter((r): r is ReferenceSectionItem => r !== null),
  };
}

export function buildStructuredCVFromDigitalCV(
  digitalCV: Array<{ name?: unknown; content?: unknown }> | undefined
): StructuredCV {
  const introduction = cleanPlainSectionContent(
    getSectionContent(digitalCV, "Introduction"),
    "Introduction"
  );
  const contactInfoRaw = getSectionContent(digitalCV, "Contact Info");
  const experienceRaw = getSectionContent(digitalCV, "Experience");
  const skillsRaw = getSectionContent(digitalCV, "Skills");
  const educationRaw = getSectionContent(digitalCV, "Education");
  const projectsRaw = getSectionContent(digitalCV, "Projects");
  const certificationsRaw = getSectionContent(digitalCV, "Certifications");
  const awardsRaw = getSectionContent(digitalCV, "Awards");

  return {
    introduction,
    contactInfo: normalizeContactInfo(contactInfoRaw),
    experience: normalizeArrayFromSection<ExperienceSectionItem>(
      experienceRaw,
      normalizeExperienceItem
    ),
    skills: normalizeSkills(skillsRaw),
    education: normalizeArrayFromSection<EducationSectionItem>(
      educationRaw,
      normalizeEducationItem
    ),
    projects: normalizeArrayFromSection<ProjectSectionItem>(
      projectsRaw,
      normalizeProjectItem
    ),
    certifications: normalizeArrayFromSection<CertificationSectionItem>(
      certificationsRaw,
      normalizeCertificationItem
    ),
    awards: normalizeArrayFromSection<AwardSectionItem>(awardsRaw, normalizeAwardItem),
  };
}

export function buildDigitalCVFromStructuredCV(structuredCV: StructuredCV): DigitalCVSection[] {
  const normalized = normalizeStructuredCVInput(structuredCV);
  return [
    { name: "Introduction", content: normalized.introduction },
    { name: "Contact Info", content: JSON.stringify(normalized.contactInfo) },
    { name: "Experience", content: JSON.stringify(normalized.experience) },
    { name: "Skills", content: JSON.stringify(normalized.skills) },
    { name: "Education", content: JSON.stringify(normalized.education) },
    { name: "Projects", content: JSON.stringify(normalized.projects) },
    { name: "Certifications", content: JSON.stringify(normalized.certifications) },
    { name: "Awards", content: JSON.stringify(normalized.awards) },
  ];
}

function buildDateValue(datePart: CVDatePart): Date | null {
  const year = Number(datePart.year);
  const monthIndex = MONTH_TO_INDEX[datePart.month.toLowerCase()];

  if (!Number.isFinite(year) || year <= 0 || monthIndex == null) return null;
  const date = new Date(year, monthIndex, 1);

  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function monthsToExperienceLabel(months: number | null): string | null {
  if (months == null || months <= 0) return null;

  if (months < 12) {
    return months === 1 ? "1 month" : `${months} months`;
  }

  const years = Number((months / 12).toFixed(1));
  if (Number.isInteger(years)) {
    return years === 1 ? "1 year" : `${years} years`;
  }

  return `${years} years`;
}

function getExperienceMonths(experience: ExperienceSectionItem[]): number | null {
  if (!Array.isArray(experience) || experience.length === 0) return null;

  let minStart: Date | null = null;
  let maxEnd: Date | null = null;

  experience.forEach((item) => {
    const start = buildDateValue(item.startDate);
    const end = item.isCurrentRole ? new Date() : buildDateValue(item.endDate);

    if (start) {
      if (!minStart || start.getTime() < minStart.getTime()) {
        minStart = start;
      }
    }

    if (end) {
      if (!maxEnd || end.getTime() > maxEnd.getTime()) {
        maxEnd = end;
      }
    }
  });

  if (!minStart || !maxEnd) return null;

  let months =
    (maxEnd.getFullYear() - minStart.getFullYear()) * 12 +
    (maxEnd.getMonth() - minStart.getMonth()) +
    1;

  if (months <= 0) return null;
  return months;
}

function toSortableDateValue(date: CVDatePart, isCurrent: boolean): number {
  if (isCurrent) return Date.now() + 100000;
  const parsed = buildDateValue(date);
  return parsed ? parsed.getTime() : 0;
}

function getMostRecentExperience(
  experience: ExperienceSectionItem[]
): ExperienceSectionItem | null {
  if (!Array.isArray(experience) || experience.length === 0) return null;

  return [...experience].sort((a, b) => {
    const bEnd = toSortableDateValue(b.endDate, b.isCurrentRole);
    const aEnd = toSortableDateValue(a.endDate, a.isCurrentRole);

    if (bEnd !== aEnd) return bEnd - aEnd;

    const bStart = toSortableDateValue(b.startDate, false);
    const aStart = toSortableDateValue(a.startDate, false);
    return bStart - aStart;
  })[0];
}

export function deriveStructuredCVFields(structuredCVInput: unknown): StructuredCVDerivedFields {
  const structuredCV = normalizeStructuredCVInput(structuredCVInput);
  const mostRecentExperience = getMostRecentExperience(structuredCV.experience);
  const numExperienceMonths = getExperienceMonths(structuredCV.experience);

  return {
    phone: toNullableString(structuredCV.contactInfo.phone),
    location:
      toNullableString(structuredCV.contactInfo.address) ||
      toNullableString(mostRecentExperience?.location),
    currentPosition: toNullableString(mostRecentExperience?.title),
    company: toNullableString(mostRecentExperience?.company),
    numExperienceMonths,
    numExperienceLabel: monthsToExperienceLabel(numExperienceMonths),
  };
}

export function stripStructuredCVSkills(structuredCVInput: unknown) {
  const normalized = normalizeStructuredCVInput(structuredCVInput);
  const { skills: _skills, ...withoutSkills } = normalized;
  return withoutSkills;
}

export function detectEditedSections(
  baseInput: unknown,
  currentInput: unknown
): string[] {
  const base = normalizeStructuredCVInput(baseInput);
  const current = normalizeStructuredCVInput(currentInput);

  const keys: Array<keyof StructuredCV> = [
    "introduction",
    "contactInfo",
    "experience",
    "skills",
    "education",
    "projects",
    "certifications",
    "awards",
  ];

  return keys.filter(
    (key) => JSON.stringify(base[key]) !== JSON.stringify(current[key])
  );
}
