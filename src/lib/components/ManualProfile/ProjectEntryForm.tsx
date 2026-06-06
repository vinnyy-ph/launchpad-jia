"use client";

import { Checkbox, Field, Group, Select } from "@/lib/components/ui";
import type { ProjectSectionItem } from "@/lib/utils/structuredCV";
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
  errors?: Record<string, string>;
  onFieldBlur?: (key: string) => void;
}

// Inline Projects form (Figma node 14567:37352) — same fields the overlay
// ProjectsModal captures, rendered inline inside the wizard accordion card.
export default function ProjectEntryForm({
  value,
  onChange,
  errors,
  onFieldBlur,
}: ProjectEntryFormProps) {
  function set<K extends keyof ProjectSectionItem>(field: K, fieldValue: ProjectSectionItem[K]) {
    onChange({ ...value, [field]: fieldValue });
  }

  function setDate(type: "startDate" | "endDate", field: "month" | "year", fieldValue: string) {
    onChange({ ...value, [type]: { ...value[type], [field]: fieldValue } });
  }

  return (
    <div className={styles.entryColumn}>
      <Field
        label="Project name"
        withAsterisk
        size="sm"
        placeholder="Enter project name"
        value={value.name}
        error={errors?.name}
        onBlur={() => onFieldBlur?.("name")}
        onChange={(event) => set("name", event.target.value)}
      />

      <Checkbox
        label="I am currently working in this project"
        checked={value.isCurrent}
        onCheckedChange={(checked) => set("isCurrent", checked)}
      />

      <LabeledField label="Start Date" withAsterisk error={errors?.startDate}>
        <Group grow gap={16} align="flex-start">
          <Select
            size="sm"
            data={MONTH_OPTIONS}
            placeholder="Month"
            value={value.startDate.month || null}
            onChange={(next) => setDate("startDate", "month", next ?? "")}
          />
          <Select
            size="sm"
            data={YEAR_OPTIONS}
            placeholder="Year"
            value={value.startDate.year || null}
            onChange={(next) => setDate("startDate", "year", next ?? "")}
          />
        </Group>
      </LabeledField>

      <LabeledField label="End Date" error={errors?.endDate}>
        <Group grow gap={16} align="flex-start">
          <Select
            size="sm"
            data={MONTH_OPTIONS}
            placeholder="Month"
            value={value.endDate.month || null}
            disabled={value.isCurrent}
            onChange={(next) => setDate("endDate", "month", next ?? "")}
          />
          <Select
            size="sm"
            data={YEAR_OPTIONS}
            placeholder="Year"
            value={value.endDate.year || null}
            disabled={value.isCurrent}
            onChange={(next) => setDate("endDate", "year", next ?? "")}
          />
        </Group>
      </LabeledField>

      <RichTextField
        id={`proj-desc-${value.id}`}
        label="Description"
        placeholder="List your highlights in the project"
        value={value.description}
        onChange={(html) => set("description", html)}
      />
    </div>
  );
}
