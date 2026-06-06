"use client";
import { useEffect, useState } from "react";
import { Button, Field, Group, Modal } from "@/lib/components/ui";
import type { ReferenceSectionItem } from "@/lib/utils/structuredCV";

function empty(): ReferenceSectionItem {
  return {
    id: `${Date.now()}`,
    name: "",
    email: "",
    phone: "",
    countryCode: "PH",
    company: "",
    position: "",
    relation: "",
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: ReferenceSectionItem) => void;
  onDelete?: (id: string) => void;
  initialData?: ReferenceSectionItem | null;
}

export default function ReferenceModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
}: Props) {
  const [item, setItem] = useState<ReferenceSectionItem>(initialData ?? empty());

  useEffect(() => {
    setItem(initialData ?? empty());
  }, [initialData, isOpen]);

  function set(p: Partial<ReferenceSectionItem>) {
    setItem((i) => ({ ...i, ...p }));
  }

  const canSave = Boolean(
    item.name.trim() &&
      item.phone.trim() &&
      item.company.trim() &&
      item.position.trim(),
  );

  if (!isOpen) return null;

  return (
    <Modal opened={isOpen} onClose={onClose} title="Character Reference">
      <Field
        label="Name"
        withAsterisk
        placeholder="Enter name of reference"
        value={item.name}
        onChange={(e) => set({ name: (e as React.ChangeEvent<HTMLInputElement>).target.value })}
      />
      <Group grow>
        <Field
          label="Email"
          placeholder="Enter email"
          value={item.email}
          onChange={(e) => set({ email: (e as React.ChangeEvent<HTMLInputElement>).target.value })}
        />
        <Field
          label="Phone number"
          withAsterisk
          placeholder="+63 000 000 0000"
          value={item.phone}
          onChange={(e) => set({ phone: (e as React.ChangeEvent<HTMLInputElement>).target.value })}
        />
      </Group>
      <Field
        label="Company"
        withAsterisk
        placeholder="Enter referral company"
        value={item.company}
        onChange={(e) => set({ company: (e as React.ChangeEvent<HTMLInputElement>).target.value })}
      />
      <Group grow>
        <Field
          label="Position"
          withAsterisk
          placeholder="Enter reference position"
          value={item.position}
          onChange={(e) =>
            set({ position: (e as React.ChangeEvent<HTMLInputElement>).target.value })
          }
        />
        <Field
          label="Relation"
          placeholder="Enter nature of relation"
          value={item.relation}
          onChange={(e) =>
            set({ relation: (e as React.ChangeEvent<HTMLInputElement>).target.value })
          }
        />
      </Group>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        {initialData && onDelete ? (
          <button type="button" onClick={() => onDelete(item.id)}>
            Delete
          </button>
        ) : (
          <span />
        )}
        <Button
          label="Save"
          variant="primary"
          disabled={!canSave}
          onClick={() => onSave(item)}
        />
      </div>
    </Modal>
  );
}
