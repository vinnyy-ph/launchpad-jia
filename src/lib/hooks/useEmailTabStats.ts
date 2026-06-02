import { useState, useEffect } from "react";
import { apiClient } from "@/lib/utils/apiClient";

export interface EmailTabStats {
  totalThreadCount: number;
  totalMessageCount: number;
  automatedCount: number;
  directCount: number;
  unreadThreadCount: number;
}

interface UseEmailTabStatsReturn {
  stats: EmailTabStats | null;
  isLoading: boolean;
  refetch: () => void;
}

/**
 * Fetches lightweight tab stats (total threads, total messages, automated/direct, unread)
 * for the given tab and optional campaignId. Use for header counts so the actual numbers
 * show immediately without loading all thread data.
 */
export function useEmailTabStats(
  orgId: string | null | undefined,
  campaignId: string | undefined,
  tab: string,
): UseEmailTabStatsReturn {
  const [stats, setStats] = useState<EmailTabStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    if (!orgId) {
      setStats(null);
      setIsLoading(false);
      return;
    }

    const effectiveTab =
      tab === "Scheduled" ? "Inbox" : tab;
    if (
      effectiveTab !== "Inbox" &&
      effectiveTab !== "Sent" &&
      effectiveTab !== "Drafts"
    ) {
      setStats(null);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function fetchStats() {
      try {
        setIsLoading(true);
        const params: any = { orgId, tab: effectiveTab };
        if (campaignId) params.campaignId = campaignId;
        const response = await apiClient.get(
          "/api/mailgun-module/mg-tab-stats",
          { params },
        );
        if (!mounted) return;
        const d = response.data;
        setStats({
          totalThreadCount: typeof d?.totalThreadCount === "number" ? d.totalThreadCount : 0,
          totalMessageCount: typeof d?.totalMessageCount === "number" ? d.totalMessageCount : 0,
          automatedCount: typeof d?.automatedCount === "number" ? d.automatedCount : 0,
          directCount: typeof d?.directCount === "number" ? d.directCount : 0,
          unreadThreadCount: typeof d?.unreadThreadCount === "number" ? d.unreadThreadCount : 0,
        });
      } catch (err) {
        console.error("Failed to fetch tab stats:", err);
        if (mounted) setStats(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    fetchStats();
    return () => {
      mounted = false;
    };
  }, [orgId, campaignId, tab, trigger]);

  const refetch = () => setTrigger((t) => t + 1);

  return { stats, isLoading, refetch };
}
