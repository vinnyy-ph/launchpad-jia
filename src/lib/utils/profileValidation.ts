// Per-field validation for the manual-profile wizard. Pure functions returning a
// { fieldKey: message } map (empty object = valid). Mirrors the repo convention
// of small tested validators (cf. careerValidation.ts) and reuses phone format.

import { validatePhoneFormat } from "./phoneValidation";
import { htmlToPlainText } from "./sanitizeRichText";
import type {
  AwardSectionItem,
  CertificationSectionItem,
  ContactWebsite,
  CVDatePart,
  EducationSectionItem,
  ExperienceSectionItem,
  ProjectSectionItem,
  ReferenceSectionItem,
} from "./structuredCV";
import type { ContactStepValue } from "@/lib/components/ManualProfile/ContactInformationStep";

export type FieldErrors = Record<string, string>;

export const REQUIRED_MESSAGE = "This field is required.";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// Accepts a URL with or without a scheme (the combo fields prefix `https://`).
export function isValidUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return Boolean(u.hostname) && u.hostname.includes(".");
  } catch {
    return false;
  }
}

// -1 if a<b, 1 if a>b, 0 if equal or not comparable (a blank part = skip).
export function compareDates(a: CVDatePart, b: CVDatePart): number {
  if (!a.year || !b.year) return 0;
  const ay = Number(a.year);
  const by = Number(b.year);
  if (ay !== by) return ay < by ? -1 : 1;
  const am = a.month ? MONTHS.indexOf(a.month) : -1;
  const bm = b.month ? MONTHS.indexOf(b.month) : -1;
  if (am === -1 || bm === -1) return 0;
  return am < bm ? -1 : am > bm ? 1 : 0;
}

function isComplete(date: CVDatePart): boolean {
  return Boolean(date.month) && Boolean(date.year);
}

export function validateContact(c: ContactStepValue): FieldErrors {
  const e: FieldErrors = {};
  if (!c.firstName.trim()) e.firstName = REQUIRED_MESSAGE;
  if (!c.lastName.trim()) e.lastName = REQUIRED_MESSAGE;
  if (!c.middleInitial.trim()) e.middleInitial = REQUIRED_MESSAGE;
  if (!c.email.trim()) e.email = REQUIRED_MESSAGE;
  else if (!isValidEmail(c.email)) e.email = "Enter a valid email address.";
  if (!c.phone.trim()) e.phone = REQUIRED_MESSAGE;
  else {
    const phone = validatePhoneFormat(c.phone);
    if (!phone.valid) e.phone = phone.error ?? "Enter a valid mobile number.";
  }
  if (c.addressManual) {
    if (!c.addressParts.street.trim()) e.street = REQUIRED_MESSAGE;
    if (!c.addressParts.city.trim()) e.city = REQUIRED_MESSAGE;
    if (!c.addressParts.country.trim()) e.country = REQUIRED_MESSAGE;
  } else if (!c.address.trim()) {
    e.address = REQUIRED_MESSAGE;
  }
  return e;
}

export function validateWebsite(w: ContactWebsite): FieldErrors {
  const e: FieldErrors = {};
  if (w.url.trim() && !isValidUrl(w.url)) e.url = "Enter a valid URL.";
  return e;
}

export function validateExperienceItem(x: ExperienceSectionItem): FieldErrors {
  const e: FieldErrors = {};
  if (!x.title.trim()) e.title = REQUIRED_MESSAGE;
  if (!x.company.trim()) e.company = REQUIRED_MESSAGE;
  if (!isComplete(x.startDate)) e.startDate = "Select a start month and year.";
  if (!x.isCurrentRole) {
    if (!isComplete(x.endDate)) e.endDate = "Select an end month and year.";
    else if (compareDates(x.endDate, x.startDate) < 0)
      e.endDate = "End date can't be before the start date.";
  }
  return e;
}

export function validateEducationItem(x: EducationSectionItem): FieldErrors {
  const e: FieldErrors = {};
  if (!x.school.trim()) e.school = REQUIRED_MESSAGE;
  if (x.startDate.year && x.endDate.year && compareDates(x.endDate, x.startDate) < 0)
    e.endDate = "Graduation date can't be before the start date.";
  return e;
}

export function validateProjectItem(x: ProjectSectionItem): FieldErrors {
  const e: FieldErrors = {};
  if (!x.name.trim()) e.name = REQUIRED_MESSAGE;
  if (!isComplete(x.startDate)) e.startDate = "Select a start month and year.";
  if (!x.isCurrent && x.endDate.year && compareDates(x.endDate, x.startDate) < 0)
    e.endDate = "End date can't be before the start date.";
  return e;
}

export function validateCertificationItem(x: CertificationSectionItem): FieldErrors {
  const e: FieldErrors = {};
  if (!x.name.trim()) e.name = REQUIRED_MESSAGE;
  if (!x.issuingOrganization.trim()) e.issuingOrganization = REQUIRED_MESSAGE;
  if (x.credentialUrl.trim() && !isValidUrl(x.credentialUrl))
    e.credentialUrl = "Enter a valid URL.";
  if (
    x.issueDate.year &&
    x.expirationDate.year &&
    compareDates(x.expirationDate, x.issueDate) < 0
  )
    e.expirationDate = "Expiration can't be before the issue date.";
  return e;
}

export function validateAwardItem(x: AwardSectionItem): FieldErrors {
  const e: FieldErrors = {};
  if (!x.title.trim()) e.title = REQUIRED_MESSAGE;
  return e;
}

export function validateReferenceItem(x: ReferenceSectionItem): FieldErrors {
  const e: FieldErrors = {};
  if (!x.name.trim()) e.name = REQUIRED_MESSAGE;
  if (x.email.trim() && !isValidEmail(x.email)) e.email = "Enter a valid email address.";
  if (!x.phone.trim()) e.phone = REQUIRED_MESSAGE;
  else if (!validatePhoneFormat(x.phone).valid) e.phone = "Enter a valid phone number.";
  if (!x.company.trim()) e.company = REQUIRED_MESSAGE;
  if (!x.position.trim()) e.position = REQUIRED_MESSAGE;
  return e;
}

export function validateIntroduction(value: string): FieldErrors {
  const e: FieldErrors = {};
  if (!htmlToPlainText(value).trim()) e.introduction = REQUIRED_MESSAGE;
  return e;
}
