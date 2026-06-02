"use client";

import AvatarImage from "../AvatarImage/AvatarImage";
import Editor from "@/lib/components/sections/editor/Editor";
import InsertTemplateModal from "./InsertTemplateModal";
import React, { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { api } from "@/lib/utils/apiClient";
import { toast, ToastOptions } from "react-toastify";
import axios from "axios";

export type MailgunAccount = {
  _id: string;
  userId: string | null;
  organizationId: string | null;
  email: string;
  mailboxName?: string;
  domain?: string;
  routeId?: string | null;
  isActive?: boolean;
  image?: string | null;
};

type EmailEditorProps = {
  initialTo?: string | null;
  initialSubject?: string | null;
  initialCareerId?: string | null;
  threadId?: string | null;
  initialMessage?: string | null;
  inReplyTo?: string | null;
  // Draft metadata
  draftId?: string | null;
  isDraft?: boolean | number | string | null;
  initialAttachments?: {
    filename: string;
    mimeType?: string;
    data?: string;
    url?: string;
    key?: string;
    size?: number;
  }[];
  initialToRaw?: string | null;
  toList?: string[] | undefined;
  savedAt?: string | number | string | null;
  // Options to restrict Job dropdown
  careerIds?: string[];
  onSync?: () => void;
  onClose?: () => void;
  // Prefetched data to avoid repeated fetches when parent already loaded accounts
  prefetchedAccounts?: MailgunAccount[];
  prefetchedSelectedAccountId?: string | null;
  prefetchedRole?: string | null;
};

export default function EmailEditor(props: EmailEditorProps = {}) {
  const [orgAccounts, setOrgAccounts] = useState<MailgunAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [orderedAccounts, setOrderedAccounts] = useState<MailgunAccount[]>([]);
  const [isFromDropdownOpen, setIsFromDropdownOpen] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [careers, setCareers] = useState<{ id: string; jobTitle: string }[]>(
    []
  );
  const [toValue, setToValue] = useState<string>("");
  const [selectedCareer, setSelectedCareer] = useState<string | null>(null);
  const [subjectValue, setSubjectValue] = useState<string>("");
  const [messageValue, setMessageValue] = useState<string>("");
  const [attachmentsState, setAttachmentsState] = useState<
    {
      filename: string;
      mimeType?: string;
      data?: string;
      url?: string;
      key?: string;
      size?: number;
    }[]
  >([]);
  const [isSending, setIsSending] = useState(false);
  const [deletingAttachmentIndex, setDeletingAttachmentIndex] = useState<
    number | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const highlightColorRef = useRef<HTMLInputElement | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string>("https://");
  const [linkText, setLinkText] = useState<string>("");
  const storedRangeRef = useRef<Range | null>(null);
  const signatureCacheRef = useRef<Map<string, string>>(new Map()); // Cache signatures by orgId
  const [rawSelectedAccount, setRawSelectedAccount] = useState({});
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editorRefreshKey, setEditorRefreshKey] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const isDraft = Boolean(
    props.isDraft ||
      props.draftId ||
      (typeof props.isDraft !== "undefined" && props.isDraft !== null)
  );
  const isReply = Boolean(props.inReplyTo || (!isDraft && props.threadId));
  const [replyOptionsOpen, setReplyOptionsOpen] = useState(false);

  const pickToastOptions = (opt?: number | string): ToastOptions => {
    const base: ToastOptions = {
      position: "top-center",
      autoClose: 5000,
      pauseOnHover: true,
    } as ToastOptions;
    if (typeof opt === "number") base.autoClose = opt;
    else if (typeof opt === "string") base.position = opt as any;
    return base;
  };

  const successToastLocal = (message: string, opt?: number | string) =>
    toast.success(message, pickToastOptions(opt));
  const errorToastLocal = (message: string, opt?: number | string) =>
    toast.error(message, pickToastOptions(opt));
  const infoToastLocal = (message: string, opt?: number | string) =>
    toast.info(message, pickToastOptions(opt));

  const formatText = (command: string, value?: string) => {
    try {
      if (command === "fontSize" && value) {
        // execCommand fontSize uses 1-7; use 7 as placeholder then replace font tags
        document.execCommand("fontSize", false, "7");
        if (contentRef.current) {
          const html = contentRef.current.innerHTML;
          const replaced = html.replace(
            /<font size=\"7\">([\s\S]*?)<\/font>/gim,
            `<span style=\"font-size:${value}px\">$1</span>`
          );
          contentRef.current.innerHTML = replaced;
        }
      } else {
        document.execCommand(command, false, value);
      }
      if (contentRef.current) setMessageValue(contentRef.current.innerHTML);
    } catch (e) {
      console.error("formatText error", e);
    }
  };

  const handleContentInput = () => {
    if (contentRef.current) setMessageValue(contentRef.current.innerHTML);
  };

  const insertHtmlAtCursor = (html: string) => {
    try {
      const sel = window.getSelection();
      if (!sel) {
        if (contentRef.current) {
          contentRef.current.innerHTML += html;
          setMessageValue(contentRef.current.innerHTML);
        }
        return;
      }
      if (sel.rangeCount === 0) {
        if (contentRef.current) {
          contentRef.current.innerHTML += html;
          setMessageValue(contentRef.current.innerHTML);
        }
        return;
      }
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const el = document.createElement("div");
      el.innerHTML = html;
      const frag = document.createDocumentFragment();
      let node: ChildNode | null = null;
      while ((node = el.firstChild)) frag.appendChild(node);
      range.insertNode(frag);
      // Move caret after inserted node
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      if (contentRef.current) setMessageValue(contentRef.current.innerHTML);
    } catch (err) {
      console.debug("insertHtmlAtCursor error", err);
    }
  };

  // Escape a string for safe insertion into HTML attributes/content
  const escapeHtml = (unsafe: string) => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Prompt for URL and insert a link. If text is selected, wrap selection; otherwise insert anchor at caret.
  const handleInsertLink = (e?: React.MouseEvent) => {
    // Open the floating modal to request URL and link text
    openLinkModal(e);
  };

  const openLinkModal = (e?: React.MouseEvent) => {
    try {
      e?.preventDefault();
      e?.stopPropagation();
    } catch (_) {}

    try {
      const sel = window.getSelection();
      const selectedText = sel ? sel.toString() : "";
      if (sel && sel.rangeCount > 0) {
        // store a clone of the range so we can restore after the modal
        storedRangeRef.current = sel.getRangeAt(0).cloneRange();
      } else {
        storedRangeRef.current = null;
      }
      setLinkText(selectedText || "");
      setLinkUrl("https://");
      setShowLinkModal(true);
    } catch (err) {
      console.error("openLinkModal error", err);
    }
  };

  const closeLinkModal = () => {
    setShowLinkModal(false);
    storedRangeRef.current = null;
  };

  const applyLinkFromModal = (urlRaw?: string, textRaw?: string) => {
    try {
      const url = String(urlRaw || linkUrl || "").trim();
      if (!url) return;

      // Restore the stored selection if available
      try {
        const sel = window.getSelection();
        if (storedRangeRef.current && sel) {
          sel.removeAllRanges();
          sel.addRange(storedRangeRef.current);
        }
      } catch (err) {
        // ignore
      }

      const selNow = window.getSelection();
      const selectedTextNow = selNow ? selNow.toString() : "";
      const hasSelection = selectedTextNow && selectedTextNow.trim().length > 0;

      if (hasSelection) {
        try {
          const providedText = String(textRaw || linkText || "").trim();
          if (providedText && providedText !== selectedTextNow.trim()) {
            insertHtmlAtCursor(
              `<a href="${escapeHtml(
                url
              )}" target="_blank" rel="noopener noreferrer" style="color:#0563c1; text-decoration:underline;">${escapeHtml(
                providedText
              )}</a>`
            );
          } else {
            document.execCommand("createLink", false, url);
            // Find the created anchor and set attributes/style
            const node = selNow && selNow.anchorNode ? selNow.anchorNode : null;
            let el: any =
              node && (node as any).nodeType === 3
                ? (node as any).parentElement
                : (node as any);
            while (el && el.tagName !== "A") el = el.parentElement;
            if (el && el.tagName === "A") {
              try {
                el.setAttribute("target", "_blank");
                el.setAttribute("rel", "noopener noreferrer");
                el.setAttribute(
                  "style",
                  "color:#0563c1; text-decoration:underline;"
                );
              } catch (_) {}
            }
          }
        } catch (err) {
          // fallback: replace selection with anchor
          insertHtmlAtCursor(
            `<a href="${escapeHtml(
              url
            )}" target="_blank" rel="noopener noreferrer" style="color:#0563c1; text-decoration:underline;">${escapeHtml(
              selectedTextNow
            )}</a>`
          );
        }
      } else {
        // No selection: use provided text or url as link text
        const text = String(textRaw || linkText || url);
        insertHtmlAtCursor(
          `<a href="${escapeHtml(
            url
          )}" target="_blank" rel="noopener noreferrer" style="color:#0563c1; text-decoration:underline;">${escapeHtml(
            text
          )}</a>`
        );
      }

      if (contentRef.current) setMessageValue(contentRef.current.innerHTML);
      try {
        contentRef.current?.focus();
      } catch (_) {}
    } catch (err) {
      console.error("applyLinkFromModal failed", err);
    } finally {
      closeLinkModal();
    }
  };

  const isFallbackLocal = (local?: string) => {
    if (!local) return false;
    const l = local.toLowerCase();
    return (
      l === "hr" ||
      l === "noreply" ||
      l.startsWith("hr-") ||
      l.startsWith("no-reply-") ||
      l === "no-reply" ||
      l.startsWith("noreply-")
    );
  };

  // Helper: extract one or more plain email addresses from a display string.
  const extractEmails = (val?: string | null) => {
    if (!val) return "";
    const str = String(val);
    const matches = str.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
    if (!matches || matches.length === 0) return str.trim();
    // remove duplicates and trim
    const uniq = Array.from(new Set(matches.map((m) => m.trim())));
    return uniq.join(", ");
  };

  const handleTemplateInsert = (payload: {
    subject: string;
    body: string;
    template?: any;
  }) => {
    const nextSubject = payload.subject || "";
    const nextBody = payload.body || "";
    setSubjectValue(nextSubject);
    setMessageValue(nextBody);
    // Store the template ID if a template was selected
    if (payload.template?._id) {
      setSelectedTemplateId(payload.template._id);
    }
    try {
      if (contentRef.current) {
        contentRef.current.innerHTML = nextBody;
      }
    } catch (err) {}
    setEditorRefreshKey((k) => k + 1);
    setIsTemplateModalOpen(false);
  };

  // Prefill fields and attachments when component receives initial props (reply/draft)
  useEffect(() => {
    // To value precedence: explicit initialTo > toList (array) > initialToRaw
    if (props.initialTo) setToValue(String(props.initialTo));
    else if (props.toList && Array.isArray(props.toList))
      setToValue(props.toList.join(", "));
    else if (props.initialToRaw) setToValue(String(props.initialToRaw));

    if (props.initialSubject) setSubjectValue(String(props.initialSubject));
    // Prefer an explicit careerIds array (first element) when provided by parent components
    if (
      props.careerIds &&
      Array.isArray(props.careerIds) &&
      props.careerIds.length > 0
    ) {
      setSelectedCareer(String(props.careerIds[0]));
    } else if (props.initialCareerId) {
      setSelectedCareer(String(props.initialCareerId));
    }
    if (props.initialMessage) setMessageValue(String(props.initialMessage));

    // Prefill attachments when opening an existing draft or when they change
    if (props.initialAttachments && Array.isArray(props.initialAttachments)) {
      const mapped = props.initialAttachments.map((a) => ({
        filename: a.filename || "attachment",
        mimeType: a.mimeType || undefined,
        data: a.data || undefined,
        url: a.url || undefined,
        key: a.key || undefined,
        size: a.size || undefined,
      }));
      setAttachmentsState(mapped);
    }
    // Note: intentionally re-run when initial props change so drafts/selected thread updates are reflected
  }, [
    props.initialTo,
    props.toList,
    props.initialToRaw,
    props.initialSubject,
    props.initialCareerId,
    props.careerIds,
    props.initialMessage,
    props.initialAttachments,
  ]);

  // Re-render editors when initial subject/message props are provided so the UI reflects them
  useEffect(() => {
    if (props.initialMessage || props.initialSubject) {
      setEditorRefreshKey((k) => k + 1);
    }
  }, [props.initialMessage, props.initialSubject]);

  // Initialize the contentEditable DOM when an initialMessage is provided
  useEffect(() => {
    try {
      if (typeof props.initialMessage !== "undefined" && contentRef.current) {
        contentRef.current.innerHTML = String(props.initialMessage || "");
      }
    } catch (e) {
      console.debug("Failed to initialize editor DOM", e);
    }
    // only when initialMessage changes
  }, [props.initialMessage]);

  useEffect(() => {
    if (!props.draftId) return;
    if (attachmentsState && attachmentsState.length > 0) return;

    let mounted = true;

    (async () => {
      const debug = (...args: any[]) => {
        try {
          console.debug.apply(console, args as any);
        } catch (_) {}
      };

      try {
        // Read activeOrg from localStorage similar to other effects
        const activeOrgRaw =
          typeof window !== "undefined"
            ? localStorage.getItem("activeOrg")
            : null;
        const activeOrg = activeOrgRaw ? JSON.parse(activeOrgRaw) : null;
        const orgId = activeOrg?._id || activeOrg?.id || null;
        if (!orgId) {
          debug("EmailEditor debug: no orgId for messages lookup");
          return;
        }

        debug("EmailEditor debug: fetching messages for org", orgId);
        const listRes = await api.get(
          `/api/mailgun-module/mg-fetch-messages?orgId=${encodeURIComponent(
            String(orgId)
          )}`
        );
        if (!mounted) return;
        const msgs = Array.isArray(listRes?.data?.messages)
          ? listRes.data.messages
          : listRes?.data || [];
        debug(
          "EmailEditor debug: fetched messages count",
          msgs.length || (msgs && Object.keys(msgs).length)
        );

        const match = (Array.isArray(msgs) ? msgs : Object.values(msgs)).find(
          (mm: any) => {
            if (!mm) return false;
            return (
              mm._id === props.draftId ||
              mm.id === props.draftId ||
              String(mm._id) === String(props.draftId) ||
              String(mm.id) === String(props.draftId)
            );
          }
        );
        debug("EmailEditor debug: lookup match", match);

        const atts =
          (match && (match.draftAttachments || match.attachments)) || [];
        if (atts && atts.length > 0) {
          const mapped = atts.map((a: any) => ({
            filename: a.filename || a.name || a.fileName || "attachment",
            mimeType: a.mimeType || a.mime || undefined,
            data: undefined,
            url: a.url || undefined,
            key: a.key || undefined,
            size: a.size || undefined,
          }));
          setAttachmentsState(mapped);
        }
      } catch (e) {
        debug(
          "EmailEditor: failed to fetch draft attachments via mg-fetch-messages",
          e
        );
      }
    })();

    return () => {
      mounted = false;
    };
  }, [props.draftId, attachmentsState]);

  // Always fetch fresh accounts data on mount
  useEffect(() => {
    // Fetch on load to ensure consistency with mixed email sources
    setIsLoadingAccounts(true);
    const activeOrgRaw =
      typeof window !== "undefined" ? localStorage.getItem("activeOrg") : null;
    const activeOrg = activeOrgRaw ? JSON.parse(activeOrgRaw) : null;
    const orgId = activeOrg?._id || activeOrg?.id || null;

    if (!orgId) {
      setIsLoadingAccounts(false);
      return;
    }
    async function fetchOrgAccounts() {
      try {
        // Fetch both user account and org accounts in parallel for faster loading
        const [meRes, orgAccountsRes, settingsRes, domainsRes] =
          await Promise.allSettled([
            api.get("/api/mailgun-module/mg-fetch-account", {
              params: { orgId },
            }),
            api.get(`/api/mailgun-module/mg-fetch-org-accounts?orgId=${orgId}`),
            api.get("/api/emails/settings", { params: { orgID: orgId } }),
            api.get("/api/mailgun-module/fetch-org-domains", {
              params: { orgId },
            }),
          ]);

        // Extract user account and role
        let userAccount: MailgunAccount | null = null;
        let currentUserRole: string | null = null;
        if (meRes.status === "fulfilled") {
          userAccount = meRes.value.data?.account || null;
          currentUserRole = meRes.value.data?.role || "hiring_manager";
          setUserRole(currentUserRole);
        } else {
          console.debug(
            "Could not fetch current user's mailgun account",
            meRes.reason
          );
          currentUserRole = "hiring_manager";
          setUserRole(currentUserRole);
        }

        // Extract org accounts (only succeeds for admins/super_admins)
        let orgAccountsData: MailgunAccount[] = [];
        if (orgAccountsRes.status === "fulfilled") {
          const data = orgAccountsRes.value.data;
          if (Array.isArray(data?.accounts)) {
            orgAccountsData = data.accounts;
          }
        } else {
          // Non-admins will get 403, silently ignore
          console.debug(
            "Could not fetch org mailgun accounts (expected for non-admins)"
          );
        }

        // Build the final accounts list and initial selection
        let finalAccounts: MailgunAccount[] = orgAccountsData.slice();
        if (
          userAccount &&
          !finalAccounts.find((a) => a._id === userAccount!._id)
        ) {
          finalAccounts = [userAccount, ...finalAccounts];
        }

        // Fetch organization domains and compute fallback emails: hr@domain, noreply@domain for each domain
        let domainsList: string[] = [];
        try {
          if (domainsRes.status === "fulfilled") {
            const domainsData = domainsRes.value.data;
            if (Array.isArray(domainsData)) {
              // Filter domains that have fullDomain attribute (orgId matching happens server-side)
              domainsList = domainsData
                .filter((d: any) => d?.fullDomain)
                .map((d: any) => d.fullDomain);
            }
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

        // Ensure fallback emails appear as last options
        for (const fb of fallbackEmails) {
          if (!finalAccounts.find((a) => a.email === fb)) {
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

        // Fetch Gmail accounts before setting the selected account
        try {
          const gmailRes = await axios.get(`/api/gmail/users?orgID=${orgId}`);
          const gmailAccounts = (gmailRes.data.result || []).map(
            (item: any) => ({
              _id: item._id,
              domain: "google",
              image: item.userDetails.picture,
              email: item.userDetails.email,
              userId: item.userID,
              routeId: null,
              organizationId: orgId,
              mailboxName: item.userDetails.email.split("@")[0],
              isActive: true,
            })
          );
          finalAccounts = [...finalAccounts, ...gmailAccounts];
        } catch (err) {
          console.debug("Could not fetch Gmail accounts", err);
        }

        // Determine preference toggle from email settings
        let preferGmail = false;
        try {
          if (settingsRes.status === "fulfilled") {
            const es = settingsRes.value?.data?.emailSettings;
            // Toggle comes from Email Settings: preference === 'gmail'
            preferGmail =
              String(es?.preference || "").toLowerCase() === "gmail";
          }
        } catch (_) {}

        // Determine the initial selection after all accounts are loaded
        // Only select Gmail first if "Prefer Gmail" toggle is enabled
        let initialSelectedId: string | null = null;
        const gmailAccount = finalAccounts.find((a) => a.domain === "google");
        if (preferGmail && gmailAccount) {
          initialSelectedId = gmailAccount._id;
        } else if (userAccount) {
          initialSelectedId = userAccount._id;
        } else if (finalAccounts.length > 0) {
          initialSelectedId = finalAccounts[0]._id;
        }

        // Apply to state: orgAccounts is canonical, orderedAccounts persists the preferred ordering
        setOrgAccounts(finalAccounts);
        setSelectedAccount(initialSelectedId);
        // Keep rawSelectedAccount in sync for initial default selection
        const initialSelectedObj = finalAccounts.find(
          (a) => a._id === initialSelectedId
        );
        setRawSelectedAccount(initialSelectedObj || {});

        const ordered = finalAccounts.slice().sort((x, y) => {
          if (x._id === initialSelectedId) return -1;
          if (y._id === initialSelectedId) return 1;
          const xIsFb = fallbackEmails.includes(x.email);
          const yIsFb = fallbackEmails.includes(y.email);
          if (xIsFb && !yIsFb) return 1;
          if (yIsFb && !xIsFb) return -1;
          return x.email.localeCompare(y.email || "");
        });
        setOrderedAccounts(ordered);
      } catch (err) {
        console.debug("Could not fetch mailgun accounts", err);
      } finally {
        setIsLoadingAccounts(false);
      }
    }

    fetchOrgAccounts();
  }, [props.prefetchedAccounts]);

  // Fetch careers for the current org to populate the Job dropdown
  useEffect(() => {
    const activeOrgRaw =
      typeof window !== "undefined" ? localStorage.getItem("activeOrg") : null;
    const activeOrg = activeOrgRaw ? JSON.parse(activeOrgRaw) : null;
    const orgId = activeOrg?._id || activeOrg?.id || null;
    if (!orgId) return;

    async function fetchCareers() {
      try {
        const res = await api.post("/api/fetch-careers", { orgID: orgId });
        if (Array.isArray(res.data)) {
          let fetched = res.data.map((c: any) => ({
            id: c.id,
            jobTitle: c.jobTitle,
          }));
          if (props.careerIds && props.careerIds.length > 0) {
            const allowed = new Set(props.careerIds.map((c) => String(c)));
            fetched = fetched.filter((c) => allowed.has(String(c.id)));
          }
          setCareers(fetched);
        }
      } catch (err) {
        console.debug("Could not fetch careers for org", err);
      }
    }

    fetchCareers();
  }, []);

  // Fetch and load email signature when selected account changes
  useEffect(() => {
    // Don't load signature if we already have draft content or initial message that shouldn't be overwritten
    if (props.draftId || (isReply && props.initialMessage && messageValue)) {
      return;
    }

    const activeOrgRaw =
      typeof window !== "undefined" ? localStorage.getItem("activeOrg") : null;
    const activeOrg = activeOrgRaw ? JSON.parse(activeOrgRaw) : null;
    const orgId = activeOrg?._id || activeOrg?.id || null;
    if (!orgId || !selectedAccount) return;

    async function fetchAndLoadSignature() {
      try {
        let signature = "";

        // Find the selected account to get its userId
        const account = orgAccounts.find((a) => a._id === selectedAccount);
        const userId = account?.userId;

        // Generate cache key based on userId (for user-specific signatures) or orgId (fallback)
        const cacheKey = userId ? `user-${userId}` : `org-${orgId}`;

        // Check if signature is already cached
        if (signatureCacheRef.current?.has(cacheKey)) {
          signature = signatureCacheRef.current.get(cacheKey) || "";
        } else {
          // Fetch signature based on the selected account's userId
          let fetchedSignature = "";

          if (userId) {
            // Try to fetch user-specific signature first
            try {
              const res = await api.get("/api/emails/settings", {
                params: { userID: userId },
              });
              fetchedSignature = res?.data?.emailSettings?.signature || "";
            } catch (err) {
              console.debug("No user-specific signature found", err);
            }
          }

          // Fallback to org-level signature if no user-specific signature
          if (!fetchedSignature) {
            try {
              const res = await api.get("/api/emails/settings", {
                params: { orgID: orgId },
              });
              fetchedSignature = res?.data?.emailSettings?.signature || "";
            } catch (err) {
              console.debug("No org-level signature found", err);
            }
          }

          signature = fetchedSignature;
          // Cache the signature for future use
          signatureCacheRef.current?.set(cacheKey, signature);
        }

        if (signature) {
          if (isReply && props.initialMessage) {
            // For replies: append signature at the end of the reply content
            const signatureHtml = `${props.initialMessage}<br><br>${signature}`;
            setMessageValue(signatureHtml);
            if (contentRef.current) {
              contentRef.current.innerHTML = signatureHtml;
            }
          } else if (!messageValue || messageValue === "") {
            // For new compose: signature at bottom with cursor at top
            const signatureHtml = `<br><br>${signature}`;
            setMessageValue(signatureHtml);
            if (contentRef.current) {
              contentRef.current.innerHTML = signatureHtml;
            }
          }

          // Force Editor component to re-render with new signature
          setEditorRefreshKey((k) => k + 1);

          // Position cursor at the very top after Editor re-renders
          setTimeout(() => {
            if (contentRef.current) {
              const range = document.createRange();
              const sel = window.getSelection();
              if (sel && contentRef.current.firstChild) {
                try {
                  range.setStart(contentRef.current, 0);
                  range.collapse(true);
                  sel.removeAllRanges();
                  sel.addRange(range);
                  contentRef.current.focus();
                } catch (e) {
                  console.debug("Could not position cursor", e);
                }
              }
            }
          }, 100);
        }
      } catch (err) {
        console.debug("Could not fetch email signature", err);
      }
    }

    fetchAndLoadSignature();
  }, [selectedAccount, isReply, props.initialMessage, orgAccounts]);

  // Keep orderedAccounts in sync when selectedAccount or orgAccounts change
  useEffect(() => {
    if (!orgAccounts || orgAccounts.length === 0) {
      setOrderedAccounts([]);
      return;
    }
    const ordered = orgAccounts.slice().sort((x, y) => {
      if (x._id === selectedAccount) return -1;
      if (y._id === selectedAccount) return 1;
      return x.email.localeCompare(y.email || "");
    });
    setOrderedAccounts(ordered);
  }, [selectedAccount, orgAccounts]);

  // Discard handler: show confirmation, then clear inputs and optionally delete draft server-side
  const handleDiscard = (e?: React.MouseEvent) => {
    try {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
    } catch (err) {}

    Swal.fire({
      title: "Discard unsaved changes?",
      text: "Your message will not be saved",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#181D27",
      cancelButtonColor: "#fff",
      confirmButtonText: "Discard changes",
      cancelButtonText: "Return to edit",
    }).then(async (result) => {
      if (!result.isConfirmed) return;

      Swal.fire({
        title: "Discarding changes...",
        text: "Please wait while we discard the changes...",
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
          Swal.showLoading();
        },
      });

      try {
        // If this editor is editing an existing draft, delete it server-side
        if (props.draftId) {
          try {
            const res = await api.post("/api/mailgun-module/mg-delete-draft", {
              draftId: props.draftId,
            });
            if (res?.data?.success) {
              try {
                console.debug(
                  "EmailEditor: invoking onSync after draft delete"
                );
                if (typeof props.onSync === "function") props.onSync();
              } catch (e) {}
            } else {
              console.debug(
                "Delete draft returned unexpected response",
                res?.data
              );
            }
          } catch (err) {
            console.error("Error deleting draft", err);
          }
        }

        // Clear local editor state
        try {
          setToValue("");
          setSelectedCareer(null);
          setSubjectValue("");
          setMessageValue("");
          setAttachmentsState([]);
          setEditorRefreshKey((k) => k + 1);
        } catch (e) {
          console.debug("Error clearing editor state", e);
        }

        // If parent provided a callback for closing/discarding, call it
        try {
          if (typeof (props as any).onDiscard === "function")
            (props as any).onDiscard();
          if (typeof (props as any).onClose === "function")
            (props as any).onClose();
        } catch (e) {}

        Swal.fire({
          title: "Discarded!",
          text: "The draft has been discarded.",
          icon: "success",
        });
      } catch (err) {
        console.error("Error during discard", err);
        Swal.fire({
          title: "Error",
          text: "Failed to discard changes.",
          icon: "error",
        });
      }
    });
  };

  return (
    <>
      {/* Content */}
      <div className="compose-email-content" style={{ overflow: "visible" }}>
        {/* From Field */}
        <div
          className="email-form-section"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <label className="form-label" style={{ margin: 0 }}>
            From
          </label>
          <div className="from-container">
            {isLoadingAccounts ? (
              // Show loading indicator while fetching accounts
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  color: "#6c757d",
                  fontSize: "14px",
                }}
              >
                <i className="la la-circle-notch la-spin"></i>
                Fetching accounts...
              </div>
            ) : userRole === "admin" || userRole === "super_admin" ? (
              //  If user is admin or super_admin, show dropdown
              <>
                <button
                  className="from-dropdown-button"
                  onClick={() => setIsFromDropdownOpen(!isFromDropdownOpen)}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {(() => {
                      const sel =
                        orgAccounts.find((a) => a._id === selectedAccount) ||
                        orgAccounts[0];
                      const local = sel?.email?.split("@")?.[0]?.toLowerCase();
                      const useIcon = isFallbackLocal(local);
                      return useIcon ? (
                        <i className="las la-user from-avatar" />
                      ) : (
                        <AvatarImage
                          src={
                            sel?.image
                              ? sel.image
                              : sel
                              ? `https://api.dicebear.com/9.x/glass/svg?seed=${sel.email}`
                              : "https://api.dicebear.com/9.x/glass/svg?seed=sabine"
                          }
                          className="rounded-circle from-avatar"
                          alt={"jia"}
                        />
                      );
                    })()}
                    <span className="from-email">
                      {/* show selected account email (prefer logged-in user's account) */}
                      {(() => {
                        const sel = orgAccounts.find(
                          (a) => a._id === selectedAccount
                        );
                        return sel ? sel.email : "hr@hellojia.ai";
                      })()}
                    </span>
                  </div>
                  <i
                    className="las la-angle-down"
                    style={{ color: "#717680" }}
                  ></i>
                </button>

                {isFromDropdownOpen && (
                  <div className="from-dropdown-options-container">
                    {orderedAccounts.map((a) => (
                      <button
                        key={a._id}
                        className={`from-dropdown-option ${
                          a._id === selectedAccount ? "active" : ""
                        }`}
                        onClick={() => {
                          setSelectedAccount(a._id);
                          setRawSelectedAccount(a);
                          setIsFromDropdownOpen(false);
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          {(() => {
                            const local = a.email
                              ?.split("@")?.[0]
                              ?.toLowerCase();
                            const useIcon = isFallbackLocal(local);
                            return (
                              <>
                                {useIcon ? (
                                  <i className="las la-user from-avatar" />
                                ) : (
                                  <AvatarImage
                                    src={
                                      a.image
                                        ? a.image
                                        : `https://api.dicebear.com/9.x/glass/svg?seed=${a.email}`
                                    }
                                    className="rounded-circle from-avatar"
                                    alt={"jia"}
                                  />
                                )}
                                <span>{a.email}</span>
                              </>
                            );
                          })()}
                        </div>
                        {a._id === selectedAccount && (
                          <i
                            className="las la-check"
                            style={{ color: "#8098F9" }}
                          ></i>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              //  If user is a recruiting manager, show only logged-in user's email
              <>
                {(() => {
                  const sel = orgAccounts.find(
                    (a) => a._id === selectedAccount
                  );
                  const local = sel?.email?.split("@")?.[0]?.toLowerCase();
                  const useIcon = isFallbackLocal(local);
                  return useIcon ? (
                    <i className="las la-user from-avatar" />
                  ) : (
                    <AvatarImage
                      src={(() => {
                        const sel2 = orgAccounts.find(
                          (a) => a._id === selectedAccount
                        );
                        return sel2?.image
                          ? sel2.image
                          : sel2
                          ? `https://api.dicebear.com/9.x/glass/svg?seed=${sel2.email}`
                          : "https://api.dicebear.com/9.x/glass/svg?seed=sabine";
                      })()}
                      className="rounded-circle from-avatar"
                      alt={"jia"}
                    />
                  );
                })()}
                <span className="from-email">
                  {/* show selected account email (prefer logged-in user's account) */}
                  {(() => {
                    const sel = orgAccounts.find(
                      (a) => a._id === selectedAccount
                    );
                    return sel && sel.email;
                  })()}
                </span>
              </>
            )}
          </div>

          {/* Template Button */}
          <button
            className="compose-email-button"
            onClick={() => setIsTemplateModalOpen(true)}
            style={{ width: "auto", height: 40 }}
          >
            <i className="la la-file-text"></i>
            Insert a Template
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: 24,
          }}
        >
          {/* Reply/Forward Buttons */}
          {isReply && (
            <div className="reply-dropdown">
              <button
                className="compose-email-button"
                style={{ width: 80, height: 40 }}
                onClick={() => setReplyOptionsOpen((s) => !s)}
                aria-expanded={replyOptionsOpen}
                aria-label="Reply options"
              >
                <i className="las la-undo"></i>
                <i className="las la-angle-down"></i>
              </button>

              {replyOptionsOpen && (
                <div className="reply-options">
                  <button
                    onClick={() => {
                      try {
                        setReplyOptionsOpen(false);
                      } catch (_) {}
                    }}
                  >
                    <i className="las la-undo"></i>
                    <span>Reply</span>
                  </button>
                  <button
                    onClick={() => {
                      try {
                        setReplyOptionsOpen(false);
                      } catch (_) {}
                    }}
                  >
                    <i className="las la-redo"></i>
                    <span>Forward</span>
                  </button>
                  <button
                    onClick={() => {
                      try {
                        setReplyOptionsOpen(false);
                      } catch (_) {}
                    }}
                  >
                    <i className="las la-expand"></i>
                    <span>Pop out reply</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* To Field */}
          <div className="email-form-section" style={{ marginBottom: 0 }}>
            <label
              className="form-label"
              style={{ display: isReply ? "none" : "block" }}
            >
              To
            </label>
            <input
              type="email"
              className="form-input"
              placeholder="candidate@example.com"
              value={toValue}
              onChange={(e) => setToValue(e.target.value)}
            />
          </div>

          {/* To & Job: hide when composing a reply (isReply=true) */}
          {!isReply && (
            <>
              {/* Job Field */}
              <div className="email-form-section" style={{ marginBottom: 0 }}>
                <label className="form-label">Job</label>
                <select
                  className="form-input form-select"
                  value={selectedCareer || ""}
                  onChange={(e) => setSelectedCareer(e.target.value || null)}
                  required
                >
                  <option value="" disabled>
                    Choose related job
                  </option>
                  {careers.length > 0 ? (
                    careers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.jobTitle}
                      </option>
                    ))
                  ) : (
                    // No careers found
                    <option value="" disabled>
                      No careers found for this organization
                    </option>
                  )}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Subject Field */}
        {!isReply && (
          <Editor
            key={`subject-${editorRefreshKey}`}
            label="Subject"
            placeholder=""
            formdata={{ subject: subjectValue }}
            height={44}
            isLabelVisible={true}
            onChange={({ id, value }) => {
              setSubjectValue(value);
            }}
            toolbarItems={["insertToken"]}
            useFixedDropdown={true}
          />
        )}

        {/* Message */}
        <div style={{ marginTop: 16 }}>
          <Editor
            key={`message-${editorRefreshKey}`}
            label="Message"
            placeholder="Type your message here..."
            formdata={{ message: messageValue }}
            height={160}
            isLabelVisible={true}
            onChange={({ id, value }) => {
              if (contentRef.current) {
                contentRef.current.innerHTML = value;
              }
              setMessageValue(value);
            }}
            useFixedDropdown={true}
          />
        </div>

        {/* Attach Button */}
        <input
          ref={(el) => {
            fileInputRef.current = el;
          }}
          type="file"
          style={{ display: "none" }}
          multiple
          onChange={async (e) => {
            const files = e.target?.files;
            if (!files) return;
            const newAttachments: {
              filename: string;
              mimeType?: string;
              data: string;
            }[] = [];
            for (let i = 0; i < files.length; i++) {
              const f = files[i];
              const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result as string;
                  const idx = result.indexOf("base64,");
                  resolve(idx >= 0 ? result.slice(idx + 7) : result);
                };
                reader.onerror = (err) => reject(err);
                reader.readAsDataURL(f);
              });
              newAttachments.push({
                filename: f.name,
                mimeType: f.type,
                data: base64,
              });
            }
            setAttachmentsState((prev) => [...prev, ...newAttachments]);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />

        <button
          type="button"
          className="compose-email-button"
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          title="Attach files"
          style={{ marginTop: 16 }}
        >
          <i className="la la-paperclip"></i>
          Attach a File
        </button>

        {/* Attached files list */}
        <div style={{ marginTop: 16 }}>
          <div className="attachment-list">
            {attachmentsState.length === 0 ? (
              <div style={{ color: "#666" }}>No attachments</div>
            ) : (
              attachmentsState.map((att, idx) => (
                <div className="attachment-item" key={`${att.filename}-${idx}`}>
                  <i className="las la-file la-lg"></i>
                  <div className="attachment-details">
                    <span className="attachment-name">{att.filename}</span>
                    <span className="attachment-size">
                      {att.size
                        ? `${Math.round(att.size / 1024)} KB`
                        : att.data
                        ? `${((att.data.length * 3) / 4 / 1024).toFixed(1)} KB`
                        : ""}
                    </span>
                  </div>
                  <button
                    className="remove-attachment-button"
                    onClick={async () => {
                      // Prevent multiple clicks
                      if (deletingAttachmentIndex !== null) return;

                      const attachment = att;
                      // If this is an existing draft attachment, delete from db and R2
                      if (props.draftId && (attachment.url || attachment.key)) {
                        setDeletingAttachmentIndex(idx);
                        try {
                          const res = await api.post(
                            "/api/mailgun-module/mg-delete-attachment",
                            {
                              draftId: props.draftId,
                              attachmentUrl: attachment.url,
                              attachmentKey: attachment.key,
                            }
                          );
                          if (res.data && res.data.success) {
                            // Remove from local state after successful deletion
                            setAttachmentsState((prev) =>
                              prev.filter((_, i) => i !== idx)
                            );
                            // Trigger sync to refresh the draft
                            try {
                              if (typeof props.onSync === "function") {
                                props.onSync();
                              }
                            } catch (e) {}
                          } else {
                            errorToastLocal("Failed to delete attachment");
                          }
                        } catch (err) {
                          console.error("Error deleting attachment", err);
                          errorToastLocal("Error deleting attachment");
                        } finally {
                          setDeletingAttachmentIndex(null);
                        }
                      } else {
                        // For new attachments, just remove from local state
                        setAttachmentsState((prev) =>
                          prev.filter((_, i) => i !== idx)
                        );
                      }
                    }}
                    type="button"
                    disabled={deletingAttachmentIndex === idx}
                  >
                    {deletingAttachmentIndex === idx ? (
                      <i className="la la-spinner la-spin"></i>
                    ) : (
                      <i className="las la-times"></i>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {/* Footer */}
      <div className="compose-email-footer">
        <div className="footer-left">
          <a
            href="#"
            className="discard-link"
            onClick={(e) => handleDiscard(e)}
          >
            <i className="las la-trash-alt" style={{ marginRight: 8 }}></i>
            Discard
          </a>
        </div>
        <div className="footer-right">
          <button
            onClick={async () => {
              // allow saving draft as long as one of to/subject/message is present (server enforces too)
              if (!selectedAccount) {
                errorToastLocal(
                  "Please select a From address before saving a draft"
                );
                return;
              }
              const payload: any = {
                fromMailgunId: selectedAccount,
                to: toValue || null,
                subject: subjectValue || null,
                html: messageValue || null,
                text: messageValue
                  ? messageValue.replace(/<[^>]*>/g, "")
                  : null,
                // Send attachments (either raw base64 `data` or previously-uploaded `url`/`key`).
                attachments: attachmentsState.map((a) => ({
                  filename: a.filename,
                  mimeType: a.mimeType,
                  data: a.data,
                  url: a.url,
                  key: a.key,
                  size: a.size,
                })),
                threadId: props.threadId || undefined,
                careerId: selectedCareer || undefined,
                inReplyTo: props.inReplyTo || undefined,
                inReplyToRaw: props.inReplyTo || undefined,
                draftId: props.draftId || undefined,
              };

              try {
                const res = await api.post(
                  "/api/mailgun-module/mg-save-draft",
                  payload
                );
                if (res.data && res.data.success) {
                  successToastLocal("Draft saved");
                  // Clear editor state
                  try {
                    setToValue("");
                    setSelectedCareer(null);
                    setSubjectValue("");
                    setMessageValue("");
                    setAttachmentsState([]);
                    setEditorRefreshKey((k) => k + 1);
                    try {
                      if (contentRef.current) contentRef.current.innerHTML = "";
                    } catch (e) {}
                  } catch (e) {}
                  // Trigger sync
                  try {
                    if (typeof props.onSync === "function") {
                      try {
                        console.debug(
                          "EmailEditor: invoking onSync after save draft"
                        );
                      } catch (e) {}
                      props.onSync();
                    }
                  } catch (e) {}
                  // Close parent compose UI if provided
                  try {
                    if (typeof props.onClose === "function") props.onClose();
                  } catch (e) {}
                } else {
                  console.error("Save draft failed", res.data);
                  errorToastLocal(
                    "Save draft failed: " +
                      (res.data?.error || JSON.stringify(res.data))
                  );
                }
              } catch (err) {
                console.error("Save draft error", err);
                errorToastLocal("Save draft error");
              }
            }}
            className="btn btn-outline-default"
            style={{ borderRadius: "25px" }}
          >
            Save Draft
          </button>
          <button
            onClick={async () => {
              if (isSending) return;
              if (!selectedAccount) {
                errorToastLocal("Please select a From address");
                return;
              }
              if (!toValue) {
                errorToastLocal("Please enter recipient email(s)");
                return;
              }
              if (!subjectValue) {
                errorToastLocal("Please enter a subject");
                return;
              }
              if (!isReply && !selectedCareer) {
                errorToastLocal("Please choose a job");
                return;
              }
              if (!messageValue) {
                errorToastLocal("Please enter a message body");
                return;
              }
              setIsSending(true);
              try {
                // sanitize the To field so the server only receives plain emails
                const toSanitized = extractEmails(toValue);

                // Get orgId from localStorage for token replacement
                const activeOrgRaw =
                  typeof window !== "undefined"
                    ? localStorage.getItem("activeOrg")
                    : null;
                const activeOrg = activeOrgRaw
                  ? JSON.parse(activeOrgRaw)
                  : null;
                const orgId = activeOrg?._id || activeOrg?.id || null;

                const payload: any = {
                  rawDomain: (rawSelectedAccount as any)?.domain || "",
                  userId: (rawSelectedAccount as any)?.userId || "",
                  fromMailgunId: selectedAccount,
                  to: toSanitized,
                  careerId: selectedCareer,
                  orgId: orgId,
                  threadId: props.threadId || undefined,
                  subject: subjectValue,
                  html: messageValue,
                  text: messageValue.replace(/<[^>]*>/g, ""),
                  // Include any attachments the user added (either `data` or `url`)
                  attachments: attachmentsState.map((a) => ({
                    filename: a.filename,
                    mimeType: a.mimeType,
                    data: a.data,
                    url: a.url,
                    key: a.key,
                    size: a.size,
                  })),
                  draftId: props.draftId || undefined,
                  inReplyTo: props.inReplyTo || undefined,
                  // provide the raw header when available so server can use exact value
                  inReplyToRaw: props.inReplyTo || undefined,
                  // Include templateId if a template was used
                  templateId: selectedTemplateId || undefined,
                };

                const res = await api.post(
                  "/api/mailgun-module/mg-send-email",
                  payload
                );
                if (res.data && res.data.success) {
                  successToastLocal("Email sent");
                  setToValue("");
                  setSelectedCareer(null);
                  setSubjectValue("");
                  setMessageValue("");
                  setAttachmentsState([]);
                  setSelectedTemplateId(null); // Clear template ID after sending
                  setEditorRefreshKey((k) => k + 1);
                  try {
                    if (contentRef.current) contentRef.current.innerHTML = "";
                  } catch (e) {}
                  try {
                    if (typeof props.onSync === "function") {
                      try {
                        console.debug(
                          "EmailEditor: invoking onSync after send"
                        );
                      } catch (e) {}
                      props.onSync();
                    }
                  } catch (e) {}
                  try {
                    if (typeof props.onClose === "function") props.onClose();
                  } catch (e) {}
                } else {
                  console.error("Send failed", res.data);
                  // Extract error message from response
                  const errorMessage =
                    res.data?.error || "Failed to send email";
                  const errorDetails = res.data?.details;

                  // Show error with details if available
                  if (errorDetails) {
                    errorToastLocal(`${errorMessage}. ${errorDetails}`);
                  } else {
                    errorToastLocal(errorMessage);
                  }
                }
              } catch (err: any) {
                console.error("Send error", err);

                // Extract error message from axios error response
                let errorMessage = "Failed to send email. Please try again.";
                let errorDetails: string | null = null;

                if (err.response) {
                  // Server responded with error status
                  const status = err.response.status;
                  const errorData = err.response.data;

                  // Extract error message
                  if (errorData?.error) {
                    errorMessage = errorData.error;
                  } else if (typeof errorData === "string") {
                    errorMessage = errorData;
                  }

                  // Extract error details
                  if (errorData?.details) {
                    errorDetails = errorData.details;
                  }

                  // Compose brief missing-data toast for 400s from token validation
                  if (status === 400) {
                    const missingSet = new Set<string>();
                    // Map missingParameter to entity keys
                    const mapMissingParam = (p?: string) => {
                      if (!p) return;
                      const s = String(p).toLowerCase();
                      if (s.includes("career")) missingSet.add("career");
                      else if (s.includes("org"))
                        missingSet.add("organization");
                      else if (
                        s.includes("applicant") ||
                        s.includes("candidate")
                      )
                        missingSet.add("candidate");
                    };
                    mapMissingParam(errorData?.missingParameter);

                    // Map missingData array to entity keys
                    if (Array.isArray(errorData?.missingData)) {
                      for (const item of errorData.missingData as any[]) {
                        const s = String(item || "").toLowerCase();
                        if (s.includes("job") || s.includes("career"))
                          missingSet.add("career");
                        if (
                          s.includes("organization") ||
                          s.includes("employer")
                        )
                          missingSet.add("organization");
                        if (s.includes("candidate"))
                          missingSet.add("candidate");
                      }
                    }

                    // Infer from unreplacedTokens when available
                    if (Array.isArray(errorData?.unreplacedTokens)) {
                      // Log unreplaced tokens for debugging
                      console.error(
                        "[EmailEditor] Unreplaced tokens:",
                        errorData.unreplacedTokens
                      );

                      for (const tok of errorData.unreplacedTokens as any[]) {
                        const s = String(tok || "").toLowerCase();
                        if (s.includes("job") || s.includes("career"))
                          missingSet.add("career");
                        if (
                          s.includes("organization") ||
                          s.includes("employer")
                        )
                          missingSet.add("organization");
                        if (s.includes("candidate"))
                          missingSet.add("candidate");
                      }
                    }

                    if (missingSet.size > 0) {
                      const items = Array.from(missingSet);
                      const joinNice = (arr: string[]) => {
                        if (arr.length === 1) return arr[0];
                        if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
                        return `${arr.slice(0, -1).join(", ")} and ${
                          arr[arr.length - 1]
                        }`;
                      };
                      const joined = joinNice(items);
                      const joinedCap =
                        joined.charAt(0).toUpperCase() + joined.slice(1);

                      // Include specific tokens in error message if available
                      let errorMsg = `${joinedCap} was not found. Ensure that the ${joined} exists.`;
                      if (
                        Array.isArray(errorData?.unreplacedTokens) &&
                        errorData.unreplacedTokens.length > 0
                      ) {
                        const tokenList = errorData.unreplacedTokens.join(", ");
                        errorMsg += ` (Tokens: ${tokenList})`;
                        console.error(
                          `[EmailEditor] Failed to replace tokens: ${tokenList}`
                        );
                      }

                      errorToastLocal(errorMsg);
                      return; // Stop further generic error handling
                    }
                  }

                  // Provide specific messages based on status code
                  if (status === 400) {
                    if (
                      !errorMessage.includes("Invalid") &&
                      !errorMessage.includes("Missing")
                    ) {
                      errorMessage =
                        errorMessage ||
                        "Invalid request. Please check the email format and try again.";
                    }
                  } else if (status === 401) {
                    errorMessage =
                      errorMessage ||
                      "Gmail authentication failed. Please reconnect your Gmail account.";
                    errorDetails =
                      errorDetails ||
                      "Your Gmail connection may have expired. Please reconnect in settings.";
                  } else if (status === 404) {
                    errorMessage =
                      errorMessage ||
                      "Gmail account not found. Please check your email settings.";
                  } else if (status === 429) {
                    errorMessage =
                      "Gmail API rate limit exceeded. Please try again in a few moments.";
                    errorDetails =
                      "Too many requests to Gmail API. Please wait before sending another email.";
                  } else if (status === 503) {
                    errorMessage =
                      "Gmail service is temporarily unavailable. Please try again later.";
                    errorDetails =
                      "The Gmail service may be experiencing issues. Please try again in a moment.";
                  } else if (status >= 500) {
                    errorMessage =
                      errorMessage ||
                      "Server error occurred. Please try again later.";
                    errorDetails =
                      errorDetails ||
                      "An internal server error occurred. Our team has been notified.";
                  }
                } else if (err.request) {
                  // Request was made but no response received
                  errorMessage =
                    "No response from server. Please check your network connection and try again.";
                  errorDetails =
                    "The request timed out or the server is unreachable.";
                } else if (
                  err.code === "ECONNREFUSED" ||
                  err.code === "ETIMEDOUT"
                ) {
                  // Network errors
                  errorMessage =
                    "Unable to connect to server. Please check your internet connection.";
                  errorDetails = err.message || "Connection error occurred.";
                } else if (err.message) {
                  // Other errors with messages
                  errorMessage = err.message;
                }

                // Show error with details if available
                if (errorDetails) {
                  errorToastLocal(`${errorMessage} ${errorDetails}`);
                } else {
                  errorToastLocal(errorMessage);
                }
              } finally {
                setIsSending(false);
              }
            }}
            className="btn btn-default btn-pill"
            style={{ borderRadius: "25px" }}
            disabled={isSending}
          >
            <i className="la la-paper-plane"></i>{" "}
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
      <InsertTemplateModal
        open={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onInsert={handleTemplateInsert}
      />
    </>
  );
}
