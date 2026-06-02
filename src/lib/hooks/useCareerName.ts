import { useState, useEffect } from "react";
import { apiClient } from "@/lib/utils/apiClient";

export interface UseCareerNameReturn {
  careerName: string | null;
  isLoading: boolean;
}

// Hook to fetch the career name (jobTitle) from the careers collection
// Uses the "id" field (not "_id") to find the career
export function useCareerName(
  careerId: string | null | undefined,
  orgId: string | null | undefined
): UseCareerNameReturn {
  const [careerName, setCareerName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchCareerName = async () => {
      if (!careerId || !orgId) {
        setCareerName(null);
        return;
      }

      setIsLoading(true);
      try {
        // Fetch career directly from careers collection using the "id" field
        const response = await apiClient.post("/api/career-data", {
          id: careerId,
          orgID: orgId,
        });

        const career = response.data;
        setCareerName(career?.jobTitle || null);
      } catch (err) {
        console.error("Failed to fetch career name:", err);
        setCareerName(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCareerName();
  }, [careerId, orgId]);

  return { careerName, isLoading };
}
