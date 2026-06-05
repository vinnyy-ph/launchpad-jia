"use client";
import { Button, Field, Select } from "@/lib/components/ui";
import type { ContactWebsite } from "@/lib/utils/structuredCV";

const WEBSITE_TYPES = ["Linkedin", "Personal", "Company", "Portfolio", "Blog"];

export default function WebsitesStep({
  value,
  onChange,
}: {
  value: ContactWebsite[];
  onChange: (v: ContactWebsite[]) => void;
}) {
  function update(id: string, patch: Partial<ContactWebsite>) {
    onChange(value.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }
  function add() {
    onChange([...value, { id: `${Date.now()}`, url: "", type: "" }]);
  }
  function remove(id: string) {
    onChange(value.filter((w) => w.id !== id));
  }

  return (
    <div>
      {value.map((w) => (
        <div
          key={w.id}
          style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 12 }}
        >
          <Field
            label="URL"
            placeholder="www.website.com"
            value={w.url}
            onChange={(e) => update(w.id, { url: (e as React.ChangeEvent<HTMLInputElement>).target.value })}
          />
          <Select
            label="Website Type"
            data={WEBSITE_TYPES}
            value={w.type}
            onChange={(v: string | null) => update(w.id, { type: v ?? "" })}
          />
          <button type="button" aria-label="Remove website" onClick={() => remove(w.id)}>
            Remove
          </button>
        </div>
      ))}
      <Button label="Add website" variant="secondary" onClick={add} />
    </div>
  );
}
