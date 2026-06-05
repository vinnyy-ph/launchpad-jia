"use client";
import { useState } from "react";
import { Button } from "@/lib/components/ui";
import { ChevronDown } from "@untitledui/icons";
import styles from "./manual-profile.module.scss";

interface HasId { id: string }

interface ModalProps<T> {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: T) => void;
  onDelete?: (id: string) => void;
  initialData?: T | null;
}

interface MultiEntryStepProps<T extends HasId> {
  items: T[];
  onChange: (items: T[]) => void;
  /** The existing *Modal component, e.g. EducationModal. */
  EditorModal: React.ComponentType<ModalProps<T>>;
  /** Accordion header label for a saved row. */
  rowLabel: (item: T) => string;
  addLabel: string;
}

export default function MultiEntryStep<T extends HasId>({
  items, onChange, EditorModal, rowLabel, addLabel,
}: MultiEntryStepProps<T>) {
  const [editing, setEditing] = useState<T | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  function openNew() { setEditing(null); setIsOpen(true); }
  function openEdit(item: T) { setEditing(item); setIsOpen(true); }
  function save(item: T) {
    const exists = items.some((i) => i.id === item.id);
    onChange(exists ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item]);
    setIsOpen(false);
  }
  function remove(id: string) { onChange(items.filter((i) => i.id !== id)); setIsOpen(false); }

  return (
    <div>
      <div className={styles.entryList}>
        {items.map((item) => (
          <button key={item.id} type="button" className={styles.entryRow} onClick={() => openEdit(item)}>
            <span>{rowLabel(item)}</span>
            <ChevronDown />
          </button>
        ))}
      </div>
      <Button label={addLabel} variant="secondary" onClick={openNew} />
      <EditorModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSave={save}
        onDelete={remove}
        initialData={editing}
      />
    </div>
  );
}
