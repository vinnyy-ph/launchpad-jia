"use client";

import styles from "@/lib/styles/commonV2/toaster.module.scss";
import { assetConstants, pathConstants } from "@/lib/utils/constantsV2";
import { api } from "@/lib/utils/apiClient";
import { useEffect, useState } from "react";

export default function ({ toasterType, toasterPayload, setToasterType }) {
  const toasterList = [
    "share",
    "cancel",
    "reminder",
    "manageCV",
    "talentVaultExpired",
    "settingsSaved",
    "settingsReverted",
    "settingsError",
  ];
  const [isResettingSetup, setIsResettingSetup] = useState(false);
  const title = toasterPayload?.title;
  const description = toasterPayload?.description;

  function handleClose() {
    setToasterType(null);
  }

  async function handleUpdate() {
    if (isResettingSetup) {
      return;
    }

    try {
      setIsResettingSetup(true);
      await api.patch("/api/talent-vault/profiles", {
        action: "reactivate_profile",
        payload: {},
      });
      handleClose();
      window.location.href = pathConstants.talentVaultSetup;
    } catch (error: any) {
      console.error("Error resetting Talent Vault setup:", error);
      alert(error?.message || "Failed to restart setup. Please try again.");
    } finally {
      setIsResettingSetup(false);
    }
  }

  useEffect(() => {
    if (toasterType === "manageCV") {
      setTimeout(() => {
        handleClose();
      }, 5000);
    }
  }, []);

  useEffect(() => {
    if (
      ["settingsSaved", "settingsReverted", "settingsError"].includes(
        toasterType
      )
    ) {
      const timer = setTimeout(handleClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [toasterType]);

  return (
    <div className={`${styles.toasterContainer} ${styles[toasterType]}`}>
      {toasterType == toasterList[0] && (
        <>
          <img alt="" className={styles.logo} src={assetConstants.checkV2} />
          <div className={styles.textContainer}>
            <span className={styles.header}>Link copied to clipboard</span>
          </div>
          <img
            alt="x"
            className={styles.xIcon}
            src={assetConstants.x}
            onClick={handleClose}
          />
        </>
      )}

      {toasterType === "settingsSaved" && (
        <>
          <img alt="" className={styles.logo} src={assetConstants.checkV2} />
          <div className={styles.textContainer}>
            <span className={styles.header}>{title ?? "Settings Saved"}</span>
            {description && (
              <span className={styles.description}>{description}</span>
            )}
          </div>
          <img
            alt="x"
            className={styles.xIcon}
            src={assetConstants.x}
            onClick={handleClose}
          />
        </>
      )}

      {toasterType === "settingsReverted" && (
        <>
          <img alt="" className={styles.logo} src={assetConstants.checkV2} />
          <div className={styles.textContainer}>
            <span className={styles.header}>{title ?? "Changes Reverted"}</span>
            {description && (
              <span className={styles.description}>{description}</span>
            )}
          </div>
          <img
            alt="x"
            className={styles.xIcon}
            src={assetConstants.x}
            onClick={handleClose}
          />
        </>
      )}

      {toasterType === "settingsError" && (
        <>
          <img alt="" className={styles.logo} src={assetConstants.alert} />
          <div className={styles.textContainer}>
            <span className={styles.header}>{title ?? "Failed to save settings"}</span>
            {description && (
              <span className={styles.description}>{description}</span>
            )}
          </div>
          <img
            alt="x"
            className={styles.xIcon}
            src={assetConstants.x}
            onClick={handleClose}
          />
        </>
      )}

      {/* {toasterType == toasterList[1] && (
        <>
          <img
            alt="x"
            className={styles.xIcon}
            src={assetConstants.x}
            onClick={handleClose}
          />
          <img alt="logo" className={styles.logo} src={assetConstants.trash} />
          <div className={styles.textContainer}>
            <span className={styles.header}>Application Cancelled</span>
            <span className={styles.description}>
              Your application for{" "}
              <span className={styles.bold}>Software Engineer - Java</span> has
              been cancelled. If your plans change, we’d be glad to see you
              apply again in the future.
            </span>
          </div>
        </>
      )} */}

      {/* {toasterType == toasterList[2] && (
        <>
          <img
            alt="x"
            className={styles.xIcon}
            src={assetConstants.x}
            onClick={handleClose}
          />
          <img alt="logo" className={styles.logo} src={assetConstants.bellV2} />
          <div className={styles.textContainer}>
            <span className={styles.header}>Reminder set</span>
            <span className={styles.description}>
              We’ll notify you when you’re eligible to reapply for this role.
            </span>
          </div>
        </>
      )} */}

      {toasterType === "manageCV" && (
        <>
          <img alt="" className={styles.logo} src={assetConstants.checkV2} />
          <div className={styles.textContainer}>
            <span className={styles.header}>CV updated successfully</span>
          </div>
        </>
      )}

      {toasterType === "talentVaultExpired" && (
        <>
          <img alt="" className={styles.logo} src="/iconsV3/alert.svg" />
          <div className={styles.textContainer}>
            <span className={styles.header}>
              Your Talent Vault profile has been deactivated.
            </span>
            <span className={styles.description}>
              This means your profile will not be shown to employers. Update
              your profile now to share your Talent Vault profile to companies.
            </span>
            <div className={styles.actions}>
              <button type="button" className={styles.dismiss} onClick={handleClose}>
                Dismiss
              </button>
              <button
                type="button"
                className={styles.update}
                onClick={() => void handleUpdate()}
                disabled={isResettingSetup}
              >
                {isResettingSetup ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
          <img
            alt="x"
            className={styles.xIcon}
            src={assetConstants.x}
            onClick={handleClose}
          />
        </>
      )}
    </div>
  );
}
