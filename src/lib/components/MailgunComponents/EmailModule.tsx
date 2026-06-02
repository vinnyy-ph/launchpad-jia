"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AvatarImage from "../AvatarImage/AvatarImage";
import CustomDropdown from "@/lib/components/Dropdown/CustomDropdown";
import ComposeEmailModule from "./ComposeEmailModule";
import ReplyEmailModule from "./ReplyEmailModule";
import type { MailgunAccount } from "./EmailEditor";
import { api } from "@/lib/utils/apiClient";
import { errorToast, successToast } from "@/lib/Utils";
import axios from "axios";
import Button from "@/lib/components/ui/button/Button";

interface EmailModuleProps {
  orgId: string;
  onOpenCompose?: (data: any) => void;
  applicantEmail?: string;
  careerId?: string;
  displayComposeButton?: boolean;
  mailgunAccounts?: MailgunAccount[];
  mailgunRole?: string | null;
  selectedMailgunAccountId?: string | null;
}

// Return a short absolute date string like "Mon, Jul 22, 2025, 10:53 AM".
const formatDate = (date: any) => {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch (e) {
    return "";
  }
};

// Return a human-friendly relative time string like "2 hours ago".
const timeAgo = (date: any) => {
  try {
    const d = new Date(date);
    const diff = Date.now() - d.getTime();
    if (isNaN(diff)) return "";
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
    return "";
  }
};

// Parse email address with optional display name: "DisplayName <email@domain>" or "email@domain"
const parseEmailAddress = (
  address: string | null | undefined
): { displayName: string | null; email: string } => {
  if (!address) return { displayName: null, email: "" };
  const str = String(address).trim();
  // Match pattern: "DisplayName <email@domain>"
  const match = str.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    const displayName = match[1].trim();
    const email = match[2].trim();
    return { displayName: displayName || null, email };
  }
  // Otherwise treat the whole string as email
  return { displayName: null, email: str };
};

export default function EmailModule({
  orgId,
  onOpenCompose,
  applicantEmail,
  careerId,
  displayComposeButton,
  mailgunAccounts: prefetchedAccounts,
  mailgunRole: prefetchedRole,
  selectedMailgunAccountId: prefetchedSelected,
}: EmailModuleProps) {
  const router = useRouter();
  const [hasMailgunAccount, setHasMailgunAccount] = useState<boolean | null>(
    null
  );
  const [hasGmailConnected, setHasGmailConnected] = useState<boolean | null>(
    null
  );
  const [isEnablingMailgun, setIsEnablingMailgun] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [memberImage, setMemberImage] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null
  );
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [mailgunAccounts, setMailgunAccounts] = useState<MailgunAccount[]>([]);
  const [mailgunRole, setMailgunRole] = useState<string | null>(null);
  const [selectedMailgunAccountId, setSelectedMailgunAccountId] = useState<
    string | null
  >(null);
  const [gmailEmails, setGmailEmails] = useState<any[]>([]);
  const [gmailThreads, setGmailThreads] = useState<any[]>([]);
  const [isLoadingGmail, setIsLoadingGmail] = useState(false);
  const [selectedGmailThreadId, setSelectedGmailThreadId] = useState<string | null>(null);
  const [gmailCategoryFilter, setGmailCategoryFilter] = useState<string>("All Gmail");

  // Prefetch Mailgun accounts/role once per module load so downstream editors reuse cached data
  useEffect(() => {
    let cancelled = false;

    const activeOrgRaw =
      typeof window !== "undefined" ? localStorage.getItem("activeOrg") : null;
    const activeOrg = activeOrgRaw ? JSON.parse(activeOrgRaw) : null;

    (async () => {
      // Fetch organization domains based on orgId
      let domainsList: string[] = [];
      try {
        const domainsRes = await api.get(
          "/api/mailgun-module/fetch-org-domains",
          {
            params: { orgId },
          }
        );
        if (Array.isArray(domainsRes.data)) {
          // Filter domains that have fullDomain attribute (orgId matching happens server-side)
          domainsList = domainsRes.data
            .filter((d: any) => d?.fullDomain)
            .map((d: any) => d.fullDomain);
        }
      } catch (err) {
        console.debug("Could not fetch organization domains", err);
      }

      // Fallback to hellojia.ai if no domains found
      if (domainsList.length === 0) {
        domainsList = ["hellojia.ai"];
      }

      const fallbackEmails = domainsList.flatMap((d: string) => [
        `hr@${d}`,
        `noreply@${d}`,
      ]);

      const fallbackAccounts: MailgunAccount[] = fallbackEmails.map((fb) => ({
        _id: `fallback:${fb}`,
        userId: null,
        organizationId: null,
        email: fb,
        mailboxName: undefined,
        domain: undefined,
        routeId: null,
        isActive: false,
      }));

      // Initialize with fallback accounts immediately
      if (!cancelled) {
        setMailgunAccounts(fallbackAccounts);
        setMailgunRole("hiring_manager");
        setSelectedMailgunAccountId(fallbackAccounts[0]?._id || null);
      }

      try {
        const [meRes, orgAccountsRes] = await Promise.allSettled([
          api.get("/api/mailgun-module/mg-fetch-account", {
            params: { orgId },
          }),
          api.get(`/api/mailgun-module/mg-fetch-org-accounts?orgId=${orgId}`),
        ]);

        let userAccount: MailgunAccount | null = null;
        let currentUserRole: string | null = "hiring_manager";
        if (meRes.status === "fulfilled") {
          userAccount = meRes.value.data?.account || null;
          currentUserRole = meRes.value.data?.role || "hiring_manager";
        }

        let orgAccountsData: MailgunAccount[] = [];
        if (orgAccountsRes.status === "fulfilled") {
          const data = orgAccountsRes.value.data;
          if (Array.isArray(data?.accounts)) orgAccountsData = data.accounts;
        }

        let finalAccounts: MailgunAccount[] = orgAccountsData.slice();
        if (
          userAccount &&
          !finalAccounts.find((a) => a && a._id === userAccount!._id)
        ) {
          finalAccounts = [userAccount, ...finalAccounts];
        }

        for (const fb of fallbackEmails) {
          if (!finalAccounts.find((a) => a && a.email === fb)) {
            finalAccounts.push({
              _id: `fallback:${fb}`,
              userId: null,
              organizationId: null,
              email: fb,
              mailboxName: undefined,
              domain: undefined,
              routeId: null,
              isActive: false,
            });
          }
        }

        const initialSelectedId = userAccount
          ? userAccount._id
          : finalAccounts[0]?._id || null;

        // Fetch Gmail accounts for the organization
        try {
          const res = await axios.get(`/api/gmail/users?orgID=${orgId}`);
          const result = res.data.result.map((item) => ({
            _id: item._id,
            domain: "google",
            image: item.userDetails.picture,
            email: item.userDetails.email,
            userId: item.userID,
            routeId: null,
            organizationId: JSON.parse(localStorage.getItem("activeOrg"))._id,
            mailboxName: item.userDetails.email.split("@")[0],
            isActive: true,
          }));
          finalAccounts = [...finalAccounts, ...result];
        } catch (err) {
          console.error("Error fetching Gmail users:", err);
        }

        setMailgunAccounts(finalAccounts);
        setMailgunRole(currentUserRole);
        setSelectedMailgunAccountId(initialSelectedId);
      } catch (err) {
        console.debug("Could not fetch mailgun accounts (EmailModule)", err);
        if (cancelled) return;
        setMailgunAccounts(fallbackAccounts);
        setMailgunRole((prev) => prev || "hiring_manager");
        setSelectedMailgunAccountId(
          (prev) =>
            prev || (fallbackAccounts[0] ? fallbackAccounts[0]._id : null)
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orgId, prefetchedAccounts, prefetchedRole, prefetchedSelected]);

  // Helper: determine whether a thread is unread for the current user
  const isThreadUnreadForUser = (thread: any) => {
    try {
      if (thread && thread.__localRead) return false;
      const u = (userEmail || "").toLowerCase();
      if (!u) return false;

      // Common server-side shapes: readBy or seenBy arrays
      if (Array.isArray(thread?.readBy)) {
        return !thread.readBy
          .map((s: any) => String(s || "").toLowerCase())
          .includes(u);
      }
      if (Array.isArray(thread?.seenBy)) {
        return !thread.seenBy
          .map((s: any) => String(s || "").toLowerCase())
          .includes(u);
      }

      // Per-message markers
      const last =
        thread?.lastMessage ||
        (thread?.messages || [])[thread?.messages?.length - 1];
      // If the last message was authored by the current user, treat it as read
      try {
        if (last) {
          const lastFromRaw =
            last?.from || last?.sender || last?.toRaw || last?.replyTo || "";
          const m = String(lastFromRaw || "").match(
            /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
          );
          const lastFrom = m
            ? String(m[0]).toLowerCase()
            : String(lastFromRaw).toLowerCase();
          if (lastFrom && lastFrom === (u || "")) return false;

          // If the last message is a draft created by the current user, also treat as read
          const lastIsDraft =
            last &&
            (last.isDraft ||
              last.is_draft ||
              last.draft ||
              (typeof last.status === "string" &&
                last.status.toLowerCase() === "draft") ||
              (typeof last.direction === "string" &&
                last.direction.toLowerCase() === "draft"));
          if (lastIsDraft && lastFrom && lastFrom === (u || "")) return false;
        }
      } catch (e) {
        /* ignore */
      }
      if (last) {
        if (Array.isArray(last?.readBy)) {
          return !last.readBy
            .map((s: any) => String(s || "").toLowerCase())
            .includes(u);
        }
        if (Array.isArray(last?.seenBy)) {
          return !last.seenBy
            .map((s: any) => String(s || "").toLowerCase())
            .includes(u);
        }
      }

      // Fallback: compare last message time vs a locally stored per-user last-open timestamp
      const key = `jia-thread-last-opened-${u}`;
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const map = JSON.parse(raw || "{}");
          const openedTs = map && map[String(thread?.id)];
          if (openedTs && last?.createdAt) {
            const lastTs = new Date(last.createdAt).getTime();
            return lastTs > Number(openedTs);
          }
          if (!openedTs && last?.createdAt) {
            // never opened -> unread
            return true;
          }
        } else {
          // nothing stored - be conservative: show unread if last message exists and it's recent
          if (last?.createdAt) return true;
        }
      } catch (e) {
        // ignore localStorage parse errors
      }
    } catch (e) {
      // On unexpected shape, treat as read
      return false;
    }
    return false;
  };

  const [showReply, setShowReply] = useState(false);
  const [replyDraft, setReplyDraft] = useState<{
    to?: string | null;
    subject?: string | null;
    careerId?: string | null;
    threadId?: string | null;
    initialMessage?: string | null;
    inReplyTo?: string | null;
  } | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState<any>(null);
  const [dismissedThreadWarnings, setDismissedThreadWarnings] = useState<
    Record<string, boolean>
  >({});

  // Pagination: index of current page (0-based) and page size
  const [pageIndex, setPageIndex] = useState<number>(0);
  const PAGE_SIZE = 10;
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Local filter states for the left-hand dropdowns (controlled to avoid runtime errors)
  const [statusFilter, setStatusFilter] = useState<string>("All Emails");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  // Role options derived from messages/threads (label -> careerId[])
  const [roleOptions, setRoleOptions] = useState<string[]>(["All Roles"]);
  const [roleLabelToIds, setRoleLabelToIds] = useState<
    Record<string, string[]>
  >({});

  const selectedMessage =
    messages.find((mm) => mm._id === selectedMessageId) ||
    (searchResults || []).find((mm) => mm._id === selectedMessageId) ||
    null;

  // Build role options (human-friendly labels) and map them to careerId(s)
  useEffect(() => {
    try {
      const src =
        searchResults &&
        Array.isArray(searchResults) &&
        searchResults.length > 0
          ? searchResults
          : messages;
      const labelSet = new Map<string, Set<string>>();
      for (const m of src || []) {
        try {
          // Prefer readable job titles; only fall back to careerId when no title exists
          const titleCandidate = ((): string | null => {
            const fromMsg =
              m?.jobTitle ||
              m?.careerTitle ||
              m?.career?.title ||
              m?.role ||
              m?.careerName;
            if (fromMsg) return String(fromMsg).trim();
            const fromThread =
              m?.threadCareerTitle ||
              (m?.threadId &&
                (m.threadId.jobTitle ||
                  m.threadId.title ||
                  m.threadId.careerTitle));
            return fromThread ? String(fromThread).trim() : null;
          })();

          const idCandidates = [] as string[];
          if (m?.careerId) idCandidates.push(String(m.careerId));
          if (m?.careerID) idCandidates.push(String(m.careerID));
          if (m?.career && typeof m.career === "string")
            idCandidates.push(String(m.career));
          if (m?.threadCareerId) idCandidates.push(String(m.threadCareerId));
          if (m?.threadId && (m.threadId as any).careerId)
            idCandidates.push(String((m.threadId as any).careerId));

          const label =
            titleCandidate && titleCandidate.length > 0 ? titleCandidate : null;

          if (label) {
            if (!labelSet.has(label)) labelSet.set(label, new Set<string>());
            const s = labelSet.get(label)!;
            for (const cid of idCandidates) {
              if (cid) s.add(cid);
            }
          } else {
            // If no readable label, fall back to the first available careerId
            for (const cid of idCandidates) {
              const fallback = String(cid);
              if (!labelSet.has(fallback))
                labelSet.set(fallback, new Set<string>());
              labelSet.get(fallback)!.add(fallback);
              break;
            }
          }
        } catch (e) {
          /* ignore per-item errors */
        }
      }

      const opts: string[] = ["All Roles"];
      const mapping: Record<string, string[]> = {};
      Array.from(labelSet.keys())
        .sort((a, b) => a.localeCompare(b))
        .forEach((lab) => {
          opts.push(lab);
          mapping[lab] = Array.from(labelSet.get(lab) || []).map((v) =>
            String(v)
          );
        });

      setRoleOptions(opts);
      setRoleLabelToIds(mapping);
      // If no roleFilter set, keep as All Roles
      if (!roleFilter) setRoleFilter("All Roles");
    } catch (e) {
      // ignore
    }
  }, [messages, searchResults]);

  // Helper: determine whether a message involves the given applicant email
  const messageInvolvesApplicant = (m: any, email?: string | null) => {
    if (!email) return true;
    try {
      const e = String(email).toLowerCase();
      const parts: string[] = [];
      const pushIf = (v: any) => {
        if (v === undefined || v === null) return;
        if (Array.isArray(v)) parts.push(v.join(" "));
        else parts.push(String(v));
      };

      pushIf(m.from);
      pushIf(m.sender);
      pushIf(m.to);
      pushIf(m.recipient);
      pushIf(m.toRaw);
      pushIf(m.replyTo);
      pushIf(m.recipientList);
      pushIf(m.cc);
      pushIf(m.bcc);
      pushIf(m.toList);

      const hay = parts.join(" ").toLowerCase();
      return hay.includes(e);
    } catch (err) {
      return false;
    }
  };

  // Centralized draft detection helper (reused in rendering and thread assembly)
  const isDraftFlag = (m: any) => {
    if (!m) return false;
    const truthy = (val: any) =>
      val === true || val === 1 || String(val).toLowerCase() === "true";
    return (
      truthy(m.isDraft) ||
      truthy(m.is_draft) ||
      truthy(m.draft) ||
      (typeof m.status === "string" && m.status.toLowerCase() === "draft") ||
      (typeof m.direction === "string" && m.direction.toLowerCase() === "draft")
    );
  };

  // Mark thread read via API and update local threads state optimistically
  const markThreadReadApi = async (threadId: any) => {
    try {
      // optimistic update: mark in local threads array using localStorage fallback
      setThreads((prev) =>
        prev.map((t) => {
          if (String(t.id || t._id) === String(threadId)) {
            const copy = { ...t };
            copy.__localRead = true;
            return copy;
          }
          return t;
        })
      );

      await api.post("/api/mailgun-module/mg-mark-read", { threadId });
      // refresh messages/threads from server so server-side markers are reflected
      try {
        fetchMessages(false, searchQuery);
      } catch (e) {}
    } catch (err) {
      console.error("markThreadReadApi error", err);
    }
  };

  // Helpers: extract an email address and detect whether a sender is an org member.
  const extractEmail = (raw?: string) => {
    if (!raw) return "";
    const s = String(raw).trim();
    const angle = s.match(/<([^>]+)>/);
    if (angle && angle[1]) return angle[1].toLowerCase();
    const token = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return (token && token[0].toLowerCase()) || s.toLowerCase();
  };

  const isOrgMemberEmail = (email?: string) => {
    if (!email) return false;
    const e = String(email).toLowerCase();

    // First, check if the email exists in the mailgunAccounts array for this org
    if (mailgunAccounts && mailgunAccounts.length > 0) {
      const matchingAccount = mailgunAccounts.find((account) => {
        if (!account || !account.email) return false;
        const accountEmail = String(account.email).toLowerCase();
        // Check if the email matches and belongs to the current org
        return (
          accountEmail === e &&
          (account.organizationId === null ||
            account.organizationId === undefined ||
            String(account.organizationId) === String(orgId))
        );
      });
      if (matchingAccount) return true;
    }

    // Fallback: check domain against the signed-in user email
    if (typeof userEmail === "string" && userEmail.includes("@")) {
      const myDomain = userEmail.split("@")[1].toLowerCase();
      if (myDomain && e.endsWith(`@${myDomain}`)) return true;
    }
    return false;
  };

  const messageIsFromOrg = (m: any) => {
    if (!m) return false;
    // Prefer explicit flags if present
    if (m.fromIsOrgMember || m.fromIsMember || m.fromIsInternal) return true;
    const fromRaw = m.from || m.sender || m.replyTo || "";
    const fromEmail = extractEmail(fromRaw);
    if (!fromEmail) return false;
    const parts = String(fromEmail).toLowerCase().split("@");
    const local = parts[0] || "";
    const domain = parts[1] || "";
    // Treat all @hellojia.ai emails as internal
    if (domain === "hellojia.ai") return true;
    // Treat hr@ and noreply@ addresses as org members (internal)
    if (/^(hr|noreply)$/.test(local)) return true;
    // Ignore other no-reply addresses (external)
    if (/^(no-?reply)/i.test(local)) return false;
    return isOrgMemberEmail(fromEmail);
  };

  const threadContainsOtherOrgMessage = (thread: any) => {
    if (!thread || !Array.isArray(thread.messages)) return false;
    const me = (userEmail || "").toLowerCase();
    return thread.messages.some((m: any) => {
      const fromRaw = m?.from || m?.sender || m?.replyTo || "";
      const fromEmail = extractEmail(fromRaw);
      if (!fromEmail) return false;
      if (fromEmail === me) return false; // skip messages from self
      return messageIsFromOrg(m);
    });
  };

  // Tabs: control which threads are displayed
  const [selectedTab, setSelectedTab] = useState<string>("inbox");

  // Fetch Gmail emails for all users in the organization
  const fetchGmailEmails = async () => {
    if (!orgId) return;
    setIsLoadingGmail(true);
    try {
      const response = await api.get("/api/gmail/emails", {
        params: { 
          orgID: orgId,
          ...(careerId && { careerId }),
        },
      });
      if (response.data?.data && Array.isArray(response.data.data)) {
        setGmailEmails(response.data.data);
      } else {
        setGmailEmails([]);
      }
      // Set threads if available
      if (response.data?.threads && Array.isArray(response.data.threads)) {
        setGmailThreads(response.data.threads);
      } else {
        setGmailThreads([]);
      }
    } catch (err) {
      console.error("Error fetching Gmail emails:", err);
      setGmailEmails([]);
      setGmailThreads([]);
    } finally {
      setIsLoadingGmail(false);
    }
  };

  // Filter Gmail threads by category filter
  const getFilteredGmailThreads = () => {
    if (!gmailThreads || gmailThreads.length === 0) return [];
    if (selectedTab !== "gmail") return [];
    
    let filtered = gmailThreads;
    
    if (gmailCategoryFilter === "Inbox") {
      filtered = gmailThreads.filter((thread) => {
        const hasInbox = thread.isInbox || (thread.labelIds && thread.labelIds.includes("INBOX"));
        const isSentOnly = (thread.isSent || (thread.labelIds && thread.labelIds.includes("SENT"))) && !hasInbox;
        return hasInbox && !isSentOnly;
      });
    } else if (gmailCategoryFilter === "Sent") {
      filtered = gmailThreads.filter((thread) => {
        const isSent = thread.isSent || (thread.labelIds && thread.labelIds.includes("SENT"));
        const isDraft = thread.isDraft || (thread.labelIds && thread.labelIds.includes("DRAFT"));
        return isSent && !isDraft;
      });
    } else if (gmailCategoryFilter === "Drafts") {
      filtered = gmailThreads.filter((thread) => {
        return thread.isDraft || (thread.labelIds && thread.labelIds.includes("DRAFT"));
      });
    }
    
    return filtered;
  };

  const threadHasDraft = (thread: any) => {
    if (!thread || !Array.isArray(thread.messages)) return false;
    return thread.messages.some(isDraftFlag);
  };

  const threadHasExternalSender = (thread: any) => {
    if (!thread || !Array.isArray(thread.messages)) return false;
    const me = (userEmail || "").toLowerCase();
    return thread.messages.some((m: any) => {
      try {
        const fromRaw = m?.from || m?.sender || m?.replyTo || "";
        const fromEmail = extractEmail(fromRaw);
        if (!fromEmail) return false;
        if (String(fromEmail).toLowerCase() === me) return false;
        return !messageIsFromOrg(m);
      } catch (e) {
        return false;
      }
    });
  };

  const threadHasOrgSender = (thread: any) => {
    if (!thread || !Array.isArray(thread.messages)) return false;
    return thread.messages.some((m: any) => {
      try {
        return messageIsFromOrg(m);
      } catch (e) {
        return false;
      }
    });
  };

  // Check if thread only has a single draft message
  const threadOnlyHasSingleDraft = (thread: any) => {
    if (!thread || !Array.isArray(thread.messages)) return false;
    if (thread.messages.length !== 1) return false;
    return isDraftFlag(thread.messages[0]);
  };

  // Navigate to a thread by index in the filtered `threadsForTab` array
  const navigateToThreadAtIndex = (index: number) => {
    // Derive which threads are shown based on selected tab (Inbox / Sent / Drafts)
    const threadsForTab = (threads || []).filter((t) => {
      try {
        if (selectedTab === "inbox") return threadHasExternalSender(t);
        if (selectedTab === "sent")
          return threadHasOrgSender(t) && !threadOnlyHasSingleDraft(t);
        if (selectedTab === "drafts") return threadHasDraft(t);
        return true;
      } catch (e) {
        return true;
      }
    });
    if (!threadsForTab || threadsForTab.length === 0) return;
    if (index < 0 || index >= threadsForTab.length) return;
    const t = threadsForTab[index];
    if (!t) return;
    setSelectedThreadId(String(t.id));
    // Select the last message in the thread (consistent with list click behavior)
    try {
      setSelectedMessageId(t.lastMessage?._id || null);
    } catch (e) {
      setSelectedMessageId(null);
    }
    setShowReply(false);

    // Mark this thread as opened/read for this user in localStorage (fallback persistence)
    try {
      const u = (userEmail || "").toLowerCase();
      if (u) {
        const key = `jia-thread-last-opened-${u}`;
        const raw = localStorage.getItem(key);
        const map = raw ? JSON.parse(raw) : {};
        map[String(t.id)] = Date.now();
        localStorage.setItem(key, JSON.stringify(map));
      }
    } catch (e) {
      // ignore localStorage errors
    }
    // Trigger server-side mark-read (debounced/optimistic locally)
    try {
      // small delay to avoid noisy writes on accidental navigation
      setTimeout(() => {
        markThreadReadApi(t.id);
      }, 300);
    } catch (e) {}
  };

  const goToPrevThread = () => {
    // Derive which threads are shown based on selected tab (Inbox / Sent / Drafts)
    const threadsForTab = (threads || []).filter((t) => {
      try {
        if (selectedTab === "inbox") return threadHasExternalSender(t);
        if (selectedTab === "sent")
          return threadHasOrgSender(t) && !threadOnlyHasSingleDraft(t);
        if (selectedTab === "drafts") return threadHasDraft(t);
        return true;
      } catch (e) {
        return true;
      }
    });
    if (!threadsForTab || threadsForTab.length === 0) return;
    const curIdx = selectedThreadId
      ? threadsForTab.findIndex(
          (tt) => String(tt.id) === String(selectedThreadId)
        )
      : -1;
    if (curIdx <= 0) {
      // already at beginning or none selected -> go to first thread
      navigateToThreadAtIndex(0);
    } else {
      navigateToThreadAtIndex(curIdx - 1);
    }
  };

  const goToNextThread = () => {
    // Derive which threads are shown based on selected tab (Inbox / Sent / Drafts)
    const threadsForTab = (threads || []).filter((t) => {
      try {
        if (selectedTab === "inbox") return threadHasExternalSender(t);
        if (selectedTab === "sent")
          return threadHasOrgSender(t) && !threadOnlyHasSingleDraft(t);
        if (selectedTab === "drafts") return threadHasDraft(t);
        return true;
      } catch (e) {
        return true;
      }
    });
    if (!threadsForTab || threadsForTab.length === 0) return;
    const curIdx = selectedThreadId
      ? threadsForTab.findIndex(
          (tt) => String(tt.id) === String(selectedThreadId)
        )
      : -1;
    if (curIdx === -1) {
      // nothing selected -> go to first thread
      navigateToThreadAtIndex(0);
    } else if (curIdx >= threadsForTab.length - 1) {
      // already at last -> keep at last
      navigateToThreadAtIndex(threadsForTab.length - 1);
    } else {
      navigateToThreadAtIndex(curIdx + 1);
    }
  };

  // Unread counts per tab (before pagination)
  const unreadInboxCount = (threads || []).filter(
    (t) => threadHasExternalSender(t) && isThreadUnreadForUser(t)
  ).length;
  const unreadSentCount = (threads || []).filter(
    (t) =>
      threadHasOrgSender(t) &&
      !threadOnlyHasSingleDraft(t) &&
      isThreadUnreadForUser(t)
  ).length;
  const unreadDraftsCount = (threads || []).filter(
    (t) => threadHasDraft(t) && isThreadUnreadForUser(t)
  ).length;

  // Derive which threads are shown based on selected tab (Inbox / Sent / Drafts)
  // This ONLY applies to Mailgun threads, NOT Gmail emails
  const threadsForTab = selectedTab === "gmail" 
    ? [] // Empty array when on Gmail tab - Gmail emails are handled separately
    : (threads || []).filter((t) => {
        try {
          if (selectedTab === "inbox") return threadHasExternalSender(t);
          if (selectedTab === "sent")
            return threadHasOrgSender(t) && !threadOnlyHasSingleDraft(t);
          if (selectedTab === "drafts") return threadHasDraft(t);
          return true;
        } catch (e) {
          return true;
        }
      });

  // Compute disabled state for prev/next navigation buttons (based on filtered tab threads)
  const currentThreadIndex = selectedThreadId
    ? threadsForTab.findIndex(
        (tt) => String(tt.id) === String(selectedThreadId)
      )
    : -1;

  const prevDisabled =
    !threadsForTab || threadsForTab.length === 0 || currentThreadIndex <= 0;
  const nextDisabled =
    !threadsForTab ||
    threadsForTab.length === 0 ||
    currentThreadIndex >= threadsForTab.length - 1;

  // Get filtered Gmail threads based on selected tab
  const filteredGmailThreads = selectedTab === "gmail" ? getFilteredGmailThreads() : [];

  // Gmail thread counts by category
  const gmailInboxCount = gmailThreads.filter((thread) => {
    const hasInbox = thread.isInbox || (thread.labelIds && thread.labelIds.includes("INBOX"));
    const isSentOnly = (thread.isSent || (thread.labelIds && thread.labelIds.includes("SENT"))) && !hasInbox;
    return hasInbox && !isSentOnly;
  }).length;
  const gmailSentCount = gmailThreads.filter((thread) => {
    const isSent = thread.isSent || (thread.labelIds && thread.labelIds.includes("SENT"));
    const isDraft = thread.isDraft || (thread.labelIds && thread.labelIds.includes("DRAFT"));
    return isSent && !isDraft;
  }).length;
  const gmailDraftsCount = gmailThreads.filter((thread) => {
    return thread.isDraft || (thread.labelIds && thread.labelIds.includes("DRAFT"));
  }).length;

  // Pagination derived values (based on filtered tab list)
  const totalThreads = threadsForTab ? threadsForTab.length : 0;
  const totalGmailThreads = selectedTab === "gmail" ? filteredGmailThreads.length : 0;
  const totalItems = selectedTab === "gmail" ? totalGmailThreads : totalThreads;
  const lastPageIndex = Math.max(0, Math.ceil(totalItems / PAGE_SIZE) - 1);
  const startThreadIndex = totalItems === 0 ? 0 : pageIndex * PAGE_SIZE + 1;
  const endThreadIndex = Math.min(totalItems, (pageIndex + 1) * PAGE_SIZE);
  const pagedThreads = threadsForTab.slice(
    pageIndex * PAGE_SIZE,
    (pageIndex + 1) * PAGE_SIZE
  );
  const pagedGmailThreads = filteredGmailThreads.slice(
    pageIndex * PAGE_SIZE,
    (pageIndex + 1) * PAGE_SIZE
  );

  // Ensure pageIndex is valid when threads change
  useEffect(() => {
    if (pageIndex > lastPageIndex) setPageIndex(lastPageIndex);
    if (pageIndex < 0) setPageIndex(0);
  }, [threads.length]);

  // Fetch Gmail connection status from email settings
  useEffect(() => {
    let mounted = true;
    
    async function fetchGmailStatus() {
      try {
        const token = localStorage.getItem("authToken");
        if (!token) return;
        
        const res = await axios.get(`/api/emails/settings?orgID=${orgId}`, {
          headers: { Authorization: token },
        });
        
        if (!mounted) return;
        
        const emailSettings = res.data?.emailSettings;
        if (emailSettings && emailSettings.connected) {
          setHasGmailConnected(true);
          // Set Gmail email from settings
          if (emailSettings.user && emailSettings.user.email) {
            setGmailEmail(emailSettings.user.email);
          }
        } else {
          setHasGmailConnected(false);
        }
      } catch (err) {
        console.error("Error fetching Gmail status", err);
        if (mounted) setHasGmailConnected(false);
      }
    }
    
    if (orgId) {
      fetchGmailStatus();
    }
    
    return () => {
      mounted = false;
    };
  }, [orgId]);

  useEffect(() => {
    let mounted = true;

    // Fetch Mailgun account info for the current user and org
    async function fetchAccount() {
      try {
        // Use the `orgId` prop as the single source of truth
        const resolvedOrgId = orgId;

        // Pass orgId as a query param via axios `params` to avoid manual URL construction
        const params: any = {};
        if (resolvedOrgId) params.orgId = resolvedOrgId;

        const res = await api.get("/api/mailgun-module/mg-fetch-account", {
          params,
        });
        const data = res.data;
        if (!mounted) return;

        // Handle org-scoped response: prefer accounts/memberId/orgId when provided
        if (data?.accounts && Array.isArray(data.accounts)) {
          // Admin/org-level response
          setHasMailgunAccount(data.accounts.length > 0);
          // try to pick a sensible user email from the accounts list
          try {
            const accounts = data.accounts || [];
            let picked: string | null = null;
            if (data.memberId) {
              const match = accounts.find(
                (a: any) =>
                  String(a.userId) === String(data.memberId) ||
                  String(a._id) === String(data.memberId)
              );
              if (match && match.email) picked = String(match.email);
            }
            if (!picked && accounts.length > 0 && accounts[0].email)
              picked = String(accounts[0].email);
            if (picked) setUserEmail(picked);
          } catch (e) {
            /* ignore */
          }
        } else if (data?.account) {
          // Single-account response
          // If we requested a specific org, ensure returned orgId matches
          if (resolvedOrgId && data?.orgId) {
            setHasMailgunAccount(
              String(data.orgId) === String(resolvedOrgId) && !!data.memberId
            );
          } else {
            setHasMailgunAccount(true);
          }
          // single account response may include email
          try {
            if (data.account && data.account.email)
              setUserEmail(String(data.account.email));
          } catch (e) {}
        } else {
          setHasMailgunAccount(false);
        }

        if (data?.memberId) setMemberId(data.memberId);
        if (data?.memberImage) setMemberImage(data.memberImage);
      } catch (err) {
        console.error("Error fetching mailgun account", err);
        setHasMailgunAccount(false);
      }
    }

    fetchAccount();
    return () => {
      mounted = false;
    };
  }, [orgId, searchQuery]);

  // Fetch messages for the org when account is available
  useEffect(() => {
    if (!orgId || hasMailgunAccount !== true) return;
    let mounted = true;
    async function loadMessages() {
      try {
        const res = await api.get(`/api/mailgun-module/mg-fetch-messages`, {
          params: { orgId },
        });
        if (!mounted) return;
        const msgs = res.data?.messages || [];
        setSearchResults(null);
        setMessages(msgs);
        try {
          setLastSync(new Date());
        } catch (e) {}
      } catch (err) {
        console.error("Failed to load messages", err);
      }
    }
    // Use the reusable fetchMessages below but avoid showing the manual spinner on initial load
    loadMessages();
    return () => {
      mounted = false;
    };
  }, [orgId, hasMailgunAccount]);


  // Reusable fetch function to refresh messages on demand (shows minimal syncing UI when asked)
  const fetchMessages = async (showIndicator = true, q?: string) => {
    if (!orgId) return;
    try {
      console.debug("EmailModule: fetchMessages called", { showIndicator });
    } catch (e) {}
    if (showIndicator) setIsSyncing(true);
    try {
      // If a search query is provided, use the search endpoint which applies text filtering server-side
      let res;
      if (q && String(q).trim().length > 0) {
        res = await api.get(`/api/mailgun-module/mg-search-messages`, {
          params: { orgId, q },
        });
        const msgs = res.data?.messages || [];
        // keep search results separate; do not overwrite the full `messages` store
        setSearchResults(msgs);
      } else {
        res = await api.get(`/api/mailgun-module/mg-fetch-messages`, {
          params: { orgId },
        });
        const msgs = res.data?.messages || [];
        setSearchResults(null);
        setMessages(msgs);
      }
      try {
        setLastSync(new Date());
      } catch (e) {}
    } catch (err) {
      console.error("Failed to fetch messages", err);
    } finally {
      if (showIndicator) setIsSyncing(false);
    }
  };

  // Listen for global sync requests (from Compose UI instances that don't have a direct onSync prop)
  useEffect(() => {
    const handler = () => {
      try {
        fetchMessages(true, searchQuery);
      } catch (e) {
        console.error("mailgun:sync-request handler error", e);
      }
    };
    try {
      if (typeof window !== "undefined")
        window.addEventListener("mailgun:sync-request", handler as any);
    } catch (e) {}
    return () => {
      try {
        if (typeof window !== "undefined")
          window.removeEventListener("mailgun:sync-request", handler as any);
      } catch (e) {}
    };
  }, [orgId]);

  // Fetch Gmail emails when Gmail tab is selected or when orgId changes
  useEffect(() => {
    if (orgId && selectedTab === "gmail") {
      fetchGmailEmails();
    }
  }, [orgId, selectedTab]);

  // Reset Gmail selection and filters when switching tabs
  useEffect(() => {
    if (selectedTab !== "gmail") {
      setSelectedGmailThreadId(null);
      setGmailCategoryFilter("All Gmail");
    } else {
      setSelectedThreadId(null); // Reset Mailgun selection when switching to Gmail
    }
  }, [selectedTab]);

  // compute threads from messages
  useEffect(() => {
    // Use searchResults as the source for the left-hand email list when present;
    // otherwise fall back to the full `messages` store.
    const sourceMessages =
      searchResults && Array.isArray(searchResults) && searchResults.length > 0
        ? searchResults
        : messages;
    if (!sourceMessages || sourceMessages.length === 0) {
      setThreads([]);
      return;
    }

    // If an applicantEmail prop is provided, only include messages involving that email
    let msgsToUse = applicantEmail
      ? sourceMessages.filter((m) =>
          messageInvolvesApplicant(m, applicantEmail)
        )
      : sourceMessages.slice();

    // If a careerId prop is provided, further restrict messages to those matching the career
    if (careerId) {
      try {
        const desired = String(careerId);
        msgsToUse = msgsToUse.filter((m) => {
          const mid =
            m?.careerId ||
            m?.careerID ||
            m?.career ||
            (m?.threadId && (m.threadId.careerId || m.threadId.careerID));
          if (mid === undefined || mid === null) return false;
          return String(mid) === desired;
        });
        try {
          // eslint-disable-next-line no-console
          console.debug(
            "EmailModule: filtered messages by careerId",
            careerId,
            msgsToUse.length
          );
        } catch (e) {}
      } catch (e) {
        // ignore filtering errors
      }
    }

    if (!msgsToUse || msgsToUse.length === 0) {
      setThreads([]);
      return;
    }

    const map = new Map<string, any>();
    const threadSubjects = new Map<string, string>();
    for (const m of msgsToUse) {
      const tid = String(m.threadId || (m.threadId?._id ?? ""));
      if (!map.has(tid)) {
        map.set(tid, { id: tid, messages: [] as any[] });
      }
      // capture thread subject if the message contains thread metadata
      try {
        if (
          m &&
          m.threadId &&
          typeof m.threadId === "object" &&
          m.threadId.subject
        ) {
          threadSubjects.set(tid, String(m.threadId.subject));
        }
      } catch (e) {
        // ignore
      }
      map.get(tid).messages.push(m);
    }
    // use centralized draft detection helper `isDraftFlag`

    let arr = Array.from(map.values()).map((t) => {
      // sort messages in thread by createdAt desc to get last message
      t.messages = t.messages
        .slice()
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      const last = t.messages[0];
      // Prefer thread document's subject, otherwise prefer the most recent non-draft message's subject
      const threadSub = threadSubjects.get(t.id);
      let subjectFromNonDraft: string | null = null;
      try {
        const nonDraft = t.messages.find(
          (m: any) => !isDraftFlag(m) && (m.subject || m.text || m.html)
        );
        if (nonDraft) subjectFromNonDraft = nonDraft.subject || null;
      } catch (e) {
        /* ignore */
      }

      const chosenSubject =
        threadSub ||
        subjectFromNonDraft ||
        last?.subject ||
        (t.messages[0] && t.messages[0].subject) ||
        "(no subject)";

      return {
        id: t.id,
        subject: chosenSubject,
        lastMessage: last,
        messages: t.messages,
        lastUpdated: last?.createdAt || null,
      };
    });
    // sort threads by lastUpdated desc
    arr.sort(
      (a, b) =>
        new Date(b.lastUpdated || 0).getTime() -
        new Date(a.lastUpdated || 0).getTime()
    );

    // If user chose to see only unread threads, filter using the helper
    try {
      if (statusFilter === "Unread Only") {
        arr = arr.filter((t: any) => isThreadUnreadForUser(t));
      }
    } catch (e) {
      // swallowing filter errors to avoid breaking the list
    }

    // Apply role filter: selected label maps to one or more careerIds
    try {
      if (roleFilter && roleFilter !== "All Roles") {
        const ids = roleLabelToIds[roleFilter] || [];
        if (ids.length > 0) {
          const idSet = new Set(ids.map((i) => String(i)));
          arr = arr.filter((t: any) => {
            try {
              // check lastMessage careerId or any message in thread
              const last = t.lastMessage;
              const lastId =
                last?.careerId ||
                last?.careerID ||
                (last?.career && String(last.career));
              if (lastId && idSet.has(String(lastId))) return true;
              if (Array.isArray(t.messages)) {
                for (const m of t.messages) {
                  const mid =
                    m?.careerId ||
                    m?.careerID ||
                    (m?.career && String(m.career));
                  if (mid && idSet.has(String(mid))) return true;
                }
              }
            } catch (e) {}
            return false;
          });
        } else {
          // If no mapped ids, try to match label text against message fields
          const lab = String(roleFilter).toLowerCase();
          arr = arr.filter((t: any) => {
            try {
              const last = t.lastMessage;
              const cand =
                (last &&
                  (last.jobTitle ||
                    last.careerTitle ||
                    last.role ||
                    last.careerName)) ||
                null;
              if (cand && String(cand).toLowerCase().includes(lab)) return true;
              if (Array.isArray(t.messages)) {
                for (const m of t.messages) {
                  const c =
                    (m &&
                      (m.jobTitle ||
                        m.careerTitle ||
                        m.role ||
                        m.careerName)) ||
                    null;
                  if (c && String(c).toLowerCase().includes(lab)) return true;
                }
              }
            } catch (e) {}
            return false;
          });
        }
      }
    } catch (e) {
      // ignore role filter errors
    }

    // Apply type filter: Automated vs Manual based on first (earliest) message sender
    try {
      if (typeFilter && typeFilter === "Automated") {
        arr = arr.filter((t: any) => {
          try {
            const msgs = Array.isArray(t.messages) ? t.messages : [];
            if (msgs.length === 0) return false;
            // find earliest message by createdAt
            let first = msgs[0];
            for (const m of msgs) {
              try {
                if (
                  m?.createdAt &&
                  first?.createdAt &&
                  new Date(m.createdAt).getTime() <
                    new Date(first.createdAt).getTime()
                ) {
                  first = m;
                }
              } catch (e) {}
            }
            const fromRaw = first?.from || first?.sender || first?.toRaw || "";
            const emailMatch = String(fromRaw || "").match(
              /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
            );
            if (!emailMatch) return false;
            const email = String(emailMatch[0]).toLowerCase();
            const parts = email.split("@");
            if (parts.length !== 2) return false;
            const local = parts[0];
            const domain = parts[1];
            if (
              (local === "no-reply" || local === "noreply") &&
              domain.endsWith("hellojia.ai")
            )
              return true;
          } catch (e) {}
          return false;
        });
      } else if (typeFilter && typeFilter === "Manual") {
        // Manual = exclude automated senders
        arr = arr.filter((t: any) => {
          try {
            const msgs = Array.isArray(t.messages) ? t.messages : [];
            if (msgs.length === 0) return true;
            let first = msgs[0];
            for (const m of msgs) {
              try {
                if (
                  m?.createdAt &&
                  first?.createdAt &&
                  new Date(m.createdAt).getTime() <
                    new Date(first.createdAt).getTime()
                ) {
                  first = m;
                }
              } catch (e) {}
            }
            const fromRaw = first?.from || first?.sender || first?.toRaw || "";
            const emailMatch = String(fromRaw || "").match(
              /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
            );
            if (!emailMatch) return true;
            const email = String(emailMatch[0]).toLowerCase();
            const parts = email.split("@");
            if (parts.length !== 2) return true;
            const local = parts[0];
            const domain = parts[1];
            if (
              (local === "no-reply" || local === "noreply") &&
              domain.endsWith("hellojia.ai")
            )
              return false;
          } catch (e) {}
          return true;
        });
      }
    } catch (e) {
      // ignore type filter errors
    }

    setThreads(arr);
  }, [
    messages,
    searchResults,
    careerId,
    applicantEmail,
    statusFilter,
    roleFilter,
    roleLabelToIds,
    typeFilter,
  ]);

  // Enable Mailgun email creation for the current user and org
  async function handleEnableMailgunIntegration() {
    // Use the `orgId` prop as canonical org id
    const resolvedOrgId = orgId;

    if (!memberId || !resolvedOrgId) {
      errorToast("Unable to determine member or organization", 2500);
      return;
    }

    setIsEnablingMailgun(true);
    try {
      const res = await api.post(
        `/api/mailgun-module/mg-enable-acount?orgID=${resolvedOrgId}`,
        {
          // server will derive user from auth token; only send createInbound flag
          createInbound: true,
        }
      );

      // API may return a single identity or an array of identities; normalize to an array
      const identitiesRaw = Array.isArray(res?.data?.identities)
        ? res.data.identities
        : res?.data?.identity
        ? [res.data.identity]
        : [];

      // Keep only identities that belong to this org (if orgId is present)
      const identities = identitiesRaw.filter((id: any) => {
        if (!id) return false;
        if (id.organizationId === undefined || id.organizationId === null)
          return true;
        return String(id.organizationId) === String(resolvedOrgId);
      });

      if (identities.length > 0) {
        const primary = identities[0];
        successToast("Mailgun account created", 1200);
        setHasMailgunAccount(true);

        try {
          if (primary.email) setUserEmail(String(primary.email));
        } catch (_) {}

        // Merge all returned identities into local state and select the primary one
        try {
          setMailgunAccounts((prev) => {
            const current = (prev || []).filter(Boolean) as any[];
            const existingIds = new Set(current.map((a) => String(a._id)));
            const additions = identities
              .filter(
                (id: any) => id && id._id && !existingIds.has(String(id._id))
              )
              .map((id: any) => ({
                _id: String(id._id),
                userId: id.userId ? String(id.userId) : null,
                organizationId: id.organizationId
                  ? String(id.organizationId)
                  : null,
                email: id.email,
                domain: id.domain,
                routeId: id.routeId || null,
                isActive: Boolean(id.canSend || id.canReceive || id.isActive),
              }));
            return [...current, ...additions] as any;
          });
        } catch (_) {}

        try {
          setSelectedMailgunAccountId((prev) =>
            prev ? prev : String(primary._id)
          );
        } catch (_) {}

        try {
          fetchMessages(true, searchQuery);
        } catch (_) {}

        // Notify parent pages to refresh account lists once so UI buttons reflect the new account
        try {
          if (typeof window !== "undefined") {
            const evt = new CustomEvent("mailgun:account-enabled", {
              detail: { orgId: resolvedOrgId },
            });
            window.dispatchEvent(evt);
          }
        } catch (_) {}
      } else {
        errorToast("Failed to create Mailgun account", 2500);
      }
    } catch (err) {
      console.error("Enable Mailgun error", err);
      const apiMessage =
        (err as any)?.response?.data?.message || (err as any)?.message || "";
      if (
        typeof apiMessage === "string" &&
        apiMessage.toLowerCase().includes("no domains")
      ) {
        errorToast(
          "No organization domains available. Please add a domain before enabling Mailgun.",
          3000
        );
      } else {
        errorToast("Error enabling Mailgun account", 2500);
      }
    } finally {
      setIsEnablingMailgun(false);
    }
  }

  // If we haven't loaded account info yet, show nothing (or a loader)
  if (hasMailgunAccount === null || hasGmailConnected === null) {
    return (
      <div id="email-module" className="email-container">
        <div style={{ padding: 24 }}>
          <i className="la la-circle-notch la-spin"></i> Loading...
        </div>
      </div>
    );
  }

  // If user does not have Mailgun account AND does not have Gmail connected
  if (hasMailgunAccount === false && hasGmailConnected === false) {
    return (
      <div className="gmail-integration">
        <div className="gmail-integration-content">
          <i className="las la-envelope gmail-integration-icon"></i>
          <h2 className="gmail-integration-title">Email Integration Required</h2>
          <p className="gmail-integration-text">
            To send and receive emails from applicants, please enable Mailgun
            email creation or connect your Gmail account in Settings.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              label={isEnablingMailgun ? "Enabling..." : "Enable Mailgun Email"}
              variant="primary"
              size="default"
              disabled={isEnablingMailgun}
              onClick={handleEnableMailgunIntegration}
              svgAsset={
                isEnablingMailgun ? (
                  <i className="la la-spinner la-spin" style={{ marginRight: 8 }}></i>
                ) : undefined
              }
            />
            <Button
              label="Go to Settings"
              variant="secondary"
              size="default"
              onClick={() => {
                try {
                  const url = `/recruiter-dashboard/settings?orgID=${encodeURIComponent(String(orgId))}&tab=email`;
                  router.push(url);
                } catch (e) {
                  if (typeof window !== "undefined") {
                    window.location.href = `/recruiter-dashboard/settings?orgID=${encodeURIComponent(String(orgId))}&tab=email`;
                  }
                }
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div id="email-module" className="email-container">
        {/* Left Sidebar - Email Navigation and List */}
        <div className="sidebar">
          {/* Search Bar */}
          <div className="sidebar-header">
            <div className="search-container">
              <div style={{ position: "relative" }}>
                <svg
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "16px",
                    height: "16px",
                    color: "#6c757d",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {/* TODO: Inbox search input */}
                <input
                  type="text"
                  placeholder="Search emails"
                  value={searchQuery}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchQuery(v);
                    // Fetch immediately without debouncing to ensure fresh data with mixed Gmail/Mailgun threads
                    try {
                      fetchMessages(true, v);
                    } catch (e) {
                      console.error("search fetch error", e);
                    }
                  }}
                  className="search-input"
                />
              </div>
            </div>

            {/* Primary Navigation Tabs */}
            <div className="tab-container">
              {/* TODO: Update count to show all unread threads, not just displayed threads/messages */}
              <button
                onClick={() => {
                  setSelectedTab("inbox");
                }}
                className={`tab-button ${
                  selectedTab === "inbox" ? "active" : ""
                }`}
              >
                <i className="las la-inbox"></i>
                Inbox
                {unreadInboxCount > 0 && (
                  <span className="badge">{unreadInboxCount}</span>
                )}
              </button>
              <button
                onClick={() => {
                  setSelectedTab("sent");
                }}
                className={`tab-button ${
                  selectedTab === "sent" ? "active" : ""
                }`}
              >
                <i className="las la-paper-plane"></i>
                Sent
                {unreadSentCount > 0 && (
                  <span className="badge">{unreadSentCount}</span>
                )}
              </button>
              <button
                onClick={() => {
                  setSelectedTab("drafts");
                }}
                className={`tab-button ${
                  selectedTab === "drafts" ? "active" : ""
                }`}
              >
                <i className="las la-edit"></i>
                Drafts
                {unreadDraftsCount > 0 && (
                  <span className="badge">{unreadDraftsCount}</span>
                )}
              </button>
              <button
                onClick={() => {
                  setSelectedTab("gmail");
                  setPageIndex(0);
                }}
                className={`tab-button ${
                  selectedTab === "gmail" ? "active" : ""
                }`}
              >
                <i className="las la-envelope"></i>
                Gmail
                {gmailThreads.length > 0 && (
                  <span className="badge" title={`Inbox: ${gmailInboxCount}, Sent: ${gmailSentCount}, Drafts: ${gmailDraftsCount}`}>
                    {gmailThreads.length}
                  </span>
                )}
              </button>
            </div>

            {/* Filter Dropdowns - Show different filters for Gmail vs Mailgun */}
            {selectedTab === "gmail" ? (
              <div className="filter-container">
                <CustomDropdown
                  options={["All Gmail", "Inbox", "Sent", "Drafts"]}
                  icon="la-filter"
                  valuePrefix="Category:"
                  value={gmailCategoryFilter}
                  setValue={(value) => {
                    setGmailCategoryFilter(value);
                    setPageIndex(0); // Reset to first page when filter changes
                  }}
                  maxContent={true}
                />
              </div>
            ) : (
              <div className="filter-container">
                <CustomDropdown
                  options={["All Emails", "Unread Only"]}
                  icon="la-filter"
                  valuePrefix="Status:"
                  value={statusFilter}
                  setValue={setStatusFilter}
                  maxContent={true}
                />
                <CustomDropdown
                  options={
                    roleOptions && roleOptions.length
                      ? roleOptions
                      : ["All Roles"]
                  }
                  icon="la-filter"
                  valuePrefix="Role:"
                  value={roleFilter}
                  setValue={setRoleFilter}
                  maxContent={true}
                />
                <CustomDropdown
                  options={["All", "Manual", "Automated"]}
                  icon="la-filter"
                  valuePrefix="Type:"
                  value={typeFilter}
                  setValue={setTypeFilter}
                  maxContent={true}
                />
              </div>
            )}
          </div>

          {/* Email List */}
          <div className="email-list">
            {selectedTab === "gmail" ? (
              // Gmail threads list
              isLoadingGmail ? (
                <div style={{ padding: 24, textAlign: "center", color: "#666" }}>
                  <i className="la la-spinner la-spin" style={{ fontSize: "24px" }}></i>
                  <p>Loading Gmail emails...</p>
                </div>
              ) : filteredGmailThreads.length === 0 ? (
                <div style={{ padding: 24, color: "#666" }}>No Gmail emails</div>
              ) : (
                pagedGmailThreads.map((thread) => {
                  const last = thread.lastMessage;
                  const parsedFrom = parseEmailAddress(last?.from);
                  const isSelected = selectedGmailThreadId === String(thread.id);
                  const snippet = last?.snippet || last?.text?.slice(0, 140) || last?.html?.replace(/<[^>]*>/g, "").slice(0, 140) || "";
                  return (
                    <div
                      key={thread.id}
                      onClick={() => {
                        setSelectedGmailThreadId(String(thread.id));
                      }}
                      className={`email-item ${isSelected ? "selected" : ""}`}
                      style={{
                        backgroundColor: isSelected ? "#F0F4FF" : "#fff",
                        border: isSelected ? "2px solid #6172F3" : "1px solid #e0e0e0",
                        padding: "12px",
                        marginBottom: "8px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = "#f8f9fa";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = "#fff";
                        }
                      }}
                    >
                      <div className="email-content">
                        <AvatarImage
                          src={`https://api.dicebear.com/9.x/glass/svg?seed=${parsedFrom.email}`}
                          className="rounded-circle"
                          alt={parsedFrom.email}
                          style={{ width: "32px", height: "32px" }}
                        />
                        <div className="email-info">
                          <div className="email-header">
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span className="email-name">
                                {parsedFrom.displayName || parsedFrom.email}
                              </span>
                              <span className="new-badge" style={{ fontSize: 10 }}>
                                Gmail
                              </span>
                              {thread.messageCount > 1 && (
                                <span className="tag message" style={{ fontSize: 10 }}>
                                  {thread.messageCount}
                                </span>
                              )}
                            </div>
                            <span className="time-text">
                              {timeAgo(last?.date) || formatDate(last?.date)}
                            </span>
                          </div>
                          <div className="subject-text" style={{ color: "#6172F3", fontWeight: "600" }}>
                            {thread.subject || "(no subject)"}
                          </div>
                          {snippet && (
                            <div className="snippet-text" style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                              {snippet}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : totalThreads === 0 ? (
              <div style={{ padding: 24, color: "#666" }}>No emails</div>
            ) : (
              pagedThreads.map((t) => {
                const last = t.lastMessage;
                const isSelected = selectedThreadId === String(t.id);
                const snippet = (() => {
                  const rawText = last?.html
                    ? last.html
                        .replace(/<br\s*\/?>\s*(<br\s*\/?>)*/gi, " ")
                        .replace(/<\/?(div|p|li|tr|td|th|h[1-6])[^>]*>/gi, " ")
                        .replace(/<[^>]*>/g, "")
                    : last?.text
                    ? last.text
                    : "";

                  // Decode HTML entities and clean up formatting
                  const decoded = rawText
                    .replace(/&nbsp;/gi, " ")
                    .replace(/&lt;/gi, "<")
                    .replace(/&gt;/gi, ">")
                    .replace(/&amp;/gi, "&")
                    .replace(/&quot;/gi, '"')
                    .replace(/&#39;/gi, "'")
                    .replace(/&apos;/gi, "'")
                    .replace(/\*\*([^*]+)\*\*/g, "$1")
                    .replace(/\*([^*]+)\*/g, "$1")
                    .replace(/__([^_]+)__/g, "$1")
                    .replace(/_([^_]+)_/g, "$1")
                    .replace(/\n/g, " ")
                    .replace(/\r/g, " ")
                    .replace(/\t/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();

                  return decoded.slice(0, 140);
                })();
                const timeText = last?.createdAt ? timeAgo(last.createdAt) : "";
                // Total attachments across all messages in the threads
                const attachmentsCount = (t.messages || []).reduce(
                  (acc: number, m: any) => {
                    const isDraft = isDraftFlag(m);
                    if (isDraft) {
                      // For drafts, only count draftAttachments
                      return (
                        acc +
                        (Array.isArray(m?.draftAttachments)
                          ? m.draftAttachments.length
                          : 0)
                      );
                    } else {
                      // For sent messages, only count attachments
                      return (
                        acc +
                        (Array.isArray(m?.attachments)
                          ? m.attachments.length
                          : 0)
                      );
                    }
                  },
                  0
                );
                const displaySubject = t.subject || "(no subject)";
                return (
                  <div
                    key={t.id}
                    className={`email-item ${isSelected ? "selected" : ""}`}
                    style={{
                      backgroundColor: isThreadUnreadForUser(t)
                        ? "#F8F9FC"
                        : undefined,
                    }}
                    onClick={() => {
                      // Check if this thread has only a single draft message
                      const isSingleDraftThread = threadOnlyHasSingleDraft(t);
                      const lastMsg = last;

                      if (isSingleDraftThread && onOpenCompose && lastMsg) {
                        try {
                          onOpenCompose({
                            to: Array.isArray(lastMsg?.toList)
                              ? lastMsg.toList.join(", ")
                              : lastMsg?.toRaw || lastMsg?.to || "",
                            subject: lastMsg?.subject || "",
                            threadId: lastMsg?.threadId || null,
                            originalEmail: lastMsg,
                            isReply: false,
                          });
                          // do not select the thread on the right
                          return;
                        } catch (e) {
                          // fallback to normal selection below on error
                          console.debug("onOpenCompose failed", e);
                        }
                      }

                      setSelectedThreadId(String(t.id));
                      // Mark this thread as opened/read for this user in localStorage (fallback persistence)
                      try {
                        const u = (userEmail || "").toLowerCase();
                        if (u) {
                          const key = `jia-thread-last-opened-${u}`;
                          const raw = localStorage.getItem(key);
                          const map = raw ? JSON.parse(raw) : {};
                          map[String(t.id)] = Date.now();
                          localStorage.setItem(key, JSON.stringify(map));
                        }
                      } catch (e) {
                        // ignore localStorage errors
                      }
                      // Trigger server-side mark-read (debounced/optimistic locally)
                      try {
                        // small delay to avoid noisy writes on accidental clicks
                        setTimeout(() => {
                          markThreadReadApi(t.id);
                        }, 300);
                      } catch (e) {}
                      // select the last message in the thread as current message
                      setSelectedMessageId(last?._id || null);
                      setShowReply(false);
                    }}
                  >
                    <div className="email-content">
                      <AvatarImage
                        src={
                          last?.senderImage
                            ? last.senderImage
                            : last?.from
                            ? `https://api.dicebear.com/9.x/glass/svg?seed=${
                                parseEmailAddress(last.from).email
                              }`
                            : "https://api.dicebear.com/9.x/glass/svg?seed=sabine"
                        }
                        className="rounded-circle"
                        alt={last?.from || "sender"}
                        style={{ width: "32px", height: "32px" }}
                      />
                      <div className="email-info">
                        <div className="email-header">
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span className="email-name">
                              {(() => {
                                const parsed = parseEmailAddress(last?.from);
                                return parsed.displayName || parsed.email || "";
                              })()}
                            </span>
                            {(t.messages || []).some(isDraftFlag) && (
                              <span
                                className="draft-badge"
                                title="Contains draft"
                                style={{ fontSize: 12, color: "#B32318" }}
                              >
                                Draft
                              </span>
                            )}
                            {/* Read / Unread tag specific to the current user */}
                            {isThreadUnreadForUser(t) && (
                              <span className="new-badge">New</span>
                            )}
                          </div>
                          <span className="time-text">{timeText}</span>
                        </div>
                        <div
                          className="subject-text"
                          style={{
                            color: isThreadUnreadForUser(t)
                              ? "#6172F3"
                              : undefined,
                            fontWeight: isThreadUnreadForUser(t)
                              ? "700"
                              : "500",
                          }}
                        >
                          {isThreadUnreadForUser(t) && <span>•</span>}{" "}
                          {displaySubject}
                        </div>
                        <div
                          className="snippet-text"
                          style={{
                            fontWeight: isThreadUnreadForUser(t)
                              ? "700"
                              : "500",
                          }}
                        >
                          {snippet}
                        </div>
                        <div className="tags-container">
                          <span className="tag message">
                            {(t.messages || []).length}{" "}
                            {(t.messages || []).length === 1
                              ? "message"
                              : "messages"}
                          </span>
                          {attachmentsCount > 0 && (
                            <span className="tag attachment">
                              {attachmentsCount}{" "}
                              {attachmentsCount === 1
                                ? "attachment"
                                : "attachments"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          <div className="pagination-container">
            <button
              className="page-button"
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={pageIndex <= 0}
              aria-disabled={pageIndex <= 0}
            >
              Previous
            </button>
            <span>
              {totalItems === 0
                ? "0 of 0"
                : `${startThreadIndex}-${endThreadIndex} of ${totalItems}`}
            </span>
            <button
              className="page-button"
              onClick={() =>
                setPageIndex((p) => Math.min(lastPageIndex, p + 1))
              }
              disabled={pageIndex >= lastPageIndex}
              aria-disabled={pageIndex >= lastPageIndex}
            >
              Next
            </button>
          </div>
        </div>

        {/* Right Content Area - Email Viewer */}
        <div className="content-area">
          {/* Header */}
          <div className="header">
            <div className="header-content">
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <button
                  className="sync-button"
                  onClick={() => {
                    if (selectedTab === "gmail") {
                      fetchGmailEmails();
                    } else {
                      fetchMessages(true, searchQuery);
                    }
                  }}
                  disabled={isSyncing || isLoadingGmail}
                  aria-disabled={isSyncing || isLoadingGmail}
                  title={
                    isSyncing || isLoadingGmail
                      ? "Syncing messages..."
                      : "Sync messages"
                  }
                >
                  {isSyncing || isLoadingGmail ? (
                    <i className="la la-spinner la-spin"></i>
                  ) : (
                    <i className="las la-cog la-lg"></i>
                  )}
                </button>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "16px" }}
              >
                <div className="user-info">
                  <AvatarImage
                    src={
                      memberImage
                        ? memberImage
                        : (userEmail || gmailEmail)
                        ? `https://api.dicebear.com/9.x/glass/svg?seed=${userEmail || gmailEmail}`
                        : "https://api.dicebear.com/9.x/glass/svg?seed=sabine"
                    }
                    className="rounded-circle"
                    alt="User's name"
                    style={{ width: "24px", height: "24px" }}
                  />
                  <div className="user-text">
                    <div className="user-email">
                      {userEmail || gmailEmail || "user email"}
                    </div>
                    <div className="user-status">
                      {hasMailgunAccount && hasGmailConnected
                        ? "Mailgun & Gmail Connected"
                        : hasMailgunAccount
                        ? "Connected Mailgun"
                        : hasGmailConnected
                        ? "Connected Gmail"
                        : "No Email Connected"}
                      {hasMailgunAccount && (
                        <>
                          {" | "}
                          <span>
                            Last sync:{" "}
                            {lastSync ? timeAgo(lastSync) : "Not synced yet"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Compose Button */}
            {displayComposeButton && (
              <button
                style={{
                  backgroundColor: "#181D27",
                  color: "#fff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "60px",
                  cursor: "pointer",
                }}
                onClick={() => setIsComposeOpen(true)}
              >
                <i className="las la-plus" style={{ marginRight: 8 }}></i>
                Compose
              </button>
            )}
          </div>

          {/* Email Content Area */}

          {selectedTab === "gmail" ? (
            selectedGmailThreadId ? (
              (() => {
                const selectedThread = gmailThreads.find((t) => String(t.id) === String(selectedGmailThreadId));
                if (!selectedThread) return null;
                
                return (
                  <>
                    {/* Gmail Thread Content Header */}
                    <div className="email-content-header">
                      <div className="email-subject">
                        {selectedThread.subject || "(no subject)"}
                      </div>
                    </div>

                    {/* Gmail Thread - Show all messages */}
                    <div className="email-thread">
                      {selectedThread.messages.map((email: any, idx: number) => {
                        const parsedFrom = parseEmailAddress(email.from);
                        return (
                          <div key={email.id || idx} className="email-message external" style={{ marginBottom: 18 }}>
                            <div className="message-header">
                              <AvatarImage
                                src={`https://api.dicebear.com/9.x/glass/svg?seed=${parsedFrom.email}`}
                                className="rounded-circle"
                                alt={parsedFrom.email}
                                style={{ width: "40px", height: "40px" }}
                              />
                              <div className="message-info">
                                <div className="participants">
                                  <div className="sender-info">
                                    <span className="sender-name">
                                      {parsedFrom.displayName || parsedFrom.email || "Unknown"}
                                    </span>
                                    <span className="sender-email">
                                      &lt;{parsedFrom.email || "unknown@example.com"}&gt;
                                    </span>
                                  </div>
                                  <div className="recipient-info">
                                    {"to " + (email.to || email.recipient || "recipient")}
                                  </div>
                                </div>
                                <div className="email-timestamp">
                                  <span style={{ marginBottom: 0 }}>
                                    {formatDate(email.date)} ({timeAgo(email.date)})
                                  </span>
                                  <div className="type-tag manual">
                                    <i className="las la-envelope" style={{ color: "#6172F3" }}></i>
                                    Gmail
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="message-content" style={{ marginTop: 8 }}>
                              {/* Email Body */}
                              {email.html ? (
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: email.html,
                                  }}
                                  style={{ marginBottom: 16 }}
                                />
                              ) : email.text ? (
                                <pre style={{ whiteSpace: "pre-wrap", marginBottom: 16 }}>
                                  {email.text}
                                </pre>
                              ) : email.body ? (
                                <div style={{ marginBottom: 16 }}>
                                  {email.body}
                                </div>
                              ) : email.snippet ? (
                                <div style={{ color: "#666", marginBottom: 16 }}>
                                  {email.snippet}
                                </div>
                              ) : (
                                <div style={{ color: "#999", marginBottom: 16 }}>
                                  No content available
                                </div>
                              )}

                              {/* Attachments */}
                              {email.attachments &&
                                Array.isArray(email.attachments) &&
                                email.attachments.length > 0 && (
                                  <div style={{ marginTop: 16 }}>
                                    <span className="attachment-count">
                                      <i className="las la-paperclip"></i>
                                      {email.attachments.length}{" "}
                                      {email.attachments.length === 1
                                        ? "attachment"
                                        : "attachments"}
                                    </span>
                                    <div className="attachment-list" style={{ marginTop: 8 }}>
                                      {email.attachments.map((att: any, i: number) => (
                                        <div className="attachment-item" key={i}>
                                          <i className="las la-file la-lg"></i>
                                          <div className="attachment-details">
                                            <span className="attachment-name">
                                              {att.filename || `attachment-${i}`}
                                            </span>
                                            <span className="attachment-size">
                                              {att.size
                                                ? `${Math.round(att.size / 1024)} KB`
                                                : ""}
                                            </span>
                                          </div>
                                          <span
                                            style={{
                                              fontSize: "12px",
                                              color: "#666",
                                              marginLeft: "8px",
                                            }}
                                          >
                                            {att.mimeType || ""}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Gmail Reply and Forward Buttons */}
                    <div className="email-message-actions" style={{ 
                      display: "flex", 
                      gap: "12px", 
                      marginTop: "24px",
                      marginBottom: "48px",
                      paddingTop: "24px",
                      paddingLeft: "8px",
                      paddingRight: "8px",
                      borderTop: "1px solid #e9eaeb"
                    }}>
                      {/* Reply Button */}
                      <button
                        className="action-button"
                        onClick={() => {
                          const selectedThread = gmailThreads.find(
                            (t) => String(t.id) === String(selectedGmailThreadId)
                          );
                          if (!selectedThread || !selectedThread.messages || selectedThread.messages.length === 0) return;

                          // Get the last message in the thread (most recent)
                          const lastMessage = selectedThread.messages[selectedThread.messages.length - 1];
                          
                          // Determine the reply-to address
                          // For Gmail, check if the message is sent by us using labelIds
                          let replyTo = "";
                          try {
                            // Check if last message is sent by us (has SENT label)
                            const isFromUs = lastMessage.labelIds?.includes("SENT") || 
                                            lastMessage.isSent || 
                                            false;
                            
                            if (isFromUs) {
                              // Find the most recent inbound message (not sent by us)
                              const inboundMessages = selectedThread.messages
                                .filter((msg: any) => {
                                  const isSentMsg = msg.labelIds?.includes("SENT") || msg.isSent || false;
                                  return !isSentMsg;
                                });
                              if (inboundMessages.length > 0) {
                                const lastInbound = inboundMessages[inboundMessages.length - 1];
                                replyTo = lastInbound.from || lastInbound.sender || "";
                              } else {
                                // Fallback to the 'to' field of the last message
                                replyTo = lastMessage.to || "";
                              }
                            } else {
                              // Last message is from someone else, reply to them
                              replyTo = lastMessage.from || lastMessage.sender || "";
                            }
                          } catch (e) {
                            replyTo = lastMessage.from || lastMessage.sender || "";
                          }

                          // Prepare subject with Re: prefix if not already present
                          let subject = selectedThread.subject || "";
                          if (subject && !/^\s*re\s*:/i.test(subject)) {
                            subject = `Re: ${subject}`;
                          }

                          // Set up compose data for reply
                          setComposeData({
                            to: replyTo,
                            subject: subject,
                            threadId: selectedThread.id || null,
                            originalEmail: {
                              ...lastMessage,
                              text: lastMessage.text || lastMessage.snippet || "",
                              html: lastMessage.html || "",
                              careerId: careerId || null,
                              gmailMessageId: lastMessage.id || null,
                              messageId: lastMessage.id || null, // Gmail message ID
                            },
                            isReply: true,
                            isForward: false,
                            isGmail: true, // Flag to indicate this is a Gmail email
                          });
                          setIsComposeOpen(true);
                        }}
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: "8px",
                          flex: "1",
                          padding: "10px 16px",
                          backgroundColor: "#ffffff",
                          border: "1px solid #d5d7da",
                          borderRadius: "100px",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "#414651",
                          transition: "all 0.2s ease",
                          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f8f9fa";
                          e.currentTarget.style.borderColor = "#adb5bd";
                          e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#ffffff";
                          e.currentTarget.style.borderColor = "#d5d7da";
                          e.currentTarget.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.05)";
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.05)";
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.style.transform = "translateY(-1px)";
                          e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
                        }}
                      >
                        <i className="las la-undo" style={{ fontSize: "16px", color: "inherit" }}></i>
                        <span>Reply</span>
                      </button>

                      {/* Forward Button */}
                      <button
                        className="action-button"
                        onClick={() => {
                          const selectedThread = gmailThreads.find(
                            (t) => String(t.id) === String(selectedGmailThreadId)
                          );
                          if (!selectedThread || !selectedThread.messages || selectedThread.messages.length === 0) return;

                          // Get the last message in the thread
                          const lastMessage = selectedThread.messages[selectedThread.messages.length - 1];
                          
                          // Prepare subject with Fwd: prefix if not already present
                          let subject = selectedThread.subject || "";
                          if (subject && !/^\s*fwd\s*:|^\s*fw\s*:/i.test(subject)) {
                            subject = `Fwd: ${subject}`;
                          }

                          // Set up compose data for forward
                          setComposeData({
                            to: "",
                            subject: subject,
                            threadId: null, // Forward creates a new thread
                            originalEmail: {
                              ...lastMessage,
                              text: lastMessage.text || lastMessage.snippet || "",
                              html: lastMessage.html || "",
                              careerId: careerId || null,
                              gmailMessageId: lastMessage.id || null,
                              messageId: lastMessage.id || null, // Gmail message ID
                            },
                            isReply: false,
                            isForward: true,
                            isGmail: true, // Flag to indicate this is a Gmail email
                          });
                          setIsComposeOpen(true);
                        }}
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          gap: "8px",
                          flex: "1",
                          padding: "10px 16px",
                          backgroundColor: "#ffffff",
                          border: "1px solid #d5d7da",
                          borderRadius: "100px",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: 600,
                          color: "#414651",
                          transition: "all 0.2s ease",
                          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f8f9fa";
                          e.currentTarget.style.borderColor = "#adb5bd";
                          e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#ffffff";
                          e.currentTarget.style.borderColor = "#d5d7da";
                          e.currentTarget.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.05)";
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "0 1px 2px rgba(0, 0, 0, 0.05)";
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.style.transform = "translateY(-1px)";
                          e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
                        }}
                      >
                        <i className="las la-redo" style={{ fontSize: "16px", color: "inherit" }}></i>
                        <span>Forward</span>
                      </button>
                    </div>
                  </>
                );
              })()
            ) : (
              <>
                {/* Empty State for Gmail */}
                <div className="empty-state">
                  <div className="empty-state-content">
                    <img
                      src="/images/email-pulse-icon.png"
                      alt="Email Icon"
                      className="empty-state-icon"
                    />
                    <h3 className="empty-state-title">
                      Select a Gmail email to view details
                    </h3>
                    <p className="empty-state-text">
                      Choose an email from the Gmail inbox to read the full details
                    </p>
                  </div>
                </div>
              </>
            )
          ) : !selectedThreadId ? (
            <>
              {/* Empty State */}
              <div className="empty-state">
                <div className="empty-state-content">
                  <img
                    src="/images/email-pulse-icon.png"
                    alt="Email Icon"
                    className="empty-state-icon"
                  />
                  <h3 className="empty-state-title">
                    Select an email to view the conversation
                  </h3>
                  <p className="empty-state-text">
                    Choose an email from the inbox to read the full conversation
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <>
                {/* Email Warning: show only when the current thread contains messages from other org members */}
                {(() => {
                  const currentThread = threads.find(
                    (tt) => String(tt.id) === String(selectedThreadId)
                  );
                  // If there's no thread, nothing to show
                  if (!currentThread) return null;

                  const threadKey = String(currentThread.id || "");
                  const hasOrgMsg =
                    threadContainsOtherOrgMessage(currentThread);
                  const dismissed = Boolean(dismissedThreadWarnings[threadKey]);

                  if (hasOrgMsg && !dismissed) {
                    return (
                      <div
                        className="email-content-header"
                        style={{ background: "#fffaeb", borderBottom: "none" }}
                      >
                        <span style={{ fontSize: 14 }}>
                          You are viewing emails sent by other members of your
                          team.
                        </span>
                        <button
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                          }}
                          aria-label="Dismiss team message warning"
                          onClick={() =>
                            setDismissedThreadWarnings((prev) => ({
                              ...prev,
                              [threadKey]: true,
                            }))
                          }
                        >
                          <i className="las la-times la-sm"></i>
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Email Content Header */}
                <div className="email-content-header">
                  <div className="email-subject">
                    {(() => {
                      const currentThread = threads.find(
                        (tt) => String(tt.id) === String(selectedThreadId)
                      );
                      if (currentThread && currentThread.subject)
                        return currentThread.subject;
                      return selectedMessage
                        ? selectedMessage.subject || "(no subject)"
                        : "Select an email";
                    })()}
                  </div>
                  <div className="email-actions">
                    <button
                      className={`action-button ${
                        prevDisabled ? "disabled" : ""
                      }`}
                      aria-label="Previous email"
                      onClick={goToPrevThread}
                      disabled={prevDisabled}
                      aria-disabled={prevDisabled}
                    >
                      <i className="las la-arrow-left"></i>
                    </button>
                    <button
                      className={`action-button ${
                        nextDisabled ? "disabled" : ""
                      }`}
                      aria-label="Next email"
                      onClick={goToNextThread}
                      disabled={nextDisabled}
                      aria-disabled={nextDisabled}
                    >
                      <i className="las la-arrow-right"></i>
                    </button>
                  </div>
                </div>

                {/* Email Thread */}
                <div className="email-thread">
                  {/* Render full thread messages on the right for selectedThreadId */}

                  {selectedThreadId
                    ? (() => {
                        let thread: any = null;
                        try {
                          const fullMsgs = (messages || []).filter(
                            (m: any) =>
                              String(m.threadId || (m.threadId?._id ?? "")) ===
                              String(selectedThreadId)
                          );
                          if (fullMsgs && fullMsgs.length) {
                            const sortedFull = fullMsgs
                              .slice()
                              .sort(
                                (a: any, b: any) =>
                                  new Date(a.createdAt).getTime() -
                                  new Date(b.createdAt).getTime()
                              );
                            thread = {
                              id: String(selectedThreadId),
                              messages: sortedFull,
                              lastMessage: sortedFull[sortedFull.length - 1],
                            };
                          }
                        } catch (e) {
                          /* ignore */
                        }
                        if (!thread) {
                          thread = threads.find(
                            (tt) => String(tt.id) === String(selectedThreadId)
                          );
                        }
                        const threadMessages = (thread?.messages || [])
                          .slice()
                          .sort(
                            (a: any, b: any) =>
                              new Date(a.createdAt).getTime() -
                              new Date(b.createdAt).getTime()
                          );

                        const draftMessage =
                          (threadMessages || [])
                            .slice()
                            .reverse()
                            .find(isDraftFlag) || null;

                        // Hide draft messages from the rendered message list (they'll appear in the editor)
                        const visibleMessages = (threadMessages || []).filter(
                          (m: any) => !isDraftFlag(m)
                        );

                        return (
                          <>
                            {visibleMessages.map((msg: any, idx: number) => (
                              <div
                                key={msg._id || idx}
                                className={`email-message ${
                                  messageIsFromOrg(msg)
                                    ? "internal"
                                    : "external"
                                }`}
                                style={{ marginBottom: 18 }}
                              >
                                <div className="message-header">
                                  <AvatarImage
                                    src={
                                      msg?.senderImage
                                        ? msg.senderImage
                                        : msg?.from
                                        ? `https://api.dicebear.com/9.x/glass/svg?seed=${
                                            parseEmailAddress(msg.from).email
                                          }`
                                        : "https://api.dicebear.com/9.x/glass/svg?seed=sabine"
                                    }
                                    className="rounded-circle"
                                    alt={msg.from || "Message sender"}
                                    style={{ width: "40px", height: "40px" }}
                                  />
                                  <div className="message-info">
                                    <div className="participants">
                                      <div className="sender-info">
                                        <span className="sender-name">
                                          {parseEmailAddress(msg.from)
                                            .displayName ||
                                            parseEmailAddress(msg.sender)
                                              .displayName ||
                                            parseEmailAddress(msg.from).email ||
                                            parseEmailAddress(msg.sender)
                                              .email ||
                                            "Unknown"}
                                        </span>
                                        <span className="sender-email">
                                          &lt;
                                          {parseEmailAddress(msg.from).email ||
                                            parseEmailAddress(msg.sender)
                                              .email ||
                                            "unknown@example.com"}
                                          &gt;
                                        </span>
                                      </div>
                                      <div className="recipient-info">
                                        {"to " +
                                          (msg.to ||
                                            msg.recipient ||
                                            "recipient")}
                                      </div>
                                    </div>
                                    <div className="email-timestamp">
                                      <span style={{ marginBottom: 0 }}>
                                        {msg.createdAt
                                          ? `${formatDate(
                                              msg.createdAt
                                            )} (${timeAgo(msg.createdAt)})`
                                          : ""}
                                      </span>

                                      {typeof msg.from === "string" &&
                                      (msg.from
                                        .toLowerCase()
                                        .startsWith("no-reply") ||
                                        msg.from
                                          .toLowerCase()
                                          .startsWith("noreply")) ? (
                                        <div className="type-tag automated">
                                          <i
                                            className="las la-bolt"
                                            style={{ color: "#6172F3" }}
                                          ></i>
                                          Automated
                                        </div>
                                      ) : (
                                        <div className="type-tag manual">
                                          <i
                                            className="las la-user"
                                            style={{ color: "#f79009" }}
                                          ></i>
                                          Manual
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div
                                  className="message-content"
                                  style={{ marginTop: 8 }}
                                >
                                  {msg.html ? (
                                    <div
                                      dangerouslySetInnerHTML={{
                                        __html: msg.html,
                                      }}
                                    />
                                  ) : msg.text ? (
                                    <pre style={{ whiteSpace: "pre-wrap" }}>
                                      {msg.text}
                                    </pre>
                                  ) : (
                                    <div style={{ color: "#666" }}>
                                      No message content
                                    </div>
                                  )}
                                </div>

                                {/* Total number of attachments for this message */}
                                <div style={{ marginTop: 16 }}>
                                  {Array.isArray(msg.attachments) &&
                                  msg.attachments.length ? (
                                    <>
                                      <span className="attachment-count">
                                        <i className="las la-paperclip"></i>
                                        {msg.attachments.length}{" "}
                                        {msg.attachments.length === 1
                                          ? "attachment"
                                          : "attachments"}
                                      </span>

                                      <div className="attachment-list">
                                        {msg.attachments.map(
                                          (att: any, i: number) => {
                                            // Check for URL first, then fall back to key
                                            const url =
                                              att.url ||
                                              att.location ||
                                              att.r2Url ||
                                              att.objectUrl ||
                                              att.storageUrl ||
                                              att.link;
                                            // If no URL but we have a key, use the key for download
                                            const downloadId =
                                              url || att.key || null;
                                            const hasDownloadableFile =
                                              !!downloadId && !att.skipped;

                                            return (
                                              <div
                                                className="attachment-item"
                                                key={i}
                                              >
                                                <i className="las la-file la-lg"></i>
                                                <div className="attachment-details">
                                                  <a
                                                    href={url || "#"}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={(e) => {
                                                      // If no URL but we have a key, prevent default and trigger download
                                                      if (!url && att.key) {
                                                        e.preventDefault();
                                                        const link =
                                                          document.createElement(
                                                            "a"
                                                          );
                                                        // Include filename parameter if available
                                                        const filename =
                                                          att.filename ||
                                                          att.name ||
                                                          null;
                                                        const downloadUrl =
                                                          filename
                                                            ? `/api/mailgun-module/mg-download-attachment?id=${encodeURIComponent(
                                                                att.key
                                                              )}&filename=${encodeURIComponent(
                                                                filename
                                                              )}`
                                                            : `/api/mailgun-module/mg-download-attachment?id=${encodeURIComponent(
                                                                att.key
                                                              )}`;
                                                        link.href = downloadUrl;
                                                        link.download =
                                                          filename || "";
                                                        document.body.appendChild(
                                                          link
                                                        );
                                                        link.click();
                                                        document.body.removeChild(
                                                          link
                                                        );
                                                      }
                                                    }}
                                                  >
                                                    <span className="attachment-name">
                                                      {att.filename ||
                                                        att.name ||
                                                        `attachment-${i}`}
                                                    </span>
                                                  </a>
                                                  <span className="attachment-size">
                                                    {att.size
                                                      ? `${Math.round(
                                                          att.size / 1024
                                                        )} KB`
                                                      : ""}
                                                  </span>
                                                </div>
                                                {hasDownloadableFile ? (
                                                  <button
                                                    className="remove-attachment-button"
                                                    type="button"
                                                    onClick={() => {
                                                      const link =
                                                        document.createElement(
                                                          "a"
                                                        );
                                                      // Include filename parameter if available for proper download name
                                                      const filename =
                                                        att.filename ||
                                                        att.name ||
                                                        null;
                                                      const downloadUrl =
                                                        filename
                                                          ? `/api/mailgun-module/mg-download-attachment?id=${encodeURIComponent(
                                                              downloadId
                                                            )}&filename=${encodeURIComponent(
                                                              filename
                                                            )}`
                                                          : `/api/mailgun-module/mg-download-attachment?id=${encodeURIComponent(
                                                              downloadId
                                                            )}`;
                                                      link.href = downloadUrl;
                                                      link.download =
                                                        filename || "";
                                                      document.body.appendChild(
                                                        link
                                                      );
                                                      link.click();
                                                      document.body.removeChild(
                                                        link
                                                      );
                                                    }}
                                                    style={{
                                                      cursor: "pointer",
                                                      border: "none",
                                                      background: "none",
                                                      padding: 0,
                                                    }}
                                                  >
                                                    <i className="las la-cloud-download-alt"></i>
                                                  </button>
                                                ) : null}
                                              </div>
                                            );
                                          }
                                        )}
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            ))}

                            {/* If there's a draft message in this thread, show it in the reply editor */}
                            {draftMessage ? (
                              <div className="email-message">
                                <ReplyEmailModule
                                  to={
                                    Array.isArray(draftMessage.toList)
                                      ? draftMessage.toList.join(", ")
                                      : draftMessage.toRaw ||
                                        draftMessage.to ||
                                        ""
                                  }
                                  toList={
                                    Array.isArray(draftMessage.toList)
                                      ? draftMessage.toList
                                      : undefined
                                  }
                                  toRaw={draftMessage.toRaw || draftMessage.to}
                                  subject={draftMessage.subject}
                                  careerId={draftMessage.careerId}
                                  threadId={thread?.id || null}
                                  initialMessage={
                                    draftMessage.text || draftMessage.html || ""
                                  }
                                  inReplyTo={
                                    draftMessage.inReplyTo ||
                                    draftMessage.mailgunMessageIdRaw ||
                                    draftMessage.mailgunMessageId ||
                                    null
                                  }
                                  // draft metadata to allow editing new-message drafts
                                  draftId={draftMessage._id}
                                  isDraft={true}
                                  draftAttachments={
                                    draftMessage.draftAttachments ||
                                    draftMessage.attachments ||
                                    []
                                  }
                                  savedAt={
                                    draftMessage.savedAt ||
                                    draftMessage.updatedAt ||
                                    draftMessage.createdAt
                                  }
                                  onSync={() =>
                                    fetchMessages(true, searchQuery)
                                  }
                                  onClose={() => {
                                    setShowReply(false);
                                    fetchMessages(true, searchQuery);
                                  }}
                                  mailgunAccounts={mailgunAccounts}
                                  mailgunRole={mailgunRole}
                                  selectedMailgunAccountId={
                                    selectedMailgunAccountId
                                  }
                                />
                              </div>
                            ) : (
                              showReply && (
                                <div className="email-message">
                                  <ReplyEmailModule
                                    to={replyDraft?.to}
                                    subject={replyDraft?.subject}
                                    careerId={replyDraft?.careerId}
                                    threadId={replyDraft?.threadId}
                                    initialMessage={replyDraft?.initialMessage}
                                    inReplyTo={replyDraft?.inReplyTo}
                                    onSync={() =>
                                      fetchMessages(true, searchQuery)
                                    }
                                    onClose={() => setShowReply(false)}
                                    mailgunAccounts={mailgunAccounts}
                                    mailgunRole={mailgunRole}
                                    selectedMailgunAccountId={
                                      selectedMailgunAccountId
                                    }
                                  />
                                </div>
                              )
                            )}
                          </>
                        );
                      })()
                    : (() => {
                        return (
                          <div style={{ color: "#666" }}>
                            Select a thread to view its conversation
                          </div>
                        );
                      })()}

                  <div className="email-message-actions">
                    {/* Reply Button */}
                    <button
                      className="action-button"
                      onClick={() => {
                        // Prefer to derive the reply target from the full messages
                        // store so the reply picks the correct most-recent message
                        // even when the left list is filtered by search.
                        let thread: any = null;
                        try {
                          const fullMsgs = (messages || []).filter(
                            (m: any) =>
                              String(m.threadId || (m.threadId?._id ?? "")) ===
                              String(selectedThreadId)
                          );
                          if (fullMsgs && fullMsgs.length) {
                            const sortedFull = fullMsgs
                              .slice()
                              .sort(
                                (a: any, b: any) =>
                                  new Date(b.createdAt).getTime() -
                                  new Date(a.createdAt).getTime()
                              );
                            thread = {
                              id: String(selectedThreadId),
                              messages: sortedFull,
                              lastMessage: sortedFull[0],
                            };
                          }
                        } catch (e) {}
                        if (!thread)
                          thread = threads.find(
                            (tt) => String(tt.id) === String(selectedThreadId)
                          );
                        const last = thread?.lastMessage || null;

                        // Prioritize non-org members as receipients when replying to emails
                        let rawTo = "";
                        try {
                          if (last?.direction === "inbound") {
                            rawTo =
                              last?.from || last?.sender || last?.replyTo || "";
                          } else {
                            // find most recent inbound message in the thread
                            const msgs = thread?.messages || [];
                            const inbound = msgs
                              .slice()
                              .reverse()
                              .find((m: any) => m && m.direction === "inbound");
                            rawTo =
                              inbound?.from ||
                              inbound?.sender ||
                              last?.to ||
                              last?.recipient ||
                              last?.replyTo ||
                              "";
                          }
                        } catch (e) {
                          rawTo =
                            last?.from || last?.sender || last?.replyTo || "";
                        }

                        const to = rawTo || "";

                        let subject = last?.subject || "";
                        if (subject && !/^\s*re\s*:/i.test(subject))
                          subject = `Re: ${subject}`;
                        const careerId = last?.careerId || null;
                        setReplyDraft({
                          to,
                          subject,
                          careerId,
                          threadId: thread?.id || null,
                          initialMessage: "",
                          // prefer the raw Message-ID if available for exact header matching
                          inReplyTo:
                            last?.mailgunMessageIdRaw ||
                            last?.mailgunMessageId ||
                            null,
                        });
                        setShowReply(true);
                      }}
                    >
                      <i className="las la-undo"></i>
                      Reply
                    </button>

                    {/* Forward Button */}
                    <button className="action-button">
                      <i className="las la-redo"></i>
                      Forward
                    </button>
                  </div>
                </div>
              </>
            </>
          )}
        </div>
      </div>
      {/* Compose Email Module */}
      {displayComposeButton && (
        <ComposeEmailModule
          isOpen={isComposeOpen}
          onClose={() => {
            setIsComposeOpen(false);
            setComposeData(null);
          }}
          replyData={composeData}
          careerIds={careerId ? [careerId] : undefined}
          onSync={() => {
            // Refresh both Mailgun and Gmail emails
            if (selectedTab === "mailgun") {
              fetchMessages(true, searchQuery);
            } else if (selectedTab === "gmail") {
              fetchGmailEmails();
            } else {
              // Refresh both if on a different tab
              fetchMessages(true, searchQuery);
              fetchGmailEmails();
            }
          }}
          mailgunAccounts={mailgunAccounts}
          mailgunRole={mailgunRole}
          selectedMailgunAccountId={selectedMailgunAccountId}
        />
      )}
    </>
  );
}
