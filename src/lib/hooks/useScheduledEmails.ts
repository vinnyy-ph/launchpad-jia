import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/utils/apiClient";
import {
  extractEmailFromString,
  extractNameFromEmail,
} from "@/lib/utils/emailCandidate";

export type ScheduledEmailItem = {
  _id: string;
  body: string;
  subject: string;
  to: string | string[];
  cc?: string | string[] | null;
  bcc?: string | string[] | null;
  sender: string;
  senderName: string;
  senderEmail: string;
  senderImage?: string | null;
  mode?: string;
  status: string;
  sendDate: string;
  accountId?: string | null;
  userId?: string | null;
  orgID: string;
  careerId?: string | null;
  threadId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  sentAt?: string | null;
};

interface UseScheduledEmailsReturn {
  scheduledEmails: ScheduledEmailItem[];
  isLoading: boolean;
  refetch: () => void;
}

/**
 * Fetches scheduled emails from schedule-email collection (status=active only).
 * Used for the Scheduled tab to show emails not yet sent.
 */
export function useScheduledEmails(
  orgID: string | null | undefined,
): UseScheduledEmailsReturn {
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmailItem[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refetch = useCallback(() => {
    setRefreshTrigger((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!orgID) {
      setScheduledEmails([]);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function fetchScheduled() {
      try {
        setIsLoading(true);
        const response = await apiClient.get("/api/scheduled-emails", {
          params: { orgID, status: "active", limit: 50 },
        });

        if (!mounted) return;

        const data = response.data?.data ?? [];
        const transformedData = (Array.isArray(data) ? data : []).map(
          (email: any) => ({
            ...email,
            senderName:
              extractNameFromEmail(email.sender) || email.sender || "Unknown",
            senderEmail: extractEmailFromString(email.sender) || email.sender,
            senderImage: email.senderImage || null,
          }),
        );
        setScheduledEmails(transformedData);
      } catch (err) {
        console.error("Failed to fetch scheduled emails:", err);
        if (mounted) setScheduledEmails([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    fetchScheduled();
    return () => {
      mounted = false;
    };
  }, [orgID, refreshTrigger]);

  return { scheduledEmails, isLoading, refetch };
}
