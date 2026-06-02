"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/utils/apiClient";
import { useCandidateCache } from "./CandidateCacheContext";

export type OrgSkillsResult = {
  orgSkills: string[];
  isLoading: boolean;
};

/**
 * Hook for fetching organization-curated candidate skills with caching support
 * @param candidateEmail - The candidate's email address
 * @param orgId - The organization ID
 * @returns Org skills array and loading state
 */
export function useOrgSkills(candidateEmail: string | null, orgId: string | null): OrgSkillsResult {
  const cache = useCandidateCache();
  const [orgSkills, setOrgSkills] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!candidateEmail || !orgId) {
      setOrgSkills([]);
      setIsLoading(false);
      return;
    }

    // Check cache first
    const cached = cache.getOrgSkillsCache(candidateEmail, orgId);
    if (cached) {
      setOrgSkills(cached);
      setIsLoading(false);
      return;
    }

    let mounted = true;
    const controller = new AbortController();

    const fetchOrgSkills = async () => {
      try {
        setIsLoading(true);

        const response = await api.get(
          `/api/get-org-candidate-skills?candidateEmail=${encodeURIComponent(candidateEmail)}&orgID=${encodeURIComponent(orgId)}`,
          { signal: controller.signal }
        );

        if (!mounted) return;

        const orgItems = response?.data?.items || [];
        const skillNames = (Array.isArray(orgItems) ? orgItems : [])
          .map((it: any) => it?.skillName)
          .filter((s: any) => !!s);

        // Store in cache
        cache.setOrgSkillsCache(candidateEmail, orgId, skillNames);

        setOrgSkills(skillNames);
      } catch {
        if (controller.signal.aborted) return;
        if (mounted) setOrgSkills([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchOrgSkills();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [candidateEmail, orgId, cache]);

  return {
    orgSkills,
    isLoading,
  };
}
