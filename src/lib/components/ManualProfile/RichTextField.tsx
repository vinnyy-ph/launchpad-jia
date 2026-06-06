"use client";

import { useEffect, useRef } from "react";
import {
  Bold01,
  Dotpoints01,
  Italic01,
  Strikethrough01,
  Underline01,
} from "@untitledui/icons";
import LabeledField from "./LabeledField";
import styles from "./manual-profile.module.scss";

function NumberedListIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </svg>
  );
}

const COMMANDS: Array<{ command: string; label: string; icon: React.ReactNode }> = [
  { command: "bold", label: "Bold", icon: <Bold01 /> },
  { command: "italic", label: "Italic", icon: <Italic01 /> },
  { command: "underline", label: "Underline", icon: <Underline01 /> },
  { command: "strikeThrough", label: "Strikethrough", icon: <Strikethrough01 /> },
  { command: "insertOrderedList", label: "Numbered list", icon: <NumberedListIcon /> },
  { command: "insertUnorderedList", label: "Bulleted list", icon: <Dotpoints01 /> },
];

interface RichTextFieldProps {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (html: string) => void;
}

// Lightweight rich-text Description editor (Figma toolbar: B / I / U / S /
// numbered + bulleted list). Self-contained contentEditable + execCommand — kept
// uncontrolled after the initial value so typing never resets the caret.
export default function RichTextField({
  id,
  label,
  placeholder,
  value,
  onChange,
}: RichTextFieldProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emitChange() {
    if (!ref.current) return;
    // Normalise a "blank" editor (browsers leave a stray <br>) back to "" so the
    // placeholder shows and the entry counts as empty.
    if (!ref.current.textContent?.trim()) {
      ref.current.innerHTML = "";
    }
    onChange(ref.current.innerHTML);
  }

  function exec(command: string) {
    ref.current?.focus();
    document.execCommand(command, false);
    emitChange();
  }

  return (
    <LabeledField label={label} htmlFor={id}>
      <div className={styles.richEditor}>
        <div
          id={id}
          ref={ref}
          className={styles.richContent}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          data-placeholder={placeholder}
          suppressContentEditableWarning
          onInput={emitChange}
        />
        <div className={styles.richToolbar}>
          {COMMANDS.map((item) => (
            <button
              key={item.command}
              type="button"
              className={styles.richToolbarBtn}
              title={item.label}
              aria-label={item.label}
              onMouseDown={(event) => {
                // Keep the editor selection while clicking the toolbar.
                event.preventDefault();
                exec(item.command);
              }}
            >
              {item.icon}
            </button>
          ))}
        </div>
      </div>
    </LabeledField>
  );
}
