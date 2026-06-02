"use client";

import React from "react";
import type { CandidateCard } from "../kanban/types";
import CandidateAnalysisView from "./CandidateAnalysisView";
import { useCandidateAnalysisDrawer } from "./useCandidateAnalysisDrawer";
import { useEscapeKey } from "../useEscapeKey";

type Props = {
  candidate: CandidateCard;
  jobTitle: string;
  stageLabel?: string;
  careerId: string;
  onClose: () => void;
  onViewCV: (candidate: CandidateCard) => void;
  onViewFullDetails: () => void;
  onViewAIInterview: () => void;
};

export default function CandidateAnalysis({
  candidate,
  jobTitle,
  stageLabel,
  careerId,
  onClose,
  onViewCV,
  onViewFullDetails,
  onViewAIInterview,
}: Props) {
  useEscapeKey(onClose, true);

  const {
    isLoading,
    cvData,
    cvReason,
    fitLabel,
    tooltipHtml,
    isRegenerating,
    regenerateError,
    handleRegenerate,
    pdfCandidate,
    interviewDetails,
    pipelineStages,
    evaluationsByStageId,
    loading,
  } = useCandidateAnalysisDrawer({ careerId, candidate, jobTitle });

  return (
    <CandidateAnalysisView
      candidate={candidate}
      stageLabel={stageLabel}
      onClose={onClose}
      onViewCV={onViewCV}
      onViewFullDetails={onViewFullDetails}
      onViewAIInterview={onViewAIInterview}
      onRegenerate={handleRegenerate}
      isLoading={isLoading}
      isRegenerating={isRegenerating}
      regenerateError={regenerateError}
      cvData={cvData}
      cvReason={cvReason}
      fitLabel={fitLabel}
      tooltipHtml={tooltipHtml}
      pdfCandidate={pdfCandidate}
      interviewDetails={interviewDetails}
      pipelineStages={pipelineStages}
      evaluationsByStageId={evaluationsByStageId}
      loading={loading}
    />
  );
}
