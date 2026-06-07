"use client";

import { useState } from "react";
import { Field } from "@/lib/components/ui";
import { XClose } from "@untitledui/icons";
import styles from "./manual-profile.module.scss";

export default function SkillsStep({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const skill = draft.trim();
    if (skill && !value.includes(skill)) onChange([...value, skill]);
    setDraft("");
  }

  return (
    <div>
      <Field
        label="Add Skill"
        size="sm"
        placeholder="Enter skill (ex. Project Management)"
        value={draft}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
        onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
      />
      <div className={styles.skillChips}>
        {value.map((skill) => (
          <span key={skill} className={styles.skillChip}>
            {skill}
            <button
              type="button"
              className={styles.skillChipRemove}
              aria-label={`Remove ${skill}`}
              onClick={() => onChange(value.filter((item) => item !== skill))}
            >
              <XClose className={styles.skillChipRemoveIcon} aria-hidden />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
