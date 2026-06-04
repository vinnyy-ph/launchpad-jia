"use client";

import React, { useMemo, useState } from "react";
import { CvAnalysisV2, summarizeBuckets } from "@/lib/utils/cvFitnessV2";
import MatchScoreDonut from "./MatchScoreDonut";
import QualificationBadges from "./QualificationBadges";
import ViewAnalysisModal from "./ViewAnalysisModal";

/** Enhanced "Evaluation by Jia" body: donut + count badges + summary + View Analysis. */
export default function EvaluationByJiaV2({ analysis, jobTitle }: { analysis: CvAnalysisV2; jobTitle?: string }) {
  const [showModal, setShowModal] = useState(false);
  const summary = useMemo(() => summarizeBuckets(analysis.qualifications), [analysis.qualifications]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <MatchScoreDonut score={analysis.matchScore} />
          <QualificationBadges summary={summary} />
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#181D27" }}>Overall Summary</span>
            {analysis.overallFit && (
              <span style={{ background: "#ECFDF3", border: "1px solid #ABEFC6", color: "#067647", borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>
                {analysis.overallFit}
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, color: "#475467", lineHeight: 1.6, marginTop: 8 }}>{analysis.summary}</p>
          <button
            onClick={() => setShowModal(true)}
            style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #D5D7DA", borderRadius: 60, background: "#fff", padding: "8px 16px", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#414651" }}
          >
            <i className="la la-chart-bar" /> View Analysis
          </button>
        </div>
      </div>
      {showModal && <ViewAnalysisModal analysis={analysis} onClose={() => setShowModal(false)} />}
    </div>
  );
}
