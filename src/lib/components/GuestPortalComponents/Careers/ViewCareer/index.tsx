"use client";

import React from "react";
import Link from "next/link";
import type { CareerItem, CareerStatus } from "../types";
import type { CandidateCard } from "./ApplicationTimeline/kanban/types";
import ExportCandidateBTN from "./ExportCandidateBTN";
import ViewCareerTabs from "./ViewCareerTabs";
import CandidateAnalysis from "./ApplicationTimeline/CandidateAnalysis";
import SkeletonViewCareer from "./SkeletonViewCareer";
import CareerDescription from "./CareerDescriptions";
import ApplicationTimeline, { useViewCareerData } from "./ApplicationTimeline";
import AllApplicants from "./AllApplicants";
import CandidateCVModal from "./ApplicationTimeline/CandidateCVModal";
import ViewCandidateAnalysis from "./ViewCandidates/ViewCandidateAnalysis";
import type { CandidateTabKey } from "./ViewCandidates/ViewCandidateTabs";
import { CandidateCacheProvider } from "./CandidateCVUtils";

const statusStyles: Record<CareerStatus, React.CSSProperties> = {
  Active: {
    background: "#ECFDF3",
    border: "1px solid #A6F4C5",
    color: "#027948",
  },
  Unpublished: {
    background: "#F5F5F5",
    border: "1px solid #E9EAEB",
    color: "#414651",
  },
  "On Hold": {
    background: "#F5F5F5",
    border: "1px solid #E9EAEB",
    color: "#414651",
  },
  Completed: {
    background: "#EEFDF3",
    border: "1px solid #B7F3CA",
    color: "#027948",
  },
  Cancelled: {
    background: "#FEF3F2",
    border: "1px solid #FECDCA",
    color: "#B32318",
  },
};

function StatusPill({ status }: { status: CareerStatus }) {
  return (
    <span
      style={{
        ...statusStyles[status],
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {status}
      {status === "Completed" ? (
        <img src="/iconsV3/check-circle-outline.svg" alt="" style={{ width: 12, height: 12 }} />
      ) : null}
    </span>
  );
}

function PublishedPill() {
  return (
    <span
      style={{
        background: "#ECFDF3",
        border: "1px solid #A6F4C5",
        color: "#027948",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: "#12B76A",
          display: "inline-block",
        }}
      />
      Published
    </span>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: "#EAECF0",
        margin: "16px 0",
        width: "100%",
      }}
    />
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 12, color: "#667085" }}>{label}</span>
      <span
        style={{
          fontSize: 14,
          color: "#101828",
          fontWeight: 500,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function ViewCareer({ item }: { item: CareerItem }) {
  const [tab, setTab] = React.useState<"timeline" | "applicants" | "description">("timeline");
  const [selectedCandidate, setSelectedCandidate] = React.useState<
    | {
        card: CandidateCard;
        groupTitle: string;
        columnTitle: string;
      }
    | null
  >(null);
  const [selectedCandidateCV, setSelectedCandidateCV] = React.useState<CandidateCard | null>(null);
  const [selectedCandidateFullView, setSelectedCandidateFullView] = React.useState<
    | {
        card: CandidateCard;
        groupTitle: string;
        columnTitle: string;
        initialTab?: CandidateTabKey;
      }
    | null
  >(null);

  const { data: viewCareerData, pipelineStages, allPipelineStages, isLoading } = useViewCareerData(item.id);

  const isPipelineReady = !!viewCareerData?.groups && viewCareerData.groups.length > 0;
  const isUnpublished = item.status === "Unpublished";
  const isCareerReady = !isUnpublished && isPipelineReady;

  const applicantsCount = React.useMemo(() => {
    if (!viewCareerData) return 0;
    return viewCareerData.groups.reduce((acc, group) => {
      return acc + group.columns.reduce((colAcc, col) => colAcc + col.cards.length, 0);
    }, 0);
  }, [viewCareerData]);

  const handleViewAnalysis = React.useCallback(
    (card: CandidateCard, context: { groupTitle: string; columnTitle: string }) => {
      if (!isCareerReady) return;
      setSelectedCandidate({
        card,
        groupTitle: context.groupTitle,
        columnTitle: context.columnTitle,
      });
    },
    [isCareerReady]
  );

  const handleBackToTimeline = React.useCallback(() => {
    setSelectedCandidate(null);
  }, []);

  const handleBackFromFullView = React.useCallback(() => {
    setSelectedCandidateFullView(null);
  }, []);

  if (isLoading) {
    return <SkeletonViewCareer />;
  }

  if (!viewCareerData) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#667085" }}>
        Failed to load career data
      </div>
    );
  }

  if (selectedCandidateFullView) {
    return (
      <CandidateCacheProvider>
        <ViewCandidateAnalysis
          candidate={selectedCandidateFullView.card}
          jobTitle={item.title || ""}
          stageLabel={`${selectedCandidateFullView.groupTitle} · ${selectedCandidateFullView.columnTitle}`}
          onBack={handleBackFromFullView}
          careerId={item.id}
          pipelineStages={allPipelineStages}
          initialTab={selectedCandidateFullView.initialTab}
        />
      </CandidateCacheProvider>
    );
  }

  return (
    <CandidateCacheProvider>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0 }}>
        <>
          <Link
          href="/careers"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "#535862",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 500,
            width: "fit-content",
            marginLeft: 10,
            lineHeight: 1,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
            <path d="M15.8334 10H4.16675M4.16675 10L10.0001 15.8333M4.16675 10L10.0001 4.16667" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Home
        </Link>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: "#101828" }}>{item.title || "—"}</h1>
            {item.status === "Active" ? <PublishedPill /> : <StatusPill status={item.status} />}
          </div>
          {isCareerReady ? <ExportCandidateBTN /> : null}
        </div>

        <ViewCareerTabs active={tab} onChange={setTab} applicantsCount={applicantsCount} />
        {tab === "timeline" ? (
          <ApplicationTimeline
            onViewAnalysis={isCareerReady ? handleViewAnalysis : undefined}
            onViewCV={(card) => {
              setSelectedCandidateCV(card);
            }}
            data={viewCareerData}
          />
        ) : tab === "applicants" ? (
          isCareerReady ? (
            <AllApplicants careerId={item.id} />
          ) : (
            <div style={{ color: "#667085", padding: 16 }}>
              Applicants will appear once this role is fully set up.
            </div>
          )
        ) : (
          <CareerDescription careerId={item.id} />
        )}

        {selectedCandidate ? (
          <CandidateAnalysis
            candidate={selectedCandidate.card}
            jobTitle={item.title || ""}
            stageLabel={`${selectedCandidate.groupTitle} · ${selectedCandidate.columnTitle}`}
            careerId={item.id}
            onClose={handleBackToTimeline}
            onViewFullDetails={() => {
              const sel = selectedCandidate;
              if (!sel) return;
              setSelectedCandidate(null);
              setSelectedCandidateFullView({
                card: sel.card,
                groupTitle: sel.groupTitle,
                columnTitle: sel.columnTitle,
              });
            }}
            onViewAIInterview={() => {
              const sel = selectedCandidate;
              if (!sel) return;
              // Use allPipelineStages to find AI Interview even when disabled
              const stages = Array.isArray(allPipelineStages) ? allPipelineStages : [];
              const ai = stages.find((s) => {
                const name = (s?.name || "").toLowerCase();
                return name.includes("ai") && name.includes("interview");
              });
              setSelectedCandidate(null);
              setSelectedCandidateFullView({
                card: sel.card,
                groupTitle: sel.groupTitle,
                columnTitle: sel.columnTitle,
                initialTab: ai?.id != null ? String(ai.id) : undefined,
              });
            }}
            onViewCV={(card) => {
              setSelectedCandidateCV(card);
            }}
          />
        ) : null}

        {selectedCandidateCV ? (
          <CandidateCVModal
            candidate={{
              name: selectedCandidateCV.name,
              email: selectedCandidateCV.email,
              avatar: selectedCandidateCV.avatar,
            }}
            onClose={() => setSelectedCandidateCV(null)}
          />
        ) : null}
        </>
      </div>
    </CandidateCacheProvider>
  );
}
