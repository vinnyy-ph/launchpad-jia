import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/utils/apiClient";
import {
  extractEmailFromString,
  extractNameFromEmail,
} from "@/lib/utils/emailCandidate";

const THREAD_PAGE_SIZE = 50;

interface UseEmailThreadsReturn {
  threads: any[];
  messages: any[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  totalThreadCount: number | null;
  loadMore: () => Promise<void>;
  refetch: () => void;
}

function processBatch(
  orgId: string,
  fetchedMessages: any[],
  careerDataMap: Record<string, { jobTitle: string; status: string | null }>,
) {
  const threadMap = new Map();
  fetchedMessages.forEach((msg: any) => {
    const threadId = msg.threadId || msg._id;
    const threadCareerIdFromMsg = msg.threadCareerId || msg.careerId || null;
    if (!threadMap.has(threadId)) {
      threadMap.set(threadId, {
        id: threadId,
        organizationId: orgId,
        careerId: threadCareerIdFromMsg,
        subject: msg.subject || "(no subject)",
        stage: null,
        readMap: msg.threadReadMap || {},
        campaignId: msg.campaignId || null,
      });
    } else {
      const existingThread = threadMap.get(threadId);
      const candidateCareerId = msg.threadCareerId || msg.careerId || null;
      if (!existingThread.careerId && candidateCareerId) {
        existingThread.careerId = candidateCareerId;
      }
      if (msg.threadReadMap && Object.keys(msg.threadReadMap).length > 0) {
        existingThread.readMap = { ...existingThread.readMap, ...msg.threadReadMap };
      }
    }
  });

  const threadsArray = Array.from(threadMap.values()).map((thread: any) => {
    const careerData = thread.careerId ? careerDataMap[thread.careerId] : null;
    const threadMessages = fetchedMessages.filter(
      (msg: any) => String(msg.threadId || msg._id) === String(thread.id),
    );
    const isDraft = threadMessages.some(
      (msg: any) =>
        !!(
          msg.isDraft ||
          msg.is_draft ||
          msg.draft ||
          (typeof msg.status === "string" && msg.status.toLowerCase() === "draft") ||
          (typeof msg.direction === "string" && msg.direction.toLowerCase() === "draft")
        ),
    );
    const firstMessageByDate = threadMessages.reduce(
      (oldest: any, msg: any) => {
        const msgDate = new Date(msg.createdAt || msg.timestamp || 0).getTime();
        const oldestDate = new Date(oldest.createdAt || oldest.timestamp || 0).getTime();
        return msgDate < oldestDate ? msg : oldest;
      },
      threadMessages[0],
    );
    const threadSubject =
      firstMessageByDate?.subject || thread.subject || "(no subject)";
    const mostRecentMessage = threadMessages.reduce(
      (latest: any, msg: any) => {
        const msgDate = new Date(msg.createdAt || msg.timestamp || 0).getTime();
        const latestDate = new Date(latest.createdAt || latest.timestamp || 0).getTime();
        return msgDate > latestDate ? msg : latest;
      },
      threadMessages[0],
    );
    const lastMessageDate = mostRecentMessage
      ? mostRecentMessage.createdAt ||
        mostRecentMessage.timestamp ||
        new Date().toISOString()
      : new Date().toISOString();
    return {
      ...thread,
      id: String(thread.id),
      subject: threadSubject,
      careerTitle: careerData?.jobTitle || null,
      stage: careerData?.status || null,
      readMap: thread.readMap || {},
      isDraft,
      date: lastMessageDate,
      lastMessage: mostRecentMessage
        ? {
            date: lastMessageDate,
            content: mostRecentMessage.html || mostRecentMessage.text || "",
          }
        : null,
    };
  });

  const transformedMessages = fetchedMessages.map((msg: any) => {
    const isDraft = !!(
      msg.isDraft ||
      msg.is_draft ||
      msg.draft ||
      (typeof msg.status === "string" && msg.status.toLowerCase() === "draft") ||
      (typeof msg.direction === "string" && msg.direction.toLowerCase() === "draft")
    );
    return {
      id: msg._id,
      _id: msg._id,
      threadId: String(msg.threadId || msg._id),
      avatar: msg.senderImage || null,
      senderName: extractNameFromEmail(msg.from) || "Unknown Sender",
      senderEmail: extractEmailFromString(msg.from) || "",
      to: Array.isArray(msg.to) ? msg.to : typeof msg.to === "string" ? [msg.to] : [],
      cc: Array.isArray(msg.cc) ? msg.cc : typeof msg.cc === "string" ? [msg.cc] : [],
      bcc: Array.isArray(msg.bcc) ? msg.bcc : typeof msg.bcc === "string" ? [msg.bcc] : [],
      timestamp: msg.createdAt || new Date().toISOString(),
      subject: msg.subject || "(no subject)",
      isAutomated: msg.isAutomated,
      direction: msg.direction || null,
      content: msg.html || msg.text || "",
      readBy: msg.readBy || [],
      attachments: (msg.attachments || []).map((att: any) => ({
        ...att,
        fileName: att.filename || att.fileName || att.name || "Unknown",
        fileSize: att.size || att.fileSize || "0 KB",
        fileType: att.contentType || att.fileType || att.mimeType || "unknown",
      })),
      mailgunMessageId: msg.mailgunMessageId || null,
      mode: msg.mode || null,
      outlookMessageId: msg.outlookMessageId || null,
      modeMessageId: msg.modeMessageId || null,
      campaignId: msg.campaignId || null,
      isDraft,
      // Preserve draft payload fields so EmailModuleV2 can open ComposeEmailModal/ReplyEmailCard with draft content
      ...(isDraft
        ? {
            html: msg.html ?? null,
            text: msg.text ?? null,
            toRaw: msg.toRaw ?? msg.to ?? null,
            toList: msg.toList ?? (Array.isArray(msg.to) ? msg.to : []),
            ccRaw: msg.ccRaw ?? null,
            bccRaw: msg.bccRaw ?? null,
            from: msg.from ?? null,
            careerId: msg.careerId ?? msg.threadCareerId ?? null,
            draftAttachments: msg.draftAttachments ?? msg.attachments ?? null,
          }
        : {}),
    };
  });

  return { threadsArray, transformedMessages };
}

function sortThreadsByDate(threads: any[]) {
  return [...threads].sort((a, b) => {
    const aDate =
      a.lastMessage?.date || a.date
        ? new Date(a.lastMessage?.date || a.date).getTime()
        : 0;
    const bDate =
      b.lastMessage?.date || b.date
        ? new Date(b.lastMessage?.date || b.date).getTime()
        : 0;
    return bDate - aDate;
  });
}

/** Tab for Mailgun thread list: Inbox, Sent, or Drafts. Pass to fetch first 50 threads per tab (and when campaignId is set, filtered by campaign). */
export function useEmailThreads(
  orgId: string | null | undefined,
  campaignId?: string,
  tab?: string,
): UseEmailThreadsReturn {
  const [threads, setThreads] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [totalThreadCount, setTotalThreadCount] = useState<number | null>(null);
  const [threadSkip, setThreadSkip] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchPage = useCallback(
    async (skip: number, limit: number) => {
      const params: any = { orgId, limit, skip };
      if (campaignId) params.campaignId = campaignId;
      if (tab && ["Inbox", "Sent", "Drafts"].includes(tab)) params.tab = tab;
      const response = await apiClient.get(
        "/api/mailgun-module/mg-fetch-messages",
        { params },
      );
      const fetchedMessages = response.data?.messages || [];
      const pageHasMore = !!response.data?.hasMore;
      const total =
        typeof response.data?.totalThreadCount === "number"
          ? response.data.totalThreadCount
          : null;
      return { fetchedMessages, pageHasMore, totalThreadCount: total };
    },
    [orgId, campaignId, tab],
  );

  useEffect(() => {
    if (!orgId) return;

    let mounted = true;

    async function initialFetch() {
      try {
        setIsLoading(true);
        const { fetchedMessages, pageHasMore, totalThreadCount: total } =
          await fetchPage(0, THREAD_PAGE_SIZE);
        if (!mounted) return;

        const careerIds = new Set<string>();
        fetchedMessages.forEach((msg: any) => {
          const c = msg.threadCareerId || msg.careerId || null;
          if (c) careerIds.add(c);
        });
        let careerDataMap: Record<
          string,
          { jobTitle: string; status: string | null }
        > = {};
        if (careerIds.size > 0 && orgId) {
          try {
            const careerResponse = await apiClient.get(
              "/api/mailgun-module/mg-get-career-data",
              {
                params: { orgId, careerIds: Array.from(careerIds).join(",") },
              },
            );
            careerDataMap = careerResponse.data?.careers || {};
          } catch (err) {
            console.error("Failed to fetch career data:", err);
          }
        }

        const { threadsArray, transformedMessages } = processBatch(
          orgId,
          fetchedMessages,
          careerDataMap,
        );
        setThreads(sortThreadsByDate(threadsArray));
        setMessages(transformedMessages);
        setHasMore(pageHasMore);
        setTotalThreadCount(total);
        setThreadSkip(THREAD_PAGE_SIZE);
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initialFetch();
    return () => {
      mounted = false;
    };
  }, [orgId, refreshTrigger, campaignId, tab, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!orgId || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const { fetchedMessages, pageHasMore, totalThreadCount: total } =
        await fetchPage(threadSkip, THREAD_PAGE_SIZE);
      const careerIds = new Set<string>();
      fetchedMessages.forEach((msg: any) => {
        const c = msg.threadCareerId || msg.careerId || null;
        if (c) careerIds.add(c);
      });
      let careerDataMap: Record<
        string,
        { jobTitle: string; status: string | null }
      > = {};
      if (careerIds.size > 0 && orgId) {
        try {
          const careerResponse = await apiClient.get(
            "/api/mailgun-module/mg-get-career-data",
            {
              params: { orgId, careerIds: Array.from(careerIds).join(",") },
            },
          );
          careerDataMap = careerResponse.data?.careers || {};
        } catch (err) {
          console.error("Failed to fetch career data:", err);
        }
      }
      const { threadsArray, transformedMessages } = processBatch(
        orgId,
        fetchedMessages,
        careerDataMap,
      );
      setMessages((prev) => [...prev, ...transformedMessages]);
      setThreads((prev) =>
        sortThreadsByDate([...prev, ...threadsArray]),
      );
      setHasMore(pageHasMore);
      if (total !== null) setTotalThreadCount(total);
      setThreadSkip((s) => s + THREAD_PAGE_SIZE);
    } catch (error) {
      console.error("Failed to load more messages:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [orgId, threadSkip, hasMore, isLoadingMore, fetchPage]);

  const refetch = useCallback(() => {
    setThreadSkip(0);
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return {
    threads,
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    totalThreadCount,
    loadMore,
    refetch,
  };
}
