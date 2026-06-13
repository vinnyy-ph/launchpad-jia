import { normalizeStructuredCVInput, type ContactWebsite } from "./structuredCV";
import type { ParsedCv } from "./parseCvFile";
import type { WizardData } from "./assembleProfile";
import {
  createEmptyContact,
  type ContactStepValue,
} from "@/lib/components/ManualProfile/ContactInformationStep";
import { createWebsite } from "@/lib/components/ManualProfile/WebsitesStep";
import { createEmptyEducation } from "@/lib/components/ManualProfile/EducationEntryForm";
import { createEmptyExperience } from "@/lib/components/ManualProfile/ExperienceEntryForm";
import { createEmptyProject } from "@/lib/components/ManualProfile/ProjectEntryForm";
import { createEmptyCertification } from "@/lib/components/ManualProfile/CertificationEntryForm";
import { createEmptyAward } from "@/lib/components/ManualProfile/AwardEntryForm";
import { createEmptyReference } from "@/lib/components/ManualProfile/ReferenceEntryForm";

function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Heuristic: 1 token → first only; 2 → first+last; 3+ → first, middle-initial from
// the 2nd token, last from the final token. Lossy by design; the user reviews Contact.
function splitName(full: string): Pick<ContactStepValue, "firstName" | "middleInitial" | "lastName"> {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", middleInitial: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], middleInitial: "", lastName: "" };
  if (parts.length === 2) return { firstName: parts[0], middleInitial: "", lastName: parts[1] };
  return {
    firstName: parts[0],
    middleInitial: parts[1].charAt(0).toUpperCase(),
    lastName: parts[parts.length - 1],
  };
}

// Keep parsed entries, else seed one blank so the wizard step still renders normally.
function orBlank<T>(items: T[], makeBlank: () => T): T[] {
  return items.length > 0 ? items : [makeBlank()];
}

// Maps a parsed CV into the wizard's editable shape. normalizeStructuredCVInput does
// the type coercion + id assignment + reference filtering; this layer adds name
// splitting, the locked-email caveat (handled by the wizard), linkedin→website
// folding, and blank-entry fallbacks. NOTE: the email here may be overwritten by the
// wizard with the authenticated userEmail (see ManualProfileWizard.applyAutofill).
export function cvToWizardData(parsed: ParsedCv): WizardData {
  const cv = normalizeStructuredCVInput(parsed.structuredCV);
  const ci = cv.contactInfo;

  const contact: ContactStepValue = {
    ...createEmptyContact(ci.email || parsed.email || ""),
    ...splitName(parsed.name || ""),
    phone: ci.phone || parsed.phone || "",
    isPhoneVerified: false,
    address: ci.address || parsed.location || "",
    addressManual: true,
  };

  const websites: ContactWebsite[] = [...ci.websites];
  if (ci.linkedin && !websites.some((w) => w.type === "Linkedin")) {
    websites.unshift({ id: genId(), url: ci.linkedin, type: "Linkedin" });
  }

  return {
    contact,
    websites: orBlank(websites, createWebsite),
    education: orBlank(cv.education, createEmptyEducation),
    experience: orBlank(cv.experience, createEmptyExperience),
    skills: cv.skills,
    projects: orBlank(cv.projects, createEmptyProject),
    certifications: orBlank(cv.certifications, createEmptyCertification),
    awards: orBlank(cv.awards, createEmptyAward),
    references: orBlank(cv.references ?? [], createEmptyReference),
    introduction: cv.introduction,
  };
}
