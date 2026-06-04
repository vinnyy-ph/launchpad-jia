"use client";

import React from "react";
import { BucketSummary } from "@/lib/utils/cvFitnessV2";

const badge = (bg: string, stroke: string, color: string): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: bg,
  border: `1px solid ${stroke}`,
  color,
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 13,
  fontWeight: 600,
  width: "fit-content",
});

/** The three count badges: required met, preferred met, total missing. */
export default function QualificationBadges({ summary }: { summary: BucketSummary }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={badge("#ECFDF3", "#ABEFC6", "#067647")}>
        <i className="la la-star" /> Required Qualifications {summary.requiredMatched}/{summary.requiredTotal}
      </span>
      <span style={badge("#FFFAEB", "#FEDF89", "#B54708")}>
        <i className="la la-thumbs-up" /> Preferred Qualifications {summary.preferredMatched}/{summary.preferredTotal}
      </span>
      <span style={badge("#FEF3F2", "#FECDCA", "#B42318")}>
        <i className="la la-question-circle" /> Missing Qualifications {summary.missingCount}
      </span>
    </div>
  );
}
