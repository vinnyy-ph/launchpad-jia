"use client";

import { useMemo, useCallback } from "react";
import { useCVData, useOrgSkills, useInterviewData, extractSkillsFromCv } from "../../CandidateCVUtils";

export type CandidateDetailsData = {
  interviewData: any | null;
  cvData: any | null;
  orgSkills: string[] | null;
  cvSkills: string[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useCandidateDetailsData(
  interviewID: string | null,
  candidateEmail: string | null,
  guestOrgId: string | null
): CandidateDetailsData {
  const {
    interviewData,
    isLoading: isInterviewLoading,
    error: interviewError,
    refetch: refetchInterview,
  } = useInterviewData(interviewID, guestOrgId);

  const {
    cvData,
    isLoading: isCVLoading,
    error: cvError,
    refetch: refetchCV,
  } = useCVData(candidateEmail);

  const { orgSkills: orgSkillsArray, isLoading: isOrgSkillsLoading } = useOrgSkills(
    candidateEmail,
    guestOrgId
  );

  const isLoading = isInterviewLoading || isCVLoading || isOrgSkillsLoading;
  const error = interviewError || cvError;

  const cvSkills = useMemo(() => {
    return extractSkillsFromCv(cvData);
  }, [cvData]);

  const orgSkills = useMemo(() => {
    return orgSkillsArray.length > 0 ? orgSkillsArray : null;
  }, [orgSkillsArray]);

  const cvSkillsResult = useMemo(() => {
    return cvSkills.length > 0 ? cvSkills : null;
  }, [cvSkills]);

  const refetch = useCallback(() => {
    refetchInterview();
    refetchCV();
  }, [refetchInterview, refetchCV]);

  return {
    interviewData,
    cvData,
    orgSkills,
    cvSkills: cvSkillsResult,
    isLoading,
    error,
    refetch,
  };
}
