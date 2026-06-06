"use client";

import { Button, Modal } from "@/lib/components/ui";

interface Props {
  opened: boolean;
  onGoBack: () => void;
  onSaveExit: () => void;
  onExitWithoutSaving: () => void;
}

export default function DiscardProfileModal({
  opened,
  onGoBack,
  onSaveExit,
  onExitWithoutSaving,
}: Props) {
  if (!opened) return null;
  return (
    <Modal opened={opened} onClose={onGoBack} title="Discard this Profile?">
      <p>Are you sure you want to discard profile creation without saving your changes?</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
        <Button label="Go back" variant="secondary" onClick={onGoBack} />
        <Button label="Save & Exit" variant="primary" onClick={onSaveExit} />
        <Button
          label="Exit without Saving"
          variant="tertiary"
          onClick={onExitWithoutSaving}
        />
      </div>
    </Modal>
  );
}
