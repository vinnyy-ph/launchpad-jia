"use client";

import { TVProgressTracker } from "@/app/(talent-vault)/components/applicant-dashboard/TVProgressTracker";
import styles from "@/app/(talent-vault)/styles/modules/applicant-dashboard.module.scss";
import { useAppContext } from "@/lib/context/ContextV2";
import { api } from "@/lib/utils/apiClient";
import { extractTvError } from "@/app/(talent-vault)/lib/tvErrorMap";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getTalentVaultInProgressStep,
  isTalentVaultSetupComplete,
  resolveTalentVaultExpiresAt,
  type TalentVaultSetupCurrentStep,
} from "@/app/(talent-vault)/lib/talentVaultStatus";
import {
  WorkStatusVisibilityControl,
} from "@/app/(talent-vault)/components/applicant-dashboard/WorkStatus";
import {
  METRIC_INFO_TOOLTIP_ID,
  MetricContainer,
} from "@/app/(talent-vault)/components/applicant-dashboard/MetricContainter";
import { InvitesSection } from "@/app/(talent-vault)/components/applicant-dashboard/InvitesSection";
import { AcceptedInterviewsSection } from "@/app/(talent-vault)/components/applicant-dashboard/AcceptedInterviewsSection";
import { pathConstants } from "@/lib/utils/constantsV2";
import { isTalentVaultEnabled } from "@/app/(talent-vault)/lib/helpers";
import { Badge } from "@/app/(talent-vault)/components/base/Badge";
import Button from "@/lib/components/ui/button/Button";
import { Tooltip as ReactTooltip } from "react-tooltip";

function resolveCurrentStep(setup: any): TalentVaultSetupCurrentStep | null {
  const currentStep = setup?.currentStep;

  if (
    currentStep === "submitCV" ||
    currentStep === "verifyProfile" ||
    currentStep === "goalSetting" ||
    currentStep === "preScreening" ||
    currentStep === "aiInterview"
  ) {
    return currentStep;
  }

  const inProgressStep = getTalentVaultInProgressStep(setup);
  if (inProgressStep === "cvProfile") return "submitCV";
  if (inProgressStep === "goalSetting") return "goalSetting";
  if (inProgressStep === "preScreening") return "preScreening";
  if (inProgressStep === "aiInterview") return "aiInterview";

  return null;
}

function resolveProfileId(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof (value as any).toString === "function") {
    const profileId = (value as any).toString();
    return profileId && profileId !== "[object Object]" ? profileId : null;
  }

  return null;
}

function toMetricCount(value: unknown) {
  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue) || parsedValue < 0) {
    return 0;
  }

  return Math.floor(parsedValue);
}

function normalizeStartDatePreference(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "immediate" || normalizedValue === "immediately") {
    return "Immediate" as const;
  }

  if (normalizedValue === "flexible") {
    return "Flexible" as const;
  }

  return null;
}

function toDate(value: unknown) {
  if (!value) {
    return null;
  }

  const parsedDate = value instanceof Date ? value : new Date(value as any);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function getDaysRemaining(expiresAtValue: unknown) {
  const expiresAt = toDate(expiresAtValue);
  if (!expiresAt) {
    return null;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = expiresAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / msPerDay));
}

export default function TalentVaultDashboard() {
  const { user, modalType, setModalType } = useAppContext();
  const router = useRouter();

  useEffect(() => {
    if (user?.email && !isTalentVaultEnabled(user.email)) {
      router.replace(pathConstants.dashboard);
    }
  }, [user?.email, router]);

  const [selectedTab, setSelectedTab] = useState<"invites" | "accepted">("invites");
  const talentVault = user?.talentVault;
  const [resolvedProfile, setResolvedProfile] = useState<any>(null);
  const [isResolvingProfile, setIsResolvingProfile] = useState(false);
  const [hasShownExpiredModal, setHasShownExpiredModal] = useState(false);
  const [isReactivatingProfile, setIsReactivatingProfile] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveProfile() {
      if (!user?.email) {
        if (!cancelled) {
          setResolvedProfile(null);
          setIsResolvingProfile(false);
        }
        return;
      }

      setIsResolvingProfile(true);

      try {
        const response = await api.get("/api/talent-vault/profiles");

        if (!cancelled) {
          setResolvedProfile(response?.data?.data || null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error resolving Talent Vault profile:", error);
          setResolvedProfile(null);
        }
      } finally {
        if (!cancelled) {
          setIsResolvingProfile(false);
        }
      }
    }

    void resolveProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.email, user?.talentVault?.profileId]);

  const fallbackProfileId = resolveProfileId(resolvedProfile?._id);
  const setup = talentVault?.setup || resolvedProfile?.setup;
  const isSetupComplete = isTalentVaultSetupComplete(setup);
  const hasProfile = Boolean(talentVault?.profileId || fallbackProfileId);
  const isSetupInProgress = hasProfile && !isSetupComplete;
  const currentStep = resolveCurrentStep(setup);
  const hasPreScreening = setup?.preScreening !== "skipped";
  const normalizedStatus = String(resolvedProfile?.status || talentVault?.status || "").toLowerCase();
  const normalizedState = String(resolvedProfile?.state || talentVault?.state || "").toLowerCase();
  const effectiveExpiresAt = resolveTalentVaultExpiresAt(
    resolvedProfile?.expiresAt ||
      resolvedProfile?.expirationDate ||
      talentVault?.expiresAt ||
      talentVault?.expirationDate,
    resolvedProfile?.completedAt || talentVault?.completedAt
  );
  const isExpiredByDate = Boolean(
    effectiveExpiresAt && effectiveExpiresAt.getTime() < Date.now()
  );
  const isProfileExpired = normalizedState === "expired" || isExpiredByDate;
  const isProfileActive = normalizedStatus === "active" && !isProfileExpired;
  const goals = resolvedProfile?.profile?.goals || talentVault?.profile?.goals;
  const startDatePreference = normalizeStartDatePreference(
    goals?.startDatePreference
  );
  const subprogramTitle = goals?.selectedSubprogramSnapshot?.title || null;
  const workStatusContent = subprogramTitle
    ? `${startDatePreference === "Immediate"
        ? "Actively looking for"
        : startDatePreference === "Flexible"
          ? "Casually looking for"
          : "Looking for"}: ${subprogramTitle}`
    : "Loading...";
  const daysRemaining = getDaysRemaining(effectiveExpiresAt);
  const daysRemainingLabel =
    typeof daysRemaining === "number"
      ? `${daysRemaining} ${daysRemaining === 1 ? "more day" : "more days"}`
      : null;
  const employerRequestsCount = toMetricCount(resolvedProfile?.counters?.employerRequests);
  const profileViewsCount = toMetricCount(resolvedProfile?.counters?.profileViews);
  const isProfileResolutionPending = Boolean(
    user?.email && !talentVault?.profileId && isResolvingProfile && !fallbackProfileId
  );

  useEffect(() => {
    setHasShownExpiredModal(false);
  }, [fallbackProfileId, user?.email]);

  useEffect(() => {
    if (
      !isSetupComplete ||
      !hasProfile ||
      isProfileResolutionPending ||
      !isProfileExpired ||
      hasShownExpiredModal
    ) {
      return;
    }

    if (modalType && modalType !== "talentVaultExpired") {
      return;
    }

    setModalType("talentVaultExpired");
    setHasShownExpiredModal(true);
  }, [
    hasProfile,
    hasShownExpiredModal,
    isProfileExpired,
    isProfileResolutionPending,
    isSetupComplete,
    modalType,
    setModalType,
  ]);

  const handleToggleWorkStatusActive = async (nextIsActive: boolean) => {
    const response = await api.patch("/api/talent-vault/profiles", {
      action: "set_visibility_status",
      payload: {
        isActive: nextIsActive,
      },
    });

    setResolvedProfile(response?.data?.data || null);
  };

  const handleReactivateProfile = async () => {
    if (isReactivatingProfile) {
      return;
    }

    try {
      setIsReactivatingProfile(true);
      await api.patch("/api/talent-vault/profiles", {
        action: "reactivate_profile",
        payload: {},
      });
      window.location.href = pathConstants.talentVaultSetup;
    } catch (error: any) {
      console.error("Error resetting Talent Vault setup:", error);
      const { message } = extractTvError(error);
      alert(message || "Failed to restart setup. Please try again.");
    } finally {
      setIsReactivatingProfile(false);
    }
  };

  const handleOpenTalentVaultProfile = () => {
    window.location.href = pathConstants.talentVault + "/profile";
  };

  return (
    <div className={styles.talentVault}>
      <div className={styles.header}>
        <h1 className={styles.name}>Talent Vault</h1>
        {!isSetupComplete && (
          <p style={{ fontWeight: 400 }}>Get matched to companies that are the perfect fit just for you.</p>
        )}

        {isSetupComplete && (
          <div className={styles.user}>
            <div className={styles.userMain}>
              <div
                className={`${styles.profilePhoto} ${
                  isProfileActive ? "" : styles.profilePhotoInactive
                }`}
              >
                <img src={resolvedProfile?.userInfo?.image || user?.image || "/user-profile.png"} alt="User profile photo" />
                <span className={styles.onlineIndicator}></span>
              </div>
              <div className={styles.info}>
                <div className={styles.userNameWithBadge}>
                  <h2 className={styles.name}>{user?.name}</h2>
                  {isProfileActive && (
                    <div className={styles.userWorkStatusBadge}>
                      <Badge content={workStatusContent} />
                    </div>
                  )}
                </div>
                <p className={styles.description}>
                  {isProfileActive
                    ? daysRemainingLabel
                      ? `Your Talent Vault Profile is currently visible to employers for ${daysRemainingLabel}.`
                      : "Your Talent Vault Profile is currently visible to employers."
                    : "Your Talent Vault Profile is not visible to employers."}
                </p>
              </div>
            </div>
            <div className={styles.userActions}>
              <WorkStatusVisibilityControl
                isActive={isProfileActive}
                isExpired={isProfileExpired}
                onToggleActive={handleToggleWorkStatusActive}
                onReactivate={handleReactivateProfile}
                isReactivating={isReactivatingProfile}
              />
              <Button
                className={styles.headerSecondaryActionButton}
                variant="secondary"
                icon="/iconsV2/edit.svg"
                label="My Talent Vault Profile"
                pill
                onClick={handleOpenTalentVaultProfile}
              />
            </div>
          </div>
        )}
      </div>

      <div className={styles.content}>
        {isProfileResolutionPending && (
          <p className={styles.description}>Loading your Talent Vault progress...</p>
        )}

        {!isProfileResolutionPending && isSetupInProgress && (
          <TVProgressTracker currentStep={currentStep} firstName={user?.name} profileId={talentVault?.profileId || fallbackProfileId} hasPreScreening={hasPreScreening} />
        )}

        {!isSetupInProgress && hasProfile && (
          <>
            <div className={styles.profileMetrics}>
              <div className={styles.metrics}>
                <MetricContainer
                  title="Employer Requests"
                  count={employerRequestsCount}
                  description="Total number of invites you received"
                />
                <MetricContainer
                  title="Profile Views"
                  count={profileViewsCount}
                  description="Total number of recruiters who viewed your profile"
                />
              </div>
              <ReactTooltip
                className="career-fit-tooltip"
                id={METRIC_INFO_TOOLTIP_ID}
                offset={8}
                noArrow
                place="bottom"
              />
            </div>

            <div className={styles.tabs} style={{ marginTop: "12px" }}>
              <div
                className={`${styles.tab} ${selectedTab === "invites" ? styles.selected : styles.unselected}`}
                onClick={() => setSelectedTab("invites")}
                style={{ cursor: "pointer" }}
              >
                <span className={`${styles.tabName} ${selectedTab === "invites" ? styles.selected : styles.unselected}`}>Invites</span>
              </div>

              <div
                className={`${styles.tab} ${selectedTab === "accepted" ? styles.selected : styles.unselected}`}
                onClick={() => setSelectedTab("accepted")}
                style={{ cursor: "pointer" }}
              >
                <span className={`${styles.tabName} ${selectedTab === "accepted" ? styles.selected : styles.unselected}`}>Accepted Interviews</span>
              </div>
            </div>

            {selectedTab === "invites" && <InvitesSection />}
            {selectedTab === "accepted" && <AcceptedInterviewsSection />}
          </>
        )}
      </div>
    </div>
  );
}
