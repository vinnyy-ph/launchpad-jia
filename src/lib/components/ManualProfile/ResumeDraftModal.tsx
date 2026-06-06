"use client";

import { Button, Modal } from "@/lib/components/ui";

interface Props {
  opened: boolean;
  savedAt?: number;
  onResume: () => void;
  onStartOver: () => void;
}

export default function ResumeDraftModal({ opened, savedAt, onResume, onStartOver }: Props) {
  if (!opened) return null;
  const when = savedAt ? new Date(savedAt).toLocaleString() : "";
  return (
    // Closing (X / overlay) keeps the draft — defaults to the non-destructive choice.
    <Modal opened={opened} onClose={onResume} title="Resume your profile?">
      <p>
        You have an unfinished profile{when ? ` from ${when}` : ""}. Would you like to pick up
        where you left off?
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
        <Button label="Start over" variant="secondary" onClick={onStartOver} />
        <Button label="Resume" variant="primary" onClick={onResume} />
      </div>
    </Modal>
  );
}
