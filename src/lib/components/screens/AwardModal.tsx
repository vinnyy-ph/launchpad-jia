"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Field, Modal, Select, Textarea } from "@/lib/components/ui";
import { useDisclosure } from "@/lib/components/ui/hooks";
import styles from "./form-modal.module.scss";

export interface AwardItem {
  id: string;
  title: string;
  issuer: string;
  issueDate: { month: string; year: string };
  description: string;
}

interface AwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (award: AwardItem) => void;
  onDelete?: (id: string) => void;
  initialData?: AwardItem | null;
}

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const years = Array.from({ length: 50 }, (_, i) =>
  (new Date().getFullYear() - i).toString(),
);

function createEmptyAward(): AwardItem {
  return {
    id: Date.now().toString(),
    title: "",
    issuer: "",
    issueDate: { month: "", year: "" },
    description: "",
  };
}

function toSelectData(options: string[]) {
  return options.map((option) => ({ value: option, label: option }));
}

export default function AwardModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
}: AwardModalProps) {
  const [opened, { open, close }] = useDisclosure(isOpen);
  const [award, setAward] = useState<AwardItem>(() => createEmptyAward());
  const monthOptions = useMemo(() => toSelectData(months), []);
  const yearOptions = useMemo(() => toSelectData(years), []);

  useEffect(() => {
    if (isOpen) {
      open();
      return;
    }

    close();
  }, [close, isOpen, open]);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setAward(initialData);
      return;
    }

    setAward(createEmptyAward());
  }, [initialData, isOpen]);

  function handleClose() {
    close();
    onClose();
  }

  function handleSave() {
    if (!award.title.trim() || !award.issuer.trim()) {
      alert("Award title and issuer are required");
      return;
    }

    onSave(award);
    handleClose();
  }

  function handleDelete() {
    if (!onDelete || !award.id) return;

    onDelete(award.id);
    handleClose();
  }

  function updateAward<K extends keyof AwardItem>(field: K, value: AwardItem[K]) {
    setAward((current) => ({ ...current, [field]: value }));
  }

  function updateDate(field: "month" | "year", value: string) {
    setAward((current) => ({
      ...current,
      issueDate: { ...current.issueDate, [field]: value },
    }));
  }

  const descriptionCharactersLeft = 2000 - (award.description?.length ?? 0);

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
          <span className={styles.heading}>
            {initialData ? "Edit Award" : "Add Award"}
          </span>
          <span className={styles.subtitle}>
            Recognize your achievements and honors that demonstrate your excellence.
          </span>
        </span>
      }
      closeButtonLabel="Close award modal"
    >
      <div className={styles.formLayout}>
        <div className={styles.fields}>
          <p className={styles.requiredHint}>
            <span className={styles.requiredHintAsterisk}>*</span> Indicates required
          </p>

          <Field
            label="Title"
            withAsterisk
            placeholder="E.g. Employee of the Year"
            value={award.title}
            onChange={(event) => updateAward("title", event.target.value)}
          />

          <Field
            label="Issuer"
            withAsterisk
            placeholder="E.g. Microsoft Corporation"
            value={award.issuer}
            onChange={(event) => updateAward("issuer", event.target.value)}
          />

          <div className={styles.dateGroup}>
            <p className={styles.groupLabel}>Issue date</p>
            <div className={styles.dateRow}>
              <Select
                data={monthOptions}
                placeholder="Month"
                value={award.issueDate.month || null}
                onChange={(value) => updateDate("month", value ?? "")}
              />
              <Select
                data={yearOptions}
                placeholder="Year"
                value={award.issueDate.year || null}
                onChange={(value) => updateDate("year", value ?? "")}
              />
            </div>
          </div>

          <div className={styles.textareaGroup}>
            <Textarea
              id="award-description"
              label="Description"
              placeholder="Describe the award, its significance, and any relevant details..."
              value={award.description}
              maxLength={2000}
              autosize
              minRows={5}
              maxRows={12}
              onChange={(event) => updateAward("description", event.target.value)}
            />
            <p className={styles.charCount}>
              {descriptionCharactersLeft} characters left
            </p>
          </div>
        </div>

        <div className={styles.footer}>
          {initialData && onDelete ? (
            <Button
              label="Delete Award"
              variant="secondary"
              onClick={handleDelete}
              pill
            />
          ) : (
            <span className={styles.footerSpacer} />
          )}

          <div className={styles.actions}>
            <Button label="Cancel" variant="secondary" pill onClick={handleClose} />
            <Button label="Save" variant="primary" pill onClick={handleSave} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
