"use client";

import { Button } from "@/lib/components/ui";
import { UploadCloud02, XClose } from "@untitledui/icons";
import styles from "./manual-profile.module.scss";

interface CvUploadBannerProps {
  /** Switch from manual entry to the faster CV-upload flow. */
  onUploadCv: () => void;
  /** Dismiss the banner for the rest of the session. */
  onDismiss: () => void;
}

// "Already have a CV?" promo banner shown above the manual-profile wizard,
// letting a candidate bail out to the CV-upload path. Figma node 14567:37539.
export default function CvUploadBanner({ onUploadCv, onDismiss }: CvUploadBannerProps) {
  return (
    <div className={styles.cvBanner}>
      <p className={styles.cvBannerText}>
        <span className={styles.cvBannerTitle}>Already have a CV?</span>
        <span className={styles.cvBannerBody}>
          Let Jia parse and auto-fill your profile so you can apply faster.
        </span>
      </p>
      <div className={styles.cvBannerActions}>
        <Button
          label="Upload CV"
          variant="secondary"
          iconJsx={<UploadCloud02 className={styles.cvBannerUploadIcon} aria-hidden />}
          iconPosition="left"
          onClick={onUploadCv}
        />
        <button
          type="button"
          className={styles.cvBannerClose}
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <XClose aria-hidden />
        </button>
      </div>
    </div>
  );
}
