"use client";

import { Field, Group } from "@/lib/components/ui";
import {
  PHONE_COUNTRY_OPTIONS,
  type SupportedPhoneCountry,
  applyCountryDialCode,
  formatNationalNumber,
  inferPhoneCountry,
  maxNationalDigits,
  sanitizeInternationalPhoneInput,
} from "@/lib/utils/phoneInput";
import CountrySelect from "./CountrySelect";
import type { ReferenceSectionItem } from "@/lib/utils/structuredCV";
import styles from "./manual-profile.module.scss";

export function createEmptyReference(): ReferenceSectionItem {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "",
    email: "",
    phone: "",
    countryCode: "PH",
    company: "",
    position: "",
    relation: "",
  };
}

interface ReferenceEntryFormProps {
  value: ReferenceSectionItem;
  onChange: (value: ReferenceSectionItem) => void;
}

// Inline Character References form (Figma node 14567:37249). The phone field
// reuses the Contact step's ISO-country + dial-code pattern.
export default function ReferenceEntryForm({ value, onChange }: ReferenceEntryFormProps) {
  function set<K extends keyof ReferenceSectionItem>(field: K, fieldValue: ReferenceSectionItem[K]) {
    onChange({ ...value, [field]: fieldValue });
  }

  const country =
    (value.countryCode as SupportedPhoneCountry) || inferPhoneCountry(value.phone);
  const dialCode =
    PHONE_COUNTRY_OPTIONS.find((option) => option.code === country)?.dialCode ?? "+63";
  const dialDigits = dialCode.replace(/^\+/, "");
  const phoneDigits = value.phone.replace(/\D/g, "");
  const nationalNumber = phoneDigits.startsWith(dialDigits)
    ? phoneDigits.slice(dialDigits.length)
    : phoneDigits;

  function handleCountryChange(next: SupportedPhoneCountry) {
    onChange({ ...value, countryCode: next, phone: applyCountryDialCode(value.phone, next) });
  }

  function handlePhoneChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nationalDigits = event.target.value
      .replace(/\D/g, "")
      .slice(0, maxNationalDigits(country));
    onChange({
      ...value,
      countryCode: country,
      phone: sanitizeInternationalPhoneInput(`${dialCode}${nationalDigits}`, country),
    });
  }

  const phoneCountrySection = (
    <span className={styles.phoneCountry}>
      <CountrySelect value={country} onChange={handleCountryChange} />
      <span className={styles.phoneDial}>{dialCode}</span>
    </span>
  );

  return (
    <div className={styles.entryColumn}>
      <Field
        label="Name"
        withAsterisk
        placeholder="Enter name of reference"
        value={value.name}
        onChange={(event) => set("name", event.target.value)}
      />

      <Group grow gap={24} align="flex-start">
        <Field
          label="Email"
          type="email"
          placeholder="Enter email"
          value={value.email}
          onChange={(event) => set("email", event.target.value)}
        />
        <Field
          label="Phone number"
          withAsterisk
          type="tel"
          inputMode="numeric"
          placeholder="000 000 0000"
          value={formatNationalNumber(nationalNumber, country)}
          sectionLeft={phoneCountrySection}
          sectionPointerEvents="auto"
          onChange={handlePhoneChange}
        />
      </Group>

      <Field
        label="Company"
        withAsterisk
        placeholder="Enter referral company"
        value={value.company}
        onChange={(event) => set("company", event.target.value)}
      />

      <Group grow gap={24} align="flex-start">
        <Field
          label="Position"
          withAsterisk
          placeholder="Enter reference position"
          value={value.position}
          onChange={(event) => set("position", event.target.value)}
        />
        <Field
          label="Relation"
          placeholder="Enter nature of relation"
          value={value.relation}
          onChange={(event) => set("relation", event.target.value)}
        />
      </Group>
    </div>
  );
}
