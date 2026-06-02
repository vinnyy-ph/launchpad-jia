"use client";

import { useEffect, useState } from "react";
import { Button, Modal } from "@/lib/components/ui";
import { useDisclosure } from "@/lib/components/ui/hooks";
import SkillTagInput from "../CandidateComponents/SkillTagInput";
import styles from "./form-modal.module.scss";

interface SkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (skills: string[]) => void;
  initialSkills?: string[];
  maxSkills?: number;
}

export default function SkillModal({
  isOpen,
  onClose,
  onSave,
  initialSkills = [],
  maxSkills = 60,
}: SkillModalProps) {
  const [opened, { open, close }] = useDisclosure(isOpen);
  const [skills, setSkills] = useState<string[]>(initialSkills.slice(0, maxSkills));

  useEffect(() => {
    if (isOpen) {
      open();
      return;
    }

    close();
  }, [close, isOpen, open]);

  useEffect(() => {
    if (!isOpen) return;
    setSkills(initialSkills.slice(0, maxSkills));
  }, [initialSkills, isOpen, maxSkills]);

  function handleClose() {
    close();
    onClose();
  }

  function handleSave() {
    onSave(skills.slice(0, maxSkills));
    handleClose();
  }

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
          <span className={styles.heading}>Skills</span>
          <span className={styles.subtitle}>
            Highlight the skills, tools, and technologies you use in your work.
          </span>
        </span>
      }
      closeButtonLabel="Close skills modal"
    >
      <div className={styles.formLayout}>
        <div className={styles.fieldsCompact}>
          <SkillTagInput
            skills={skills}
            onSkillsChange={(updatedSkills) =>
              setSkills(updatedSkills.slice(0, maxSkills))
            }
          />
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
