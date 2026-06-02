/**
 * Shared utility functions for CV data processing
 */

/**
 * Extract skills from CV data markdown content
 */
export function extractSkillsFromCv(cvData: any): string[] {
  try {
    const digitalCV = Array.isArray(cvData?.digitalCV) ? cvData.digitalCV : [];
    const skillsSection = digitalCV.find((section: any) => section?.name === "Skills");
    if (!skillsSection?.content) return [];

    const cleaned = String(skillsSection.content)
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      .replace(/[#*_~`]/g, "")
      .replace(/^>\s+/gm, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    const skills = cleaned
      .split(/[\n,]/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 1 && !/^[^a-zA-Z0-9]+$/.test(s));

    return skills;
  } catch {
    return [];
  }
}

/**
 * Sanitize location string - removes URLs and invalid values
 */
export function sanitizeLocation(value: any): string | null {
  const raw = value ? String(value) : "";
  if (!raw) return null;
  if (/linkedin|http[s]?:\/\/|www\./i.test(raw)) return null;
  return raw;
}

/**
 * Get content from a specific CV section
 */
export function getCVSectionContent(cvData: any[] | null, sectionName: string): string {
  if (!cvData || !Array.isArray(cvData)) return "";
  const section = cvData.find((s: any) => s?.name === sectionName);
  return (
    section?.content?.split(`**${sectionName}**`)[1]?.trim()?.replace(/\*\*/g, "") ||
    section?.content?.trim()?.replace(/\*\*/g, "") ||
    ""
  );
}

/**
 * Check if CV data has content
 */
export function hasValidCVData(cvData: any): boolean {
  const digitalCV = Array.isArray(cvData?.digitalCV) ? cvData.digitalCV : [];
  return digitalCV.length > 0;
}

/**
 * Get digital CV array from CV data response
 */
export function getDigitalCV(cvData: any): any[] {
  return Array.isArray(cvData?.digitalCV) ? cvData.digitalCV : [];
}

