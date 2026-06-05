"use client";
import { useState } from "react";
import { Field } from "@/lib/components/ui";
import { SkillTag } from "@/lib/components/CandidateComponents/SkillTag";

export default function SkillsStep({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const s = draft.trim();
    if (s && !value.includes(s)) onChange([...value, s]);
    setDraft("");
  }

  return (
    <div>
      <Field
        label="Add Skill"
        placeholder="Enter skill (ex. Project Management)"
        value={draft}
        onChange={(e) => setDraft((e as React.ChangeEvent<HTMLInputElement>).target.value)}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {value.map((s) => (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <SkillTag label={s} />
            <button
              type="button"
              aria-label={`Remove ${s}`}
              onClick={() => onChange(value.filter((x) => x !== s))}
            >
              x
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
