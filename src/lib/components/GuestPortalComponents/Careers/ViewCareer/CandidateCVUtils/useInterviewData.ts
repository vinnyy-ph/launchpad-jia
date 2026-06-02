"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/utils/apiClient";
import { useCandidateCache } from "./CandidateCacheContext";

export type InterviewDataResult = {
  interviewData: any | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

/**
 * Hook for fetching interview details with caching support
 * @param interviewId - The interview ID
 * @param orgId - The organization ID (optional)
 * @returns Interview data, loading state, error, and refetch function
 */
export function useInterviewData(interviewId: string | null, orgId: string | null): InterviewDataResult {
  const cache = useCandidateCache();
  const [interviewData, setInterviewData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    // Invalidate cache when explicitly refetching
    if (interviewId) {
      cache.invalidateInterviewCache(interviewId);
    }
    setRefetchTrigger((prev) => prev + 1);
  }, [interviewId, cache]);

  useEffect(() => {
    if (!interviewId) {
      setInterviewData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check cache first (cache is invalidated by refetch() so no need to check refetchTrigger)
    const cached = cache.getInterviewCache(interviewId);
    if (cached) {
      // Use cached data immediately
      setInterviewData(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    let mounted = true;
    const controller = new AbortController();

    const fetchInterviewData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await api.post(
          "/api/interview-details",
          { id: interviewId, orgID: orgId },
          { signal: controller.signal }
        );

        if (!mounted) return;

        const data = response?.data || null;
        
        // Store in cache
        cache.setInterviewCache(interviewId, data);
        
        setInterviewData(data);
      } catch (err: any) {
        if (controller.signal.aborted) return;
        if (!mounted) return;
        setError(err?.message || "Failed to load interview details");
        setInterviewData(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchInterviewData();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [interviewId, orgId, refetchTrigger, cache]);

  return {
    interviewData,
    isLoading,
    error,
    refetch,
  };
}
