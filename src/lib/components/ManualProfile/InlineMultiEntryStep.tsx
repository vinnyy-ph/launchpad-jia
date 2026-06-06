"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trash02 } from "@untitledui/icons";
import styles from "./manual-profile.module.scss";

interface HasId {
  id: string;
}

interface InlineMultiEntryStepProps<T extends HasId> {
  items: T[];
  onChange: (items: T[]) => void;
  renderForm: (value: T, onChange: (next: T) => void) => React.ReactNode;
  /** Accordion header label for an entry (e.g. the school name). */
  entryLabel: (value: T, index: number) => string;
  /** Singular noun for the delete a11y label, e.g. "education". */
  entryNoun: string;
}

// Inline multi-entry editor rendered as collapsible accordion cards (mirrors the
// Websites step): each entry has a header (label + chevron) that toggles its form.
// "Add <entry>" lives in the wizard footer (it appends a blank to `items`).
export default function InlineMultiEntryStep<T extends HasId>({
  items,
  onChange,
  renderForm,
  entryLabel,
  entryNoun,
}: InlineMultiEntryStepProps<T>) {
  // Collapse state keyed by id; missing/false means expanded, so new and initial
  // cards open by default and each toggles independently.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function updateRow(id: string, next: T) {
    onChange(items.map((item) => (item.id === id ? next : item)));
  }

  function remove(id: string) {
    onChange(items.filter((item) => item.id !== id));
    setCollapsed((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function toggle(id: string) {
    setCollapsed((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <div className={styles.entryCards}>
      {items.map((item, index) => {
        const open = !collapsed[item.id];

        return (
          <div key={item.id} className={styles.entryCard}>
            <button
              type="button"
              className={styles.entryHeader}
              aria-expanded={open}
              onClick={() => toggle(item.id)}
            >
              <span className={styles.entryHeaderLabel}>{entryLabel(item, index)}</span>
              {open ? (
                <ChevronUp className={styles.entryChevron} aria-hidden />
              ) : (
                <ChevronDown className={styles.entryChevron} aria-hidden />
              )}
            </button>

            {open && (
              <div className={styles.entryBody}>
                {renderForm(item, (next) => updateRow(item.id, next))}

                <div className={styles.entryDeleteRow}>
                  <button
                    type="button"
                    className={styles.entryDelete}
                    aria-label={`Remove ${entryNoun} ${index + 1}`}
                    onClick={() => remove(item.id)}
                  >
                    <Trash02 className={styles.entryDeleteIcon} aria-hidden />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
