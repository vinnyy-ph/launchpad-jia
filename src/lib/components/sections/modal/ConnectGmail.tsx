"use client";

import styles from "./modal.module.scss";
import { Button } from "@/lib/components/ui";
import { getGmailScopeDescription, GmailScopes } from "@/lib/data/googleScope";
import { memo } from "react";

interface ConnectGmailProps {
  isVisible: boolean;
  onClick: () => void;
  onClose: () => void;
}

function ConnectGmail({ isVisible, onClick, onClose }: ConnectGmailProps) {
  return (
    <div className={`${styles.modal} ${isVisible ? styles.active : ""}`}>
      <div className={`${styles.modalContent} ${styles.connectGmail}`}>
        <div className={styles.icon}>
          <img alt="" src="/icons/mail.svg" />
        </div>

        <div className={styles.textGroup}>
          <span className={styles.label}>Connect Gmail Account</span>
          <span className={styles.description}>
            You'll be redirected to Google to authorize access to your Gmail
            account.
          </span>
        </div>

        <div className={styles.permissionGroup}>
          <span className={styles.label}>Permissions Requested:</span>

          {getGmailScopeDescription(GmailScopes).map((permission) => (
            <span className={styles.permission} key={permission}>
              <img alt="" src="/icons/checkmark.svg" />
              {permission}
            </span>
          ))}
        </div>

        <span className={styles.note}>
          <span className={styles.bold}>Note: </span>
          This integration allows sending recruitment emails from your personal
          Gmail account while maintaining professional templates and tracking.
        </span>

        <div className={styles.buttonGroup}>
          <Button
            label="Cancel"
            size="large"
            variant="secondary"
            onClick={onClose}
          />
          <Button label="Continue to Google" size="large" onClick={onClick} />
        </div>
      </div>
    </div>
  );
}

export default memo(ConnectGmail);
