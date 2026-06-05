import { isStrictInternationalPhone, sanitizeInternationalPhoneInput } from "./phoneInput";

export interface PhoneFormatResult {
  valid: boolean;
  error?: string;
}

/** Format check only — reuses the repo's strict E.164 validator. No Firebase, no SMS. */
export function validatePhoneFormat(value: string): PhoneFormatResult {
  const normalized = sanitizeInternationalPhoneInput(value || "");
  if (!normalized) return { valid: false, error: "Mobile number is required." };
  if (!isStrictInternationalPhone(normalized)) {
    return { valid: false, error: "Enter a valid mobile number with country code (e.g. +63 917 123 4567)." };
  }
  return { valid: true };
}

/** Strip everything but a leading + and digits, for equality comparison. */
export function normalizePhoneForCompare(value: string): string {
  const raw = (value || "").trim();
  const plus = raw.startsWith("+") ? "+" : "";
  return plus + raw.replace(/[^\d]/g, "");
}

export interface ExistingPhoneRecord {
  email: string;
  phone: string;
}

/** Pure uniqueness check. The route supplies records from `applicant-cv`. */
export function isPhoneTaken(
  existing: ExistingPhoneRecord[],
  candidatePhone: string,
  currentEmail: string,
): boolean {
  const target = normalizePhoneForCompare(candidatePhone);
  if (!target) return false;
  const self = (currentEmail || "").trim().toLowerCase();
  return existing.some(
    (r) =>
      normalizePhoneForCompare(r.phone) === target &&
      (r.email || "").trim().toLowerCase() !== self,
  );
}
