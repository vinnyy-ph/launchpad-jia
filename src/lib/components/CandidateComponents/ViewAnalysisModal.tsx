"use client";

import React, { useMemo, useState } from "react";
import {
  CvAnalysisV2,
  AnalysisTab,
  QualificationStatus,
  filterQualificationsByTab,
  summarizeBuckets,
} from "@/lib/utils/cvFitnessV2";
import MatchScoreDonut from "./MatchScoreDonut";
import QualificationBadges from "./QualificationBadges";

const STATUS_STYLE: Record<QualificationStatus, { bg: string; stroke: string; color: string; label: string }> = {
  matched: { bg: "#ECFDF3", stroke: "#ABEFC6", color: "#067647", label: "Matched" },
  partial: { bg: "#FFFAEB", stroke: "#FEDF89", color: "#B54708", label: "Partially Matched" },
  missing: { bg: "#FEF3F2", stroke: "#FECDCA", color: "#B42318", label: "Missing" },
};

const TABS: { key: AnalysisTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "matched", label: "Matched" },
  { key: "partial", label: "Partially Matched" },
  { key: "missing", label: "Missing" },
];

const PAGE_SIZE = 5;

export default function ViewAnalysisModal({ analysis, onClose }: { analysis: CvAnalysisV2; onClose: () => void }) {
  const [tab, setTab] = useState<AnalysisTab>("all");
  const [page, setPage] = useState(0);

  const summary = useMemo(() => summarizeBuckets(analysis.qualifications), [analysis.qualifications]);
  const filtered = useMemo(() => filterQualificationsByTab(analysis.qualifications, tab), [analysis.qualifications, tab]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const selectTab = (key: AnalysisTab) => { setTab(key); setPage(0); };

  return (
    <div className="modal-background fade-in-bottom">
      <div className="modal-container">
        <div className="modal-content" style={{ background: "#fff", borderRadius: 14, padding: 24, maxWidth: 900, width: "90vw", maxHeight: "85vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#181D27" }}>View Analysis</h3>
            <button aria-label="Close" onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
              <i className="la la-times" style={{ fontSize: 20, color: "#717680" }} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <MatchScoreDonut score={analysis.matchScore} />
              <QualificationBadges summary={summary} />
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#181D27" }}>Overall Summary</span>
              <p style={{ fontSize: 14, color: "#475467", lineHeight: 1.6, marginTop: 8 }}>{analysis.summary}</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #EAECF0", flexWrap: "wrap" }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => selectTab(t.key)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: "8px 12px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: tab === t.key ? "#6941C6" : "#717680",
                  borderBottom: tab === t.key ? "2px solid #6941C6" : "2px solid transparent",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {current.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#667085", fontSize: 14 }}>No qualifications in this category.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {current.map((q, i) => {
                const s = STATUS_STYLE[q.status];
                return (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid #F2F4F7" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: s.bg, border: `1px solid ${s.stroke}`, color: s.color, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 600, height: "fit-content", whiteSpace: "nowrap" }}>
                      {s.label}
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#181D27" }}>{q.text}</div>
                      <div style={{ fontSize: 13, color: "#475467", marginTop: 2 }}>{q.evidence}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} style={{ border: "1px solid #D5D7DA", borderRadius: 8, background: "#fff", padding: "6px 12px", cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.5 : 1 }}>Prev</button>
              <span style={{ fontSize: 13, color: "#717680", alignSelf: "center" }}>{page + 1} / {pageCount}</span>
              <button disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} style={{ border: "1px solid #D5D7DA", borderRadius: 8, background: "#fff", padding: "6px 12px", cursor: page >= pageCount - 1 ? "not-allowed" : "pointer", opacity: page >= pageCount - 1 ? 0.5 : 1 }}>Next</button>
            </div>
            <button onClick={onClose} style={{ background: "#181D27", color: "#fff", borderRadius: 60, border: "none", padding: "10px 24px", cursor: "pointer", fontWeight: 600 }}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}
