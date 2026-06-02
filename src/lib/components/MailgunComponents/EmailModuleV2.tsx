"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "./email.module.scss";
import AvatarImage from "@/lib/components/AvatarImage/AvatarImage";
import Button from "@/lib/components/ui/button/Button";
import ComposeEmailModal from "./components/ComposeEmailModal";
import EmailPreviewCard, {
  EmailPreviewCardSkeleton,
} from "./components/EmailPreviewCard";
import EmailMessageCard from "./components/EmailMessageCard";
import EmailThreadHeader from "./components/EmailThreadHeader";
import InsertTemplateModal from "./components/InsertTemplateModal";
import LinkCareerModal from "./components/LinkCareerModal";
import ReplyEmailCard from "./components/ReplyEmailCard";
import { useAppContext } from "@/lib/context/AppContext";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { useEmailData } from "@/lib/hooks/useEmailData";
import { useScheduledEmails } from "@/lib/hooks/useScheduledEmails";
import { useEmailThreads } from "@/lib/hooks/useEmailThreads";
import { useEmailTabStats } from "@/lib/hooks/useEmailTabStats";
import { useGmailThreads } from "@/lib/hooks/useGmailThreads";
import { useOutlookThreads } from "@/lib/hooks/useOutlookThreads";
import { useEmailCareers } from "@/lib/hooks/useEmailCareers";
import { useApplicantInfo } from "@/lib/hooks/useApplicantInfo";
import { useInterviewStage } from "@/lib/hooks/useInterviewStage";
import { useCareerName } from "@/lib/hooks/useCareerName";
import { useInterviewStages } from "@/lib/hooks/useInterviewStages";
import { useEmailMessageCounts } from "@/lib/hooks/useEmailMessageCounts";
import { useThreadNavigation } from "@/lib/utils/emailCandidate";
import { errorToast, successToast } from "@/lib/Utils";
import {
  timeAgo,
  getTabUnreadCount,
  extractParticipantEmails,
  getThreadDateForSort,
  filterMergedThreadsByTab,
  threadMatchesSearch,
  threadMatchesSelectedFilters,
  getEmailTabCountGroups,
} from "@/lib/utils/emailCandidate";
import { useUserEmailsSet } from "@/lib/hooks/useUserEmailsSet";
import { apiClient } from "@/lib/utils/apiClient";
import Swal from "sweetalert2";
import Link from "next/link";

// Helper function to filter Gmail threads by category
const emailTabs = [
  { name: "Inbox", icon: "inbox" },
  { name: "Sent", icon: "send" },
  { name: "Drafts", icon: "draft" },
  { name: "Scheduled", icon: "scheduled" },
];

interface EmailModuleProps {
  email?: string;
  careerId?: string;
  campaignId?: string;
  hideCompose?: boolean;
  orgId?: string;
}

export default function EmailModule({
  email,
  careerId,
  campaignId,
  hideCompose = false,
  orgId: orgIdProp,
}: EmailModuleProps = {}) {
  const [searchValue, setSearchValue] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<{
    career: string[];
    stage: string[];
    emailType: string[];
    status?: string[];
  }>({ career: [], stage: [], emailType: [], status: [] });
  const { orgID, user } = useAppContext();
  const effectiveOrgId = orgIdProp ?? orgID;
  const [activeOrg] = useLocalStorage("activeOrg", null);
  const { senderOptions, outlookUser, outlookEmail } =
    useEmailData(effectiveOrgId);

  // Current org role (from activeOrg) — hiring managers only see threads they participate in
  const currentOrgRole =
    activeOrg &&
    effectiveOrgId != null &&
    String(activeOrg._id) === String(effectiveOrgId)
      ? activeOrg.role
      : null;
  const isHiringManager = currentOrgRole === "hiring_manager";

  // User emails set (from senderOptions)
  const userEmailsSet = useUserEmailsSet(user, senderOptions);

  const [activeTab, setActiveTab] = useState("Inbox");
  const [lastMailgunTab, setLastMailgunTab] = useState("Inbox");
  const [replyThreadId, setReplyThreadId] = useState<string | null>(null);
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [composeInitialDraft, setComposeInitialDraft] = useState<any>(null);
  const [isCareerModalOpen, setIsCareerModalOpen] = useState(false);
  const [isInsertTemplateModalOpen, setIsInsertTemplateModalOpen] =
    useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  // Track threads marked as read optimistically (threadId -> timestamp)
  const [optimisticallyReadThreads, setOptimisticallyReadThreads] = useState<
    Map<string, string>
  >(new Map());

  // Per-tab fetch: Inbox/Sent/Drafts each get their own first 50 threads (and load more on pagination). Scheduled uses its own data source.
  const tabForFetch =
    activeTab === "Scheduled" ? lastMailgunTab : activeTab;
  useEffect(() => {
    if (activeTab === "Inbox" || activeTab === "Sent" || activeTab === "Drafts") {
      setLastMailgunTab(activeTab);
    }
  }, [activeTab]);

  // Fetch threads and messages using custom hook (paginated: 50 threads per batch, per tab; respects campaignId when on campaign page)
  const {
    threads,
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    totalThreadCount,
    loadMore,
    refetch,
  } = useEmailThreads(effectiveOrgId, campaignId, tabForFetch);

  // Tab stats (total messages, automated, direct, unread) – loaded with tab so counts show immediately
  const { stats: tabStats, refetch: refetchTabStats } = useEmailTabStats(
    effectiveOrgId,
    campaignId,
    tabForFetch,
  );

  // Fetch Gmail threads and messages
  const {
    gmailThreads,
    gmailMessages,
    isLoading: isLoadingGmail,
    refetch: refetchGmail,
    lastSync: gmailLastSync,
    gmailTokenExpired,
  } = useGmailThreads(effectiveOrgId, undefined, campaignId);

  // Fetch Outlook threads (sync + threads + all-messages); refetch used by sync button
  const {
    refetch: refetchOutlook,
    outlookTokenExpired,
  } = useOutlookThreads(effectiveOrgId);

  // Fetch scheduled emails (active only) for Scheduled tab and badge count
  const {
    scheduledEmails,
    isLoading: isLoadingScheduled,
    refetch: refetchScheduled,
  } = useScheduledEmails(effectiveOrgId);

  // Fetch valid careers for the org
  const { careers: validCareers, loading: loadingCareers } =
    useEmailCareers(effectiveOrgId);
  // Map: { id, jobTitle }
  const validCareerMap = useMemo(
    () => new Map(validCareers.map((c) => [c.id, c.jobTitle])),
    [validCareers],
  );

  // Synthetic threads and messages from scheduled emails (for Scheduled tab)
  const scheduledThreads = useMemo(
    () =>
      scheduledEmails.map((se) => ({
        id: se._id,
        subject: se.subject || "(no subject)",
        careerId: se.careerId ?? undefined,
        careerTitle: se.careerId ? validCareerMap.get(se.careerId) : undefined,
        readMap: {} as Record<string, string>,
      })),
    [scheduledEmails, validCareerMap],
  );
  const scheduledMessages = useMemo(
    () =>
      scheduledEmails.map((se) => ({
        id: se._id,
        threadId: se._id,
        senderName: se.senderName || "Me",
        senderEmail: se.senderEmail,
        avatar: se.senderImage || null,
        to: Array.isArray(se.to) ? se.to : se.to ? [se.to] : [],
        cc: Array.isArray(se.cc) ? se.cc : se.cc ? [se.cc] : [],
        bcc: Array.isArray(se.bcc) ? se.bcc : se.bcc ? [se.bcc] : [],
        subject: se.subject,
        content: se.body,
        timestamp: se.sendDate,
        direction: "outbound" as const,
        scheduledSendDate: se.sendDate,
        scheduledId: se._id,
      })),
    [scheduledEmails],
  );

  // Mark thread as read via API (optimistic update)
  const markThreadRead = async (threadId: string) => {
    const now = new Date().toISOString();
    setOptimisticallyReadThreads((prev) => {
      const next = new Map(prev);
      next.set(threadId, now);
      return next;
    });

    // Make API call in background without triggering refetch
    try {
      await apiClient.post("/api/mailgun-module/mg-mark-read", { threadId });
    } catch (err) {
      console.error("Failed to mark thread as read:", err);
      setOptimisticallyReadThreads((prev) => {
        const next = new Map(prev);
        next.delete(threadId);
        return next;
      });
    }
  };

  const handleDiscardAllDrafts = async () => {
    if (!effectiveOrgId) return;
    const result = await Swal.fire({
      title: "Discard all drafts?",
      text: "All drafts for this organization will be permanently deleted. This cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, discard all",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    try {
      const res = await apiClient.post(
        "/api/mailgun-module/mg-delete-all-drafts",
        { orgID: effectiveOrgId },
      );
      const deletedCount = res?.data?.deletedCount ?? 0;
      successToast(
        deletedCount > 0
          ? `${deletedCount} draft${deletedCount === 1 ? "" : "s"} discarded`
          : "No drafts to discard",
        2500,
      );
      refetch();
      refetchGmail();
      refetchCounts();
      refetchTabStats();
      setSelectedId(null);
      setReplyThreadId(null);
    } catch (err) {
      console.error("Failed to discard all drafts:", err);
      errorToast("Failed to discard all drafts", 3000);
    }
  };

  // Update last sync when threads are successfully loaded
  useEffect(() => {
    if (!isLoading && threads.length >= 0) {
      // Set last sync when data is loaded (initial load or after refetch)
      // Use Gmail sync time if available, otherwise use current time
      setLastSync(gmailLastSync || new Date());
      if (user?.uid) {
        setOptimisticallyReadThreads((prev) => {
          const next = new Map(prev);
          threads.forEach((thread) => {
            if (thread.readMap?.[user.uid]) {
              next.delete(thread.id);
            }
          });
          return next;
        });
      }
    }
  }, [isLoading, threads.length, user?.uid, threads, gmailLastSync]);

  // Fetch message counts (total, automated, direct)
  const { counts: messageCounts, refetch: refetchCounts } =
    useEmailMessageCounts(effectiveOrgId);

  // Trigger sync and show toast when module loads
  useEffect(() => {
    successToast("Syncing emails...", 1500);
    refetch();
    refetchGmail();
    refetchOutlook();
    refetchCounts();
    refetchTabStats();
    setLastSync(new Date());
  }, []);

  // Only show careerIds that exist in both threads and validCareers
  const threadCareerIds = Array.from(
    new Set(threads.map((t) => t.careerId).filter(Boolean)),
  );
  const allCareers = threadCareerIds
    .filter((id) => validCareerMap.has(id))
    .map((id) => ({ id, jobTitle: validCareerMap.get(id) }))
    .sort((a, b) => a.jobTitle.localeCompare(b.jobTitle));

  // All unique stages from interviews collection
  const { stages: allStages, loading: loadingStages } =
    useInterviewStages(effectiveOrgId);

  // Email types: Automated or Manual (Direct)
  const allEmailTypes = [
    ...(messages.some((m) => m.isAutomated) ? ["Automated"] : []),
    ...(messages.some((m) => !m.isAutomated) ? ["Manual"] : []),
    // Gmail messages are manual/direct emails
    ...(gmailMessages.length > 0 ? ["Manual"] : []),
  ];

  // Merge database and Gmail threads
  const mergedThreads = useMemo(() => {
    const allThreads = [
      ...threads,
      ...gmailThreads.map((t) => ({
        ...t,
        careerTitle: t.careerId ? validCareerMap.get(t.careerId) : undefined,
      })),
    ];
    return allThreads.sort(
      (a, b) => getThreadDateForSort(b) - getThreadDateForSort(a),
    );
  }, [threads, gmailThreads, validCareerMap]);

  const mergedMessages = useMemo(
    () => [...messages, ...gmailMessages],
    [messages, gmailMessages],
  );

  // Filter threads by email and careerId props (if provided)
  const propFilteredThreads = useMemo(() => {
    let filtered = mergedThreads;

    // Hiring managers: only show threads where the logged-in user's Gmail or Mailgun accounts are participants
    if (isHiringManager && userEmailsSet.size > 0) {
      filtered = filtered.filter((thread) => {
        const threadMessages = mergedMessages.filter(
          (m) => m.threadId === thread.id,
        );
        if (threadMessages.length === 0) return false;
        // Gmail threads may have thread-level participants
        if (thread.source === "gmail" && thread.participants) {
          const threadParticipantEmails = (thread.participants || [])
            .map((p: any) => {
              const s = typeof p === "string" ? p : "";
              const match = s.match(/<([^>]+)>/);
              return (match ? match[1] : s).toLowerCase();
            })
            .filter(Boolean);
          if (threadParticipantEmails.some((e) => userEmailsSet.has(e)))
            return true;
        }
        // Include thread if any message has the user (login email, Gmail account, or Mailgun account) as participant
        return threadMessages.some((msg) =>
          extractParticipantEmails(msg).some((e) => userEmailsSet.has(e)),
        );
      });
    }

    // Filter by email prop if provided
    if (email) {
      const lowerEmail = email.toLowerCase().trim();
      filtered = filtered.filter((thread) => {
        const threadMessages = mergedMessages.filter(
          (m) => m.threadId === thread.id,
        );

        // For Gmail threads, also check thread-level participants if available
        if (thread.source === "gmail" && thread.participants) {
          const threadParticipants = (thread.participants || []).map(
            (p: any) => {
              const match = typeof p === "string" ? p.match(/<([^>]+)>/) : null;
              return match
                ? match[1].toLowerCase()
                : typeof p === "string"
                  ? p.toLowerCase()
                  : "";
            },
          );
          const found = threadParticipants.some(
            (p: string) =>
              p === lowerEmail ||
              p.includes(lowerEmail) ||
              lowerEmail.includes(p),
          );
          // For Gmail threads with participants, only include if email is found in participants
          return found;
        }

        // Check if email appears in any message participants
        return threadMessages.some((msg) => {
          const participants = [
            msg.from,
            msg.senderEmail,
            ...(msg.to || []),
            ...(msg.cc || []),
            ...(msg.bcc || []),
          ]
            .filter(Boolean)
            .map((p) => {
              // Extract email from "Name <email>" format or just "email"
              const match = typeof p === "string" ? p.match(/<([^>]+)>/) : null;
              return match
                ? match[1].toLowerCase()
                : typeof p === "string"
                  ? p.toLowerCase()
                  : "";
            });
          return participants.some(
            (p) => p.includes(lowerEmail) || lowerEmail.includes(p),
          );
        });
      });
    }

    // Filter by careerId prop if provided
    if (careerId && !campaignId) {
      filtered = filtered.filter((thread) => {
        return thread.careerId === careerId;
      });
    }

    // Filter by campaignId prop if provided
    if (campaignId) {
      filtered = filtered.filter((thread) => {
        return thread.campaignId === campaignId;
      });
    }

    return filtered;
  }, [
    mergedThreads,
    mergedMessages,
    email,
    careerId,
    campaignId,
    isHiringManager,
    userEmailsSet,
  ]);

  const baseFilteredThreads = filterMergedThreadsByTab(
    activeTab,
    propFilteredThreads,
    mergedMessages,
  );

  const filteredThreads = baseFilteredThreads
    .filter((thread) =>
      threadMatchesSelectedFilters(
        thread,
        mergedMessages,
        selectedFilters,
        optimisticallyReadThreads,
        user,
      ),
    )
    .filter((thread) => {
      const threadMessages = mergedMessages.filter(
        (m) => m.threadId === thread.id,
      );
      return threadMatchesSearch(thread, threadMessages, searchValue);
    });

  // Gmail-only threads/messages for this tab (for adding Gmail counts to tab stats)
  const gmailThreadsInTab = useMemo(
    () =>
      activeTab === "Scheduled"
        ? []
        : filterMergedThreadsByTab(
            activeTab,
            gmailThreads.map((t) => ({ ...t, source: "gmail" })),
            gmailMessages,
          ),
    [activeTab, gmailThreads, gmailMessages],
  );
  const gmailUnreadCount = getTabUnreadCount(
    gmailThreadsInTab,
    gmailMessages,
    optimisticallyReadThreads,
    user?.email,
    user?.uid,
  );

  // Use tab stats (actual totals) when available so counts show immediately; add Gmail on top
  const filteredMessages = mergedMessages.filter((m) =>
    filteredThreads.some((t) => t.id === m.threadId),
  );
  const unreadCount =
    activeTab === "Scheduled"
      ? scheduledEmails.length
      : tabStats
        ? tabStats.unreadThreadCount + gmailUnreadCount
        : getTabUnreadCount(
            filteredThreads,
            mergedMessages,
            optimisticallyReadThreads,
            user?.email,
            user?.uid,
          );

  const countGroups = useMemo(
    () =>
      getEmailTabCountGroups(
        activeTab,
        tabStats,
        scheduledEmails.length,
        gmailMessages.length,
        filteredMessages,
      ),
    [
      activeTab,
      tabStats,
      scheduledEmails.length,
      gmailMessages.length,
      filteredMessages,
    ],
  );

  const selectedThread =
    activeTab === "Scheduled"
      ? scheduledThreads.find((t) => t.id === selectedId) || null
      : mergedThreads.find((t) => t.id === selectedId) || null;

  // Get thread messages for the selected thread (scheduled vs real)
  const threadMessages = selectedThread
    ? activeTab === "Scheduled"
      ? scheduledMessages.filter((m) => m.threadId === selectedThread.id)
      : mergedMessages.filter((m) => m.threadId === selectedThread.id)
    : [];

  // Sort thread messages to get first message for subject display
  const sortedThreadMessages = [...threadMessages].sort((a, b) => {
    const ta =
      a.timestamp || a.date ? new Date(a.timestamp || a.date!).getTime() : 0;
    const tb =
      b.timestamp || b.date ? new Date(b.timestamp || b.date!).getTime() : 0;
    return ta - tb;
  });
  const firstMessage = sortedThreadMessages[0] || threadMessages[0];

  // Determine applicant email and name from thread messages
  const applicantInfo = useApplicantInfo(threadMessages);

  // Use thread's careerId or fall back to prop (e.g. campaign's careerId) for display
  const effectiveCareerId = selectedThread?.careerId || careerId || undefined;

  // Fetch career name from careers collection
  const { careerName, isLoading: isLoadingCareerName } = useCareerName(
    effectiveCareerId,
    effectiveOrgId,
  );

  // Fetch interview stage for the applicant in the selected career
  const { stage: interviewStage, isLoading: isLoadingStage } =
    useInterviewStage(applicantInfo.email, effectiveCareerId, effectiveOrgId);

  // Pagination logic (use filteredThreads or scheduledThreads for Scheduled tab)
  const threadsPerPage = 10;
  const listForPagination =
    activeTab === "Scheduled" ? scheduledThreads : filteredThreads;
  const totalForDisplay =
    activeTab === "Scheduled"
      ? listForPagination.length
      : totalThreadCount !== null
        ? totalThreadCount + gmailThreads.length
        : listForPagination.length;
  const totalPages = Math.ceil(
    Math.max(listForPagination.length, totalForDisplay) / threadsPerPage,
  );
  const startIndex = (currentPage - 1) * threadsPerPage;
  const endIndex = startIndex + threadsPerPage;
  const paginatedThreads = filteredThreads.slice(startIndex, endIndex);
  const paginatedScheduledThreads = scheduledThreads.slice(
    startIndex,
    endIndex,
  );

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = async () => {
    if (currentPage >= totalPages) return;
    const nextPage = currentPage + 1;
    const threadsNeeded = nextPage * threadsPerPage;
    // Load more Mailgun threads if the next page would need more than we have
    if (
      threadsNeeded > listForPagination.length &&
      hasMore &&
      !isLoadingMore
    ) {
      await loadMore();
    }
    setCurrentPage(nextPage);
  };

  const nextPageDisabled =
    (currentPage >= totalPages && !hasMore) || isLoadingMore;

  // Unschedule (cancel) a scheduled email
  const handleUnschedule = async (scheduledId: string) => {
    if (!effectiveOrgId) return;
    try {
      await apiClient.post("/api/mailgun-module/cancel-scheduled-email", {
        _id: scheduledId,
        orgID: effectiveOrgId,
      });
      successToast("Scheduled email cancelled", 2000);
      refetchScheduled();
      setSelectedId(null);
    } catch (err) {
      console.error("Failed to cancel scheduled email:", err);
      errorToast("Failed to cancel scheduled email", 3000);
    }
  };

  // Reset to page 1 when list or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filteredThreads.length, scheduledThreads.length]);

  // Thread navigation hook
  const { goToPrevThread, goToNextThread, isPrevDisabled, isNextDisabled } =
    useThreadNavigation(
      filteredThreads,
      selectedThread,
      setSelectedId,
      setReplyThreadId,
      markThreadRead,
    );

  return (
    <div className={styles.emailModule}>
      {/* Sidebar Buttons */}
      <div className={styles.sidebar}>
        {emailTabs.map((tab) => {
          const isActive = activeTab === tab.name;
          const iconName = isActive ? `${tab.icon}V2` : tab.icon;
          let tabUnread = 0;
          if (
            tab.name === "Inbox" ||
            tab.name === "Sent" ||
            tab.name === "Drafts"
          ) {
            const tabThreads = filterMergedThreadsByTab(
              tab.name,
              propFilteredThreads,
              mergedMessages,
            );
            tabUnread = getTabUnreadCount(
              tabThreads,
              mergedMessages,
              optimisticallyReadThreads,
              user?.email,
              user?.uid,
            );
          }
          if (tab.name === "Scheduled") {
            tabUnread = scheduledEmails.length;
          }
          return (
            <button
              key={tab.name}
              className={`${styles.button} ${isActive ? styles.active : ""}`}
              onClick={() => setActiveTab(tab.name)}
            >
              <img src={`/icons/${iconName}.svg`} alt={tab.name} />
              {tabUnread > 0 && tab.name !== "Scheduled" && (
                <div className={styles.unreadBadge} />
              )}
              <span className={styles.tooltip}>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Threads */}
      <div className={styles.threadGroup}>
        <EmailThreadHeader
          activeTab={activeTab}
          countGroups={countGroups}
          unreadCount={unreadCount}
          onDiscardAllDrafts={handleDiscardAllDrafts}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          filterOptions={{
            careers: allCareers,
            stages: allStages,
            emailTypes: allEmailTypes,
            status: ["Read", "Unread"],
          }}
          selectedFilters={selectedFilters}
          onSelectedFiltersChange={setSelectedFilters}
        />
        {gmailTokenExpired && (
          <div className={styles.gmailTokenExpiredBanner} role="alert">
            <span>
              Your Gmail connection has expired. Please reconnect your account in{" "}
              <Link
                href={
                  effectiveOrgId
                    ? `/recruiter-dashboard/settings?tab=email&orgID=${effectiveOrgId}`
                    : "/recruiter-dashboard/settings?tab=email"
                }
                className={styles.gmailTokenExpiredLink}
              >
                Email Settings
              </Link>{" "}
              to sync Gmail threads.
            </span>
          </div>
        )}
        {outlookTokenExpired && (
          <div className={styles.gmailTokenExpiredBanner} role="alert">
            <span>
              Your Outlook connection has expired. Please reconnect your account in{" "}
              <Link
                href={
                  effectiveOrgId
                    ? `/recruiter-dashboard/settings?tab=email&orgID=${effectiveOrgId}`
                    : "/recruiter-dashboard/settings?tab=email"
                }
                className={styles.gmailTokenExpiredLink}
              >
                Email Settings
              </Link>{" "}
              to sync Outlook threads.
            </span>
          </div>
        )}
        <div className={styles.threadList}>
          {activeTab === "Scheduled" ? (
            isLoadingScheduled ? (
              <div className={styles.threadColumn}>
                {[...Array(8)].map((_, i) => (
                  <EmailPreviewCardSkeleton key={i} />
                ))}
              </div>
            ) : scheduledEmails.length === 0 ? (
              <div className={styles.emailViewEmpty}>
                <div className={styles.iconWrapper}>
                  <img src="/icons/message-chat-square.svg" />
                </div>
                <span>No scheduled emails</span>
              </div>
            ) : (
              <>
                <div className={styles.threadColumn}>
                  {paginatedScheduledThreads.map((t) => {
                    const threadMessagesForCard = scheduledMessages.filter(
                      (m) => m.threadId === t.id,
                    );
                    return (
                      <EmailPreviewCard
                        key={t.id}
                        thread={t}
                        messages={threadMessagesForCard}
                        isActive={selectedId === t.id}
                        isScheduled={true}
                        onSelect={(id) => {
                          setSelectedId(id);
                          setReplyThreadId(null);
                        }}
                        outlookUserPicture={outlookUser?.picture ?? null}
                        outlookEmail={outlookEmail ?? null}
                      />
                    );
                  })}
                </div>
                <div className={styles.threadPagination}>
                  <Button
                    label="Previous"
                    variant="secondary"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                  />
                  <span>
                    {listForPagination.length > 0 ? startIndex + 1 : 0}-
                    {Math.min(endIndex, listForPagination.length)} of{" "}
                    {listForPagination.length}
                  </span>
                  <Button
                    label="Next"
                    variant="secondary"
                    onClick={handleNextPage}
                    disabled={currentPage >= totalPages}
                  />
                </div>
              </>
            )
          ) : isLoading ? (
            <div className={styles.threadColumn}>
              {[...Array(8)].map((_, i) => (
                <EmailPreviewCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className={styles.emailViewEmpty}>
              <div className={styles.iconWrapper}>
                <img src="/icons/message-chat-square.svg" />
              </div>
              <span>No messages found</span>
            </div>
          ) : (
            <>
              <div className={styles.threadColumn}>
                {paginatedThreads.map((t) => {
                  const threadMessages = mergedMessages.filter(
                    (m) => m.threadId === t.id,
                  );
                  const optimisticReadAt = optimisticallyReadThreads.get(t.id);
                  const draftMessage = threadMessages.find((m: any) => m.isDraft);
                  const isSingleDraftThread =
                    threadMessages.length === 1 &&
                    draftMessage &&
                    (draftMessage as any).isDraft;
                  const isReplyDraftThread =
                    threadMessages.length > 1 && !!draftMessage;
                  return (
                    <EmailPreviewCard
                      key={t.id}
                      thread={t}
                      messages={threadMessages}
                      isActive={selectedId === t.id}
                      optimisticReadAt={optimisticReadAt}
                      onSelect={(id) => {
                        if (isSingleDraftThread && draftMessage) {
                          // Standalone draft: open compose modal only
                          setComposeInitialDraft(draftMessage);
                          setIsComposeModalOpen(true);
                          setReplyThreadId(null);
                          setSelectedId(null);
                          markThreadRead(id);
                        } else if (isReplyDraftThread && draftMessage) {
                          // Reply draft: open thread view with reply card pre-shown
                          setSelectedId(id);
                          setReplyThreadId(id);
                          setComposeInitialDraft(null);
                          markThreadRead(id);
                        } else {
                          setSelectedId(id);
                          setReplyThreadId(null);
                          setComposeInitialDraft(null);
                          markThreadRead(id);
                        }
                      }}
                      outlookUserPicture={outlookUser?.picture ?? null}
                      outlookEmail={outlookEmail ?? null}
                    />
                  );
                })}
              </div>
              <div className={styles.threadPagination}>
                <Button
                  label="Previous"
                  variant="secondary"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                />
                <span>
                  {listForPagination.length > 0 ? startIndex + 1 : 0}-
                  {Math.min(endIndex, listForPagination.length)} of{" "}
                  {totalForDisplay}
                </span>
                <Button
                  label="Next"
                  variant="secondary"
                  onClick={handleNextPage}
                  disabled={nextPageDisabled}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Full Email View */}
      <div className={styles.emailViewGroup}>
        {/* Header */}
        <div className={styles.emailViewHeader}>
          <div className={styles.profileGroup}>
            <Button
              icon="/settings-icon.svg"
              label=""
              variant="secondary"
              onClick={() => {
                refetch();
                refetchGmail();
                refetchOutlook();
                refetchCounts();
                refetchTabStats();
                setLastSync(new Date());
                successToast("Syncing emails...", 1500);
              }}
              style={{ width: 40, height: 40 }}
            />
            <AvatarImage src={user?.image || ""} />
            <div className={styles.profileInfo}>
              <div className={styles.profileName}>{user?.name}</div>
              <div className={styles.profileSync}>
                Last sync:{" "}
                {lastSync ? timeAgo(lastSync) : "Not synced yet"}
              </div>
            </div>
          </div>
          {!hideCompose && (
            <Button
              icon="/icons/plus.svg"
              label="Compose"
              variant="primary"
              onClick={() => setIsComposeModalOpen(true)}
            />
          )}
        </div>

        {selectedThread ? (
          <>
            <div className={styles.emailViewSubject}>
              <span className={styles.subjectText}>
                {firstMessage?.subject ||
                  selectedThread.subject ||
                  "(no subject)"}
              </span>
              <div className={styles.navButtons}>
                <button
                  onClick={goToPrevThread}
                  disabled={isPrevDisabled}
                  aria-label="Previous Thread"
                >
                  <img src="/icons/corner-up-left.svg" />
                </button>
                <button
                  onClick={goToNextThread}
                  disabled={isNextDisabled}
                  aria-label="Next Thread"
                >
                  <img src="/icons/corner-up-right.svg" />
                </button>
              </div>
            </div>
            <div className={styles.emailViewTags}>
              {threadMessages[0] && (
                <>
                  <div className={styles.badge}>
                    Applicant:{" "}
                    {applicantInfo.name || applicantInfo.email || "Unknown"}
                  </div>
                  {effectiveCareerId ? (
                    <>
                      <div className={styles.badge}>
                        Career:{" "}
                        {isLoadingCareerName
                          ? "Loading..."
                          : careerName ||
                            selectedThread?.careerTitle ||
                            "Unknown"}
                      </div>
                      <div className={styles.badge}>
                        Stage:{" "}
                        {isLoadingStage
                          ? "Loading..."
                          : interviewStage || "Unknown"}
                      </div>
                    </>
                  ) : (
                    <div
                      className={`${styles.badge} ${styles.error}`}
                      onClick={() => setIsCareerModalOpen(true)}
                    >
                      Link to Career
                      <img src="/iconsV2/chevron-rightV2.svg" />
                    </div>
                  )}
                </>
              )}
            </div>
            <div className={styles.emailViewContent}>
              <div className={styles.emailViewMessages}>
                {/* Messages: when reply card is open with a draft, hide the draft from the thread so it only appears in the reply composer */}
                <EmailMessageCard
                  thread={selectedThread}
                  messages={
                    replyThreadId === selectedThread.id
                      ? threadMessages.filter((m: any) => !m.isDraft)
                      : threadMessages
                  }
                  onCancelScheduled={
                    activeTab === "Scheduled" ? handleUnschedule : undefined
                  }
                  outlookUserPicture={outlookUser?.picture ?? null}
                  outlookEmail={outlookEmail ?? null}
                />

                {/* Reply Email Card - Only show for non-scheduled threads */}
                {activeTab !== "Scheduled" &&
                  replyThreadId === selectedThread.id && (
                    <ReplyEmailCard
                      threadId={selectedThread.id}
                      onScheduled={() => {
                        refetch();
                        refetchCounts();
                        refetchScheduled();
                        setLastSync(new Date());
                      }}
                      messages={mergedMessages.filter(
                        (m) => m.threadId === selectedThread.id,
                      )}
                      thread={selectedThread}
                      onReplySuccess={() => {
                        refetch();
                        refetchGmail();
                        refetchCounts();
                        setLastSync(new Date());
                        setReplyThreadId(null);
                      }}
                      onClose={() => {
                        refetch();
                        refetchGmail();
                        refetchCounts();
                        refetchTabStats();
                        setReplyThreadId(null);
                      }}
                      initialDraft={
                        threadMessages.find((m: any) => m.isDraft) ?? undefined
                      }
                      initialBody={
                        (() => {
                          const draft = threadMessages.find(
                            (m: any) => m.isDraft,
                          );
                          return draft
                            ? draft.html ??
                              draft.text ??
                              draft.content ??
                              ""
                            : "";
                        })()
                      }
                    />
                  )}
              </div>

              {/* Reply / Forward Actions - Only for non-scheduled and non-Gmail threads */}
              {activeTab !== "Scheduled" &&
                replyThreadId !== selectedThread.id && (
                  <div className={styles.emailViewActions}>
                    <Button
                      icon="/iconsV2/corner-up-left.svg"
                      label="Reply"
                      variant="secondary"
                      onClick={() => setReplyThreadId(selectedThread.id)}
                      style={{ width: "100%" }}
                    />
                    <Button
                      icon="/iconsV2/corner-up-right.svg"
                      label="Forward"
                      variant="secondary"
                      onClick={() => setReplyThreadId(selectedThread.id)}
                      style={{ width: "100%" }}
                    />
                  </div>
                )}
            </div>
          </>
        ) : (
          <div className={styles.emailViewEmpty}>
            <div className={styles.iconWrapper}>
              <img src="/icons/mail.svg" />
            </div>
            <span>
              {activeTab === "Scheduled"
                ? "Select a scheduled email"
                : "Select an email to view the conversation"}
            </span>
          </div>
        )}
      </div>

      {/* Compose Email Modal */}
      {isComposeModalOpen && (
        <ComposeEmailModal
          onClose={() => {
            setIsComposeModalOpen(false);
            setComposeInitialDraft(null);
          }}
          onDraftDiscarded={() => {
            refetch();
            refetchGmail();
            refetchCounts();
            refetchTabStats();
          }}
          onEmailSent={() => {
            refetch();
            refetchGmail();
            refetchCounts();
            setLastSync(new Date());
          }}
          onScheduled={() => {
            refetch();
            refetchGmail();
            refetchCounts();
            refetchScheduled();
            setLastSync(new Date());
          }}
          defaultRecipient={email}
          defaultCareerId={careerId}
          initialDraft={composeInitialDraft}
        />
      )}

      {/* Assign Career Modal */}
      {isCareerModalOpen && (
        <LinkCareerModal
          isOpen={isCareerModalOpen}
          onClose={() => setIsCareerModalOpen(false)}
          threadId={selectedThread?.id || null}
          applicantEmail={applicantInfo.email}
          orgId={effectiveOrgId || null}
          onSuccess={() => {
            // Refresh threads to show updated career link
            refetch();
          }}
        />
      )}

      {/* Insert Template Modal */}
      {isInsertTemplateModalOpen && (
        <InsertTemplateModal
          isOpen={isInsertTemplateModalOpen}
          onClose={() => setIsInsertTemplateModalOpen(false)}
          onSelectTemplate={() => {
            setIsInsertTemplateModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
