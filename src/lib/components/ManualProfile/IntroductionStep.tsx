"use client";

import RichTextField from "./RichTextField";
import styles from "./manual-profile.module.scss";

export default function IntroductionStep({
  value,
  onChange,
  errors,
  onFieldBlur,
  genId = 0,
  generating = false,
  generateError,
  generateHint,
}: {
  value: string;
  onChange: (v: string) => void;
  errors?: Record<string, string>;
  onFieldBlur?: (key: string) => void;
  /** Bumped by the wizard after a successful generate to remount the editor. */
  genId?: number;
  generating?: boolean;
  generateError?: string | null;
  generateHint?: string | null;
}) {
  return (
    <div className={styles.introStep}>
      <div
        className={`${styles.introEditorWrap}${generating ? ` ${styles.introGenerating}` : ""}`}
        onBlur={() => onFieldBlur?.("introduction")}
      >
        <div className={styles.introEditorInner}>
          <RichTextField
            key={genId}
            id="introduction"
            label="Introduction"
            placeholder="Tell us about yourself — what you do, what you're good at, and what you're looking for."
            value={value}
            onChange={onChange}
          />
        </div>
        {generating && (
          <div className={styles.introGenOverlay} aria-live="polite">
            <span className={styles.sparkles}>
              <span>✦</span>
              <span>✦</span>
              <span>✦</span>
            </span>
            Writing your introduction…
          </div>
        )}
      </div>

      {!generating && errors?.introduction && (
        <p className={styles.fieldError}>{errors.introduction}</p>
      )}
      {!generating && generateError && (
        <p className={styles.fieldError} role="alert">
          {generateError}
        </p>
      )}
      {!generating && generateHint && <p className={styles.introHint}>{generateHint}</p>}
    </div>
  );
}
