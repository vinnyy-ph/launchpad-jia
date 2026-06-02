import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/utils/apiClient";
import type { Requisition } from "../types";

interface UseRequisitionsTableOptions {
  orgID?: string;
  autoFetch?: boolean;
}

export function useRequisitionsTable(options?: UseRequisitionsTableOptions) {
  const { autoFetch = true } = options || {};
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRequisitions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Get orgID from localStorage (activeOrg for recruiter, guestOrg for guest)
      let orgID = options?.orgID;
      
      if (!orgID && typeof window !== 'undefined') {
        const activeOrg = localStorage.getItem("activeOrg");
        if (activeOrg) {
          try {
            const parsedOrg = JSON.parse(activeOrg);
            orgID = parsedOrg._id;
          } catch (e) {
            console.error("Failed to parse activeOrg:", e);
          }
        }
      }

      if (!orgID) {
        throw new Error("Organization ID not found");
      }

      // Use apiClient which automatically adds auth token
      // Include badges parameter to get badge indicators
      const response = await api.get(`/api/requisitions?orgID=${orgID}&includeBadges=true`);

      if (response.data.success) {
        setRequisitions(response.data.requisitions || []);
      } else {
        throw new Error(response.data.message || 'Failed to fetch requisitions');
      }
    } catch (err) {
      console.error("Error fetching requisitions:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch requisitions"));
      setRequisitions([]); // Clear requisitions on error
    } finally {
      setIsLoading(false);
    }
  }, [options?.orgID]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchRequisitions();
    }
  }, [autoFetch, fetchRequisitions]);

  const refetchRequisitions = useCallback(() => {
    return fetchRequisitions();
  }, [fetchRequisitions]);

  return {
    requisitions,
    isLoading,
    error,
    fetchRequisitions,
    refetchRequisitions,
  };
}
