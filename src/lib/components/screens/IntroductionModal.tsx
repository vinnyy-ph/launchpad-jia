"use client";

import { useEffect, useState } from "react";
import { Button, Modal, Textarea } from "@/lib/components/ui";
import { useDisclosure } from "@/lib/components/ui/hooks";
import styles from "./form-modal.module.scss";

interface IntroductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (introduction: string) => void;
  initialValue?: string;
  maxLength?: number;
}

export default function IntroductionModal({
  isOpen,
  onClose,
  onSave,
  initialValue = "",
  maxLength = 2600,
}: IntroductionModalProps) {
  const [opened, { open, close }] = useDisclosure(isOpen);
  const [introduction, setIntroduction] = useState(initialValue);

  useEffect(() => {
    if (isOpen) {
      open();
      return;
    }

    close();
  }, [close, isOpen, open]);

  useEffect(() => {
    if (!isOpen) return;
    setIntroduction(initialValue);
  }, [initialValue, isOpen]);

  function handleClose() {
    close();
    onClose();
  }

  function handleSave() {
    onSave(introduction);
    handleClose();
  }

  const charactersLeft = maxLength - (introduction?.length ?? 0);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      size={800}
      radius={16}
      classNames={{
        body: styles.modalBody,
        content: styles.modalContent,
        header: styles.modalHeader,
        title: styles.modalTitle,
      }}
      title={
        <span className={styles.titleBlock}>
          <span className={styles.heading}>Introduction</span>
          <span className={styles.subtitle}>
            Share a short professional summary about your background, experience,
            and strengths.
          </span>
        </span>
      }
      closeButtonLabel="Close introduction modal"
    >
      <div className={styles.formLayout}>
        <div className={styles.fields}>
          <div className={styles.textareaGroup}>
            <Textarea
              id="introduction-textarea"
              placeholder="Tell us about yourself - what you do, what you're good at, and what you're looking for."
              value={introduction}
              maxLength={maxLength}
              autosize
              minRows={8}
              maxRows={15}
              onChange={(event) => setIntroduction(event.target.value)}
            />
            <p className={styles.charCountStart}>{charactersLeft} characters left</p>
          </div>
        </div>

        <div className={`${styles.footer} ${styles.footerRight}`}>
          <div className={styles.actions}>
            <Button label="Cancel" variant="secondary" pill onClick={handleClose} />
            <Button label="Save" variant="primary" pill onClick={handleSave} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
