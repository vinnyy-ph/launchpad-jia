import { useEffect, useRef } from "react";
import type { TokenEditorHandle } from "@/lib/components/MailgunComponents/editor/TokenEditorField";
import type { AutocompleteOption } from "@/lib/components/MailgunComponents/editor/AutocompleteField";
import type { ComposeInitialDraft } from "@/lib/components/MailgunComponents/components/ComposeEmailModal";

interface SenderOption {
  value: string;
  imageSrc?: string;
  label: string;
  email?: string;
  userId?: string;
  id?: string;
}

interface UseDraftPrefillParams {
  initialDraft: ComposeInitialDraft | null | undefined;
  recipientOptions: AutocompleteOption[];
  filteredSenderOptions: SenderOption[];
  careerOptions: AutocompleteOption[];
  subjectEditorRef: React.RefObject<TokenEditorHandle | null>;
  bodyEditorRef: React.RefObject<TokenEditorHandle | null>;
  setFormData: (data: { email_subject: string; email_body: string }) => void;
  setToRecipients: (recipients: AutocompleteOption[]) => void;
  setCcRecipients: (recipients: AutocompleteOption[]) => void;
  setBccRecipients: (recipients: AutocompleteOption[]) => void;
  setShowCc: (show: boolean) => void;
  setShowBcc: (show: boolean) => void;
  setFromSender: (sender: SenderOption[]) => void;
  setLinkedCareer: (career: AutocompleteOption[]) => void;
}

export const useDraftPrefill = ({
  initialDraft,
  recipientOptions,
  filteredSenderOptions,
  careerOptions,
  subjectEditorRef,
  bodyEditorRef,
  setFormData,
  setToRecipients,
  setCcRecipients,
  setBccRecipients,
  setShowCc,
  setShowBcc,
  setFromSender,
  setLinkedCareer,
}: UseDraftPrefillParams) => {
  const draftIdRef = useRef<string | null>(null);
  const draftThreadIdRef = useRef<string | null>(null);
  const hasPrefilledToRef = useRef(false);
  const hasPrefilledCcRef = useRef(false);
  const hasPrefilledBccRef = useRef(false);
  const hasPrefilledFromRef = useRef(false);
  const hasPrefilledCareerRef = useRef(false);

  const resetPrefillGuards = () => {
    hasPrefilledToRef.current = false;
    hasPrefilledCcRef.current = false;
    hasPrefilledBccRef.current = false;
    hasPrefilledFromRef.current = false;
    hasPrefilledCareerRef.current = false;
  };

  // Effect 1: Immediately set text-based fields and draft refs when initialDraft changes.
  // This runs before async options (senders / recipients / careers) finish loading.
  // Important: TokenEditorField initialises its DOM once on mount and ignores subsequent
  // `value` prop changes, so we must also push content imperatively via the editor refs.
  useEffect(() => {
    if (!initialDraft) {
      draftIdRef.current = null;
      draftThreadIdRef.current = null;
      resetPrefillGuards();
      return;
    }
    draftIdRef.current = initialDraft._id ? String(initialDraft._id) : null;
    draftThreadIdRef.current = initialDraft.threadId
      ? String(initialDraft.threadId)
      : null;
    const subject = initialDraft.subject ?? "";
    const body = initialDraft.html ?? initialDraft.text ?? "";
    setFormData({ email_subject: subject, email_body: body });
    // Reset all per-field guards so Effect 2 can run for each field
    resetPrefillGuards();

    // Imperatively update the editor DOM. Use a microtask so the refs are
    // guaranteed to be attached and any signature inserted synchronously
    // gets overwritten by the actual draft content.
    setTimeout(() => {
      if (subjectEditorRef.current?.insertTemplate) {
        subjectEditorRef.current.insertTemplate(subject, "");
      }
      if (bodyEditorRef.current?.insertTemplate) {
        bodyEditorRef.current.insertTemplate("", body);
      }
    }, 0);
  }, [initialDraft?._id, initialDraft?.threadId]);

  // Effect 2: Match To / From / Career against their respective async option lists.
  // Each field has its OWN guard so they prefill independently — whichever option
  // array arrives first doesn't block the others from matching later.
  useEffect(() => {
    if (!initialDraft) return;

    // --- To: match as soon as recipientOptions are available ---
    if (!hasPrefilledToRef.current && recipientOptions.length > 0) {
      hasPrefilledToRef.current = true;
      const toRaw =
        initialDraft.toRaw ??
        (Array.isArray(initialDraft.toList)
          ? initialDraft.toList.join(", ")
          : null) ??
        (Array.isArray(initialDraft.to)
          ? initialDraft.to.join(", ")
          : String(initialDraft.to || ""));
      const toEmails = (
        typeof toRaw === "string"
          ? toRaw
              .split(/[,;]/)
              .map((s) => s.trim())
              .filter(Boolean)
          : []
      ) as string[];
      if (toEmails.length > 0) {
        const matched = toEmails.map((email) => {
          const lower = email.toLowerCase();
          const opt = recipientOptions.find(
            (o) =>
              o.value?.toLowerCase() === lower ||
              o.email?.toLowerCase() === lower ||
              (typeof o.value === "string" &&
                o.value.toLowerCase().includes(lower)),
          );
          return opt ?? { value: email, label: email, email };
        });
        setToRecipients(matched);
      }
    }

    const matchEmailsToRecipients = (raw: string | string[] | null | undefined): AutocompleteOption[] => {
      const str =
        typeof raw === "string"
          ? raw
          : Array.isArray(raw)
            ? raw.join(", ")
            : "";
      const emails = str
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (emails.length === 0) return [];
      return emails.map((email) => {
        const lower = email.toLowerCase();
        const opt = recipientOptions.find(
          (o) =>
            o.value?.toLowerCase() === lower ||
            o.email?.toLowerCase() === lower ||
            (typeof o.value === "string" && o.value.toLowerCase().includes(lower)),
        );
        return opt ?? ({ value: email, label: email, email } as AutocompleteOption);
      });
    };

    // --- Cc: match as soon as recipientOptions are available ---
    if (!hasPrefilledCcRef.current && recipientOptions.length > 0) {
      const ccRaw = initialDraft.ccRaw ?? (Array.isArray(initialDraft.cc) ? initialDraft.cc.join(", ") : initialDraft.cc) ?? "";
      if (ccRaw && String(ccRaw).trim()) {
        hasPrefilledCcRef.current = true;
        setShowCc(true);
        setCcRecipients(matchEmailsToRecipients(ccRaw));
      }
    }

    // --- Bcc: match as soon as recipientOptions are available ---
    if (!hasPrefilledBccRef.current && recipientOptions.length > 0) {
      const bccRaw = initialDraft.bccRaw ?? (Array.isArray(initialDraft.bcc) ? initialDraft.bcc.join(", ") : initialDraft.bcc) ?? "";
      if (bccRaw && String(bccRaw).trim()) {
        hasPrefilledBccRef.current = true;
        setShowBcc(true);
        setBccRecipients(matchEmailsToRecipients(bccRaw));
      }
    }

    // --- From: match as soon as filteredSenderOptions are available ---
    if (!hasPrefilledFromRef.current && filteredSenderOptions.length > 0) {
      hasPrefilledFromRef.current = true;
      
      // Attempt to match by fromMailgunId (prefixed ID like "outlook:memberId" or "gmail:emailSettingsId")
      if (initialDraft.fromMailgunId) {
        const fromMailgunId = String(initialDraft.fromMailgunId);
        const matchedFrom = filteredSenderOptions.find(
          (o) => o.value === fromMailgunId,
        );
        if (matchedFrom) {
          setFromSender([
            {
              value: matchedFrom.value ?? matchedFrom.email ?? "",
              label: matchedFrom.label ?? matchedFrom.email ?? "",
              email: matchedFrom.email,
              imageSrc: matchedFrom.imageSrc,
            },
          ]);
          return;
        }
      }
      
      // Fallback: match by email address (for backwards compatibility with old drafts)
      const fromStr =
        typeof initialDraft.from === "string" ? initialDraft.from : "";
      if (fromStr) {
        const fromEmail = fromStr.includes("<")
          ? fromStr.replace(/.*<([^>]+)>.*/, "$1").trim()
          : fromStr.trim();
        const matchedFrom = filteredSenderOptions.find(
          (o) =>
            o.email?.toLowerCase() === fromEmail.toLowerCase() ||
            o.value?.toLowerCase() === fromEmail.toLowerCase(),
        );
        if (matchedFrom) {
          setFromSender([
            {
              value: matchedFrom.value ?? matchedFrom.email ?? "",
              label: matchedFrom.label ?? matchedFrom.email ?? "",
              email: matchedFrom.email,
              imageSrc: matchedFrom.imageSrc,
            },
          ]);
        }
      }
    }

    // --- Career: match as soon as careerOptions are available ---
    if (!hasPrefilledCareerRef.current && careerOptions.length > 0) {
      hasPrefilledCareerRef.current = true;
      if (initialDraft.careerId) {
        const matchedCareer = careerOptions.find(
          (opt) => opt.value === initialDraft.careerId,
        );
        if (matchedCareer) {
          setLinkedCareer([matchedCareer]);
        }
      }
    }
  }, [
    initialDraft?._id,
    initialDraft?.toRaw,
    initialDraft?.toList,
    initialDraft?.to,
    initialDraft?.ccRaw,
    initialDraft?.cc,
    initialDraft?.bccRaw,
    initialDraft?.bcc,
    initialDraft?.careerId,
    recipientOptions.length,
    filteredSenderOptions.length,
    careerOptions.length,
  ]);

  return { draftIdRef, draftThreadIdRef };
};
