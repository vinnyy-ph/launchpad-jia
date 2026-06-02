"use client";

// Re-export useCVData from shared CandidateCVUtils for backwards compatibility
// Components using this can also import directly from "../CandidateCVUtils"
import { useCVData } from "../CandidateCVUtils";

export function useCandidateCVData(candidateEmail?: string | null) {
  const { cvData, digitalCV, isLoading, error, refetch } = useCVData(candidateEmail || null);

  // Return in the original format for backwards compatibility
  return {
    isLoading,
    error,
    cvData: digitalCV, // Original hook returned digitalCV array as cvData
    refetch,
  };
}
