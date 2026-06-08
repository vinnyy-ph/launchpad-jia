"use client";

import React from "react";
import RichTextEditor from "./RichTextEditor";
import QualificationListInput from "./QualificationListInput";
import { StructuredCareerDescription } from "@/lib/utils/cvFitnessV2";

/**
 * Shared empty shape used to seed new-career form state. Treat as immutable —
 * consumers must replace (spread) rather than mutate it, since the nested arrays
 * are shared by reference across every form instance.
 */
export const EMPTY_STRUCTURED_DESCRIPTION: StructuredCareerDescription = {
  overview: "",
  rolesAndResponsibilities: "",
  requiredQualifications: [],
  preferredQualifications: [],
};

type Props = {
  value: StructuredCareerDescription;
  onChange: (next: StructuredCareerDescription) => void;
  /** True when the Overview is required but empty. */
  error?: boolean;
};

/** The structured (4-section) career description editor: overview, R&R, required + preferred quals. */
export default function StructuredDescriptionFields({ value, onChange, error }: Props) {
  const patch = (partial: Partial<StructuredCareerDescription>) => onChange({ ...value, ...partial });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 14, color: "#414651", fontWeight: 600 }}>Overview</span>
        <RichTextEditor setText={(text: string) => patch({ overview: text })} text={value.overview} error={error || false} />
        <div style={{ minHeight: 18 }}>
          {error && <span style={{ fontSize: 12, color: "#EF4444" }}>Overview is required.</span>}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 14, color: "#414651", fontWeight: 600 }}>Roles and Responsibilities</span>
        <RichTextEditor setText={(text: string) => patch({ rolesAndResponsibilities: text })} text={value.rolesAndResponsibilities} error={false} />
      </div>

      <QualificationListInput
        label="Required Qualifications"
        placeholder="e.g. 5+ years of product design experience"
        values={value.requiredQualifications}
        onChange={(values) => patch({ requiredQualifications: values })}
      />

      <QualificationListInput
        label="Preferred Qualifications"
        placeholder="e.g. Experience in a fintech environment"
        values={value.preferredQualifications}
        onChange={(values) => patch({ preferredQualifications: values })}
      />
    </div>
  );
}
