"use client";

import { Checkbox, Field, Select, Textarea } from "@/lib/components/ui";
import type { ExperienceSectionItem } from "@/lib/utils/structuredCV";
import styles from "./manual-profile.module.scss";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Experience years run back from the current year (no future dates).
const YEARS = Array.from({ length: 50 }, (_, i) =>
  (new Date().getFullYear() - i).toString(),
);

const EMPLOYMENT_TYPES = [
  "Full-time", "Part-time", "Contract", "Internship", "Freelance", "Self-employed",
];
const WORK_SETUPS = ["On-site", "Remote", "Hybrid"];

const MONTH_OPTIONS = MONTHS.map((m) => ({ value: m, label: m }));
const YEAR_OPTIONS = YEARS.map((y) => ({ value: y, label: y }));
const EMPLOYMENT_TYPE_OPTIONS = EMPLOYMENT_TYPES.map((t) => ({ value: t, label: t }));
const WORK_SETUP_OPTIONS = WORK_SETUPS.map((s) => ({ value: s, label: s }));

const DESCRIPTION_MAX = 2000;

export function createEmptyExperience(): ExperienceSectionItem {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: "",
    company: "",
    companyDomain: "",
    companyLogoUrl: "",
    employmentType: "",
    location: "",
    workSetup: "",
    startDate: { month: "", year: "" },
    endDate: { month: "", year: "" },
    isCurrentRole: false,
    description: "",
  };
}

interface ExperienceEntryFormProps {
  value: ExperienceSectionItem;
  onChange: (value: ExperienceSectionItem) => void;
}

// Inline Experience form (Figma node 14567:37419) — same fields the overlay
// ExperienceModal captures, rendered inline inside the wizard accordion card.
export default function ExperienceEntryForm({ value, onChange }: ExperienceEntryFormProps) {
  function set<K extends keyof ExperienceSectionItem>(field: K, fieldValue: ExperienceSectionItem[K]) {
    onChange({ ...value, [field]: fieldValue });
  }

  function setDate(type: "startDate" | "endDate", field: "month" | "year", fieldValue: string) {
    onChange({ ...value, [type]: { ...value[type], [field]: fieldValue } });
  }

  const charactersLeft = DESCRIPTION_MAX - (value.description?.length ?? 0);

  return (
    <div className={styles.expForm}>
      <Field
        label="Job Title"
        withAsterisk
        placeholder="What is your title?"
        value={value.title}
        onChange={(event) => set("title", event.target.value)}
      />

      <div className={styles.fieldGrid}>
        <Field
          label="Company or Organization"
          withAsterisk
          placeholder="E.g. Google, Inc."
          value={value.company}
          onChange={(event) => set("company", event.target.value)}
        />
        <div className={styles.fieldGroup}>
          <span className={styles.fieldGroupLabel}>Employment Type</span>
          <Select
            data={EMPLOYMENT_TYPE_OPTIONS}
            placeholder="Select employment type"
            value={value.employmentType || null}
            onChange={(next) => set("employmentType", next ?? "")}
          />
        </div>
      </div>

      <div className={styles.fieldGrid}>
        <Field
          label="Address"
          placeholder="E.g. Manila, Philippines"
          value={value.location}
          onChange={(event) => set("location", event.target.value)}
        />
        <div className={styles.fieldGroup}>
          <span className={styles.fieldGroupLabel}>Work Setup</span>
          <Select
            data={WORK_SETUP_OPTIONS}
            placeholder="Select"
            value={value.workSetup || null}
            onChange={(next) => set("workSetup", next ?? "")}
          />
        </div>
      </div>

      <Checkbox
        label="I am currently working in this role"
        checked={value.isCurrentRole}
        onCheckedChange={(checked) => set("isCurrentRole", checked)}
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
        <span className={styles.fieldGroupLabel}>
          End Date<span className={styles.fieldAsterisk}>*</span>
        </span>
        <div className={styles.fieldGrid}>
          <Select
            data={MONTH_OPTIONS}
            placeholder="Month"
            value={value.endDate.month || null}
            disabled={value.isCurrentRole}
            onChange={(next) => setDate("endDate", "month", next ?? "")}
          />
          <Select
            data={YEAR_OPTIONS}
            placeholder="Year"
            value={value.endDate.year || null}
            disabled={value.isCurrentRole}
            onChange={(next) => setDate("endDate", "year", next ?? "")}
          />
        </div>
      </div>

      <div className={styles.descriptionField}>
        <Textarea
          id={`exp-desc-${value.id}`}
          label="Description"
          placeholder="List your major duties and success, highlighting specific projects"
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
