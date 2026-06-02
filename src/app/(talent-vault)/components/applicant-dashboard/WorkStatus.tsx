"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/app/(talent-vault)/components/base/Badge";
import styles from "@/app/(talent-vault)/styles/modules/applicant-dashboard.module.scss";
import profileSetupStyles from "@/app/(talent-vault)/styles/modules/profile-setup.module.scss";
import { VisibilityConfirmModal } from "@/app/(talent-vault)/components/applicant-dashboard/VisibilityConfirmModal";

type StartDatePreference = "Immediate" | "Flexible" | null;

const workGoalOptions = [
  "Internship",
  "Full-time Employment",
  "Part-time Employment",
  "Project-based Jobs",
] as const;

const startDateOptions = [
  { value: "Immediate" as const, label: "Immediately (actively looking for work)" },
  { value: "Flexible" as const, label: "Flexible (casually looking)" },
];

const workGoalOrder = new Map(workGoalOptions.map((value, index) => [value, index]));

interface WorkStatusProps {
  isActive?: boolean;
  isExpired?: boolean;
  workGoals?: string[];
  startDatePreference?: StartDatePreference;
  onSaveGoals?(
    payload: { workGoals: string[]; startDatePreference: StartDatePreference }
  ): Promise<void> | void;
}

interface WorkStatusVisibilityControlProps {
  isActive?: boolean;
  isExpired?: boolean;
  onToggleActive?(nextIsActive: boolean): Promise<void> | void;
  onReactivate?(): Promise<void> | void;
  isReactivating?: boolean;
  className?: string;
}

export function normalizeWorkStatusGoals(workGoals?: string[]) {
  if (!Array.isArray(workGoals)) {
    return [] as string[];
  }

  const dedupedValues = new Set<string>();

  for (const value of workGoals) {
    const trimmedValue = String(value || "").trim();
    if (!trimmedValue) continue;

    if (workGoalOrder.has(trimmedValue as (typeof workGoalOptions)[number])) {
      dedupedValues.add(trimmedValue);
    }
  }

  return Array.from(dedupedValues).sort((firstValue, secondValue) => {
    return (
      (workGoalOrder.get(firstValue as (typeof workGoalOptions)[number]) ?? Number.MAX_SAFE_INTEGER) -
      (workGoalOrder.get(secondValue as (typeof workGoalOptions)[number]) ?? Number.MAX_SAFE_INTEGER)
    );
  });
}

export function getWorkStatusContent(workGoals: string[], startDatePreference: StartDatePreference) {
  const prefix =
    startDatePreference === "Immediate"
      ? "Actively looking for"
      : startDatePreference === "Flexible"
        ? "Casually looking for"
        : "Looking for";

  return workGoals.length === 0 ? `${prefix} opportunities` : `${prefix} ${workGoals.join(", ")}`;
}

export function WorkStatusVisibilityControl({
  isActive = false,
  isExpired = false,
  onToggleActive,
  onReactivate,
  isReactivating = false,
  className = "",
}: WorkStatusVisibilityControlProps) {
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const shouldShowReactivateButton = isExpired && typeof onReactivate === "function";

  const applyStatusToggle = async (nextIsActive: boolean) => {
    if (isTogglingStatus || isExpired || !onToggleActive) {
      return;
    }

    try {
      setIsTogglingStatus(true);
      await onToggleActive(nextIsActive);
    } catch (error: any) {
      console.error("Error toggling work status visibility:", error);
      alert(error?.message || "Failed to update visibility. Please try again.");
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleStatusToggle = (nextIsActive: boolean) => {
    if (isTogglingStatus || isExpired || !onToggleActive) {
      return;
    }

    if (!nextIsActive) {
      setShowDeactivateConfirm(true);
      return;
    }

    void applyStatusToggle(true);
  };

  const handleConfirmDeactivate = () => {
    setShowDeactivateConfirm(false);
    void applyStatusToggle(false);
  };

  const handleReactivateClick = () => {
    if (!onReactivate || isReactivating) {
      return;
    }

    void onReactivate();
  };

  return (
    <>
      <div className={`${styles.visibilityControl} ${className}`.trim()}>
        {shouldShowReactivateButton ? (
          <button
            type="button"
            className={`${styles.filledPillActionButton} ${styles.visibilityReactivateButton}`}
            onClick={handleReactivateClick}
            disabled={isReactivating}
          >
            {isReactivating ? "Redirecting..." : "Reactivate"}
          </button>
        ) : (
          <div className={styles.visibilitySwitchContainer}>
            <Badge
              prefixIcon={isActive ? <span className={styles.activeDot}></span> : null}
              content={isActive ? "Active" : "Inactive"}
              variant={isActive ? "success" : "warning"}
            />
            <label className="switch">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => handleStatusToggle(event.target.checked)}
                disabled={isExpired || isTogglingStatus}
              />
              <span className="slider round"></span>
            </label>
          </div>
        )}
      </div>
      <VisibilityConfirmModal
        open={showDeactivateConfirm}
        onCancel={() => setShowDeactivateConfirm(false)}
        onConfirm={handleConfirmDeactivate}
        isSubmitting={isTogglingStatus}
      />
    </>
  );
}

export function WorkStatus({
  isActive = false,
  isExpired = false,
  workGoals,
  startDatePreference = null,
  onSaveGoals,
}: WorkStatusProps) {
  const normalizedWorkGoals = useMemo(() => normalizeWorkStatusGoals(workGoals), [workGoals]);
  const normalizedStartDatePreference =
    startDatePreference === "Immediate" || startDatePreference === "Flexible"
      ? startDatePreference
      : null;
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftWorkGoals, setDraftWorkGoals] = useState<string[]>(normalizedWorkGoals);
  const [draftStartDatePreference, setDraftStartDatePreference] = useState<StartDatePreference>(
    normalizedStartDatePreference
  );

  useEffect(() => {
    if (isEditing) {
      return;
    }

    setDraftWorkGoals(normalizedWorkGoals);
    setDraftStartDatePreference(normalizedStartDatePreference);
  }, [isEditing, normalizedStartDatePreference, normalizedWorkGoals]);

  const hasChanges = useMemo(() => {
    return (
      JSON.stringify(draftWorkGoals) !== JSON.stringify(normalizedWorkGoals) ||
      draftStartDatePreference !== normalizedStartDatePreference
    );
  }, [draftStartDatePreference, draftWorkGoals, normalizedStartDatePreference, normalizedWorkGoals]);

  const handleWorkGoalToggle = (workGoal: string) => {
    setDraftWorkGoals((previousValue) => {
      if (previousValue.includes(workGoal)) {
        return previousValue.filter((value) => value !== workGoal);
      }

      return normalizeWorkStatusGoals([...previousValue, workGoal]);
    });
  };

  const handleStartEdit = () => {
    setDraftWorkGoals(normalizedWorkGoals);
    setDraftStartDatePreference(normalizedStartDatePreference);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (isSaving) {
      return;
    }

    setDraftWorkGoals(normalizedWorkGoals);
    setDraftStartDatePreference(normalizedStartDatePreference);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (isSaving) {
      return;
    }

    if (!hasChanges) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      await onSaveGoals?.({
        workGoals: draftWorkGoals,
        startDatePreference: draftStartDatePreference,
      });
      setIsEditing(false);
    } catch (error: any) {
      console.error("Error saving work status:", error);
      alert(error?.message || "Failed to save work status. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const inactiveBadge = (
    <div className={styles.inactiveBadge}>
      <Badge
        content="Inactive"
        variant="warning"
      />
      <p style={{ color: "#B54708", margin: "0", fontSize: "12px", lineHeight: "18px", fontWeight: "500" }}>
        {isExpired
          ? "Reactivate your Talent Vault profile now to stay on the radar for potential employers."
          : "Activate your Talent Vault profile now to stay on the radar for potential employers."}
      </p>
    </div>
  );

  return (
    <>
    <div className={`${styles.workStatus} ${isEditing ? styles.workStatusEditing : ""}`}>
      <div className={styles.workStatusTopRow}>
        <div className={styles.leftContent}>
          <div>
            <span className={styles.title}>Work Status</span>
            {!isEditing && !isActive && inactiveBadge}
          </div>
          {!isEditing && isActive && (
            <button type="button" className={styles.editIcon} onClick={handleStartEdit}>
              <img src="/icons/edit-2.svg" alt="Edit" />
            </button>
          )}
        </div>

        {isEditing && (
          <div className={styles.workStatusEditActions}>
            <button
              type="button"
              className={styles.workStatusCancelButton}
              onClick={handleCancelEdit}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.workStatusSaveButton}
              onClick={() => void handleSaveEdit()}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        )}
      </div>

      {isEditing && (
        <div className={styles.workStatusEditPanel}>
          <div className={profileSetupStyles.workGoals}>
            <div className={profileSetupStyles.workGoalsForm}>
              <div className={profileSetupStyles.workGoalSection}>
                <div className={profileSetupStyles.workGoalPrompt}>What are you looking for?</div>
                <div className={profileSetupStyles.workGoalOptionsCard}>
                  {workGoalOptions.map((option) => {
                    const id = `tv-dashboard-work-goal-${option
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")}`;

                    return (
                      <label key={option} htmlFor={id} className={profileSetupStyles.workGoalOptionRow}>
                        <input
                          id={id}
                          className={profileSetupStyles.workGoalCheckbox}
                          type="checkbox"
                          checked={draftWorkGoals.includes(option)}
                          onChange={() => handleWorkGoalToggle(option)}
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className={profileSetupStyles.workGoalSection}>
                <div className={profileSetupStyles.workGoalPrompt}>Start Date</div>
                <div className={profileSetupStyles.workGoalOptionsCard}>
                  {startDateOptions.map((option) => {
                    const id = `tv-dashboard-start-date-${option.value.toLowerCase()}`;

                    return (
                      <label key={option.value} htmlFor={id} className={profileSetupStyles.workGoalOptionRow}>
                        <input
                          id={id}
                          className={profileSetupStyles.workGoalRadio}
                          type="radio"
                          name="tv-dashboard-start-date"
                          checked={draftStartDatePreference === option.value}
                          onChange={() => setDraftStartDatePreference(option.value)}
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
