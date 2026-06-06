"use client";

import { Checkbox, Field, Select, Textarea } from "@/lib/components/ui";
import type { ProjectSectionItem } from "@/lib/utils/structuredCV";
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

export function createEmptyProject(): ProjectSectionItem {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "",
    isCurrent: false,
    startDate: { month: "", year: "" },
    endDate: { month: "", year: "" },
    description: "",
  };
}

interface ProjectEntryFormProps {
  value: ProjectSectionItem;
  onChange: (value: ProjectSectionItem) => void;
}

// Inline Projects form (Figma node 14567:37352) — same fields the overlay
// ProjectsModal captures, rendered inline inside the wizard accordion card.
export default function ProjectEntryForm({ value, onChange }: ProjectEntryFormProps) {
  function set<K extends keyof ProjectSectionItem>(field: K, fieldValue: ProjectSectionItem[K]) {
    onChange({ ...value, [field]: fieldValue });
  }

  function setDate(type: "startDate" | "endDate", field: "month" | "year", fieldValue: string) {
    onChange({ ...value, [type]: { ...value[type], [field]: fieldValue } });
  }

  const charactersLeft = DESCRIPTION_MAX - (value.description?.length ?? 0);

  return (
    <div className={styles.entryColumn}>
      <Field
        label="Project name"
        withAsterisk
        placeholder="Enter project name"
        value={value.name}
        onChange={(event) => set("name", event.target.value)}
      />

      <Checkbox
        label="I am currently working in this project"
        checked={value.isCurrent}
        onCheckedChange={(checked) => set("isCurrent", checked)}
      />

      <div className={styles.fieldGroup}>
        <span className={styles.fieldGroupLabel}>
          Start Date<span className={styles.fieldAsterisk}>*</span>
        </span>
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
        <span className={styles.fieldGroupLabel}>End Date</span>
        <div className={styles.fieldGrid}>
          <Select
            data={MONTH_OPTIONS}
            placeholder="Month"
            value={value.endDate.month || null}
            disabled={value.isCurrent}
            onChange={(next) => setDate("endDate", "month", next ?? "")}
          />
          <Select
            data={YEAR_OPTIONS}
            placeholder="Year"
            value={value.endDate.year || null}
            disabled={value.isCurrent}
            onChange={(next) => setDate("endDate", "year", next ?? "")}
          />
        </div>
      </div>

      <div className={styles.descriptionField}>
        <Textarea
          id={`proj-desc-${value.id}`}
          label="Description"
          placeholder="List your highlights in the project"
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
