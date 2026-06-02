"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/utils/apiClient";
import { useCandidateCache } from "./CandidateCacheContext";

export type RegenerateCVResult = {
  regenerate: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
};

/**
 * Hook for regenerating CV analysis
 * @param interviewID - The interview ID
 * @param candidateEmail - The candidate's email address
 * @param onSuccess - Optional callback to run after successful regeneration (e.g., refetch data)
 * @returns Regenerate function, loading state, error, and clearError function
 */
export function useRegenerateCV(
  interviewID: string | null,
  candidateEmail: string | null,
  onSuccess?: () => void
): RegenerateCVResult {
  const cache = useCandidateCache();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const regenerate = useCallback(async () => {
    if (!interviewID || !candidateEmail || isLoading) return;

    try {
      setIsLoading(true);
      setError(null);

      await api.post("/api/analyze-cv", {
        interviewID,
        userEmail: candidateEmail,
      });

      // Invalidate cache for this candidate so fresh data is fetched
      cache.invalidateAllForEmail(candidateEmail);
      if (interviewID) {
        cache.invalidateInterviewCache(interviewID);
      }

      // Call success callback to refresh data
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error("Failed to regenerate CV:", err);
      setError(err?.message || "Failed to regenerate CV analysis. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [interviewID, candidateEmail, isLoading, onSuccess, cache]);

  return {
    regenerate,
    isLoading,
    error,
    clearError,
  };
}
