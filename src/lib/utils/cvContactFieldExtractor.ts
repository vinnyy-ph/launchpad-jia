export type DigitalCvSection = {
  name?: string;
  content?: unknown;
};

export type ExtractedContactFields = {
  phone: string | null;
  currentPosition: string | null;
  company: string | null;
};

const cleanMarkdown = (input: unknown): string => {
  if (input == null) return "";
  return String(input)
    .replace(/\*\*/g, "")
    .replace(/[\*`_~]/g, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .trim();
};

const normalizeSpaces = (s: string): string => s.replace(/\s+/g, " ").trim();

const isProbablyUrl = (s: string): boolean => /http[s]?:\/\/|www\.|linkedin/i.test(s);

export function extractContactFieldsFromDigitalCv(
  digitalCV: unknown
): ExtractedContactFields {
  const sections: DigitalCvSection[] = Array.isArray(digitalCV)
    ? (digitalCV as DigitalCvSection[])
    : [];

  const contactSection = sections.find((s) => s?.name === "Contact Info");
  const currentPositionSection = sections.find((s) => s?.name === "Current Position");

  let phone: string | null = null;
  let currentPosition: string | null = null;
  let company: string | null = null;

  if (contactSection?.content != null) {
    const cleanContent = cleanMarkdown(contactSection.content);

    const phonePatterns: RegExp[] = [
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
      if (match?.[1]) {
        const candidate = normalizeSpaces(match[1]);
        if (candidate) {
          phone = candidate;
          break;
        }
      }
    }
  }

  if (currentPositionSection?.content != null) {
    const cleaned = cleanMarkdown(currentPositionSection.content);
    if (cleaned) {
      const normalized = normalizeSpaces(cleaned);
      currentPosition = normalized;

      // Try to split "Role at Company" into separate fields
      const companyMatch = normalized.match(/(.+)\s+at\s+(.+)/i);
      if (companyMatch) {
        const role = normalizeSpaces(companyMatch[1]);
        const comp = normalizeSpaces(companyMatch[2]);
        currentPosition = role || currentPosition;
        company = comp || company;
      }

      // Alternative separators
      if (!company && /\|/.test(normalized)) {
        const parts = normalized
          .split("|")
          .map((p) => normalizeSpaces(p))
          .filter(Boolean);
        if (parts.length >= 2) {
          currentPosition = parts[0] || currentPosition;
          company = parts[1] || company;
        }
      }

      if (!company && /\s+-\s+/.test(normalized)) {
        const parts = normalized
          .split(/\s+-\s+/)
          .map((p) => normalizeSpaces(p))
          .filter(Boolean);
        if (parts.length >= 2) {
          currentPosition = parts[0] || currentPosition;
          company = parts[1] || company;
        }
      }

      // Basic safety to avoid obviously invalid company values
      if (company && isProbablyUrl(company)) {
        company = null;
      }
    }
  }

  // Normalize empty strings
  return {
    phone: phone && phone !== "-" ? phone : null,
    currentPosition:
      currentPosition && currentPosition !== "-" ? currentPosition : null,
    company: company && company !== "-" ? company : null,
  };
}
