"use client";

import React from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Tooltip } from "react-tooltip";
import { extractInterviewAssessment } from "@/lib/Utils";
import { useAIInterviewData } from "../../ViewCandidates/AIInterview/useAIInterviewData";
import AIInterviewSkeleton from "../../ViewCandidates/AIInterview/AIInterviewSkeleton";
import { EvaluationByEndorserSkeleton, EvaluationByJiaSkeleton } from "../../ViewCandidates/CVScreening/CVScreeningSkeleton";
import { Label } from "@/lib/components/GuestPortalComponents/label";

import type { CandidateCard } from "../kanban/types";
import { CandidateCVDocument } from "@/lib/components/CandidateComponents/CandidateCVDocument";
import type { PipelineStage } from "../useViewCareerData";
import { EvaluationByEndorser } from "../../ViewCandidates/CVScreening";
import EvaluationByJia from "../../ViewCandidates/CVScreening/EvaluationByJia";
import InterviewAnalysis from "../../ViewCandidates/AIInterview/InterviewAnalysis";
import InterviewSummary from "../../ViewCandidates/AIInterview/InterviewSummary";
import InterviewTranscript from "../../ViewCandidates/AIInterview/InterviewTranscript";
import VideoRecording from "../../ViewCandidates/AIInterview/VideoRecording";
import SkeletonBox, { SkeletonWrapper } from "../../ViewCandidates/SkeletonBox";

type Props = {
  candidate: CandidateCard;
  stageLabel?: string;
  onClose: () => void;
  onViewCV: (candidate: CandidateCard) => void;
  onViewFullDetails: () => void;
  onViewAIInterview: () => void;
  onRegenerate: () => void | Promise<void>;

  isLoading: boolean;
  isRegenerating: boolean;
  regenerateError: string | null;

  cvData: any[] | null;
  cvReason: string | null; // legacy
  fitLabel: string | null; // legacy
  tooltipHtml: string; // legacy
  pdfCandidate: any;
  interviewDetails?: any | null;

  pipelineStages: PipelineStage[];
  evaluationsByStageId: Record<string, any | null>;
  loading: {
    cv: boolean;
    pipeline: boolean;
    evaluations: boolean;
  };
};

export default function CandidateAnalysisView({
  candidate,
  stageLabel,
  onClose,
  onViewCV,
  onViewFullDetails,
  onViewAIInterview,
  onRegenerate,
  isLoading: _isLoading,
  isRegenerating,
  regenerateError,
  cvData,
  cvReason: _cvReason,
  fitLabel: _fitLabel,
  tooltipHtml: _tooltipHtml,
  pdfCandidate,
  interviewDetails,
  pipelineStages,
  evaluationsByStageId,
  loading,
}: Props) {
  const [openStageIds, setOpenStageIds] = React.useState<string[]>([]);
  const didInitOpenRef = React.useRef(false);

  function getFitLabelStyle(status: string | null): { bgColor: string; strokeColor: string; textColor: string } {
    if (!status) return { bgColor: "#F2F4F7", strokeColor: "#EAECF0", textColor: "#344054" };

    const lower = status.toLowerCase();
    if (lower.includes("strong")) return { bgColor: "#ECFDF3", strokeColor: "#ABEFC6", textColor: "#067647" };
    if (lower.includes("good")) return { bgColor: "#EFF8FF", strokeColor: "#B2DDFF", textColor: "#175CD3" };
    if (lower.includes("maybe")) return { bgColor: "#FFFAEB", strokeColor: "#FEDF89", textColor: "#B54708" };
    if (lower.includes("bad") || lower.includes("not")) return { bgColor: "#FEF3F2", strokeColor: "#FECDCA", textColor: "#B42318" };
    return { bgColor: "#F2F4F7", strokeColor: "#EAECF0", textColor: "#344054" };
  }

  function MatchFitBadge({ fit, assessmentHtml }: { fit: string; assessmentHtml?: string | null }) {
    const style = getFitLabelStyle(fit || null);
    return (
      <a data-tooltip-id="career-fit-tooltip" data-tooltip-html={assessmentHtml || "No assessment available"}>
        <Label
          bgColor={style.bgColor}
          strokeColor={style.strokeColor}
          textColor={style.textColor}
          style={{ fontSize: 14, fontWeight: 500, cursor: "pointer" }}
        >
          {fit}
        </Label>
      </a>
    );
  }

  const currentStageName = React.useMemo(() => {
    if (!stageLabel) return null;
    // stageLabel format: "{groupTitle} · {columnTitle}"
    const parts = String(stageLabel).split("·");
    return (parts[0] || "").trim() || null;
  }, [stageLabel]);

  const visibleStages = React.useMemo(() => {
    const allStages = Array.isArray(pipelineStages) ? pipelineStages : [];
    // Filter out disabled stages, BUT always keep core stages (CV Screening, AI Interview)
    // because they contain inherited/transferred data that should be displayed
    const stages = allStages.filter((s) => {
      // Always show core stages (id "1" = CV Screening, id "2" = AI Interview)
      if (s?.id === "1" || s?.id === "2") return true;
      // For other stages, filter out disabled ones
      return s?.enabled !== false;
    });
    // Match recruiter CandidateMenu:
    // - Remove last stage (Job Offer)
    // - Only include up to candidate's current stage
    // - Reverse so latest stage is on top
    const stageIndex = currentStageName ? stages.findIndex((s) => s?.name === currentStageName) : -1;
    const effectiveIndex = stageIndex >= 0 ? stageIndex : Math.max(stages.length - 2, 0);
    return stages.slice(0, -1).filter((_s, idx) => idx <= effectiveIndex).reverse();
  }, [currentStageName, pipelineStages]);

  // UX: open the top stage by default (once), but allow collapsing everything.
  React.useEffect(() => {
    if (didInitOpenRef.current) return;
    if (!visibleStages.length) return;
    const firstId = visibleStages[0]?.id;
    if (firstId == null) return;
    setOpenStageIds([String(firstId)]);
    didInitOpenRef.current = true;
  }, [visibleStages]);

  const toggleStage = (stageId: string) => {
    setOpenStageIds((prev) => {
      const isOpen = prev.includes(stageId);
      if (isOpen) {
        return prev.filter((id) => id !== stageId);
      }

      return [...prev, stageId];
    });
  };

  const aiStageId = React.useMemo(() => {
    const stages = Array.isArray(pipelineStages) ? pipelineStages : [];
    const ai = stages.find((s) => {
      const name = (s?.name || "").toLowerCase();
      return name.includes("ai") && name.includes("interview");
    });
    return ai?.id != null ? String(ai.id) : null;
  }, [pipelineStages]);

  const shouldLoadAIInterview = aiStageId ? openStageIds.includes(aiStageId) : false;

  const aiInterview = useAIInterviewData(
    shouldLoadAIInterview ? candidate?.interviewID || null : null,
    shouldLoadAIInterview ? candidate?.id || null : null
  );

  const getStageType = (stage: PipelineStage): "cv" | "ai" | "custom" => {
    const name = (stage?.name || "").toLowerCase();
    if (name.includes("cv") && name.includes("screening")) return "cv";
    if (name.includes("ai") && name.includes("interview")) return "ai";
    return "custom";
  };

  const StageIcon = ({ stage }: { stage: PipelineStage }) => {
    const stageName = (stage?.name || "").toLowerCase();
    const icon = stage?.icon;
    const className =
      icon ||
      (stageName.includes("cv") && stageName.includes("screening")
        ? "la la-file-alt"
        : stageName.includes("ai") && stageName.includes("interview")
          ? "la la-microphone"
          : stageName.includes("human") && stageName.includes("interview")
            ? "la la-user"
            : "la la-clipboard-list");

    return (
      <div
        style={{
          width: 32,
          height: 32,
          backgroundColor: "#181D27",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <i className={className} style={{ color: "#FFFFFF", fontSize: 20 }} />
      </div>
    );
  };

  const ChevronDownIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 8L10 13L15 8" stroke="#A4A7AE" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const ChevronUpIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 12L10 7L5 12" stroke="#A4A7AE" strokeWidth="1.67" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const PipelineStagesSkeleton = () => {
    return (
      <SkeletonWrapper>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                border: "1px solid #EAECF0",
                borderRadius: 12,
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 12,
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                  <SkeletonBox width={32} height={32} borderRadius={999} />
                  <SkeletonBox width={220} height={18} borderRadius={6} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <SkeletonBox width={86} height={24} borderRadius={999} />
                  <SkeletonBox width={20} height={20} borderRadius={6} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SkeletonWrapper>
    );
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2000,
          display: "flex",
          justifyContent: "flex-end",
          pointerEvents: "auto",
        }}
      >
        <div
          onClick={onClose}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(16, 24, 40, 0.35)",
          }}
        />

        <div
          style={{
            position: "relative",
            width: 720,
            maxWidth: "92vw",
            height: "100%",
            background: "#fff",
            borderLeft: "1px solid #EAECF0",
            boxShadow: "-16px 0 48px rgba(16, 24, 40, 0.14)",
            display: "flex",
            flexDirection: "column",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid #EAECF0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 650, color: "#101828", lineHeight: 1 }}>
                Candidate Analysis
              </h1>
              <button
                type="button"
                onClick={() => {
                  onViewFullDetails();
                }}
                style={{
                  color: "#414651",
                  border: "1px solid #D5D7DA",
                  borderRadius: 999,
                  background: "#FFFFFF",
                  padding: "6px 12px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}>Full application details</span>
                <i className="la la-external-link-alt" style={{ fontSize: 18 }} />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                border: 0,
                background: "transparent",
                cursor: "pointer",
                padding: 6,
                borderRadius: 8,
                color: "#475467",
              }}
              aria-label="Close"
            >
              <i className="la la-times" />
            </button>
          </div>

          <div style={{ padding: 16, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: 12,
                border: "1px solid #EAECF0",
                borderRadius: 12,
                background: "#F9FAFB",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <img
                  alt={candidate?.name || "Candidate"}
                  src={candidate?.avatar || ""}
                  style={{ width: 40, height: 40, borderRadius: "50%", background: "#E0E0E0", objectFit: "cover" }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 650,
                      color: "#101828",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {candidate?.name || "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "#667085", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {candidate?.email || "—"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-start",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 999,
                  background: "#F8F9FC",
                  border: "1px solid #D5D9EB",
                  padding: "0px 10px",
                  maxWidth: "fit-content",
                  flexShrink: 0,
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4E5BA6" }} />
                <span style={{ fontSize: 14, color: "#363F72", fontWeight: 700, whiteSpace: "nowrap" }}>
                  Stage: {stageLabel || "—"}
                </span>
              </div>
            </div>

            {regenerateError ? <div style={{ fontSize: 12, color: "#B42318" }}>{regenerateError}</div> : null}

            <div style={{ width: "100%", height: 1, background: "#E9EAEB", margin: "4px 0" }} />

            {/* Pipeline stage sections */}
            {loading.pipeline ? (
              <PipelineStagesSkeleton />
            ) : visibleStages.length === 0 ? (
              <div style={{ fontSize: 14, color: "#667085" }}>No pipeline stages configured for this career.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {visibleStages.map((stage) => {
                  const stageId = String(stage.id);
                  const isOpen = openStageIds.includes(stageId);
                  const stageType = getStageType(stage);
                  const recruiterEval = evaluationsByStageId?.[stageId] || null;
                  const canDownloadCv = Array.isArray(cvData) && cvData.length > 0;

                  return (
                    <div key={stageId} style={{ border: "1px solid #EAECF0", borderRadius: 12, background: "#fff" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                          padding: 12,
                        }}
                        onClick={() => toggleStage(stageId)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <StageIcon stage={stage} />
                          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#181D27" }}>{stage.alias || stage.name}</h2>

                          {stageType === "cv" && canDownloadCv ? (
                            <>
                              <button
                                style={{
                                  color: "#414651",
                                  border: "1px solid #D5D7DA",
                                  borderRadius: 60,
                                  background: "#FFFFFF",
                                  padding: "5px 15px",
                                  cursor: "pointer",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onClose();
                                  onViewCV(candidate);
                                }}
                              >
                                <i className="la la-file-alt" style={{ fontSize: 20, marginRight: 5 }} />
                                <span style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}>View CV</span>
                              </button>

                              <div
                                style={{
                                  color: "#414651",
                                  border: "1px solid #D5D7DA",
                                  borderRadius: 60,
                                  background: "#FFFFFF",
                                  padding: "5px 15px",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <i className="la la-download" style={{ fontSize: 20, marginRight: 5 }} />
                                <PDFDownloadLink
                                  key={new Date().toISOString()}
                                  document={<CandidateCVDocument candidate={pdfCandidate} cvData={cvData} includeCVAnalysis={false} />}
                                  fileName={`${candidate?.name || "candidate"}-CV.pdf`}
                                  style={{ color: "#414651" }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {() => (
                                    <span style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}>
                                      Download CV
                                    </span>
                                  )}
                                </PDFDownloadLink>
                              </div>
                            </>
                          ) : null}

                          {stageType === "ai" ? (
                            <button
                              style={{
                                color: "#414651",
                                border: "1px solid #D5D7DA",
                                borderRadius: 60,
                                background: "#FFFFFF",
                                padding: "5px 15px",
                                cursor: "pointer",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewAIInterview();
                              }}
                            >
                              <span style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}>Full analysis & transcript</span>
                              <i className="la la-external-link-alt" style={{ fontSize: 20, marginLeft: 5 }} />
                            </button>
                          ) : null}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {/* Always prioritize recruiter evaluation for ALL stages (same as recruiter sidebar) */}
                          {recruiterEval?.matchFit ? (
                            <MatchFitBadge fit={String(recruiterEval.matchFit)} assessmentHtml={recruiterEval?.evaluationNotes} />
                          ) : stageType === "cv" && interviewDetails?.cvStatus ? (
                            <MatchFitBadge
                              fit={String(interviewDetails.cvStatus)}
                              assessmentHtml={interviewDetails?.cvScreeningReason}
                            />
                          ) : stageType === "ai" && interviewDetails?.jobFit ? (
                            <MatchFitBadge
                              fit={String(interviewDetails.jobFit)}
                              assessmentHtml={
                                interviewDetails?.summary ? extractInterviewAssessment(String(interviewDetails.summary)) : undefined
                              }
                            />
                          ) : null}

                          {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                        </div>
                      </div>

                      {isOpen ? (
                        <>
                          {(loading.evaluations || recruiterEval || stageType === "cv" || stageType === "ai") ? (
                            <div style={{ padding: 12, paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                              {/* Recruiter evaluation for this stage (hide block if none) */}
                              {loading.evaluations ? (
                                <EvaluationByEndorserSkeleton />
                              ) : recruiterEval ? (
                                <EvaluationByEndorser evaluation={recruiterEval} />
                              ) : null}

                              {/* Jia evaluation */}
                              {stageType === "cv" ? (
                                loading.cv ? (
                                  <EvaluationByJiaSkeleton />
                                ) : (
                                  <EvaluationByJia
                                    cvStatus={pdfCandidate?.cvStatus || null}
                                    cvScreeningReason={pdfCandidate?.cvScreeningReason || null}
                                    onRegenerate={async () => onRegenerate()}
                                    isRegenerating={isRegenerating}
                                    hasCV={Array.isArray(cvData) && cvData.length > 0}
                                  />
                                )
                              ) : stageType === "ai" ? (
                                aiInterview?.isLoading ? (
                                  <AIInterviewSkeleton />
                                ) : (
                                  <>
                                    <InterviewAnalysis analysis={aiInterview?.analysis || null} />
                                    <InterviewSummary summary={aiInterview?.summary || null} />
                                    <InterviewTranscript
                                      transcripts={Array.isArray(aiInterview?.transcripts) ? aiInterview.transcripts : []}
                                      candidateName={aiInterview?.candidateName || candidate?.name || "Candidate"}
                                    />
                                    <VideoRecording recording={aiInterview?.interviewRecording || null} />
                                  </>
                                )
                              ) : null}
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Tooltip className="career-fit-tooltip fade-in" id="career-fit-tooltip" clickable={true}/>
    </>
  );
}
