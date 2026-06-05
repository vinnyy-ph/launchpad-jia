export type SupportedPhoneCountry = "PH" | "US" | "SG" | "AU" | "UK";

export const PHONE_COUNTRY_OPTIONS: Array<{
  code: SupportedPhoneCountry;
  dialCode: string;
}> = [
  { code: "PH", dialCode: "+63" },
  { code: "US", dialCode: "+1" },
  { code: "SG", dialCode: "+65" },
  { code: "AU", dialCode: "+61" },
  { code: "UK", dialCode: "+44" },
];

// Per-country national-number presentation: max digit count + display grouping
// (mobile formats; `groups` sum to `max`). Used to space-format and cap the
// editable national number — the dial code is shown separately as a fixed prefix.
interface NationalNumberFormat {
  max: number;
  groups: number[];
}

export const NATIONAL_NUMBER_FORMAT: Record<SupportedPhoneCountry, NationalNumberFormat> = {
  PH: { max: 10, groups: [3, 3, 4] },
  US: { max: 10, groups: [3, 3, 4] },
  SG: { max: 8, groups: [4, 4] },
  AU: { max: 9, groups: [3, 3, 3] },
  UK: { max: 10, groups: [4, 6] },
};

export function maxNationalDigits(country: SupportedPhoneCountry): number {
  return NATIONAL_NUMBER_FORMAT[country].max;
}

// Groups national digits with spaces per country (PH "9876543210" -> "987 654
// 3210"), capping at the country's max digit count. Non-digits are ignored.
export function formatNationalNumber(
  value: string,
  country: SupportedPhoneCountry,
): string {
  const { max, groups } = NATIONAL_NUMBER_FORMAT[country];
  const digits = `${value || ""}`.replace(/\D/g, "").slice(0, max);
  if (!digits) {
    return "";
  }

  const parts: string[] = [];
  let cursor = 0;
  for (const size of groups) {
    if (cursor >= digits.length) {
      break;
    }
    parts.push(digits.slice(cursor, cursor + size));
    cursor += size;
  }
  if (cursor < digits.length) {
    parts.push(digits.slice(cursor));
  }
  return parts.join(" ");
}

function normalizePhilippinesPhoneInput(digits: string): string {
  if (!digits) {
    return "";
  }

  if (digits.startsWith("630")) {
    return `+63${digits.slice(3)}`;
  }

  if (digits.startsWith("63")) {
    return `+${digits}`;
  }

  if (digits.startsWith("09")) {
    return `+63${digits.slice(1)}`;
  }

  if (digits.startsWith("9")) {
    return `+63${digits}`;
  }

  return `+${digits}`;
}

export function sanitizeInternationalPhoneInput(
  value: string,
  preferredCountry?: SupportedPhoneCountry,
): string {
  const raw = `${value || ""}`;
  const digits = raw.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (
    preferredCountry === "PH" ||
    digits.startsWith("63") ||
    digits.startsWith("09")
  ) {
    return normalizePhilippinesPhoneInput(digits);
  }

  return `+${digits}`;
}

export function isStrictInternationalPhone(value: string): boolean {
  const normalized = `${value || ""}`.trim();
  // E.164-like: "+" + country code + subscriber number, max 15 digits.
  return /^\+[1-9]\d{7,14}$/.test(normalized);
}

export function inferPhoneCountry(value: string): SupportedPhoneCountry {
  const normalized = sanitizeInternationalPhoneInput(value);
  if (!normalized) return "PH";

  const matched = PHONE_COUNTRY_OPTIONS
    .slice()
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((option) => normalized.startsWith(option.dialCode));

  return matched?.code || "PH";
}

export function applyCountryDialCode(
  value: string,
  countryCode: SupportedPhoneCountry,
): string {
  const target = PHONE_COUNTRY_OPTIONS.find((option) => option.code === countryCode);
  if (!target) return sanitizeInternationalPhoneInput(value);

  const normalized = sanitizeInternationalPhoneInput(value);
  if (!normalized) {
    return target.dialCode;
  }

  const digits = normalized.replace(/^\+/, "");
  const matchedCurrent = PHONE_COUNTRY_OPTIONS
    .slice()
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((option) => digits.startsWith(option.dialCode.replace(/^\+/, "")));
  const localDigits = matchedCurrent
    ? digits.slice(matchedCurrent.dialCode.replace(/^\+/, "").length)
    : digits;

  return `${target.dialCode}${localDigits}`;
}
