"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CvAnalysisV2,
  AnalysisTab,
  QualificationStatus,
  filterQualificationsByTab,
  summarizeBuckets,
} from "@/lib/utils/cvFitnessV2";
import MatchScoreDonut from "./MatchScoreDonut";
import QualificationBadges from "./QualificationBadges";

const STATUS_META: Record<QualificationStatus, { bg: string; border: string; color: string; icon: string; label: string }> = {
  matched: { bg: "#ECFDF3", border: "#ABEFC6", color: "#067647", icon: "la la-star", label: "Matched" },
  partial: { bg: "#FFFAEB", border: "#FEDF89", color: "#A15C07", icon: "la la-thumbs-up", label: "Partially Matched" },
  missing: { bg: "#FEF3F2", border: "#FECDCA", color: "#B42318", icon: "la la-question-circle", label: "Missing" },
};

const TABS: { key: AnalysisTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "matched", label: "Matched" },
  { key: "partial", label: "Partially Matched" },
  { key: "missing", label: "Missing" },
];

const PAGE_SIZE = 5;
const RANKING_W = 200;
const STATUS_ORDER: Record<QualificationStatus, number> = { matched: 0, partial: 1, missing: 2 };

// 1-based page list with ellipses, matching the Figma pattern (1 2 3 … 8 9 10).
function getPages(total: number, cur: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const wanted = [1, 2, 3, total - 2, total - 1, total, cur - 1, cur, cur + 1].filter((p) => p >= 1 && p <= total);
  const sorted = Array.from(new Set(wanted)).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - (sorted[i - 1] as number) > 1) out.push("…");
    out.push(p);
  });
  return out;
}

function StatusPill({ status }: { status: QualificationStatus }) {
  const m = STATUS_META[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: m.bg, border: `1px solid ${m.border}`, color: m.color, borderRadius: 8, padding: "4px 10px 4px 8px", fontSize: 14, fontWeight: 500, whiteSpace: "nowrap" }}>
      <i className={m.icon} style={{ fontSize: 16 }} />
      {m.label}
    </span>
  );
}

export default function ViewAnalysisModal({ analysis, onClose }: { analysis: CvAnalysisV2; onClose: () => void }) {
  const [tab, setTab] = useState<AnalysisTab>("all");
  const [page, setPage] = useState(0); // 0-based

  // Escape-to-close. The component only mounts while open, so the listener's
  // lifecycle is tied to the modal being visible.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const quals = analysis.qualifications;
  const summary = useMemo(() => summarizeBuckets(quals), [quals]);
  const counts = useMemo(
    () => ({
      all: quals.length,
      matched: quals.filter((q) => q.status === "matched").length,
      partial: quals.filter((q) => q.status === "partial").length,
      missing: quals.filter((q) => q.status === "missing").length,
    }),
    [quals]
  );
  const filtered = useMemo(
    () => filterQualificationsByTab(quals, tab).slice().sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    [quals, tab]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const selectTab = (key: AnalysisTab) => { setTab(key); setPage(0); };

  const headerCell: React.CSSProperties = { background: "#F8F9FC", borderBottom: "1px solid #E9EAEB", padding: "12px 24px", fontSize: 12, fontWeight: 700, color: "#717680" };
  const bodyCell: React.CSSProperties = { padding: "16px 24px", display: "flex", alignItems: "center" };
  // Previous/Next share one style, varying only by disabled state.
  const pagerBtn = (disabled: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "#fff",
    border: `1px solid ${disabled ? "#E9EAEB" : "#D5D7DA"}`,
    borderRadius: 8,
    padding: "8px 14px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 14,
    fontWeight: 700,
    color: disabled ? "#D5D7DA" : "#414651",
  });

  return (
    <div className="modal-background fade-in-bottom">
      <div className="modal-container">
        <div className="modal-content" style={{ background: "#fff", borderRadius: 14, padding: 24, maxWidth: 900, width: "92vw", maxHeight: "90vh", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#181D27" }}>View Analysis</h3>
            <button aria-label="Close" onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
              <i className="la la-times" style={{ fontSize: 20, color: "#717680" }} />
            </button>
          </div>

          {/* Top summary: ring + badges + overall summary */}
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <MatchScoreDonut score={analysis.matchScore} size={140} />
            <QualificationBadges summary={summary} />
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 500, color: "#181D27" }}>Overall Summary</span>
                {analysis.overallFit && (
                  <span style={{ background: "#ECFDF3", border: "1px solid #ABEFC6", color: "#067647", borderRadius: 8, padding: "4px 10px", fontSize: 14, fontWeight: 500 }}>{analysis.overallFit}</span>
                )}
              </div>
              <p style={{ fontSize: 16, color: "#414651", lineHeight: "24px", marginTop: 8 }}>{analysis.summary}</p>
            </div>
          </div>

          {/* Tabs with count chips */}
          <div style={{ display: "flex", borderBottom: "1px solid #E9EAEB", flexWrap: "wrap" }}>
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => selectTab(t.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 12,
                    fontSize: 14,
                    fontWeight: 700,
                    color: active ? "#414651" : "#717680",
                    borderBottom: active ? "2px solid #9FCAED" : "2px solid transparent",
                  }}
                >
                  {t.label}
                  <span style={{ background: "#fff", border: "1px solid #D5D7DA", borderRadius: 6, padding: "2px 6px", fontSize: 12, fontWeight: 500, color: "#414651", boxShadow: "0px 1px 1px rgba(10,13,18,0.05)", lineHeight: "18px" }}>
                    {counts[t.key]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div style={{ border: "1px solid #E9EAEB", borderRadius: 16, overflow: "hidden", boxShadow: "0px 1px 2px rgba(10,13,18,0.05)", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            {/* Header row */}
            <div style={{ display: "flex" }}>
              <div style={{ ...headerCell, width: RANKING_W, flexShrink: 0 }}>Ranking</div>
              <div style={{ ...headerCell, flex: 1 }}>Qualification Assessment</div>
            </div>
            {/* Body rows (scrolls within the table so pagination + Done stay visible) */}
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              {currentRows.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "#717680", fontSize: 14 }}>No qualifications in this category.</div>
              ) : (
                currentRows.map((q, i) => (
                  <div key={i} style={{ display: "flex", minHeight: 72, borderBottom: "1px solid #E9EAEB" }}>
                    <div style={{ ...bodyCell, width: RANKING_W, flexShrink: 0 }}>
                      <StatusPill status={q.status} />
                    </div>
                    <div style={{ ...bodyCell, flex: 1, flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>{q.text}</span>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#717680" }}>{q.evidence}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Pagination */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #E9EAEB", padding: "12px 24px 16px" }}>
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                style={pagerBtn(page === 0)}
              >
                <i className="la la-arrow-left" style={{ fontSize: 18 }} /> Previous
              </button>
              <div style={{ display: "flex", gap: 2 }}>
                {getPages(pageCount, page + 1).map((p, i) =>
                  p === "…" ? (
                    <span key={`e${i}`} style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: "#717680", fontSize: 14 }}>…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p - 1)}
                      style={{ width: 40, height: 40, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, background: page + 1 === p ? "#F8F9FC" : "transparent", color: page + 1 === p ? "#535862" : "#717680" }}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>
              <button
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                style={pagerBtn(page >= pageCount - 1)}
              >
                Next <i className="la la-arrow-right" style={{ fontSize: 18 }} />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ background: "#181D27", color: "#fff", borderRadius: 60, border: "none", padding: "10px 28px", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}
