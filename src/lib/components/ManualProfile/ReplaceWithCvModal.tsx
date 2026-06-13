"use client";

import { Button, Modal } from "@/lib/components/ui";

interface Props {
  opened: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Shown only when the wizard already has user-entered data before an autofill.
export default function ReplaceWithCvModal({ opened, onConfirm, onCancel }: Props) {
  if (!opened) return null;
  return (
    <Modal opened={opened} onClose={onCancel} title="Replace your entries?">
      <p>
        Uploading a CV will overwrite everything you&apos;ve entered so far. Do you want to
        continue?
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
        <Button label="Cancel" variant="secondary" onClick={onCancel} />
        <Button label="Replace with CV" variant="primary" onClick={onConfirm} />
      </div>
    </Modal>
  );
}
