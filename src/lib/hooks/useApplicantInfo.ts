import { useMemo } from "react";
import { extractEmailFromString } from "@/lib/utils/emailCandidate";

export interface ThreadMessage {
  id: string;
  threadId?: string;
  senderName?: string;
  senderEmail?: string;
  to?: string | string[];
  direction?: "inbound" | "outbound" | null;
}

export interface ApplicantInfo {
  email: string | null;
  name: string | null;
}

/**
 * Hook to determine applicant email and name from thread messages
 * Uses multiple strategies to identify the applicant:
 * 1. Most common recipient in outbound messages
 * 2. Sender of first inbound message
 * 3. Sender of first message (fallback)
 */
export function useApplicantInfo(
  messages: ThreadMessage[],
  requireCareerId: boolean = false
): ApplicantInfo {
  return useMemo(() => {
    if (messages.length === 0) {
      return { email: null, name: null };
    }

    // Strategy 1: Find the most common recipient in outbound messages
    // (outbound = sent by org, so recipient is likely the applicant)
    const outboundMessages = messages.filter(
      (m) => m.direction === "outbound",
    );

    if (outboundMessages.length > 0) {
      // Count recipient emails from outbound messages
      const recipientCounts = new Map<string, number>();
      outboundMessages.forEach((msg) => {
        const toList = Array.isArray(msg.to) ? msg.to : [msg.to].filter(Boolean);
        toList.forEach((recipient: string) => {
          const email = extractEmailFromString(recipient);
          if (email) {
            const normalized = email.toLowerCase().trim();
            recipientCounts.set(
              normalized,
              (recipientCounts.get(normalized) || 0) + 1,
            );
          }
        });
      });

      // Find the most common recipient
      let maxCount = 0;
      let applicantEmail: string | null = null;
      recipientCounts.forEach((count, email) => {
        if (count > maxCount) {
          maxCount = count;
          applicantEmail = email;
        }
      });

      if (applicantEmail) {
        // Try to get name from senderName of inbound messages
        const inboundMessages = messages.filter(
          (m) => m.direction === "inbound",
        );
        const applicantMessage = inboundMessages.find(
          (m) => m.senderEmail?.toLowerCase() === applicantEmail,
        );
        const applicantName = applicantMessage?.senderName || applicantEmail;

        return { email: applicantEmail, name: applicantName };
      }
    }

    // Strategy 2: Fallback - find sender of first inbound message
    const inboundMessages = messages.filter(
      (m) => m.direction === "inbound",
    );
    if (inboundMessages.length > 0) {
      const firstInbound = inboundMessages[0];
      const email = firstInbound.senderEmail?.toLowerCase().trim() || null;
      const name = firstInbound.senderName || email;
      return { email, name };
    }

    // Strategy 3: Last resort - use first message's sender
    const firstMessage = messages[0];
    const email = firstMessage.senderEmail?.toLowerCase().trim() || null;
    const name = firstMessage.senderName || email;
    return { email, name };
  }, [messages]);
}
