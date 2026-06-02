"use client";

import React from "react";
import { api } from "@/lib/utils/apiClient";
import type { CandidateCard } from "../kanban/types";
import { useCVScreeningData } from "../../ViewCandidates/CVScreening";
import type { PipelineStage } from "../useViewCareerData";

function stripHtml(html: string): string {
  if (!html) return "";
  try {
    if (typeof window === "undefined") {
      return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }
    const doc = new DOMParser().parseFromString(html, "text/html");
    return (doc.body?.textContent || "").replace(/\s+/g, " ").trim();
  } catch {
    return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
}

export function useCandidateAnalysisDrawer(params: { careerId: string; candidate: CandidateCard; jobTitle: string }) {
  const { careerId, candidate, jobTitle } = params;

  const [interviewDetails, setInterviewDetails] = React.useState<any | null>(null);
  const [pipelineStages, setPipelineStages] = React.useState<PipelineStage[]>([]);
  const [isPipelineLoading, setIsPipelineLoading] = React.useState(false);
  const [evaluations, setEvaluations] = React.useState<any[]>([]);
  const [isEvaluationsLoading, setIsEvaluationsLoading] = React.useState(false);

  const [isRegenerating, setIsRegenerating] = React.useState(false);
  const [regenerateError, setRegenerateError] = React.useState<string | null>(null);
  const [overrideCvStatus, setOverrideCvStatus] = React.useState<string | null>(null);
  const [overrideCvReason, setOverrideCvReason] = React.useState<string | null>(null);

  React.useEffect(() => {
    // When navigating between careers/candidates while the drawer stays mounted,
    // ensure we do not keep showing the previous interview's data.
    setInterviewDetails(null);
    setPipelineStages([]);

    let didCancel = false;

    const fetchInterviewDetails = async () => {
      if (!candidate?.interviewID) return;
      try {
        setIsPipelineLoading(true);
        const guestOrg = localStorage.getItem("guestOrg");
        const orgID = guestOrg ? JSON.parse(guestOrg)._id : null;
        const res = await api.post("/api/interview-details", { id: candidate.interviewID, orgID });
        const details = res?.data || null;
        const stages = Array.isArray(details?.pipelineStages) ? details.pipelineStages : [];
        if (!didCancel) {
          setInterviewDetails(details);
          setPipelineStages(stages);
        }
      } catch (e) {
        // leave empty; UI will show message
      } finally {
        if (!didCancel) setIsPipelineLoading(false);
      }
    };

    fetchInterviewDetails();

    return () => {
      didCancel = true;
    };
  }, [careerId, candidate?.interviewID]);

  const {
    digitalCV,
    cvStatus: hookCvStatus,
    cvScreeningReason: hookCvReason,
    preScreeningQuestions,
    isLoading: isCVLoading,
  } = useCVScreeningData(candidate.interviewID, candidate.email);

  const cvData = digitalCV;

  const cvStatus = overrideCvStatus || hookCvStatus || null;
  const cvReason = overrideCvReason || hookCvReason || null;

  const fitLabel = React.useMemo(() => {
    if (cvStatus) return cvStatus;
    if (!candidate?.fit) return null;
    const raw = String(candidate.fit);
    const parts = raw.split(":");
    if (parts.length >= 2) return parts.slice(1).join(":").trim();
    return raw;
  }, [candidate?.fit, cvStatus]);

  const plainReason = React.useMemo(() => stripHtml(cvReason || ""), [cvReason]);
  const tooltipHtml = cvReason || plainReason || "No assessment available";

  const handleRegenerate = React.useCallback(async () => {
    if (!candidate?.interviewID || !candidate?.email) return;

    try {
      setIsRegenerating(true);
      setRegenerateError(null);

      const response = await api.post("/api/analyze-cv", {
        interviewID: candidate.interviewID,
        userEmail: candidate.email,
      });

      const update = response?.data?.update;
      if (update?.cvStatus) setOverrideCvStatus(update.cvStatus);
      if (update?.cvScreeningReason) setOverrideCvReason(update.cvScreeningReason);
      if (!update?.cvStatus && !update?.cvScreeningReason && response?.data?.message) {
        setRegenerateError(String(response.data.message));
      }
    } catch {
      setRegenerateError("Failed to regenerate CV analysis.");
    } finally {
      setIsRegenerating(false);
    }
  }, [candidate?.email, candidate?.interviewID]);

  React.useEffect(() => {
    const fetchRecruiterEvaluations = async () => {
      const mongoInterviewId = interviewDetails?._id || candidate?.id || null;
      if (!mongoInterviewId) return;
      try {
        setIsEvaluationsLoading(true);
        const response = await api.post("/api/get-recruiter-evaluations", {
          interviewID: mongoInterviewId,
        });
        if (response?.status === 200 && Array.isArray(response.data)) {
          setEvaluations(response.data);
        } else {
          setEvaluations([]);
        }
      } catch {
        setEvaluations([]);
      } finally {
        setIsEvaluationsLoading(false);
      }
    };

    fetchRecruiterEvaluations();
  }, [candidate?.id, interviewDetails?._id]);

  const evaluationsByStageId = React.useMemo(() => {
    const getTimeValue = (value: any) => {
      if (!value) return 0;
      const d = new Date(value);
      const t = d.getTime();
      return Number.isFinite(t) ? t : 0;
    };

    const pickLatestByStageId = (stageId: string) => {
      const stage = pipelineStages.find((s) => String(s.id) === String(stageId));
      if (!stage) return null;

      // Get the last substage ID (consistent with recruiter dashboard)
      const lastSubstageId = stage.substages?.[stage.substages.length - 1]?.id;
      if (lastSubstageId == null) return null;

      // Match by BOTH stageId AND substageId
      const items = evaluations.filter(
        (e) => String(e?.stageId) === String(stageId) && String(e?.substageId) === String(lastSubstageId)
      );

      if (items.length <= 1) return items[0] || null;
      return items.reduce((best, cur) => {
        const bestT = Math.max(getTimeValue(best?.updatedAt), getTimeValue(best?.createdAt));
        const curT = Math.max(getTimeValue(cur?.updatedAt), getTimeValue(cur?.createdAt));
        return curT >= bestT ? cur : best;
      }, items[0]);
    };

    const map: Record<string, any | null> = {};
    for (const stage of pipelineStages || []) {
      const stageId = String(stage.id);
      map[stageId] = pickLatestByStageId(stageId);
    }
    return map;
  }, [evaluations, pipelineStages]);

  const pdfCandidate = React.useMemo(() => {
    return {
      name: candidate?.name || "",
      email: candidate?.email || "",
      image: candidate?.avatar || "",
      jobTitle: jobTitle || "",
      cvStatus: cvStatus || undefined,
      cvScreeningReason: cvReason || undefined,
      currentStep: "CV Screening",
    };
  }, [candidate?.avatar, candidate?.email, candidate?.name, cvReason, cvStatus, jobTitle]);

  // Build analysisData object for backward compatibility
  const analysisData = React.useMemo(() => {
    return {
      digitalCV,
      preScreeningQuestions,
      interviewDetails: {
        cvStatus: hookCvStatus,
        cvScreeningReason: hookCvReason,
      },
    };
  }, [digitalCV, preScreeningQuestions, hookCvStatus, hookCvReason]);

  return {
    isLoading: isCVLoading || isPipelineLoading || isEvaluationsLoading,
    analysisData,
    cvData,
    cvStatus,
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
    loading: {
      cv: isCVLoading,
      pipeline: isPipelineLoading,
      evaluations: isEvaluationsLoading,
    },
  };
}
