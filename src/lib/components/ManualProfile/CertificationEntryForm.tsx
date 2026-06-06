"use client";

import { Field, Group, Select } from "@/lib/components/ui";
import type { CertificationSectionItem } from "@/lib/utils/structuredCV";
import LabeledField from "./LabeledField";
import styles from "./manual-profile.module.scss";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Certifications can expire in the future, so allow a forward range too.
const YEARS = Array.from({ length: 60 }, (_, i) =>
  (new Date().getFullYear() + 10 - i).toString(),
);

const MONTH_OPTIONS = MONTHS.map((m) => ({ value: m, label: m }));
const YEAR_OPTIONS = YEARS.map((y) => ({ value: y, label: y }));

export function createEmptyCertification(): CertificationSectionItem {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "",
    issuingOrganization: "",
    issuingOrganizationDomain: "",
    issuingOrganizationLogoUrl: "",
    issueDate: { month: "", year: "" },
    expirationDate: { month: "", year: "" },
    credentialId: "",
    credentialUrl: "",
  };
}

interface CertificationEntryFormProps {
  value: CertificationSectionItem;
  onChange: (value: CertificationSectionItem) => void;
}

// Inline Certifications form (Figma node 14567:37314).
export default function CertificationEntryForm({ value, onChange }: CertificationEntryFormProps) {
  function set<K extends keyof CertificationSectionItem>(field: K, fieldValue: CertificationSectionItem[K]) {
    onChange({ ...value, [field]: fieldValue });
  }

  function setDate(type: "issueDate" | "expirationDate", field: "month" | "year", fieldValue: string) {
    onChange({ ...value, [type]: { ...value[type], [field]: fieldValue } });
  }

  return (
    <div className={styles.entryColumn}>
      <Field
        label="Name"
        withAsterisk
        size="sm"
        placeholder="E.g. Microsoft certified network associate security"
        value={value.name}
        onChange={(event) => set("name", event.target.value)}
      />

      <Field
        label="Issuing Organization"
        withAsterisk
        size="sm"
        placeholder="E.g. Microsoft"
        value={value.issuingOrganization}
        onChange={(event) => set("issuingOrganization", event.target.value)}
      />

      <LabeledField label="Issue Date">
        <Group grow gap={16} align="flex-start">
          <Select
            size="sm"
            data={MONTH_OPTIONS}
            placeholder="Month"
            value={value.issueDate.month || null}
            onChange={(next) => setDate("issueDate", "month", next ?? "")}
          />
          <Select
            size="sm"
            data={YEAR_OPTIONS}
            placeholder="Year"
            value={value.issueDate.year || null}
            onChange={(next) => setDate("issueDate", "year", next ?? "")}
          />
        </Group>
      </LabeledField>

      <LabeledField label="Expiration Date">
        <Group grow gap={16} align="flex-start">
          <Select
            size="sm"
            data={MONTH_OPTIONS}
            placeholder="Month"
            value={value.expirationDate.month || null}
            onChange={(next) => setDate("expirationDate", "month", next ?? "")}
          />
          <Select
            size="sm"
            data={YEAR_OPTIONS}
            placeholder="Year"
            value={value.expirationDate.year || null}
            onChange={(next) => setDate("expirationDate", "year", next ?? "")}
          />
        </Group>
      </LabeledField>

      <Field
        label="Credential ID"
        size="sm"
        placeholder="Enter credential ID"
        value={value.credentialId}
        onChange={(event) => set("credentialId", event.target.value)}
      />

      <LabeledField label="Credential URL" htmlFor={`cred-url-${value.id}`}>
        <div className={styles.urlCombo}>
          <span className={styles.urlComboTextPrefix}>https://</span>
          <input
            id={`cred-url-${value.id}`}
            className={styles.urlComboTextInput}
            placeholder="www.example.com"
            value={value.credentialUrl}
            onChange={(event) => set("credentialUrl", event.target.value)}
          />
        </div>
      </LabeledField>
    </div>
  );
}
