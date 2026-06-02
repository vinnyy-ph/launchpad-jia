/**
 * Custom hook for fetching tab badge counts
 * Displays count of new/unvisited items for careers and requisitions tabs
 */

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/utils/apiClient";

interface TabBadgeCounts {
  careers: number;
  requisitions: number;
}

export function useTabBadges(orgID: string | null, enabled: boolean) {
  const [counts, setCounts] = useState<TabBadgeCounts>({
    careers: 0,
    requisitions: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    if (!enabled || !orgID) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.get(`/api/tabs/count-new-items?orgID=${orgID}`);

      setCounts({
        careers: res.data.careers || 0,
        requisitions: res.data.requisitions || 0,
      });
    } catch (error) {
      console.error("Failed to fetch tab badges:", error);
      // Reset to zero on error to avoid showing stale data
      setCounts({ careers: 0, requisitions: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [orgID, enabled]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return { counts, isLoading, refresh: fetchCounts };
}
