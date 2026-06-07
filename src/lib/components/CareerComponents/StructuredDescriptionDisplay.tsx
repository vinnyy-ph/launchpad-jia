"use client";

import React from "react";
import { StructuredCareerDescription, stripHtml } from "@/lib/utils/cvFitnessV2";

const sectionLabel: React.CSSProperties = { fontSize: 14, color: "#414651", fontWeight: 700, marginTop: 16 };
const sectionBody: React.CSSProperties = { fontSize: 15, color: "#717680", lineHeight: 1.6, marginTop: 8 };

const hasText = (html: string) => stripHtml(html).length > 0;

/** Read-only render of the 4 structured sections. */
export default function StructuredDescriptionDisplay({ value }: { value: StructuredCareerDescription }) {
  const required = (value.requiredQualifications || []).filter((q) => q && q.trim());
  const preferred = (value.preferredQualifications || []).filter((q) => q && q.trim());

  return (
    <div>
      {hasText(value.overview) && (
        <>
          <div style={sectionLabel}>Overview</div>
          <div style={sectionBody} dangerouslySetInnerHTML={{ __html: value.overview }} />
        </>
      )}
      {hasText(value.rolesAndResponsibilities) && (
        <>
          <div style={sectionLabel}>Roles and Responsibilities</div>
          <div style={sectionBody} dangerouslySetInnerHTML={{ __html: value.rolesAndResponsibilities }} />
        </>
      )}
      {required.length > 0 && (
        <>
          <div style={sectionLabel}>Required Qualifications</div>
          <ul style={{ ...sectionBody, paddingLeft: 20 }}>
            {required.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </>
      )}
      {preferred.length > 0 && (
        <>
          <div style={sectionLabel}>Preferred Qualifications</div>
          <ul style={{ ...sectionBody, paddingLeft: 20 }}>
            {preferred.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}
