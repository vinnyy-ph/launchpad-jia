"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/utils/apiClient";
import { useAppContext } from "@/lib/context/ContextV2";
import styles from "@/lib/styles/screens/applicantSettings.module.scss";

type Visibility = "show" | "hide";

export default function () {
  const { setToasterType } = useAppContext();
  const [initialVisibility, setInitialVisibility] = useState<Visibility>("show");
  const [visibility, setVisibility] = useState<Visibility>("show");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasChanges = visibility !== initialVisibility;

  useEffect(() => {
    api
      .get("/api/job-portal/settings")
      .then((res) => {
        const profileVisible = res.data?.profileVisible !== false;
        const value: Visibility = profileVisible ? "show" : "hide";
        setInitialVisibility(value);
        setVisibility(value);
      })
      .catch(() => {
        // Default to show on error
        setInitialVisibility("show");
        setVisibility("show");
      })
      .finally(() => setLoading(false));
  }, []);

  function handleRevert() {
    setVisibility(initialVisibility);
    const revertedToShow = initialVisibility === "show";
    setToasterType({
      type: "settingsReverted",
      title: "Changes Reverted",
      description: revertedToShow
        ? "Your profile is now visible to employers in recruiter searches."
        : "Your profile is now hidden from recruiter searches.",
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch("/api/job-portal/settings", {
        profileVisible: visibility === "show",
      });
      setInitialVisibility(visibility);
      setToasterType({
        type: "settingsSaved",
        title: "Settings Saved",
        description:
          visibility === "show"
            ? "You have successfully made your profile visible to employers."
            : "You have successfully hidden your profile.",
      });
    } catch {
      setToasterType({
        type: "settingsError",
        title: "Failed to save settings",
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.settings}>
      <div className={styles.infoFilter}>
        <div className={styles.textContainer}>
          <span className={styles.name}>Settings</span>
          <span className={styles.description}>
            Manage your profile and discovery preferences.
          </span>
        </div>

        <div className={styles.buttonContainer}>
          <button
            className="secondaryBtn"
            onClick={handleRevert}
            disabled={!hasChanges || saving}
          >
            Revert
          </button>
          <button
            className="primaryBtn"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className={styles.rowContainer}>
        <div className={styles.labelContainer}>
          <span className={styles.title}>Visibility Settings</span>
          <span className={styles.description}>
            Control whether verified employers can discover your profile for job
            opportunities.
          </span>
        </div>
        <div className={styles.inputContainer}>
          <div className={styles.radioGroup}>
            <input
              type="radio"
              name="visibility"
              id="show"
              checked={visibility === "show"}
              onChange={() => setVisibility("show")}
            />
            <div className={styles.radioOption}>
              <span className={styles.radioLabel}>Show my profile</span>
              <span className={styles.radioDescription}>
                Your profile is visible to verified employers in recruiter
                searches.
              </span>
            </div>
          </div>
          <div className={styles.radioGroup}>
            <input
              type="radio"
              name="visibility"
              id="hide"
              checked={visibility === "hide"}
              onChange={() => setVisibility("hide")}
            />
            <div className={styles.radioOption}>
              <span className={styles.radioLabel}>Hide my profile</span>
              <span className={styles.radioDescription}>
                Your profile will only be visible to employers you apply to.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
