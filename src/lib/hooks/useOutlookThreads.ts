"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/utils/apiClient";

/**
 * Fetches Outlook threads and messages (sync + threads + all-messages).
 * refetch() triggers the same flow as outlook-test "Refresh threads".
 */
export function useOutlookThreads(orgId: string | null | undefined) {
  const [outlookThreads, setOutlookThreads] = useState<any[]>([]);
  const [outlookMessages, setOutlookMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [outlookTokenExpired, setOutlookTokenExpired] = useState(false);

  useEffect(() => {
    if (!orgId) {
      setOutlookThreads([]);
      setOutlookMessages([]);
      setOutlookTokenExpired(false);
      return;
    }

    let mounted = true;

    async function fetchOutlookData() {
      try {
        setIsLoading(true);
        setOutlookTokenExpired(false);
        await apiClient.get("/api/outlook/email", { params: { orgID: orgId } });
        if (!mounted) return;
        const threadsRes = await apiClient.get("/api/outlook/threads", {
          params: { orgID: orgId, limit: 50, onlyMine: "true" },
        });
        const rawThreads = threadsRes.data?.threads || [];
        if (rawThreads.length === 0) {
          setOutlookThreads([]);
          setOutlookMessages([]);
          setLastSync(new Date());
          return;
        }
        const messagesRes = await apiClient.get("/api/outlook/all-messages", {
          params: { orgID: orgId },
        });
        if (!mounted) return;
        setOutlookThreads(rawThreads);
        setOutlookMessages(messagesRes.data?.messages || []);
        setLastSync(new Date());
      } catch (err: any) {
        console.error("Error fetching Outlook threads:", err);
        setOutlookThreads([]);
        setOutlookMessages([]);
        const data = err?.response?.data;
        const status = err?.response?.status;
        const message = String(data?.error || err?.message || "").toLowerCase();
        const isTokenExpired =
          status === 401 ||
          data?.outlookTokenExpired === true ||
          message.includes("credentials") ||
          message.includes("invalid_grant") ||
          message.includes("aadsts");
        setOutlookTokenExpired(isTokenExpired);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOutlookData();
  }, [orgId, refreshTrigger]);

  const refetch = () => setRefreshTrigger((prev) => prev + 1);

  return {
    outlookThreads,
    outlookMessages,
    isLoading,
    refetch,
    lastSync,
    outlookTokenExpired,
  };
}
