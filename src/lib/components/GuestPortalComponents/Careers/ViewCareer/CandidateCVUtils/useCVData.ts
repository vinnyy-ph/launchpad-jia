"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/utils/apiClient";
import { useCandidateCache } from "./CandidateCacheContext";

export type CVDataResult = {
  cvData: any | null;
  digitalCV: any[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

/**
 * Hook for fetching candidate CV data with caching support
 * @param candidateEmail - The candidate's email address
 * @returns CV data, loading state, error, and refetch function
 */
export function useCVData(candidateEmail: string | null): CVDataResult {
  const cache = useCandidateCache();
  const [cvData, setCvData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    // Invalidate cache when explicitly refetching
    if (candidateEmail) {
      cache.invalidateCVCache(candidateEmail);
    }
    setRefetchTrigger((prev) => prev + 1);
  }, [candidateEmail, cache]);

  useEffect(() => {
    if (!candidateEmail) {
      setCvData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check cache first (cache is invalidated by refetch() so no need to check refetchTrigger)
    const cached = cache.getCVCache(candidateEmail);
    if (cached) {
      // Use cached data immediately
      setCvData(cached.cvData);
      setIsLoading(false);
      setError(null);
      return;
    }

    let mounted = true;
    const controller = new AbortController();

    const fetchCVData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await api.post(
          "/api/load-user-cv",
          { email: candidateEmail },
          { signal: controller.signal }
        );

        if (!mounted) return;

        const err = response?.data?.error ? String(response.data.error) : null;
        if (err) {
          setError(err);
          setCvData(null);
          return;
        }

        const data = response?.data || null;
        
        // Store in cache
        cache.setCVCache(candidateEmail, data);
        
        setCvData(data);
      } catch (err: any) {
        if (controller.signal.aborted) return;
        if (!mounted) return;
        setError(err?.message || "Failed to load candidate CV");
        setCvData(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchCVData();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [candidateEmail, refetchTrigger, cache]);

  const digitalCV = Array.isArray(cvData?.digitalCV) ? cvData.digitalCV : [];

  return {
    cvData,
    digitalCV,
    isLoading,
    error,
    refetch,
  };
}
