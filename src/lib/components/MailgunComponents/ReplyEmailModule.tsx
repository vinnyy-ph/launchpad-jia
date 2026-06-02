"use client";

import React, { useState } from "react";
import EmailEditor, { MailgunAccount } from "./EmailEditor";

type ReplyEmailModuleProps = {
  to?: string | null;
  subject?: string | null;
  careerId?: string | null;
  threadId?: string | null;
  initialMessage?: string | null;
  inReplyTo?: string | null;
  // Draft metadata (optional)
  draftId?: string | null;
  isDraft?: boolean | number | string | null;
  draftAttachments?: any[];
  toList?: string[] | undefined;
  toRaw?: string | null;
  savedAt?: string | number | string | null;
  onSync?: () => void;
  onClose?: () => void;
  mailgunAccounts?: MailgunAccount[];
  mailgunRole?: string | null;
  selectedMailgunAccountId?: string | null;
};

export default function ReplyEmailModule({
  to,
  subject,
  careerId,
  threadId,
  initialMessage,
  inReplyTo,
  draftId,
  isDraft,
  draftAttachments,
  toList,
  toRaw,
  savedAt,
  onSync,
  onClose,
  mailgunAccounts,
  mailgunRole,
  selectedMailgunAccountId,
}: ReplyEmailModuleProps) {
  const [composeMode, setComposeMode] = useState<
    "minimized" | "window" | "fullscreen"
  >("window");

  return (
    <EmailEditor
      initialTo={
        to || (Array.isArray(toList) ? toList.join(", ") : toRaw || "")
      }
      initialSubject={subject || ""}
      initialCareerId={careerId || null}
      threadId={threadId || null}
      initialMessage={initialMessage || ""}
      inReplyTo={inReplyTo || null}
      // Forward draft metadata to editor
      draftId={draftId || undefined}
      isDraft={isDraft || undefined}
      initialAttachments={
        Array.isArray(draftAttachments) ? draftAttachments : undefined
      }
      initialToRaw={toRaw || undefined}
      toList={toList || undefined}
      savedAt={savedAt || undefined}
      onSync={onSync}
      onClose={onClose}
      prefetchedAccounts={mailgunAccounts}
      prefetchedRole={mailgunRole}
      prefetchedSelectedAccountId={selectedMailgunAccountId}
    />
  );
}
