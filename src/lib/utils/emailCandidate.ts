import Swal from "sweetalert2";
import { useCallback } from "react";

// Extract file extension from file name
export const getFileExtension = (fileName: string): string => {
  const match = fileName.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
};

// Format file size in human readable form
export const formatFileSize = (size: string | number): string => {
  let bytes = typeof size === "string" ? parseInt(size, 10) : size;
  if (isNaN(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
};

// Extract email address from a string
export const extractEmailFromString = (
  str: string | null | undefined,
): string => {
  if (!str) return "";
  const match = String(str).match(/<([^>]+)>/);
  if (match) return match[1];
  // Check if it's already an email
  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const emailMatch = String(str).match(emailRegex);
  return emailMatch ? emailMatch[0] : str;
};

// Extract name from email string
export const extractNameFromEmail = (
  str: string | null | undefined,
): string => {
  if (!str) return "";
  const match = String(str).match(/^(.+?)\s*<[^>]+>$/);
  if (match) return match[1].trim();
  return extractEmailFromString(str);
};

// Extract email addresses from recipient objects/strings
export const extractRecipientEmails = (recipients: any[]): string[] => {
  return recipients
    .map((r) => {
      if (typeof r === "string") return extractEmailFromString(r);
      return r.email || r.value || r.subtitle || r.label || "";
    })
    .filter(Boolean);
};

// Extract mailgun account ID from sender object
export const extractFromMailgunId = (fromSender: any[]): string => {
  if (!fromSender || fromSender.length === 0) return "";
  return typeof fromSender[0] === "string"
    ? fromSender[0]
    : fromSender[0]?.value || fromSender[0]?.id || "";
};

// Token values may be "Category-Token Label" (e.g. "Careers-Job Title"); return label only for display.
function tokenValueToDisplayLabel(tokenValue: string): string {
  const trimmed = tokenValue.trim();
  const dashIndex = trimmed.indexOf("-");
  if (dashIndex > 0) return trimmed.slice(dashIndex + 1).trim();
  return trimmed;
}

// Cleans subject string from token editor: strips HTML entities and tags
export function cleanEmailSubject(html: string): string {
  if (!html || typeof html !== "string") return "";
  let s = html;
  // Replace &nbsp; with space
  s = s.replace(/&nbsp;/gi, " ");
  // Replace token spans with the token label only (e.g. "Careers-Job Title" -> "Job Title")
  s = s.replace(
    /<span[^>]*data-token="(?:\[\[)?([^\]"]+)(?:\]\])?"[^>]*>[^<]*<\/span>/gi,
    (_, tokenValue) => tokenValueToDisplayLabel(tokenValue),
  );
  // Remove any remaining HTML tags
  s = s.replace(/<[^>]+>/g, "");
  // Decode common HTML entities
  s = s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  // Collapse multiple spaces and trim
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// For preview display: replace token spans with their inner text (actual value e.g. "Jane Doe")
// instead of the token name (e.g. "Candidate Full Name"). Then strip HTML and decode entities.
export function cleanEmailContentForPreview(html: string): string {
  if (!html || typeof html !== "string") return "";
  let s = html;
  s = s.replace(/&nbsp;/gi, " ");
  // Replace token spans with inner content (the actual value, not the token label)
  s = s.replace(
    /<span[^>]*data-token="(?:\[\[)?([^\]"]+)(?:\]\])?"[^>]*>(.*?)<\/span>/gis,
    (_, _tokenValue, inner) => inner.replace(/<[^>]+>/g, "").trim(),
  );
  // Remove any remaining HTML tags
  s = s.replace(/<[^>]+>/g, "");
  // Decode common HTML entities
  s = s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  // Collapse multiple spaces and trim
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// Filter sender options based on user role
// Hiring managers can only send from their own Gmail and Mailgun accounts
// (excludes fallback hr/noreply accounts)
export const filterSenderOptionsByRole = (
  senderOptions: any[],
  userEmail: string | null | undefined,
  userId: string | null | undefined,
  userRoles: string[] | undefined,
  orgRoles: Record<string, string[]> | undefined,
  orgID: string | null | undefined,
  currentOrgRole?: string | null,
): any[] => {
  // Check if user has hiring_manager role (currentOrgRole from activeOrg is the source of truth)
  const isHiringManager =
    currentOrgRole === "hiring_manager" ||
    userRoles?.includes("hiring_manager") ||
    orgRoles?.[orgID || ""]?.includes("hiring_manager");

  if (!isHiringManager) {
    return senderOptions;
  }

  // For hiring managers, only show their own Gmail and Mailgun accounts
  // Exclude fallback accounts (hr-*, no-reply-*)
  const normalizedUserEmail = userEmail?.toLowerCase();

  return senderOptions.filter((option) => {
    // Use id or value (OrgAccountOption shape); fallback to _id for raw account shape
    const optId = option.id ?? option.value ?? option._id ?? "";
    const optIdStr = typeof optId === "string" ? optId : "";

    // Always exclude fallback accounts
    if (optIdStr.startsWith("fallback:")) {
      return false;
    }

    // Include Gmail accounts only if they match the logged-in user's email
    if (option.domain === "google" || optIdStr.startsWith("gmail:")) {
      return option.email?.toLowerCase() === normalizedUserEmail;
    }

    if (option.domain === "outlook" || optIdStr.startsWith("outlook:")) {
      return option.email?.toLowerCase() === normalizedUserEmail;
    }
    return true;
  });
};

// Check if sender is a Gmail account
export const isGmailAccount = (
  fromSender: any[],
  gmailEmails: string[],
): boolean => {
  if (!fromSender || fromSender.length === 0) return false;
  const sender = fromSender[0];
  const email =
    typeof sender === "string" ? null : sender?.email || sender?.subtitle || "";
  const id = extractFromMailgunId(fromSender);

  // Check if ID starts with "gmail:" or if email is in gmailEmails list
  return id.startsWith("gmail:") || (email && gmailEmails.includes(email));
};

// Extract email-settings ID from Gmail account ID
export const extractGmailAccountId = (fromSender: any[]): string | null => {
  const id = extractFromMailgunId(fromSender);
  if (id.startsWith("gmail:")) {
    return id.replace(/^gmail:/, "");
  }
  return null;
};

// Validate email form data
export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
}

// Validate email form data
export const validateEmailForm = (
  fromSender: any[],
  toRecipients: any[],
  subject: string,
  body: string,
  requireSubject: boolean = true,
): EmailValidationResult => {
  if (!fromSender || fromSender.length === 0) {
    return { isValid: false, error: "Please select a sender" };
  }
  if (!toRecipients || toRecipients.length === 0) {
    return { isValid: false, error: "Please add at least one recipient" };
  }
  if (requireSubject && !subject.trim()) {
    return { isValid: false, error: "Please enter a subject" };
  }
  if (!body.trim()) {
    return { isValid: false, error: "Please enter a message" };
  }
  return { isValid: true };
};

// Format reply subject (add "Re:" prefix if not present)
export const formatReplySubject = (originalSubject: string): string => {
  if (!originalSubject) return "";
  if (/^re:\s*/i.test(originalSubject)) {
    return originalSubject;
  }
  return `Re: ${originalSubject}`;
};

//  In-Reply-To header value
export const formatInReplyToHeader = (
  messageId: string | null,
): string | undefined => {
  if (!messageId) return undefined;
  return messageId.startsWith("<") ? messageId : `<${messageId}>`;
};

// Convert HTML to plain text
export const htmlToText = (html: string): string => {
  return html.replace(/<[^>]*>/g, "");
};

// Converts a timestamp to a relative time string (e.g., "2h ago", "3d ago")
export function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 7) {
    return past.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "just now";
}

// Strips HTML tags from a string and returns plain text
// Also handles HTML entities and limits the result to 140 characters
export function stripHtml(html?: string): string {
  if (!html) return "";

  // Create a temporary DOM element to decode HTML entities
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  // Get text content (automatically decodes HTML entities like &nbsp;)
  let text = tempDiv.textContent || tempDiv.innerText || "";

  // Clean up whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text.length > 140 ? text.slice(0, 140) + "…" : text;
}

// Helper function to format time ago
export const timeAgo = (date: Date | null): string => {
  if (!date) return "Not synced yet";
  try {
    const d = new Date(date);
    const diff = Date.now() - d.getTime();
    if (isNaN(diff)) return "Not synced yet";
    if (diff < 0) return "just now";
    const sec = Math.round(diff / 1000);
    if (sec < 60) return `${sec} second${sec === 1 ? "" : "s"} ago`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
    const days = Math.round(hr / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    const weeks = Math.round(days / 7);
    if (weeks < 4) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
    const years = Math.round(days / 365);
    return `${years} year${years === 1 ? "" : "s"} ago`;
  } catch (e) {
    return "Not synced yet";
  }
};

// Types for thread unread checking
export type ThreadReadMap = Record<string, string>;

export type ThreadMessageForUnread = {
  timestamp?: string;
  date?: string;
  senderEmail?: string;
  readBy?: string[];
  direction?: "inbound" | "outbound" | null;
};

export type ThreadForUnread = {
  readMap?: ThreadReadMap;
};

// Helper: get message timestamp for sorting/comparison (timestamp or date)
function getMessageTime(msg: ThreadMessageForUnread): number {
  const raw = msg?.timestamp || msg?.date;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function isThreadUnread(
  thread: ThreadForUnread,
  threadMessages: ThreadMessageForUnread[],
  userEmail: string | null | undefined,
  userUid: string | null | undefined,
  optimisticReadAt?: string,
): boolean {
  try {
    const normalizedUserEmail = (userEmail || "").toLowerCase();
    const normalizedUserUid = userUid || null;
    if (!normalizedUserEmail && !normalizedUserUid) return false;

    // Get the last message in the thread (use timestamp or date for sorting)
    const sorted = [...threadMessages].sort((a, b) => {
      const ta = getMessageTime(a);
      const tb = getMessageTime(b);
      return ta - tb;
    });
    const last = sorted[sorted.length - 1] || threadMessages[0];
    const lastMessageTimestamp = getMessageTime(last);

    // First check optimistic read timestamp (highest priority for immediate UI update)
    if (optimisticReadAt && lastMessageTimestamp > 0) {
      const optimisticReadTimestamp = new Date(optimisticReadAt).getTime();
      if (
        !Number.isNaN(optimisticReadTimestamp) &&
        optimisticReadTimestamp >= lastMessageTimestamp
      ) {
        return false;
      }
    }

    // Explicit: last message is inbound (reply from applicant/candidate) → unread unless marked read
    if (last?.direction === "inbound" && normalizedUserEmail) {
      const readMapTs =
        normalizedUserUid && thread.readMap?.[normalizedUserUid]
          ? new Date(thread.readMap[normalizedUserUid]).getTime()
          : 0;
      const markedReadByMap =
        !Number.isNaN(readMapTs) &&
        readMapTs > 0 &&
        lastMessageTimestamp <= readMapTs;
      const markedReadByMessage =
        Array.isArray(last.readBy) &&
        last.readBy.some(
          (e: string) => String(e || "").toLowerCase() === normalizedUserEmail,
        );
      if (!markedReadByMap && !markedReadByMessage) {
        return true; // show unread badge for new inbound reply
      }
    }

    // Check readMap from thread (using user.uid)
    if (
      normalizedUserUid &&
      thread.readMap &&
      thread.readMap[normalizedUserUid]
    ) {
      const readTimestamp = new Date(
        thread.readMap[normalizedUserUid],
      ).getTime();
      if (!Number.isNaN(readTimestamp) && lastMessageTimestamp > 0) {
        if (lastMessageTimestamp > readTimestamp) {
          return true;
        }
      }
      return false;
    }

    // If the last message was sent by the current user, treat it as read
    if (last?.senderEmail && normalizedUserEmail) {
      const lastSenderEmail = last.senderEmail.toLowerCase();
      if (lastSenderEmail === normalizedUserEmail) return false;
    }

    // Check if user is in the readBy array of the last message
    if (last && Array.isArray(last.readBy) && normalizedUserEmail) {
      const readByEmails = last.readBy.map((email: string) =>
        String(email || "").toLowerCase(),
      );
      return !readByEmails.includes(normalizedUserEmail);
    }

    // If no readBy array or readMap exists, treat as unread (conservative approach)
    return true;
  } catch (e) {
    // On error, treat as read to avoid false positives
    return false;
  }
}

// Filter threads by tab (Inbox, Sent, Drafts)
export function filterThreadsByTab(
  tabName: string,
  threads: any[],
  messages: any[],
): any[] {
  switch (tabName) {
    case "Inbox":
      // Threads that contain at least one inbound message.
      return threads.filter((thread) => {
        const threadMessages = messages.filter((m) => m.threadId === thread.id);
        if (threadMessages.length === 0) return false;
        // Exclude single-message threads that are drafts only
        if (threadMessages.length === 1 && threadMessages[0].isDraft)
          return false;
        return threadMessages.some((m) => m.direction === "inbound");
      });
    case "Sent":
      // Threads that contain at least one outbound message.
      return threads.filter((thread) => {
        const threadMessages = messages.filter((m) => m.threadId === thread.id);
        if (threadMessages.length === 0) return false;
        if (threadMessages.length === 1 && threadMessages[0].isDraft)
          return false;
        return threadMessages.some((m) => m.direction === "outbound");
      });
    case "Drafts":
      // Threads with at least one draft message
      return threads.filter((thread) => {
        const threadMessages = messages.filter((m) => m.threadId === thread.id);
        return threadMessages.some((m) => m.isDraft);
      });
    default:
      return threads;
  }
}

// Get unread count for a set of threads
export function getTabUnreadCount(
  threads: any[],
  messages: any[],
  optimisticallyReadThreads: Map<string, string>,
  userEmail: string | null | undefined,
  userUid: string | null | undefined,
): number {
  return threads.reduce((count, thread) => {
    const threadMessages = messages.filter((m) => m.threadId === thread.id);
    const optimisticReadAt = optimisticallyReadThreads.get(thread.id);
    return isThreadUnread(
      thread,
      threadMessages,
      userEmail,
      userUid,
      optimisticReadAt,
    )
      ? count + 1
      : count;
  }, 0);
}

// Extract all participant emails from a message (from, senderEmail, to, cc, bcc) as lowercase. 
export function extractParticipantEmails(msg: any): string[] {
  const raw = [
    msg?.from,
    msg?.senderEmail,
    ...(Array.isArray(msg?.to) ? msg.to : msg?.to ? [msg.to] : []),
    ...(Array.isArray(msg?.cc) ? msg.cc : msg?.cc ? [msg.cc] : []),
    ...(Array.isArray(msg?.bcc) ? msg.bcc : msg?.bcc ? [msg.bcc] : []),
  ].filter(Boolean);
  return raw.map((p: any) => {
    const s = typeof p === "string" ? p : "";
    const match = s.match(/<([^>]+)>/);
    return (match ? match[1] : s).toLowerCase();
  });
}

// Get numeric date for thread sorting (lastMessage.date or thread.date). 
export function getThreadDateForSort(thread: any): number {
  const date = thread?.lastMessage?.date ?? thread?.date;
  if (typeof date === "string") return new Date(date).getTime();
  if (date instanceof Date) return date.getTime();
  if (typeof date === "number") return date;
  return 0;
}

// Filter threads that have at least one draft message (or thread.isDraft). 
export function getDraftThreads(threads: any[], allMessages: any[]): any[] {
  return threads.filter((thread) => {
    const threadMessages = allMessages.filter((m) => m.threadId === thread.id);
    return (
      (thread as any).isDraft || threadMessages.some((m: any) => m.isDraft)
    );
  });
}

// Unified tab filter for merged Mailgun + Gmail threads (Inbox, Sent, Drafts). Scheduled returns [].
export function filterMergedThreadsByTab(
  tab: string,
  threads: any[],
  allMessages: any[],
): any[] {
  if (tab === "Scheduled") return [];
  if (tab === "Drafts") return getDraftThreads(threads, allMessages);

  return threads.filter((thread) => {
    const isGmailThread = (thread as any).source === "gmail";
    const threadMessages = allMessages.filter(
      (m) => m.threadId === thread.id,
    );

    if (isGmailThread) {
      switch (tab) {
        case "Inbox": {
          const hasInbox =
            (thread as any).isInbox ||
            ((thread as any).labelIds && (thread as any).labelIds.includes("INBOX"));
          const isSentOnly =
            ((thread as any).isSent ||
              ((thread as any).labelIds &&
                (thread as any).labelIds.includes("SENT"))) &&
            !hasInbox;
          return hasInbox && !isSentOnly;
        }
        case "Sent": {
          const isSent =
            (thread as any).isSent ||
            ((thread as any).labelIds &&
              (thread as any).labelIds.includes("SENT"));
          const isDraft =
            (thread as any).isDraft ||
            ((thread as any).labelIds &&
              (thread as any).labelIds.includes("DRAFT"));
          return isSent && !isDraft;
        }
        default:
          return true;
      }
    }

    const baseFiltered = filterThreadsByTab(tab, [thread], allMessages);
    if (baseFiltered.length === 0) return false;
    if (["Inbox", "Sent"].includes(tab)) {
      const hasDraftMessage = threadMessages.some((m: any) => m.isDraft);
      const hasNonDraftMessage = threadMessages.some((m: any) => !m.isDraft);
      if (hasDraftMessage && hasNonDraftMessage) return true;
    }
    return true;
  });
}

// Return true if thread matches search string (participants, career, subject, content).
export function threadMatchesSearch(
  thread: any,
  threadMessages: any[],
  searchValue: string,
): boolean {
  const lower = searchValue.trim().toLowerCase();
  if (!lower) return true;
  const participants = [
    ...(threadMessages.flatMap((m: any) => [
      m.from,
      ...(m.to || []),
      ...(m.cc || []),
      ...(m.bcc || []),
    ]) || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const career = ((thread as any).careerTitle || "").toLowerCase();
  const subject = ((thread as any).subject || "").toLowerCase();
  const content = threadMessages
    .map((m: any) => m.body || m.content || m.snippet || "")
    .join(" ")
    .toLowerCase();
  return (
    participants.includes(lower) ||
    career.includes(lower) ||
    subject.includes(lower) ||
    content.includes(lower)
  );
}

// Return true if thread matches selected filters (career, stage, emailType, status).
export function threadMatchesSelectedFilters(
  thread: any,
  mergedMessages: any[],
  selectedFilters: {
    career: string[];
    stage: string[];
    emailType: string[];
    status?: string[];
  },
  optimisticallyReadThreads: Map<string, string>,
  user: { email?: string | null; uid?: string | null } | null | undefined,
): boolean {
  const isGmailThread = (thread as any).source === "gmail";
  const threadMessages = mergedMessages.filter((m) => m.threadId === thread.id);

  if (selectedFilters.career.length > 0 && thread.careerId) {
    if (!selectedFilters.career.includes(thread.careerId)) return false;
  } else if (selectedFilters.career.length > 0 && !thread.careerId) {
    return false;
  }

  if (selectedFilters.stage.length > 0 && !isGmailThread) {
    if (
      !threadMessages.some((m: any) =>
        selectedFilters.stage.includes(m.stage),
      )
    ) {
      return false;
    }
  }

  if (selectedFilters.emailType.length > 0) {
    let match = false;
    for (const type of selectedFilters.emailType) {
      if (
        (type === "Automated" && threadMessages.some((m: any) => m.isAutomated)) ||
        (type === "Manual" && threadMessages.some((m: any) => !m.isAutomated))
      ) {
        match = true;
      }
    }
    if (!match) return false;
  }

  if (selectedFilters.status && selectedFilters.status.length > 0) {
    const optimisticReadAt = optimisticallyReadThreads.get(thread.id);
    const unread = isThreadUnread(
      thread,
      threadMessages,
      user?.email,
      user?.uid,
      optimisticReadAt,
    );
    const read = !unread;
    if (selectedFilters.status.length === 2) return true;
    if (
      selectedFilters.status.length === 1 &&
      ((selectedFilters.status[0] === "Unread" && !unread) ||
        (selectedFilters.status[0] === "Read" && !read))
    ) {
      return false;
    }
  }
  return true;
}

/** Build count groups for email tab header (total, automated, direct). */
export function getEmailTabCountGroups(
  activeTab: string,
  tabStats: { totalMessageCount: number; automatedCount: number; directCount: number } | null,
  scheduledCount: number,
  gmailCount: number,
  filteredMessages: any[],
): { name: string; icon: string; count: number }[] {
  if (activeTab === "Scheduled") {
    return [
      { name: "total", icon: "mail", count: scheduledCount },
      { name: "automated", icon: "zap-purple", count: 0 },
      { name: "direct", icon: "user-orange", count: scheduledCount },
    ];
  }
  if (tabStats) {
    return [
      {
        name: "total",
        icon: "mail",
        count: tabStats.totalMessageCount + gmailCount,
      },
      {
        name: "automated",
        icon: "zap-purple",
        count: tabStats.automatedCount,
      },
      {
        name: "direct",
        icon: "user-orange",
        count: tabStats.directCount + gmailCount,
      },
    ];
  }
  return [
    {
      name: "total",
      icon: "mail",
      count: filteredMessages.length,
    },
    {
      name: "automated",
      icon: "zap-purple",
      count: filteredMessages.filter((m: any) => m.isAutomated).length,
    },
    {
      name: "direct",
      icon: "user-orange",
      count: filteredMessages.filter((m: any) => !m.isAutomated).length,
    },
  ];
}

// Use thread navigation hook
export function useThreadNavigation(
  filteredThreads: any[],
  selectedThread: any,
  setSelectedId: (id: string) => void,
  setReplyThreadId: (id: string | null) => void,
  markThreadRead: (id: string) => void,
): {
  goToPrevThread: () => void;
  goToNextThread: () => void;
  isPrevDisabled: boolean;
  isNextDisabled: boolean;
} {
  const currentIdx = filteredThreads.findIndex(
    (t) => t.id === selectedThread?.id,
  );

  const goToPrevThread = useCallback(() => {
    if (currentIdx > 0) {
      setSelectedId(filteredThreads[currentIdx - 1].id);
      setReplyThreadId(null);
      markThreadRead(filteredThreads[currentIdx - 1].id);
    }
  }, [
    currentIdx,
    filteredThreads,
    setSelectedId,
    setReplyThreadId,
    markThreadRead,
  ]);

  const goToNextThread = useCallback(() => {
    if (currentIdx >= 0 && currentIdx < filteredThreads.length - 1) {
      setSelectedId(filteredThreads[currentIdx + 1].id);
      setReplyThreadId(null);
      markThreadRead(filteredThreads[currentIdx + 1].id);
    }
  }, [
    currentIdx,
    filteredThreads,
    setSelectedId,
    setReplyThreadId,
    markThreadRead,
  ]);

  const isPrevDisabled = !selectedThread || currentIdx <= 0;
  const isNextDisabled =
    !selectedThread ||
    currentIdx === filteredThreads.length - 1 ||
    filteredThreads.length === 0;

  return { goToPrevThread, goToNextThread, isPrevDisabled, isNextDisabled };
}

// Insert template into subject/body and update form data
export function insertTemplateToEditors({
  template,
  subjectEditorRef,
  bodyEditorRef,
  setFormData,
}) {
  if (template.subject && subjectEditorRef.current?.insertTemplate) {
    subjectEditorRef.current.insertTemplate(template.subject, "");
  }
  if (template.body && bodyEditorRef.current?.insertTemplate) {
    bodyEditorRef.current.insertTemplate("", template.body);
  }
  setFormData((prev) => ({
    ...prev,
    email_subject: template.subject || prev.email_subject,
    email_body: template.body || prev.email_body,
  }));
}

// Save selection before opening link modal
export function saveEditorSelectionForLinkModal(bodyEditorRef, savedRangeRef) {
  const editor = bodyEditorRef.current?.getElement();
  if (editor) {
    const sel = window.getSelection();
    if (
      sel &&
      sel.rangeCount > 0 &&
      editor.contains(sel.getRangeAt(0).commonAncestorContainer)
    ) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }
}

// Insert link at selection or caret in editor
export function insertLinkInEditor({
  url,
  bodyEditorRef,
  savedRangeRef,
  setFormData,
}) {
  if (bodyEditorRef.current) {
    const editor = bodyEditorRef.current.getElement();
    if (editor) {
      editor.focus();
      const sel = window.getSelection();
      sel?.removeAllRanges();
      if (savedRangeRef.current) {
        sel?.addRange(savedRangeRef.current);
      }
      let range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      if (!range || !editor.contains(range.commonAncestorContainer)) {
        // If no valid selection, insert a link at caret with URL as text
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.style.color = "#0070f3";
        a.style.textDecoration = "underline";
        a.textContent = url;
        editor.appendChild(a);
        setFormData((prev) => ({
          ...prev,
          email_body: editor.innerHTML,
        }));
        return;
      }
      // If selection exists, apply link
      if (!range.collapsed) {
        document.execCommand("createLink", false, url);
        setTimeout(() => {
          const links = editor.querySelectorAll('a[href="' + url + '"]');
          links.forEach((a) => {
            a.setAttribute("target", "_blank");
            a.setAttribute("rel", "noopener noreferrer");
            a.style.color = "#0070f3";
            a.style.textDecoration = "underline";
          });
          setFormData((prev) => ({
            ...prev,
            email_body: editor.innerHTML,
          }));
        }, 0);
      } else {
        // If selection is collapsed, insert a link at caret
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.style.color = "#0070f3";
        a.style.textDecoration = "underline";
        a.textContent = url;
        range.insertNode(a);
        // Move caret after the link
        range.setStartAfter(a);
        range.collapse(true);
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
        setFormData((prev) => ({
          ...prev,
          email_body: editor.innerHTML,
        }));
      }
    }
  }
}

// Handle discarding email with confirmation
export async function handleDiscardEmail({
  setFormData,
  setFromSender,
  setToRecipients,
  setCcRecipients,
  setBccRecipients,
  setLinkedCareer,
  clearAttachments,
  setShowCc,
  setShowBcc,
  onClose,
  onBeforeDiscard,
  onAfterDiscard,
}: {
  setFormData?: (v: any) => void;
  setFromSender?: (v: any) => void;
  setToRecipients?: (v: any) => void;
  setCcRecipients?: (v: any) => void;
  setBccRecipients?: (v: any) => void;
  setLinkedCareer?: (v: any) => void;
  clearAttachments?: () => void;
  setShowCc?: (v: boolean) => void;
  setShowBcc?: (v: boolean) => void;
  onClose?: () => void;
  onBeforeDiscard?: () => void | Promise<void>;
  onAfterDiscard?: () => void;
} = {}) {
  const result = await Swal.fire({
    title: "Discard this email?",
    text: "All content will be lost. This action cannot be undone.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Yes, discard it",
    cancelButtonText: "Cancel",
  });
  if (result.isConfirmed) {
    await onBeforeDiscard?.();
    if (setFormData) setFormData({ email_subject: "", email_body: "" });
    if (setFromSender) setFromSender([]);
    if (setToRecipients) setToRecipients([]);
    if (setCcRecipients) setCcRecipients([]);
    if (setBccRecipients) setBccRecipients([]);
    if (setLinkedCareer) setLinkedCareer([]);
    if (clearAttachments) clearAttachments();
    if (setShowCc) setShowCc(false);
    if (setShowBcc) setShowBcc(false);
    if (onClose) onClose();
    onAfterDiscard?.();
  }
}

// Format a timestamp with relative time (e.g., "3 hours ago")
// Displays full date/time for messages older than 24 hours
export const formatTimestamp = (ts?: string) => {
  if (!ts) return "";
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);

  const formatted = date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  if (diffMs < 24 * 60 * 60 * 1000 && diffMs >= 0) {
    let relative = "";
    if (diffHour >= 1) {
      relative = `${diffHour} ${diffHour === 1 ? "hour" : "hours"} ago`;
    } else if (diffMin >= 1) {
      relative = `${diffMin} ${diffMin === 1 ? "min" : "mins"} ago`;
    } else {
      relative = "just now";
    }
    return `${formatted} (${relative})`;
  }

  return formatted;
};

// Format a scheduled send date for display
// e.g., "Wed, Jan 30, 2026 3:30 PM"
export const formatScheduledTime = (isoDate: string): string => {
  try {
    const d = new Date(isoDate);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoDate;
  }
};

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Format a Date to "Jan 30, 2026" format (Philippine time)
export const getFormattedDateFull = (date: Date) =>
  `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

// Get tomorrow's date in "Jan 30, 2026" format
export const getTomorrowDate = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getFormattedDateFull(tomorrow);
};

// Get next Monday's date in "Jan 30, 2026" format
export const getNextMonday = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  return getFormattedDateFull(nextMonday);
};

// Parse Philippine date string (e.g., "Jan 20, 2026")
// Returns { year, monthIndex, day } or null if invalid
export const parsePHDate = (input: string) => {
  const m = input.match(/^(\w{3})\s(\d{1,2}),\s(\d{4})$/);
  if (!m) return null;
  const mon = MONTHS.indexOf(m[1]);
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (mon === -1 || mon === undefined) return null;
  return { year, monthIndex: mon, day };
};

// Parse Philippine time string (e.g., "3:27 PM")
// Returns { hour24, minute } or null if invalid
export const parsePHTime = (input: string) => {
  const m = input.match(/^(0?[1-9]|1[0-2]):([0-5]\d)[\u00A0\u202F\s]?(AM|PM)$/);
  if (!m) return null;
  const hour12 = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const period = m[3];
  let hour24 = hour12 % 12;
  if (period === "PM") hour24 += 12;
  return { hour24, minute };
};

// Build UTC Date from Philippine date and time strings
// Handles conversion from PH timezone (UTC+8) to UTC
export const buildSendDate = (
  dateStr: string,
  timeStr: string,
): Date | null => {
  const dParts = parsePHDate(dateStr);
  const tParts = parsePHTime(timeStr);
  if (!dParts || !tParts) return null;
  return new Date(
    Date.UTC(
      dParts.year,
      dParts.monthIndex,
      dParts.day,
      tParts.hour24 - 8,
      tParts.minute,
      0,
      0,
    ),
  );
};
