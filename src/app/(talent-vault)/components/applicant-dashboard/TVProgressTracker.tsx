"use client";

import { assetConstants } from "@/lib/utils/constantsV2";
import styles from "@/app/(talent-vault)/styles/modules/progress-tracker.module.scss";
import { Badge } from "../base/Badge";
import { useState, type ReactNode } from "react";
import type { TalentVaultSetupCurrentStep } from "@/app/(talent-vault)/lib/talentVaultStatus";
import { useRouter } from "next/navigation";
import { TVJourneyTracker } from "./TVJourneyTracker";
import { useAppContext } from "@/lib/context/ContextV2";

type TVProgressTrackerProps = {
  currentStep?: TalentVaultSetupCurrentStep | null;
  firstName?: string | null;
  profileId?: string | null;
  hasPreScreening?: boolean;
};

type StepContent = {
  stepName: string;
  cheerHighlight: string;
  cheerContent: ReactNode;
  message: ReactNode;
  tip?: ReactNode;
};

function resolveStep(
  step: TalentVaultSetupCurrentStep | null | undefined,
  hasPreScreening: boolean = true
): TalentVaultSetupCurrentStep {
  if (
    step === "submitCV" ||
    step === "verifyProfile" ||
    step === "goalSetting" ||
    step === "preScreening" ||
    step === "aiInterview"
  ) {
    // Skip pre-screening if not applicable
    if (step === "preScreening" && !hasPreScreening) {
      return "aiInterview";
    }
    return step;
  }

  return "submitCV";
}

function toFirstName(name: string | null | undefined) {
  if (typeof name !== "string") return "there";
  const trimmedName = name.trim();
  if (!trimmedName) return "there";
  return trimmedName.split(/\s+/)[0];
}

function getStepContent(
  step: TalentVaultSetupCurrentStep,
  firstName: string,
  hasPreScreening: boolean = true,
  options?: { onViewInterviewGuide?: () => void }
): StepContent {
  if (step === "submitCV") {
    return {
      stepName: "Submit CV",
      cheerHighlight: `Great start, ${firstName}!`,
      cheerContent: "You're one step closer to your next opportunity.",
      message: "Upload your CV to start building your Talent Vault profile.",
    };
  }

  if (step === "verifyProfile") {
    return {
      stepName: "Verify Profile",
      cheerHighlight: "CV Submitted!",
      cheerContent: `Nice work, ${firstName}.`,
      message: "Review your profile details and continue when everything looks correct.",
    };
  }

  if (step === "goalSetting") {
    return {
      stepName: "Goal Setting",
      cheerHighlight: "CV Verified!",
      cheerContent: `Great work ${firstName}, keep the momentum going!`,
      message: "Set your work goals and start preference so Jia can match you faster.",
    };
  }

  if (step === "preScreening") {
    return {
      stepName: "Pre-screening",
      cheerHighlight: "Goal, set!",
      cheerContent: "Now for some quick pre-screening questions!",
      message: "Answer a few pre-screening questions to move closer to completion.",
    };
  }

  return {
    stepName: "AI Interview",
    cheerHighlight: "Almost there!",
    cheerContent: hasPreScreening
      ? "Thanks for completing the pre-screening. Just one interview left."
      : "Thanks for setting your goals. Just one interview left.",
    message: "Complete your AI Interview to finish setting up your Talent Vault profile.",
    tip: (
      <>
        {" "}Want to prepare better? Read our{" "}
        <strong
          className={styles.guideLink}
          role="button"
          tabIndex={0}
          onClick={options?.onViewInterviewGuide}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              options?.onViewInterviewGuide?.();
            }
          }}
        >
          Interview Guide
        </strong>{" "}
        before you start.
      </>
    ),
  };
}

export function TVProgressTracker({ currentStep, firstName, profileId, hasPreScreening = true }: TVProgressTrackerProps) {
  const router = useRouter();
  const { user, setModalType } = useAppContext();
  const [isJourneyTrackerOpen, setIsJourneyTrackerOpen] = useState(false);
  const step = resolveStep(currentStep, hasPreScreening);
  const normalizedFirstName = toFirstName(firstName);

  const handleViewInterviewGuide = () => {
    const modalPayload = {
      source: "talent-vault",
      profileId: profileId || null,
      name: user?.name || "",
      email: user?.email || "",
    };

    sessionStorage.setItem("selectedCareer", JSON.stringify(modalPayload));
    setModalType("preScreeningGuide");
  };

  const content = getStepContent(step, normalizedFirstName, hasPreScreening, {
    onViewInterviewGuide: handleViewInterviewGuide,
  });

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <img className={styles.icon} src="/iconsV3/tv-icon.svg" alt="Jia Talent Vault Icon" />

          <div className={styles.headerContents}>
            <div className={styles.title}>
              <h2>Talent Vault Setup</h2>
              <p style={{ fontWeight: 400 }}>Jia Talent Vault</p>
            </div>

            <div className={styles.currentStep}>
              <div className={styles.title}>
                <span>Next Step: </span> <span className={styles.stepName}>{content.stepName}</span>
              </div>
              <Badge
                prefixIcon={(
                  <span className={styles.warningCircle}></span>
                )}
                variant="warning"
                content="Needs your action"
              />
            </div>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.cheerBanner}>
            <img src={assetConstants.partyPopper} alt="Party popper icon" />
            <span>
              <strong>{content.cheerHighlight}</strong> <span>{content.cheerContent}</span>
            </span>
          </div>

          <div className={styles.main}>
            <div className={styles.contentWrapper}>
              <img alt="Gradient icon" src={assetConstants.gradientIcon} />

              <div className={styles.instruction}>
                <h3 className={styles.title}>Next Step: {content.stepName}</h3>

                <div className={styles.message}>
                  <p style={{ fontWeight: 400 }}>{content.message}</p>
                </div>

                {content.tip ? (
                  <small className={styles.interviewTip}>
                    <strong>Tip:</strong>
                    <span>{content.tip}</span>
                  </small>
                ) : null}
              </div>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setIsJourneyTrackerOpen(true)}
              >
                <img alt="trending up" src={assetConstants.trendingUp} />
                View My Progress
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => router.push("/dashboard/talent-vault/setup")}
              >
                View Next Step
              </button>
            </div>
          </div>
        </div>
      </div>

      <TVJourneyTracker
        isOpen={isJourneyTrackerOpen}
        onClose={() => setIsJourneyTrackerOpen(false)}
        currentStep={step}
        hasPreScreening={hasPreScreening}
      />
    </>
  );
}
