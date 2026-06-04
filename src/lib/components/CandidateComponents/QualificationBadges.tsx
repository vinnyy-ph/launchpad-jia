"use client";

import React from "react";
import { BucketSummary } from "@/lib/utils/cvFitnessV2";

type Hue = { bg: string; border: string; text: string; chip: string };

const HUES: Record<"green" | "amber" | "red", Hue> = {
  green: { bg: "#ECFDF3", border: "#ABEFC6", text: "#067647", chip: "#ABEFC6" },
  amber: { bg: "#FFFAEB", border: "#FEDF89", text: "#A15C07", chip: "#FEDF89" },
  red: { bg: "#FEF3F2", border: "#FECDCA", text: "#B42318", chip: "#FECDCA" },
};

function Pill({ hue, icon, label, count }: { hue: Hue; icon: string; label: string; count: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: hue.bg,
        border: `1px solid ${hue.border}`,
        color: hue.text,
        borderRadius: 8,
        padding: "4px 10px 4px 8px",
        fontSize: 14,
        fontWeight: 500,
        width: "fit-content",
        whiteSpace: "nowrap",
      }}
    >
      <i className={icon} style={{ fontSize: 16 }} />
      {label}
      <span
        style={{
          background: hue.chip,
          color: hue.text,
          borderRadius: 6,
          padding: "0 6px",
          fontSize: 13,
          fontWeight: 600,
          lineHeight: "18px",
        }}
      >
        {count}
      </span>
    </span>
  );
}

/** The three count badges — label + a separate count chip (per Figma 14356:7851/7853/7855). */
export default function QualificationBadges({ summary }: { summary: BucketSummary }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Pill hue={HUES.green} icon="la la-star" label="Required Qualifications" count={`${summary.requiredMatched}/${summary.requiredTotal}`} />
      <Pill hue={HUES.amber} icon="la la-thumbs-up" label="Preferred Qualifications" count={`${summary.preferredMatched}/${summary.preferredTotal}`} />
      <Pill hue={HUES.red} icon="la la-question-circle" label="Missing Qualifications" count={`${summary.missingCount}`} />
    </div>
  );
}
