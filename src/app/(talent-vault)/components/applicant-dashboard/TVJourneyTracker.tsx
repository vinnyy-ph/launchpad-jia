"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "@/app/(talent-vault)/styles/modules/tv-journeytracker.module.scss";
import { assetConstants } from "@/lib/utils/constantsV2";
import type { TalentVaultSetupCurrentStep } from "@/app/(talent-vault)/lib/talentVaultStatus";
import { useRouter } from "next/navigation";
import { InProgressIcon } from "../icons/InProgress";
import { Badge } from "../base/Badge";
import { HelpBanner } from "../HelpBanner";

type TVJourneyTrackerProps = {
  isOpen: boolean;
  onClose(): void;
  currentStep: TalentVaultSetupCurrentStep;
  hasPreScreening?: boolean;
};

const FULL_STEP_ORDER: TalentVaultSetupCurrentStep[] = [
  "submitCV",
  "verifyProfile",
  "goalSetting",
  "preScreening",
  "aiInterview",
];

type StepConfig = {
  key: Exclude<TalentVaultSetupCurrentStep, null>;
  label: string;
  helpMessage: string;
};

const FULL_STEP_CONFIGS: Record<string, StepConfig> = {
  submitCV: {
    key: "submitCV",
    label: "Submit CV",
    helpMessage:
      "Once you've submitted your CV, Jia will automatically generate your profile. All you have to do is to double check if we got your information right.",
  },
  verifyProfile: {
    key: "verifyProfile",
    label: "Verify Profile",
    helpMessage:
      "Once you've verified your CV, we'll be asking you for your career goals. This will help us make better matches for job opportunities that fit your goals.",
  },
  goalSetting: {
    key: "goalSetting",
    label: "Goal Setting",
    helpMessage:
      "After this step, we'll ask a few quick preference questions to help match you with the right opportunities.",
  },
  preScreening: {
    key: "preScreening",
    label: "Pre-screening",
    helpMessage:
      "After goal setting, we'll just go through a quick pre-screening questionnaire to help us match you to the right job opportunity.",
  },
  aiInterview: {
    key: "aiInterview",
    label: "AI Interview",
    helpMessage:
      "All that's left is the AI Interview with Jia. This interview help us get a good look of your skills and personality. You'll be getting an interview summary from us to help you gauge yourself. After you're done, we can now start matching you to potential job opportunities tailored just for you!",
  },
};

function normalizeCurrentStep(currentStep: TalentVaultSetupCurrentStep) {
  if (
    currentStep === "submitCV" ||
    currentStep === "verifyProfile" ||
    currentStep === "goalSetting" ||
    currentStep === "preScreening" ||
    currentStep === "aiInterview"
  ) {
    return currentStep;
  }

  return "submitCV";
}

export function TVJourneyTracker({
  isOpen,
  onClose,
  currentStep,
  hasPreScreening = true,
}: TVJourneyTrackerProps) {
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen || typeof window === "undefined") {
    return null;
  }

  const normalizedCurrentStep = normalizeCurrentStep(currentStep);
  const stepOrder = hasPreScreening ? FULL_STEP_ORDER : FULL_STEP_ORDER.filter(s => s !== "preScreening");
  const stepConfigs = stepOrder.map(step => FULL_STEP_CONFIGS[step]);
  const currentStepIndex = stepOrder.indexOf(normalizedCurrentStep);
  const completedSteps = currentStepIndex > 0 ? currentStepIndex : 0;
  const totalSteps = stepOrder.length;
  const progressPercentage = (completedSteps / totalSteps) * 100;

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <aside
        className={styles.panel}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tv-journey-tracker-title"
      >
        <header className={styles.header}>
          <h2 id="tv-journey-tracker-title" className={styles.title}>
            My Journey Tracker
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close journey tracker"
          >
            <img src={assetConstants.x} alt="Close" />
          </button>
        </header>

        <div className={styles.content}>
          <div className={styles.headerWrapper}>
            <div className={styles.tvHeader}>
              <img src="/iconsV3/tv-icon.svg" alt="Talent Vault icon" />
              <div>
                <div className={styles.title}>Talent Vault Profile Setup</div>
                <div className={styles.subtitle}>Jia Talent Vault</div>
              </div>
            </div>

            <button
              type="button"
              className={styles.nextStepBtn}
              onClick={() => router.push("/dashboard/talent-vault/setup")}
            >
              View Next Step
            </button>
          </div>

          <div className={styles.progressBarSection}>
            <div className={styles.progressBarContainer}>
              <div className={styles.progressBarBackground}>
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
            <span className={styles.progressText}>
              {completedSteps} of {totalSteps} steps completed
            </span>
          </div>

          <div className={styles.stepsSection}>
            {stepConfigs.map((stepConfig, index) => {
              const stepState =
                index < currentStepIndex
                  ? "done"
                  : index === currentStepIndex
                  ? "in_progress"
                  : "pending";

              const isCompleted = stepState === "done";
              const isInProgress = stepState === "in_progress";

              return (
                <div className={styles.stepWrapper} key={stepConfig.key}>
                  <div className={styles.step}>
                    <InProgressIcon status={stepState} />
                    <div className={styles.stepInfo}>
                      <div className={styles.stepCount}>STEP {index + 1}</div>
                      <div className={styles.stepStatus}>
                        <span className={styles.stepName}>{stepConfig.label}</span>
                        <Badge
                          content={isCompleted ? "Completed" : "Pending"}
                          variant={isCompleted ? "success" : "neutral"}
                        />
                      </div>
                    </div>
                  </div>

                  {isInProgress ? (
                    <HelpBanner
                      title="What's next?"
                      message={stepConfig.helpMessage}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

        </div>
      </aside>
    </div>,
    document.body
  );
}
