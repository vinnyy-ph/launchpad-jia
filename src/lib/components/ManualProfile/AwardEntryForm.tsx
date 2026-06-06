"use client";

import { Field, Select, Textarea } from "@/lib/components/ui";
import type { AwardSectionItem } from "@/lib/utils/structuredCV";
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

const DESCRIPTION_MAX = 2000;

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
}

// Inline Awards form (Figma node 14567:37215).
export default function AwardEntryForm({ value, onChange }: AwardEntryFormProps) {
  function set<K extends keyof AwardSectionItem>(field: K, fieldValue: AwardSectionItem[K]) {
    onChange({ ...value, [field]: fieldValue });
  }

  function setIssueDate(field: "month" | "year", fieldValue: string) {
    onChange({ ...value, issueDate: { ...value.issueDate, [field]: fieldValue } });
  }

  const charactersLeft = DESCRIPTION_MAX - (value.description?.length ?? 0);

  return (
    <div className={styles.entryColumn}>
      <Field
        label="Award Title"
        withAsterisk
        placeholder="Enter title of award"
        value={value.title}
        onChange={(event) => set("title", event.target.value)}
      />

      <Field
        label="Issuer"
        placeholder="E.g. Microsoft"
        value={value.issuer}
        onChange={(event) => set("issuer", event.target.value)}
      />

      <div className={styles.fieldGroup}>
        <span className={styles.fieldGroupLabel}>Issue Date</span>
        <div className={styles.fieldGrid}>
          <Select
            data={MONTH_OPTIONS}
            placeholder="Month"
            value={value.issueDate.month || null}
            onChange={(next) => setIssueDate("month", next ?? "")}
          />
          <Select
            data={YEAR_OPTIONS}
            placeholder="Year"
            value={value.issueDate.year || null}
            onChange={(next) => setIssueDate("year", next ?? "")}
          />
        </div>
      </div>

      <div className={styles.descriptionField}>
        <Textarea
          id={`award-desc-${value.id}`}
          label="Description"
          placeholder="Tell us more about this award"
          value={value.description}
          maxLength={DESCRIPTION_MAX}
          autosize
          minRows={6}
          maxRows={12}
          onChange={(event) => set("description", event.target.value)}
        />
        <p className={styles.charCount}>{charactersLeft} characters left</p>
      </div>
    </div>
  );
}
