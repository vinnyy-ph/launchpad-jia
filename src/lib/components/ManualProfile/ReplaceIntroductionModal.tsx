"use client";

import { Button, Modal } from "@/lib/components/ui";

interface Props {
  opened: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ReplaceIntroductionModal({ opened, onConfirm, onCancel }: Props) {
  if (!opened) return null;
  return (
    <Modal opened={opened} onClose={onCancel} title="Replace your introduction?">
      <p>Generating will replace what you&apos;ve written. Do you want to continue?</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
        <Button label="Cancel" variant="secondary" onClick={onCancel} />
        <Button label="Replace" variant="primary" onClick={onConfirm} />
      </div>
    </Modal>
  );
}
