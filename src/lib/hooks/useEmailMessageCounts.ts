import { useState, useEffect } from "react";
import { apiClient } from "@/lib/utils/apiClient";

export interface EmailMessageCounts {
  total: number;
  automated: number;
  direct: number;
}

export interface UseEmailMessageCountsReturn {
  counts: EmailMessageCounts;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch email message counts (total, automated, direct) for an organization
 */
export function useEmailMessageCounts(
  orgId: string | null | undefined
): UseEmailMessageCountsReturn {
  const [counts, setCounts] = useState<EmailMessageCounts>({
    total: 0,
    automated: 0,
    direct: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!orgId) {
      setCounts({ total: 0, automated: 0, direct: 0 });
      return;
    }

    let mounted = true;

    async function fetchCounts() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await apiClient.get(
          "/api/mailgun-module/mg-get-message-counts",
          {
            params: { orgId },
          }
        );

        if (!mounted) return;

        const fetchedCounts = response.data?.counts || {
          total: 0,
          automated: 0,
          direct: 0,
        };

        setCounts(fetchedCounts);
      } catch (err: any) {
        console.error("Failed to fetch message counts:", err);
        if (mounted) {
          setError(
            err.response?.data?.error || "Failed to fetch message counts"
          );
          setCounts({ total: 0, automated: 0, direct: 0 });
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchCounts();

    return () => {
      mounted = false;
    };
  }, [orgId, refreshTrigger]);

  const refetch = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return {
    counts,
    isLoading,
    error,
    refetch,
  };
}
