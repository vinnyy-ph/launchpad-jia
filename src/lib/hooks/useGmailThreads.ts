import { useState, useEffect } from "react";
import { api, apiClient } from "@/lib/utils/apiClient";

interface GmailThread {
  id: string;
  subject: string;
  lastMessage?: any;
  labelIds?: string[];
  isInbox?: boolean;
  isSent?: boolean;
  isDraft?: boolean;
  messageCount?: number;
  messages?: any[];
  source: "gmail"; // Mark as Gmail source
  date?: string;
  careerId?: string; // Career ID from gmail-subject collection
  careerTitle?: string; // Career title from careers collection
  campaignId?: string;
}

interface GmailMessage {
  id: string;
  threadId: string;
  from?: string;
  senderEmail?: string;
  senderName?: string;
  to?: string;
  date?: string;
  timestamp?: string;
  subject?: string;
  html?: string;
  text?: string;
  content?: string;
  snippet?: string;
  attachments?: any[];
  direction?: "inbound" | "outbound";
  isAutomated?: boolean;
  isDraft?: boolean;
  avatar?: string; // User's image/picture from Gmail users API
}

interface UseGmailThreadsReturn {
  gmailThreads: GmailThread[];
  gmailMessages: GmailMessage[];
  isLoading: boolean;
  refetch: () => void;
  lastSync: Date | null;
  /** True when Gmail OAuth token refresh failed (e.g. invalid_grant). User should reconnect in Settings. */
  gmailTokenExpired: boolean;
}

export function useGmailThreads(
  orgId: string | null | undefined,
  careerId?: string,
  campaignId?: string, // Optional campaignId
): UseGmailThreadsReturn {
  const [gmailThreads, setGmailThreads] = useState<GmailThread[]>([]);
  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [gmailTokenExpired, setGmailTokenExpired] = useState(false);

  useEffect(() => {
    if (!orgId) {
      setGmailThreads([]);
      setGmailMessages([]);
      setGmailTokenExpired(false);
      return;
    }

    let mounted = true;

    async function fetchGmailData() {
      try {
        setIsLoading(true);

        // Fetch Gmail threads and emails
        const emailsResponse = await api.get("/api/gmail/emails", {
          params: {
            orgID: orgId,
            ...(careerId && { careerId }),
            ...(campaignId && { campaignId }),
          },
        });

        // Fetch Gmail users to map emails to avatars
        const usersResponse = await api.get("/api/gmail/users", {
          params: {
            orgID: orgId,
          },
        });

        if (!mounted) return;

        setGmailTokenExpired(Boolean(emailsResponse.data?.gmailTokenExpired));

        const threads = emailsResponse.data?.threads || [];
        const gmailUsers = usersResponse.data?.result || [];

        // Collect all unique career IDs from Gmail threads
        const careerIds = new Set<string>();
        threads.forEach((thread: any) => {
          if (thread.careerId) {
            careerIds.add(thread.careerId);
          }
        });

        // Fetch career data (jobTitle) for all career IDs in one batch call
        let careerDataMap: Record<
          string,
          { jobTitle: string; status: string | null }
        > = {};
        if (careerIds.size > 0) {
          try {
            const careerResponse = await apiClient.get(
              "/api/mailgun-module/mg-get-career-data",
              {
                params: {
                  orgId,
                  careerIds: Array.from(careerIds).join(","),
                },
              },
            );
            careerDataMap = careerResponse.data?.careers || {};
          } catch (err) {
            console.error("Failed to fetch career data:", err);
          }
        }

        // Create maps of email -> user image and email -> user name for quick lookup
        const emailToImageMap = new Map<string, string>();
        const emailToNameMap = new Map<string, string>();
        gmailUsers.forEach((user: any) => {
          const email = user.userDetails?.email?.toLowerCase();
          const image = user.userDetails?.image || user.userDetails?.picture;
          const name = user.userDetails?.name;
          if (email && image) {
            emailToImageMap.set(email, image);
          }
          if (email && name) {
            emailToNameMap.set(email, name);
          }
        });

        const threadsWithSource = threads.map((thread: any) => {
          const careerData = thread.careerId
            ? careerDataMap[thread.careerId]
            : null;

          // Extract all unique participants from this thread's messages
          const participantsSet = new Set<string>();
          if (thread.messages && Array.isArray(thread.messages)) {
            thread.messages.forEach((msg: any) => {
              if (msg.from) participantsSet.add(msg.from);
              if (msg.to) {
                const toList = Array.isArray(msg.to) ? msg.to : [msg.to];
                toList.forEach((t: any) => {
                  if (t) participantsSet.add(t);
                });
              }
              if (msg.cc) {
                const ccList = Array.isArray(msg.cc) ? msg.cc : [msg.cc];
                ccList.forEach((c: any) => {
                  if (c) participantsSet.add(c);
                });
              }
              if (msg.bcc) {
                const bccList = Array.isArray(msg.bcc) ? msg.bcc : [msg.bcc];
                bccList.forEach((b: any) => {
                  if (b) participantsSet.add(b);
                });
              }
            });
          }

          return {
            ...thread,
            source: "gmail" as const,
            // Use lastMessage date if available, otherwise use thread date
            date: thread.lastMessage?.date || thread.date,
            // careerId is now returned from the /api/gmail/emails endpoint
            // Add careerTitle from fetched career data
            careerTitle: careerData?.jobTitle || null,
            // Add participants from this thread's messages for filtering
            participants: Array.from(participantsSet),
            campaignId: thread.campaignId,
          };
        });

        // Extract messages from threads
        const messages: GmailMessage[] = [];
        threadsWithSource.forEach((thread: GmailThread) => {
          if (thread.messages && Array.isArray(thread.messages)) {
            thread.messages.forEach((msg: any) => {
              // Extract sender email and name from "from" field
              // Format can be "Name <email@example.com>" or just "email@example.com"
              let senderEmail = msg.from;
              let senderName = msg.from;

              if (msg.from) {
                const emailMatch = String(msg.from).match(/<([^>]+)>/);
                if (emailMatch) {
                  senderEmail = emailMatch[1];
                  senderName = String(msg.from)
                    .replace(/<[^>]+>/, "")
                    .trim();
                } else {
                  senderEmail = msg.from;
                  senderName = msg.from;
                }
              }

              // Prefer user's name from Gmail users API if available
              const userNameFromApi = senderEmail
                ? emailToNameMap.get(senderEmail.toLowerCase())
                : undefined;
              const finalSenderName =
                userNameFromApi || senderName || senderEmail;

              // Get avatar from email to image map
              const avatar = senderEmail
                ? emailToImageMap.get(senderEmail.toLowerCase())
                : undefined;

              // Determine direction: outbound if sender is in gmail users (org member), inbound otherwise
              const isOrgMember = senderEmail
                ? emailToNameMap.has(senderEmail.toLowerCase())
                : false;
              const messageDirection = isOrgMember ? "outbound" : "inbound";

              messages.push({
                id: msg.id || `gmail-${thread.id}-${messages.length}`,
                threadId: String(thread.id),
                from: msg.from,
                senderEmail: senderEmail,
                senderName: finalSenderName,
                to: msg.to,
                date: msg.date,
                timestamp: msg.date,
                subject: msg.subject || thread.subject,
                html: msg.html,
                text: msg.text,
                content: msg.html || msg.text,
                snippet: msg.snippet || msg.text?.slice(0, 140),
                attachments: msg.attachments,
                direction: messageDirection,
                isAutomated: false, // Gmail emails are not automated
                isDraft: msg.isDraft || false,
                avatar: avatar,
              });
            });
          }
        });

        setGmailThreads(threadsWithSource);
        setGmailMessages(messages);
        setLastSync(new Date());
      } catch (err: any) {
        console.error("Error fetching Gmail threads:", err);
        setGmailThreads([]);
        setGmailMessages([]);
        // If API returned 401 or body indicates token expired, show reconnect alert
        const data = err?.response?.data;
        const isTokenExpired =
          err?.response?.status === 401 ||
          data?.gmailTokenExpired === true ||
          String(data?.error || err?.message || "").toLowerCase().includes("invalid_grant");
        setGmailTokenExpired(isTokenExpired);
      } finally {
        setIsLoading(false);
      }
    }

    fetchGmailData();
  }, [orgId, careerId, campaignId, refreshTrigger]);

  const refetch = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return {
    gmailThreads,
    gmailMessages,
    isLoading,
    refetch,
    lastSync,
    gmailTokenExpired,
  };
}
