"use client";

import { Field, Group, Select } from "@/lib/components/ui";
import type { AwardSectionItem } from "@/lib/utils/structuredCV";
import LabeledField from "./LabeledField";
import RichTextField from "./RichTextField";
import styles from "./manual-profile.module.scss";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const YEARS = Array.from({ length: 50 }, (_, i) =>
  (new Date().getFullYear() - i).toString(),
);

const MONTH_OPTIONS = MONTHS.map((m) => ({ value: m, label: m }));
const YEAR_OPTIONS = YEARS.map((y) => ({ value: y, label: y }));

export function createEmptyAward(): AwardSectionItem {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: "",
    issuer: "",
    issuerDomain: "",
    issuerLogoUrl: "",
    issueDate: { month: "", year: "" },
    description: "",
  };
}

interface AwardEntryFormProps {
  value: AwardSectionItem;
  onChange: (value: AwardSectionItem) => void;
  errors?: Record<string, string>;
  onFieldBlur?: (key: string) => void;
}

// Inline Awards form (Figma node 14567:37215).
export default function AwardEntryForm({
  value,
  onChange,
  errors,
  onFieldBlur,
}: AwardEntryFormProps) {
  function set<K extends keyof AwardSectionItem>(field: K, fieldValue: AwardSectionItem[K]) {
    onChange({ ...value, [field]: fieldValue });
  }

  function setIssueDate(field: "month" | "year", fieldValue: string) {
    onChange({ ...value, issueDate: { ...value.issueDate, [field]: fieldValue } });
  }

  return (
    <div className={styles.entryColumn}>
      <Field
        label="Award Title"
        withAsterisk
        size="sm"
        placeholder="Enter title of award"
        value={value.title}
        error={errors?.title}
        onBlur={() => onFieldBlur?.("title")}
        onChange={(event) => set("title", event.target.value)}
      />

      <Field
        label="Issuer"
        size="sm"
        placeholder="E.g. Microsoft"
        value={value.issuer}
        onChange={(event) => set("issuer", event.target.value)}
      />

      <LabeledField label="Issue Date">
        <Group grow gap={16} align="flex-start">
          <Select
            size="sm"
            data={MONTH_OPTIONS}
            placeholder="Month"
            value={value.issueDate.month || null}
            onChange={(next) => setIssueDate("month", next ?? "")}
          />
          <Select
            size="sm"
            data={YEAR_OPTIONS}
            placeholder="Year"
            value={value.issueDate.year || null}
            onChange={(next) => setIssueDate("year", next ?? "")}
          />
        </Group>
      </LabeledField>

      <RichTextField
        id={`award-desc-${value.id}`}
        label="Description"
        placeholder="Tell us more about this award"
        value={value.description}
        onChange={(html) => set("description", html)}
      />
    </div>
  );
}
