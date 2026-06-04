"use client";

import React, { useMemo, useState } from "react";
import { CvAnalysisV2, summarizeBuckets } from "@/lib/utils/cvFitnessV2";
import MatchScoreDonut from "./MatchScoreDonut";
import QualificationBadges from "./QualificationBadges";
import ViewAnalysisModal from "./ViewAnalysisModal";

const headerBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: "#fff",
  border: "1px solid #D5D7DA",
  borderRadius: 8,
  padding: "8px 12px",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
  color: "#414651",
  whiteSpace: "nowrap",
};

/**
 * Full "Evaluation by Jia" card (Figma 14356:7833): outer #F8F9FC wrapper, header with
 * Regenerate + View Analysis buttons, and a white inner panel (donut + count badges + summary).
 */
export default function EvaluationByJiaV2({
  analysis,
  onRegenerate,
  regenerating,
}: {
  analysis: CvAnalysisV2;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const [showModal, setShowModal] = useState(false);
  const summary = useMemo(() => summarizeBuckets(analysis.qualifications), [analysis.qualifications]);

  return (
    <div style={{ background: "#F8F9FC", borderRadius: 16, padding: 8, display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      {/* Card heading wrapper */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 12px", flexWrap: "wrap" }}>
        <img src="/jia-dashboard-logo.png" alt="Jia" style={{ width: 32, height: 32, borderRadius: 16, objectFit: "contain", flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 120, fontSize: 16, fontWeight: 500, color: "#181D27" }}>Evaluation by Jia</span>
        <button style={{ ...headerBtn, opacity: regenerating ? 0.6 : 1 }} onClick={onRegenerate} disabled={regenerating}>
          <i className="la la-redo-alt" style={{ fontSize: 18 }} /> Regenerate
        </button>
        <button style={headerBtn} onClick={() => setShowModal(true)}>
          <i className="la la-chart-bar" style={{ fontSize: 18 }} /> View Analysis
        </button>
      </div>

      {/* Inner panel */}
      <div style={{ background: "#fff", border: "1px solid #E9EAEB", borderRadius: 16, padding: 24, width: "100%" }}>
        {regenerating ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 24 }}>
            <i className="la la-circle-notch spin" style={{ fontSize: 24, color: "#414651" }} />
            <span style={{ color: "#6B7280", fontSize: 14 }}>Regenerating CV Analysis...</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 40, alignItems: "center" }}>
            <MatchScoreDonut score={analysis.matchScore} size={160} />
            <QualificationBadges summary={summary} />
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 500, color: "#181D27" }}>Overall Summary</span>
                {analysis.overallFit && (
                  <span style={{ background: "#ECFDF3", border: "1px solid #ABEFC6", color: "#067647", borderRadius: 8, padding: "4px 10px", fontSize: 14, fontWeight: 500 }}>
                    {analysis.overallFit}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 16, color: "#414651", lineHeight: "24px", marginTop: 8 }}>{analysis.summary}</p>
            </div>
          </div>
        )}
      </div>

      {showModal && <ViewAnalysisModal analysis={analysis} onClose={() => setShowModal(false)} />}
    </div>
  );
}
