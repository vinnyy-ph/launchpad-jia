"use client";

import React from "react";

type Props = {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
};

/** Repeatable add/remove text rows for a list of qualifications. */
export default function QualificationListInput({ label, placeholder, values, onChange }: Props) {
  // When the stored list is empty we still render one "phantom" empty row so there is
  // always an input to type into. The handlers below operate on `rows` (not `values`),
  // which commits that phantom row into form state on the first edit or Add.
  const rows = values.length > 0 ? values : [""];

  const update = (index: number, value: string) => {
    const next = [...rows];
    next[index] = value;
    onChange(next);
  };

  const add = () => onChange([...rows, ""]);

  // Removing the last row stores [] — the phantom row above keeps one input visible.
  const remove = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 14, color: "#414651", fontWeight: 600 }}>{label}</span>
      {rows.map((value, index) => (
        <div key={index} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => update(index, e.target.value)}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #D5D7DA",
              fontSize: 14,
              color: "#181D27",
            }}
          />
          <button
            type="button"
            aria-label="Remove qualification"
            onClick={() => remove(index)}
            style={{ border: "1px solid #D5D7DA", borderRadius: 8, background: "#FFFFFF", padding: "8px 10px", cursor: "pointer" }}
          >
            <i className="la la-trash" style={{ fontSize: 16, color: "#B42318" }} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        style={{
          alignSelf: "flex-start",
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: "1px solid #D5D7DA",
          borderRadius: 60,
          background: "#FFFFFF",
          padding: "8px 14px",
          cursor: "pointer",
          fontSize: 14,
          color: "#414651",
          fontWeight: 600,
        }}
      >
        <i className="la la-plus" style={{ fontSize: 14 }} /> Add {label.toLowerCase()}
      </button>
    </div>
  );
}
