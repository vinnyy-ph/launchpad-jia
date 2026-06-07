// Assemble the wizard's in-progress data into the StructuredCV that gets written
// to the DB. This is the ONLY gate before the write (handleSubmit adds just a
// phone-uniqueness check), so the filtering here must be strict.

import { inferPhoneCountry } from "./phoneInput";
import {
  validateAwardItem,
  validateCertificationItem,
  validateEducationItem,
  validateExperienceItem,
  validateProjectItem,
  validateReferenceItem,
  validateWebsite,
  type FieldErrors,
} from "./profileValidation";
import type {
  AwardSectionItem,
  CertificationSectionItem,
  ContactWebsite,
  EducationSectionItem,
  ExperienceSectionItem,
  ProjectSectionItem,
  ReferenceSectionItem,
  StructuredCV,
} from "./structuredCV";
import type { ContactStepValue } from "@/lib/components/ManualProfile/ContactInformationStep";

export interface WizardData {
  contact: ContactStepValue;
  websites: ContactWebsite[];
  education: EducationSectionItem[];
  experience: ExperienceSectionItem[];
  skills: string[];
  projects: ProjectSectionItem[];
  certifications: CertificationSectionItem[];
  awards: AwardSectionItem[];
  references: ReferenceSectionItem[];
  introduction: string;
}

// Per-section intent. The wizard's ONLY forward navigation is the footer Next /
// Skip buttons (no clickable step indicators, review pane, or deep links), so the
// status map is always set by Submit time. If such a path is ever added, the
// validator filter below is still the backstop.
export type SectionStatus = "untouched" | "submitted" | "skipped";

export type MultiEntrySection =
  | "websites"
  | "education"
  | "experience"
  | "projects"
  | "certifications"
  | "awards"
  | "references";

export type ProfileSectionStatus = Record<MultiEntrySection, SectionStatus>;

export const INITIAL_SECTION_STATUS: ProfileSectionStatus = {
  websites: "untouched",
  education: "untouched",
  experience: "untouched",
  projects: "untouched",
  certifications: "untouched",
  awards: "untouched",
  references: "untouched",
};

const SECTION_STATUS_VALUES: readonly SectionStatus[] = ["untouched", "submitted", "skipped"];

// Coerce an untrusted value (a deserialized draft's sectionStatus — possibly
// missing on legacy drafts, or hand-edited) into a valid status map. Unknown
// shapes, extra keys, and invalid values all fall back per-section to
// INITIAL_SECTION_STATUS, so a bad draft can never restore an invalid state.
export function sanitizeSectionStatus(input: unknown): ProfileSectionStatus {
  if (!input || typeof input !== "object") return INITIAL_SECTION_STATUS;
  const source = input as Record<string, unknown>;
  const out = { ...INITIAL_SECTION_STATUS };
  for (const section of Object.keys(INITIAL_SECTION_STATUS) as MultiEntrySection[]) {
    const value = source[section];
    if (typeof value === "string" && (SECTION_STATUS_VALUES as readonly string[]).includes(value)) {
      out[section] = value as SectionStatus;
    }
  }
  return out;
}

// The multi-entry step indices → their section key. The wizard's only forward
// navigation is Next/Skip, so this mapping + nextSectionStatus fully describe how
// a section's intent gets set. (Revisit if a jump-to-step path is ever added.)
export const STEP_SECTION: Record<number, MultiEntrySection> = {
  1: "websites",
  2: "education",
  3: "experience",
  5: "projects",
  6: "certifications",
  7: "awards",
  8: "references",
};

export type SectionAction = "submit" | "skip" | "enter";

// Pure status transition for the section at `stepIndex`: submit → submitted,
// skip → skipped, enter (re-entry) → untouched. No-op (same ref) for non-section
// steps or when already at the target.
export function nextSectionStatus(
  status: ProfileSectionStatus,
  stepIndex: number,
  action: SectionAction,
): ProfileSectionStatus {
  const section = STEP_SECTION[stepIndex];
  if (!section) return status;
  const target: SectionStatus =
    action === "submit" ? "submitted" : action === "skip" ? "skipped" : "untouched";
  if (status[section] === target) return status;
  return { ...status, [section]: target };
}

const isValid = (errs: FieldErrors) => Object.keys(errs).length === 0;

// Uniform keep rule for every multi-entry section:
//   - `skipped`  → drop everything (the user said this section isn't part of the CV).
//   - otherwise  → keep an entry only if its key field is non-empty AND its
//                  validator passes (all required fields present + valid).
// The key-field check is what drops blank rows in the one section with no required
// field (Websites — validateWebsite passes an empty URL); for every other section
// the validator already rejects blanks/partials, so the rule is uniform.
function keepEntries<T>(
  entries: T[],
  status: SectionStatus,
  keyNonEmpty: (entry: T) => boolean,
  validate: (entry: T) => FieldErrors,
): T[] {
  if (status === "skipped") return [];
  return entries.filter((entry) => keyNonEmpty(entry) && isValid(validate(entry)));
}

export function assembleStructuredCV(
  d: WizardData,
  status: ProfileSectionStatus,
): StructuredCV {
  const websites = keepEntries(
    d.websites,
    status.websites,
    (w) => w.url.trim() !== "",
    validateWebsite,
  );
  const linkedin = websites.find((w) => w.type === "Linkedin")?.url ?? "";

  return {
    introduction: d.introduction,
    contactInfo: {
      email: d.contact.email,
      phone: d.contact.phone,
      isPhoneVerified: d.contact.isPhoneVerified,
      countryCode: inferPhoneCountry(d.contact.phone),
      address: d.contact.address,
      linkedin,
      websites,
    },
    experience: keepEntries(
      d.experience,
      status.experience,
      (e) => e.title.trim() !== "" || e.company.trim() !== "",
      validateExperienceItem,
    ),
    skills: d.skills,
    education: keepEntries(
      d.education,
      status.education,
      (e) => e.school.trim() !== "",
      validateEducationItem,
    ),
    projects: keepEntries(
      d.projects,
      status.projects,
      (e) => e.name.trim() !== "",
      validateProjectItem,
    ),
    certifications: keepEntries(
      d.certifications,
      status.certifications,
      (e) => e.name.trim() !== "" || e.issuingOrganization.trim() !== "",
      validateCertificationItem,
    ),
    awards: keepEntries(
      d.awards,
      status.awards,
      (e) => e.title.trim() !== "",
      validateAwardItem,
    ),
    references: keepEntries(
      d.references,
      status.references,
      (e) => e.name.trim() !== "",
      validateReferenceItem,
    ),
  };
}
