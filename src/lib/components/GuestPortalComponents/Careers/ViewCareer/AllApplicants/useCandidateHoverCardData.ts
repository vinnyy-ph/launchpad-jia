"use client";

import { useMemo } from "react";
import { useCVData, useOrgSkills, extractSkillsFromCv, sanitizeLocation } from "../CandidateCVUtils";

export function useCandidateHoverCardData(candidateEmail: string, guestOrgId: string | null) {
  const { cvData, isLoading: isCVLoading } = useCVData(candidateEmail);
  const { orgSkills, isLoading: isOrgSkillsLoading } = useOrgSkills(candidateEmail, guestOrgId);

  const isLoading = isCVLoading || isOrgSkillsLoading;

  const phone = useMemo(() => {
    return cvData?.phone ? String(cvData.phone) : null;
  }, [cvData?.phone]);

  const location = useMemo(() => {
    return sanitizeLocation(cvData?.location);
  }, [cvData?.location]);

  const cvSkills = useMemo(() => {
    return extractSkillsFromCv(cvData);
  }, [cvData]);

  const resolvedSkills = useMemo(() => {
    if (Array.isArray(orgSkills) && orgSkills.length > 0) {
      return orgSkills;
    }
    if (cvSkills.length > 0) {
      return cvSkills;
    }
    return [];
  }, [orgSkills, cvSkills]);

  return {
    isLoading,
    phone,
    location,
    resolvedSkills,
  };
}
