"use client";

import { useRef, useState } from "react";
import { Button, Modal } from "@/lib/components/ui";
import { UploadCloud02 } from "@untitledui/icons";
import styles from "./manual-profile.module.scss";

interface Props {
  opened: boolean;
  onClose: () => void;
  onFile: (file: File) => void;
  parsing: boolean;
  error: string | null;
}

const ACCEPT = ".pdf,.doc,.docx,.txt";

// Drag/drop (or click-to-pick) CV upload. Parsing + error are driven by the wizard;
// while parsing, closing and re-picking are disabled so a late parse can't land after
// the user backs out.
export default function CvUploadModal({ opened, onClose, onFile, parsing, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  if (!opened) return null;

  function pick(file?: File | null) {
    if (file && !parsing) onFile(file);
  }

  return (
    <Modal opened={opened} onClose={parsing ? () => {} : onClose} title="Upload your CV">
      <div
        className={`${styles.cvDropzone}${dragOver ? ` ${styles.cvDropzoneActive}` : ""}`}
        role="button"
        tabIndex={0}
        aria-disabled={parsing}
        onClick={() => !parsing && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !parsing) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!parsing) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files?.[0]);
        }}
      >
        <UploadCloud02 aria-hidden />
        {parsing ? (
          <p>
            <span className={styles.spinner} aria-hidden /> Reading your CV…
          </p>
        ) : (
          <p>
            Drag &amp; drop your CV here, or click to choose a file.
            <br />
            PDF, DOC, DOCX, or TXT.
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          style={{ display: "none" }}
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>

      {error && (
        <p className={styles.cvDropzoneError} role="alert">
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
        <Button label="Cancel" variant="secondary" onClick={onClose} disabled={parsing} />
      </div>
    </Modal>
  );
}
