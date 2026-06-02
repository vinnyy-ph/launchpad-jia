"use client";

import React, { useEffect, useState, useMemo } from "react";
import type { CandidateCard } from "../ApplicationTimeline/kanban/types";
import ViewCandidateTabs, { CandidateTabKey, PipelineStage } from "./ViewCandidateTabs";
import Header from "./Header";
import ViewCandidateSkeleton from "./ViewCandidateSkeleton";
import {
  useCVScreeningData,
  EvaluationByJia,
  EvaluationByEndorser,
  CandidateCV,
  ContactInfo,
  PreScreeningQA,
  Skills,
} from "./CVScreening";
import AIInterview from "./AIInterview";
import HumanInterview from "./HumanInterview";
import Comments from "./Comments";
import { CustomStageRenderer } from "./CustomStages";
import { useAllStageEvaluations } from "./useAllStageEvaluations";

type Props = {
  candidate: CandidateCard;
  jobTitle: string;
  stageLabel?: string;
  onBack: () => void;
  careerId: string;
  pipelineStages?: PipelineStage[];
  initialTab?: CandidateTabKey;
};

// Helper to check if a stage matches a known type by name
function isStageType(stage: PipelineStage | null, type: "cv-screening" | "ai-interview" | "human-interview"): boolean {
  if (!stage) return false;
  const name = stage.name.toLowerCase();
  
  switch (type) {
    case "cv-screening":
      return name.includes("cv") && name.includes("screening");
    case "ai-interview":
      return name.includes("ai") && name.includes("interview");
    case "human-interview":
      return name.includes("human") && name.includes("interview");
    default:
      return false;
  }
}

// Helper to get stage type
function getStageType(stage: PipelineStage): "cv-screening" | "ai-interview" | "human-interview" | "custom" {
  const name = stage.name.toLowerCase();
  if (name.includes("cv") && name.includes("screening")) return "cv-screening";
  if (name.includes("ai") && name.includes("interview")) return "ai-interview";
  if (name.includes("human") && name.includes("interview")) return "human-interview";
  return "custom";
}

export default function ViewCandidateAnalysis({
  candidate,
  jobTitle,
  stageLabel,
  onBack,
  careerId,
  pipelineStages = [],
  initialTab,
}: Props) {
  // Filter out disabled stages and Job Offer stage for visible stages
  // BUT always keep core stages (CV Screening, AI Interview) for inherited data display
  const visibleStages = useMemo(() => {
    return pipelineStages.filter((stage) => {
      // Always show core stages (id "1" = CV Screening, id "2" = AI Interview)
      // because they contain inherited/transferred data that should be displayed
      if (stage.id === "1" || stage.id === "2") {
        // Still filter out Job Offer check for these
        const name = stage.name.toLowerCase();
        return !(name.includes("job") && name.includes("offer"));
      }
      // For other stages, filter out disabled ones
      if (stage.enabled === false) return false;
      // Also filter out Job Offer stage (it's typically an end state, not a review tab)
      const name = stage.name.toLowerCase();
      return !(name.includes("job") && name.includes("offer"));
    });
  }, [pipelineStages]);

  // Default to first stage or "comments" if no stages
  const defaultTab = useMemo(() => {
    return visibleStages[0]?.id || "comments";
  }, [visibleStages]);

  const [activeTab, setActiveTab] = useState<CandidateTabKey>(initialTab ?? defaultTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Fetch all evaluations centrally and map to stages
  const {
    stageLabelsMap,
    getEvaluationForStage,
    isLoading: isEvaluationsLoading,
  } = useAllStageEvaluations(candidate.id, pipelineStages);

  const {
    digitalCV,
    cvStatus,
    cvScreeningReason,
    preScreeningQuestions,
    candidateName,
    cvUploadedAt,
    cvFileInfo,
    isLoading: isCVDataLoading,
    regenerate,
    isRegenerating,
  } = useCVScreeningData(candidate.interviewID, candidate.email, null, candidate.id);

  const isLoading = isCVDataLoading || isEvaluationsLoading;
  const hasCV = digitalCV !== null && digitalCV.length > 0;

  if (isLoading) {
    return <ViewCandidateSkeleton />;
  }

  // Render content for a specific stage (used for each tab panel)
  const renderStageContent = (stage: PipelineStage) => {
    const stageType = getStageType(stage);

    switch (stageType) {
      case "cv-screening": {
        const cvScreeningEvaluation = getEvaluationForStage(stage.id);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Evaluation by Endorser - Full Width (only shown if evaluation exists) */}
            <EvaluationByEndorser evaluation={cvScreeningEvaluation} />

            {/* Evaluation by Jia - Full Width */}
            <EvaluationByJia
              cvStatus={cvStatus}
              cvScreeningReason={cvScreeningReason}
              onRegenerate={regenerate}
              isRegenerating={isRegenerating}
              hasCV={hasCV}
            />

            {/* Pre-screening Question Answers - Full Width */}
            <PreScreeningQA preScreeningQuestions={preScreeningQuestions} />

            {/* Two Column Layout: CV on left, sidebar on right - both columns match height */}
            <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
              <div style={{ flex: 1, display: "flex" }}>
                <CandidateCV
                  digitalCV={digitalCV}
                  cvUploadedAt={cvUploadedAt}
                  cvFileInfo={cvFileInfo}
                  candidateEmail={candidate.email}
                  candidateName={candidateName}
                  fillHeight
                />
              </div>
              <div style={{ width: 360, display: "flex", flexDirection: "column", gap: 16 }}>
                <ContactInfo digitalCV={digitalCV} />
                <Skills digitalCV={digitalCV} fillHeight />
              </div>
            </div>
          </div>
        );
      }

      case "ai-interview": {
        const aiInterviewEvaluation = getEvaluationForStage(stage.id);
        return (
          <AIInterview
            interviewID={candidate.interviewID}
            interviewUID={candidate.id}
            evaluation={aiInterviewEvaluation}
          />
        );
      }

      case "human-interview":
        return (
          <HumanInterview
            interviewUID={candidate.id}
            stageId={stage.id}
            pipelineStages={pipelineStages}
          />
        );

      case "custom":
      default:
        return (
          <CustomStageRenderer
            stage={stage}
            interviewUID={candidate.id}
            pipelineStages={pipelineStages}
          />
        );
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Header
        candidate={candidate}
        jobTitle={jobTitle}
        stageLabel={stageLabel}
        onBack={onBack}
      />

      <ViewCandidateTabs
        active={activeTab}
        onChange={setActiveTab}
        stageEvaluations={stageLabelsMap}
        pipelineStages={pipelineStages}
      />

      {/* All stage tabs rendered persistently - visibility controlled by CSS */}
      {/* This prevents unmounting and refetching when switching tabs */}
      {visibleStages.map((stage) => (
        <div
          key={stage.id}
          style={{ display: activeTab === stage.id ? "block" : "none" }}
        >
          {renderStageContent(stage)}
        </div>
      ))}

      {/* Comments tab - also rendered persistently */}
      <div style={{ display: activeTab === "comments" ? "block" : "none" }}>
        <Comments
          interviewID={candidate.interviewID}
          candidateEmail={candidate.email}
          careerId={careerId}
        />
      </div>
    </div>
  );
}
