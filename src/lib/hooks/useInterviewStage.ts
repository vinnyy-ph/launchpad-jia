import { useState, useEffect, useRef } from "react";
import { apiClient } from "@/lib/utils/apiClient";

export interface UseInterviewStageReturn {
  stage: string | null;
  isLoading: boolean;
}

// Global cache for interview stages to avoid refetching the same data
// Key format: "orgId:careerId:applicantEmail"
const stageCache = new Map<
  string,
  { stage: string | null; timestamp: number }
>();
const CACHE_DURATION = 60000; // 1 minute cache

// Hook to fetch the current interview stage for an applicant in a specific career
export function useInterviewStage(
  applicantEmail: string | null,
  careerId: string | null | undefined,
  orgId: string | null | undefined,
): UseInterviewStageReturn {
  const [stage, setStage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchInterviewStage = async () => {
      // Validate all required parameters - check for null, undefined, empty strings
      const trimmedEmail = applicantEmail?.trim();
      const trimmedCareerId = careerId?.trim();
      const trimmedOrgId = orgId?.trim();

      if (!trimmedCareerId || !trimmedEmail || !trimmedOrgId) {
        setStage(null);
        setIsLoading(false);
        return;
      }

      // Check cache first
      const cacheKey = `${trimmedOrgId}:${trimmedCareerId}:${trimmedEmail}`;
      const cached = stageCache.get(cacheKey);
      const now = Date.now();

      if (cached && now - cached.timestamp < CACHE_DURATION) {
        setStage(cached.stage);
        return;
      }

      setIsLoading(true);
      try {
        const response = await apiClient.get(
          "/api/mailgun-module/mg-get-interview-stage",
          {
            params: {
              applicantEmail: trimmedEmail,
              careerId: trimmedCareerId,
              orgId: trimmedOrgId,
            },
          },
        );

        if (!mountedRef.current) return;

        const fetchedStage = response.data?.stage || null;
        setStage(fetchedStage);

        // Update cache
        stageCache.set(cacheKey, { stage: fetchedStage, timestamp: now });
      } catch (err) {
        console.error("Failed to fetch interview stage:", err);
        if (mountedRef.current) {
          setStage(null);
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchInterviewStage();
  }, [careerId, applicantEmail, orgId]);

  return { stage, isLoading };
}
