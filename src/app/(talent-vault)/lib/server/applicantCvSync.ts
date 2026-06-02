type DigitalCvSection = {
  name?: string;
  content?: unknown;
};

type ApplicantCvInput = {
  digitalCV: DigitalCvSection[];
  fileInfo?: {
    name?: string;
    size?: number;
    type?: string;
  } | null;
  name?: string | null;
  errorRemarks?: string | null;
  phone?: string | null;
  location?: string | null;
  currentPosition?: string | null;
  company?: string | null;
  numExperience?: string | null;
};

export function normalizeNullableString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

function getSection(digitalCV: DigitalCvSection[], sectionName: string) {
  return digitalCV.find((section) => section?.name === sectionName);
}

function stripContentFormatting(rawValue: unknown): string {
  return String(rawValue || "")
    .replace(/\*\*/g, "")
    .replace(/[\*`_~]/g, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .trim();
}

function parseExperienceFromContent(experienceContent: unknown): string | null {
  if (experienceContent == null) return null;

  const raw = String(experienceContent).trim().toLowerCase();
  if (!raw) return null;

  const yearsMatch = raw.match(/(\d+(?:\.\d+)?)\s*years?\b/);
  const monthsMatch = raw.match(/(\d+(?:\.\d+)?)\s*months?\b/);

  if (yearsMatch) {
    const value = Number(yearsMatch[1]);
    if (Number.isFinite(value) && value >= 0) {
      return value === 1 ? "1 year" : `${value} years`;
    }
  }

  if (monthsMatch) {
    const value = Number(monthsMatch[1]);
    if (Number.isFinite(value) && value >= 0) {
      return value === 1 ? "1 month" : `${value} months`;
    }
  }

  return null;
}

function extractPhone(contactContent: unknown): string | null {
  const cleanContent = stripContentFormatting(contactContent);
  if (!cleanContent) return null;

  const phonePatterns = [
    /Phone[:\s]*([+\d\s\-()\.]+)/i,
    /Mobile[:\s]*([+\d\s\-()\.]+)/i,
    /Tel[:\s]*([+\d\s\-()\.]+)/i,
    /Contact[:\s]*([+\d\s\-()\.]+)/i,
    /(\+\d{1,3}[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{4})/,
    /(\d{4}[\s\-]?\d{3}[\s\-]?\d{4})/,
    /(\(\d{3}\)[\s\-]?\d{3}[\s\-]?\d{4})/,
    /(\d{11})/,
  ];

  for (const pattern of phonePatterns) {
    const match = cleanContent.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function extractLocation(contactContent: unknown): string | null {
  const cleanContent = stripContentFormatting(contactContent);
  if (!cleanContent) return null;

  const locationPatterns = [
    /Address[:\s]*([^\n\r]+)/i,
    /Location[:\s]*([^\n\r]+)/i,
    /City[:\s]*([^\n\r]+)/i,
    /([A-Za-z\s]+,\s*[A-Za-z\s]+(?:,\s*[A-Za-z\s]+)*)/,
  ];

  for (const pattern of locationPatterns) {
    const match = cleanContent.match(pattern);
    if (match && match[1]) {
      const locationCandidate = String(match[1])
        .trim()
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/^\s*[-*+]\s*/, "");

      if (/linkedin|http[s]?:\/\/|www\./i.test(locationCandidate)) {
        continue;
      }

      if (locationCandidate) {
        return locationCandidate;
      }
    }
  }

  return null;
}

function extractCurrentPositionAndCompany(
  currentPositionContent: unknown,
  providedCompany: string | null
) {
  const cleanedPosition = stripContentFormatting(currentPositionContent)
    .replace(/^"|"$/g, "")
    .trim();

  if (!cleanedPosition) {
    return {
      currentPosition: null,
      company: providedCompany,
    };
  }

  let currentPosition = cleanedPosition;
  let company = providedCompany;
  const companyMatch = cleanedPosition.match(/(.+)\s+at\s+(.+)/i);

  if (companyMatch) {
    currentPosition = companyMatch[1].trim();
    if (!company) {
      company = companyMatch[2].trim();
    }
  }

  return {
    currentPosition,
    company,
  };
}

export function buildApplicantCvUpdateSet(input: ApplicantCvInput) {
  const digitalCV = Array.isArray(input.digitalCV) ? input.digitalCV : [];
  const contactSection = getSection(digitalCV, "Contact Info");
  const currentPositionSection = getSection(digitalCV, "Current Position");
  const experienceSection = getSection(digitalCV, "Experience");

  const providedPhone = normalizeNullableString(input.phone);
  const providedLocation = normalizeNullableString(input.location);
  const providedCurrentPosition = normalizeNullableString(input.currentPosition);
  const providedCompany = normalizeNullableString(input.company);
  const providedNumExperience = normalizeNullableString(input.numExperience);

  const fallbackPhone = providedPhone || extractPhone(contactSection?.content);
  const fallbackLocation = providedLocation || extractLocation(contactSection?.content);
  const positionAndCompany = extractCurrentPositionAndCompany(
    currentPositionSection?.content,
    providedCompany
  );

  const fallbackCurrentPosition =
    providedCurrentPosition || positionAndCompany.currentPosition;
  const fallbackCompany = providedCompany || positionAndCompany.company;

  const fallbackNumExperience =
    providedNumExperience || parseExperienceFromContent(experienceSection?.content);

  const setData: Record<string, any> = {
    digitalCV,
    errorRemarks: input.errorRemarks ?? null,
    fileInfo: input.fileInfo || null,
    name: normalizeNullableString(input.name) || null,
    numExperience: fallbackNumExperience || null,
    phone: fallbackPhone,
    location: fallbackLocation,
    currentPosition: fallbackCurrentPosition,
    company: fallbackCompany,
    updatedAt: Date.now(),
  };

  return setData;
}
