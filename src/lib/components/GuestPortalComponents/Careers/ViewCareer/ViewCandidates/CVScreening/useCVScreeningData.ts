"use client";

import { useMemo, useCallback } from "react";
import {
  useCVData,
  useInterviewData,
  useRegenerateCV,
} from "../../CandidateCVUtils";

export type CVSection = {
  name: string;
  content: string;
};

export type PreScreeningAnswer = {
  id?: string;
  type?: string; // "Minimum" | "Maximum" for range questions
  value?: string | number;
  text?: string;
};

export type PreScreeningQuestion = {
  id: string;
  questionType?: string;
  questionFormat?: string; // "Single Choice" | "Multiple Choice" | "Range" | "Open-ended"
  question: string;
  selectedAnswers?: (PreScreeningAnswer | string)[];
  answers?: { id: string; text: string; type?: string }[]; // Available answer options
};

export type RecruiterEvaluation = {
  _id?: string;
  stageId: string;
  substageId: string;
  interviewUID: string;
  evaluationNotes: string;
  matchFit?: string;
  action?: string;
  updatedBy: {
    name?: string;
    image?: string;
    email?: string;
  };
  createdBy?: {
    name?: string;
    image?: string;
    email?: string;
  };
  createdAt?: string;
};

export type CVScreeningData = {
  digitalCV: CVSection[] | null;
  cvStatus: string | null;
  cvScreeningReason: string | null;
  preScreeningQuestions: PreScreeningQuestion[] | null;
  candidateName: string | null;
  candidateEmail: string;
  cvUploadedAt: string | null;
  cvFileInfo: any | null;
  isLoading: boolean;
  error: string | null;
  regenerate: () => Promise<void>;
  isRegenerating: boolean;
  refetchCV: () => void;
  refetchInterview: () => void;
};

/**
 * Hook for fetching CV screening data (CV, pre-screening questions, etc.)
 * Note: Recruiter evaluations are now handled by useAllStageEvaluations in the parent component
 * @param interviewID - The interview ID (used for CV/interview data)
 * @param candidateEmail - The candidate's email address
 * @param orgId - Optional organization ID
 * @param interviewUID - The MongoDB _id of the interview (unused, kept for API compatibility)
 */
export function useCVScreeningData(
  interviewID: string,
  candidateEmail: string,
  orgId?: string | null,
  interviewUID?: string | null
): CVScreeningData {
  // Get orgId from localStorage if not provided
  const resolvedOrgId = useMemo(() => {
    if (orgId) return orgId;
    try {
      if (typeof window === "undefined") return null;
      const guestOrg = localStorage.getItem("guestOrg");
      return guestOrg ? JSON.parse(guestOrg)._id : null;
    } catch {
      return null;
    }
  }, [orgId]);

  // Use the shared cached hooks
  const {
    cvData,
    digitalCV: rawDigitalCV,
    isLoading: isCVLoading,
    error: cvError,
    refetch: refetchCV,
  } = useCVData(candidateEmail || null);

  const {
    interviewData,
    isLoading: isInterviewLoading,
    error: interviewError,
    refetch: refetchInterview,
  } = useInterviewData(interviewID || null, resolvedOrgId);

  // Callback to refetch both CV and interview data
  const refetchAll = useCallback(() => {
    refetchCV();
    refetchInterview();
  }, [refetchCV, refetchInterview]);

  // Use regenerate hook with refetch callback
  const {
    regenerate,
    isLoading: isRegenerating,
    error: regenerateError,
  } = useRegenerateCV(interviewID, candidateEmail, refetchAll);

  // Combine loading states
  const isLoading = isCVLoading || isInterviewLoading;

  // Combine errors
  const error = useMemo(() => {
    if (cvError && interviewError) {
      return cvError || interviewError;
    }
    if (regenerateError) {
      return regenerateError;
    }
    return null;
  }, [cvError, interviewError, regenerateError]);

  // Extract data from interview
  const cvStatus = interviewData?.cvStatus || null;
  const cvScreeningReason = interviewData?.cvScreeningReason || null;
  const preScreeningQuestions = interviewData?.preScreeningQuestions || null;
  const candidateName = interviewData?.name || cvData?.name || null;
  const cvUploadedAt = cvData?.updatedAt || null;
  const cvFileInfo = cvData?.fileInfo || null;

  // Ensure digitalCV is properly typed
  const digitalCV: CVSection[] | null = Array.isArray(rawDigitalCV) && rawDigitalCV.length > 0
    ? rawDigitalCV
    : null;

  return {
    digitalCV,
    cvStatus,
    cvScreeningReason,
    preScreeningQuestions,
    candidateName,
    candidateEmail,
    cvUploadedAt,
    cvFileInfo,
    isLoading,
    error,
    regenerate,
    isRegenerating,
    refetchCV,
    refetchInterview,
  };
}
