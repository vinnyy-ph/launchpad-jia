"use client";

import { Field, Group, Select, Textarea } from "@/lib/components/ui";
import type { EducationSectionItem } from "@/lib/utils/structuredCV";
import styles from "./manual-profile.module.scss";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Allow a few future years for an expected graduation date.
const YEARS = Array.from({ length: 50 }, (_, i) =>
  (new Date().getFullYear() + 5 - i).toString(),
);

const MONTH_OPTIONS = MONTHS.map((m) => ({ value: m, label: m }));
const YEAR_OPTIONS = YEARS.map((y) => ({ value: y, label: y }));

const DESCRIPTION_MAX = 2000;

export function createEmptyEducation(): EducationSectionItem {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    school: "",
    schoolDomain: "",
    schoolLogoUrl: "",
    degree: "",
    fieldOfStudy: "",
    startDate: { month: "", year: "" },
    endDate: { month: "", year: "" },
    description: "",
  };
}

interface EducationEntryFormProps {
  value: EducationSectionItem;
  onChange: (value: EducationSectionItem) => void;
}

// Inline Education form (Figma node 14567:37499) — the same fields the overlay
// EducationModal captures, rendered inline inside the wizard card.
export default function EducationEntryForm({ value, onChange }: EducationEntryFormProps) {
  function set<K extends keyof EducationSectionItem>(field: K, fieldValue: EducationSectionItem[K]) {
    onChange({ ...value, [field]: fieldValue });
  }

  function setDate(type: "startDate" | "endDate", field: "month" | "year", fieldValue: string) {
    onChange({ ...value, [type]: { ...value[type], [field]: fieldValue } });
  }

  const charactersLeft = DESCRIPTION_MAX - (value.description?.length ?? 0);

  return (
    <div className={styles.eduForm}>
      <Field
        label="School"
        withAsterisk
        placeholder="E.g. Ateneo De Manila University"
        value={value.school}
        onChange={(event) => set("school", event.target.value)}
      />

      <Group grow gap={16} align="flex-start">
        <Field
          label="Degree"
          placeholder="E.g. Bachelor of Science"
          value={value.degree}
          onChange={(event) => set("degree", event.target.value)}
        />
        <Field
          label="Field of Study"
          placeholder="E.g. Management Engineering"
          value={value.fieldOfStudy}
          onChange={(event) => set("fieldOfStudy", event.target.value)}
        />
      </Group>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldGroupLabel}>Start Date</span>
        <div className={styles.fieldGrid}>
          <Select
            data={MONTH_OPTIONS}
            placeholder="Month"
            value={value.startDate.month || null}
            onChange={(next) => setDate("startDate", "month", next ?? "")}
          />
          <Select
            data={YEAR_OPTIONS}
            placeholder="Year"
            value={value.startDate.year || null}
            onChange={(next) => setDate("startDate", "year", next ?? "")}
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldGroupLabel}>Graduation Date (or expected)</span>
        <div className={styles.fieldGrid}>
          <Select
            data={MONTH_OPTIONS}
            placeholder="Month"
            value={value.endDate.month || null}
            onChange={(next) => setDate("endDate", "month", next ?? "")}
          />
          <Select
            data={YEAR_OPTIONS}
            placeholder="Year"
            value={value.endDate.year || null}
            onChange={(next) => setDate("endDate", "year", next ?? "")}
          />
        </div>
      </div>

      <div className={styles.descriptionField}>
        <Textarea
          id={`edu-desc-${value.id}`}
          label="Description"
          placeholder="List your awards, activities, societies etc."
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
