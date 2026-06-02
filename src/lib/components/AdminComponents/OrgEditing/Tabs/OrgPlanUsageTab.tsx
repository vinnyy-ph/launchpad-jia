"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Organization, PricingPlan } from "@/lib/types/organization";
import CreditTransactionTable, { CreditTransactionTableRef } from "../../CreditTransactionTable";
import OrganizationStatus from "../OrganizationStatus";
import ChangeOrgPlanModal from "../Modals/ChangeOrgPlanModal";
import AddOrgPlanModal from "../Modals/AddOrgPlanModal";
import EditOrgPlanScheduleModal from "../Modals/EditOrgPlanScheduleModal";
import ManageOrgCreditsModal from "../Modals/ManageOrgCreditsModal";
import ManageCareerSlotsModal from "../Modals/ManageCareerSlotsModal";
import PlanStatusBanner from "../PlanStatusBanner";
import PricingPlanBadge from "../../PricingPlans/PricingPlanBadge";
import PlanHistoryModal from "../Modals/PlanHistoryModal";
import { api } from "@/lib/utils/apiClient";
import { candidateActionToast, errorToast, successToast } from "@/lib/Utils";
import { RESERVED_SUBDOMAINS } from "@/lib/utils/subdomainUtils";

// Inlined from planUtils.ts
const getPendingPlanInfo = (organization: any, assignedPlans: any) => {
  const pendingCredit = organization.pendingCreditBasedPlanId;
  const pendingPremium = organization.pendingPremiumPlanId;
  const planDetailsPendingInfo = organization.planDetails?.pendingPlanInfo;
  if (planDetailsPendingInfo) {
    return {
      pendingPlanId: planDetailsPendingInfo.pendingPlanId,
      pendingPlanType: planDetailsPendingInfo.pendingPlanType,
      pendingPlanName: planDetailsPendingInfo.pendingPlanName,
      activationDate: planDetailsPendingInfo.activationDate,
    };
  }
  if (pendingCredit) {
    return {
      pendingPlanId: pendingCredit,
      pendingPlanType: 'credit-based' as const,
      pendingPlanName: assignedPlans?.creditBased?.name || 'Unknown',
      activationDate: organization.pendingCreditBasedPlanIdStartDate,
    };
  }
  if (pendingPremium) {
    return {
      pendingPlanId: pendingPremium,
      pendingPlanType: 'premium' as const,
      pendingPlanName: assignedPlans?.premium?.name || 'Unknown',
      activationDate: organization.pendingPremiumPlanIdStartDate,
    };
  }
  return null;
};

const shouldShowPendingBanner = (organization: any, currentPlans: any) => {
  const pendingInfo = getPendingPlanInfo(organization, currentPlans);
  if (!pendingInfo) return false;
  const currentPlan = pendingInfo.pendingPlanType === 'credit-based'
    ? currentPlans?.creditBased
    : currentPlans?.premium;
  const currentPlanName = currentPlan?.name;
  return pendingInfo.pendingPlanName && (!currentPlanName || currentPlanName !== pendingInfo.pendingPlanName);
};

interface OrgPlanUsageTabProps {
  organization: Organization;
  onUpdate: (updates: Partial<Organization>) => void;
  onRefresh?: () => void | Promise<void>;
}

export default function OrgPlanUsageTab({ organization, onUpdate, onRefresh }: OrgPlanUsageTabProps) {
  const gradient =
    "linear-gradient(90deg, #fccec0 0%, #ebacc9 33%, #ceb6da 66%, #9fcaed 100%)";

  const [orgAccessEnabled, setOrgAccessEnabled] = useState(() => organization.status === "active");
  const [projectsEnabled, setProjectsEnabled] = useState(() => organization.projectsEnabled ?? true);
  const [guestPortalEnabled, setGuestPortalEnabled] = useState(() => organization.guestPortalEnabled ?? false);
  const [brandedPortalEnabled, setBrandedPortalEnabled] = useState(() => organization.brandedPortalEnabled ?? false);
  const [globalHiringEnabled, setGlobalHiringEnabled] = useState(() => organization.globalHiringEnabled ?? false);
  const [linkedCareersEnabled, setLinkedCareersEnabled] = useState(() => organization.linkedCareersEnabled ?? false);
  const [togglingFeature, setTogglingFeature] = useState<string | null>(null);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [showAddPlanModal, setShowAddPlanModal] = useState(false);
  const [showEditScheduleModal, setShowEditScheduleModal] = useState(false);
  const [showManageCreditsModal, setShowManageCreditsModal] = useState(false);
  const [showManageSlotsModal, setShowManageSlotsModal] = useState(false);
  const [showPlanHistoryModal, setShowPlanHistoryModal] = useState(false);
  const [changePlanType, setChangePlanType] = useState<"credit-based" | "premium" | null>(null);
  const [editSchedulePlanType, setEditSchedulePlanType] = useState<"credit-based" | "premium" | null>(null);

  // Branded Portal Logic
  const [portalSlug, setPortalSlug] = useState(organization?.brandedJobPortalSubdomain || "");
  const [isSavingSlug, setIsSavingSlug] = useState(false);

  useEffect(() => {
    if (organization?.brandedJobPortalSubdomain) {
      setPortalSlug(organization.brandedJobPortalSubdomain);
    }
  }, [organization?.brandedJobPortalSubdomain]);

  const isValidSlugFormat = (slug: string): boolean => {
    const slugRegex = /^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$/;
    return slugRegex.test(slug) && slug.length >= 3 && slug.length <= 50;
  };

  const savePortalSlug = async () => {
    const cleanSlug = (portalSlug || "").trim();

    if (!cleanSlug) {
      errorToast("Branded portal slug is required", 1300);
      return;
    }

    if (!isValidSlugFormat(cleanSlug)) {
      errorToast("Slug must be 3-50 characters, lowercase letters, numbers, and hyphens only", 1300);
      return;
    }

    if (RESERVED_SUBDOMAINS.includes(cleanSlug)) {
      errorToast("This subdomain is reserved and cannot be used", 1300);
      return;
    }

    if (!organization?._id) {
      errorToast("Save organization first", 1300);
      return;
    }

    setIsSavingSlug(true);

    try {
      await api.post("/api/admin/update-organization", {
        orgID: organization._id,
        update: { brandedJobPortalSubdomain: cleanSlug },
      });

      successToast("Branded portal URL updated", 1300);
      onUpdate({ brandedJobPortalSubdomain: cleanSlug });
    } catch (err: any) {
      console.error("Portal slug save failed", err);
      const errorMessage = err?.response?.data?.message || "Failed to save portal URL";
      errorToast(errorMessage, 1300);
    } finally {
      setIsSavingSlug(false);
    }
  };

  const [planDetails, setPlanDetails] = useState<{
    plan: PricingPlan | null;
    hasPlan: boolean;
    isPlanExpired: boolean;
    isPlanPending: boolean;
    pendingPlanInfo?: {
      pendingCredits?: number;
      activationDate?: Date;
      pendingPlanType?: string;
      pendingPlanName?: string;
      pendingPlanId?: string;
    };
    existingPlanTypes: string[];
    assignedPlans: {
      creditBased: (PricingPlan & { isPending?: boolean }) | null;
      premium: (PricingPlan & { isPending?: boolean }) | null;
    };
    usage: {
      creditsUsed?: number;
      creditsTotal?: number;
      activeJobPosts?: number;
      maxJobPosts?: number;
      adminSeatsUsed: number;
      maxAdminSeats: number | null; // null = unlimited (combined from both plans)
      perPlanJobPosts?: {
        creditBased: number;
        premium: number;
      };
      perPlanAdminSeats?: {
        creditBased: number | null | undefined;
        premium: number | null | undefined;
      };
    };
  } | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);
  const [isCancellingPendingPlan, setIsCancellingPendingPlan] = useState(false);

  // Ref for CreditTransactionTable to trigger refresh externally
  const transactionTableRef = useRef<CreditTransactionTableRef>(null);

  // Local pending plan logic (previously from usePlanLogic)
  const showPendingBannerLocal = useMemo(() => {
    return shouldShowPendingBanner({ ...organization, planDetails }, planDetails?.assignedPlans);
  }, [organization, planDetails]);

  const pendingPlanInfoLocal = useMemo(() => {
    return getPendingPlanInfo({ ...organization, planDetails }, planDetails?.assignedPlans);
  }, [organization, planDetails]);

  // Check if there's a pending change specifically for each plan type
  const hasPendingCreditBasedChange = useMemo(() => {
    return showPendingBannerLocal && pendingPlanInfoLocal?.pendingPlanType === 'credit-based';
  }, [showPendingBannerLocal, pendingPlanInfoLocal]);

  const hasPendingPremiumChange = useMemo(() => {
    return showPendingBannerLocal && pendingPlanInfoLocal?.pendingPlanType === 'premium';
  }, [showPendingBannerLocal, pendingPlanInfoLocal]);

  // Determine if the pending plan is a SWITCH (replacing) vs ADD (coexisting)
  // Switch: an existing plan's end date is set right before the pending plan starts
  // Add: the existing plan continues (end date extends beyond pending start)
  const isPendingSwitch = useMemo(() => {
    if (!pendingPlanInfoLocal?.activationDate) return false;

    const pendingStart = new Date(pendingPlanInfoLocal.activationDate);
    pendingStart.setHours(0, 0, 0, 0);
    const dayBeforePending = new Date(pendingStart);
    dayBeforePending.setDate(dayBeforePending.getDate() - 1);

    // Check if pending is same type as an existing plan (always a switch)
    const pendingType = pendingPlanInfoLocal.pendingPlanType;
    if (pendingType === "credit-based" && planDetails?.assignedPlans?.creditBased && !planDetails.assignedPlans.creditBased.isPending) {
      return true; // Same-type switch (Credit → Credit upgrade)
    }
    if (pendingType === "premium" && planDetails?.assignedPlans?.premium && !planDetails.assignedPlans.premium.isPending) {
      return true; // Same-type switch (Premium → Premium upgrade)
    }

    // Cross-type: Check if any existing plan ends right before pending starts (being replaced)
    if (organization.creditBasedPlan?.endDate && planDetails?.assignedPlans?.creditBased && !planDetails.assignedPlans.creditBased.isPending) {
      const creditEnd = new Date(organization.creditBasedPlan.endDate);
      creditEnd.setHours(0, 0, 0, 0);
      if (creditEnd.getTime() === dayBeforePending.getTime()) {
        return true; // Credit plan is ending to make way for new plan
      }
    }

    if (organization.premiumPlan?.endDate && planDetails?.assignedPlans?.premium && !planDetails.assignedPlans.premium.isPending) {
      const premiumEnd = new Date(organization.premiumPlan.endDate);
      premiumEnd.setHours(0, 0, 0, 0);
      if (premiumEnd.getTime() === dayBeforePending.getTime()) {
        return true; // Premium plan is ending to make way for new plan
      }
    }

    // No plan is being terminated → it's an add
    return false;
  }, [pendingPlanInfoLocal, planDetails, organization.creditBasedPlan?.endDate, organization.premiumPlan?.endDate]);


  const fetchPlanDetails = useCallback(async () => {
    if (!organization._id) return;
    try {
      setIsLoadingPlan(true);
      const response = await api.get(`/api/pricing-plan/admin/get-org-plan-details?orgId=${organization._id}`);
      setPlanDetails({
        plan: response.data.plan,
        hasPlan: response.data.hasPlan,
        isPlanExpired: response.data.isPlanExpired,
        isPlanPending: response.data.isPlanPending || false,
        pendingPlanInfo: response.data.pendingPlanInfo,
        existingPlanTypes: response.data.existingPlanTypes || [],
        assignedPlans: response.data.assignedPlans || { creditBased: null, premium: null },
        usage: response.data.usage,
      });
    } catch (error) {
      console.error("Error fetching plan details:", error);
    } finally {
      setIsLoadingPlan(false);
    }
  }, [organization._id]);

  // Combined refresh function that updates plan details, transactions, and organization data
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      fetchPlanDetails(),
      onRefresh?.()
    ]);
    // Refresh transactions table via ref
    transactionTableRef.current?.refresh();
  }, [fetchPlanDetails, onRefresh]);

  // Cancel a pending plan switch
  const handleCancelPendingPlan = async () => {
    if (!planDetails?.pendingPlanInfo?.pendingPlanType) return;

    try {
      setIsCancellingPendingPlan(true);
      await api.delete("/api/pricing-plan/admin/cancel-pending-plan", {
        data: {
          orgId: organization._id,
          schemaType: planDetails.pendingPlanInfo.pendingPlanType,
        },
      });

      candidateActionToast(
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>Pending plan cancelled.</span>
            <span style={{ fontSize: 14, color: "#717680", fontWeight: 500 }}>
              The scheduled plan switch has been cancelled.
            </span>
          </div>
        </div>,
        3000,
        <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }} />
      );
      handleRefresh();
    } catch (error) {
      console.error("Error cancelling pending plan:", error);
      errorToast("Failed to cancel pending plan", 2000);
    } finally {
      setIsCancellingPendingPlan(false);
    }
  };

  useEffect(() => {
    fetchPlanDetails();
  }, [fetchPlanDetails]);

  // Sync state when organization prop changes
  useEffect(() => {
    setOrgAccessEnabled(organization.status === "active");
    setProjectsEnabled(organization.projectsEnabled ?? true);
    setGuestPortalEnabled(organization.guestPortalEnabled ?? false);
    setBrandedPortalEnabled(organization.brandedPortalEnabled ?? false);
    setGlobalHiringEnabled(organization.globalHiringEnabled ?? false);
    setLinkedCareersEnabled(organization.linkedCareersEnabled ?? false);
  }, [organization]);

  // Check for active plans (not pending)
  const hasActiveCreditBasedPlan = !!(planDetails?.assignedPlans?.creditBased && !planDetails.assignedPlans.creditBased.isPending);
  const hasActivePremiumPlan = !!(planDetails?.assignedPlans?.premium && !planDetails.assignedPlans.premium.isPending);
  const hasAnyActivePlan = hasActiveCreditBasedPlan || hasActivePremiumPlan;
  const hasBothPlanTypes = (planDetails?.existingPlanTypes?.length || 0) >= 2;

  // Comprehensive date comparison for expired/expiring logic
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Get end dates from nested structure
  const creditBasedEndDate = organization.creditBasedPlan?.endDate ? new Date(organization.creditBasedPlan.endDate) : null;
  const premiumEndDate = organization.premiumPlan?.endDate ? new Date(organization.premiumPlan.endDate) : null;

  // Normalize end dates
  if (creditBasedEndDate) creditBasedEndDate.setHours(0, 0, 0, 0);
  if (premiumEndDate) premiumEndDate.setHours(0, 0, 0, 0);

  // Determine which plan to check (prioritize credit-based if both exist)
  const activePlanEndDate = creditBasedEndDate || premiumEndDate;
  const activePlanName = planDetails?.assignedPlans?.creditBased?.name || planDetails?.assignedPlans?.premium?.name || "Basic";

  // Check if plan is expired (end date is in the past)
  const isPlanExpired = activePlanEndDate ? activePlanEndDate < todayStart : false;

  // Check if plan is expiring soon (within 2 weeks)
  const twoWeeksFromNow = new Date(todayStart);
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
  const isPlanExpiringSoon = activePlanEndDate && !isPlanExpired ? activePlanEndDate <= twoWeeksFromNow : false;

  // Show no plan state if expired or no active plans
  const showNoPlanState = (!hasAnyActivePlan && !planDetails?.isPlanPending) || isPlanExpired;

  // Show status banner for: no plan, expired, or expiring soon
  const showStatusBanner = showNoPlanState || isPlanExpiringSoon;

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const Switch = ({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) => (
    <label className="switch" style={{ display: "flex", alignItems: "center", lineHeight: 0, opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
      <span className="slider round"></span>
    </label>
  );

  const UnlimitedBadge = () => (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 999,
      backgroundColor: "#EFF8FF",
      color: "#175CD3",
      border: "1px solid #B2DDFF",
      fontSize: 10,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.02em",
      marginLeft: 8,
    }}>
      Unlimited
    </span>
  );

  const UsageBar = ({ value, max, isWarning = false }: { value: number; max: number; isWarning?: boolean }) => {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    const barColor = isWarning ? "#F97066" : gradient;
    return (
      <div style={{ width: "100%", height: 8, background: "#E9EAEB", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: barColor }} />
      </div>
    );
  };

  return (
    <>
      <style>
        {`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}
      </style>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Plan */}
        <div style={{ background: "#F8F9FC", borderRadius: 16, padding: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0 }}>Plan</h3>
            <div style={{ display: "flex", gap: 12, alignItems: "center", ...(!orgAccessEnabled ? { filter: "grayscale(1)", opacity: 0.6, pointerEvents: "none" } : {}) }}>
              <button
                type="button"
                onClick={() => setShowPlanHistoryModal(true)}
                style={{
                  background: "#fff",
                  border: "1px solid #D5D7DA",
                  borderRadius: 999,
                  padding: "8px 14px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <i className="la la-history" />
                Plan History
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!hasBothPlanTypes && !showNoPlanState && !(planDetails?.isPlanPending && !isPendingSwitch)) {
                    setShowAddPlanModal(true);
                  }
                }}
                disabled={hasBothPlanTypes || showNoPlanState || (planDetails?.isPlanPending && !isPendingSwitch)}
                style={{
                  background: (hasBothPlanTypes || showNoPlanState || (planDetails?.isPlanPending && !isPendingSwitch)) ? "#E9EAEB" : "#181D27",
                  border: (hasBothPlanTypes || showNoPlanState || (planDetails?.isPlanPending && !isPendingSwitch)) ? "1px solid #E9EAEB" : "1px solid #181D27",
                  borderRadius: 999,
                  padding: "8px 14px",
                  fontSize: 14,
                  fontWeight: 700,
                  color: (hasBothPlanTypes || showNoPlanState || (planDetails?.isPlanPending && !isPendingSwitch)) ? "#717680" : "#fff",
                  cursor: (hasBothPlanTypes || showNoPlanState || (planDetails?.isPlanPending && !isPendingSwitch)) ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <i className="la la-plus" style={{ fontSize: 18 }} />
                Add another plan
              </button>
            </div>
          </div>

          {/* Plan Status Banner - standalone version for no plan or expired */}
          {!isLoadingPlan && showStatusBanner && showNoPlanState && (
            <PlanStatusBanner
              planName={activePlanName}
              endDate={formatDate(activePlanEndDate)}
              isExpired={isPlanExpired}
              isExpiringSoon={isPlanExpiringSoon}
              onChooseNewPlan={() => setShowAddPlanModal(true)}
              onEditSchedule={() => {
                // Determine which plan type to edit based on which one exists
                const planType = organization.creditBasedPlan?.planId ? "credit-based" : "premium";
                setEditSchedulePlanType(planType);
                setShowEditScheduleModal(true);
              }}
              variant="standalone"
            />
          )}

          {/* Main Plan Details Container - hide if nothing to show (no active plan and no pending plan) */}
          {(!showNoPlanState || (showPendingBannerLocal && pendingPlanInfoLocal)) && (
            <div style={{ background: "#fff", borderRadius: 12, boxShadow: "inset 0px 0px 2px 0px rgba(0,16,53,0.16)", padding: "16px 24px" }}>
              {/* Plan Status Banner - inline version for expiring soon (within the white container) */}
              {!isLoadingPlan && showStatusBanner && !showNoPlanState && !showPendingBannerLocal && (
                <PlanStatusBanner
                  planName={activePlanName}
                  endDate={formatDate(activePlanEndDate)}
                  isExpired={isPlanExpired}
                  isExpiringSoon={isPlanExpiringSoon}
                  onChooseNewPlan={() => setShowAddPlanModal(true)}
                  onEditSchedule={() => {
                    const planType = organization.creditBasedPlan?.planId ? "credit-based" : "premium";
                    setEditSchedulePlanType(planType);
                    setShowEditScheduleModal(true);
                  }}
                  variant="inline"
                />
              )}
              {/* Pending Plan Switch Banner */}
              {!isLoadingPlan && showPendingBannerLocal && pendingPlanInfoLocal && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 24px",
                    background: "#fff",
                    border: "1px solid #dee0e2ff",
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: "flex", gap: 12 }}>
                    <i className="la la-info-circle" style={{ color: "#717680", fontSize: 20 }} />
                    <span style={{ fontSize: 14, color: "#181D27" }}>
                      This organization will {isPendingSwitch ? "switch to" : "start"} a{" "}
                      <strong>{pendingPlanInfoLocal.pendingPlanName}</strong>{" "}
                      ({pendingPlanInfoLocal.pendingPlanType}) plan on{" "}
                      <strong>{formatDate(pendingPlanInfoLocal.activationDate)}</strong>.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelPendingPlan}
                    disabled={isCancellingPendingPlan}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 999,
                      border: "1px solid #F04438",
                      background: "#fff",
                      color: "#F04438",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: isCancellingPendingPlan ? "not-allowed" : "pointer",
                      opacity: isCancellingPendingPlan ? 0.6 : 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {isCancellingPendingPlan && <i className="la la-spinner la-spin" style={{ fontSize: 14 }} />}
                    Cancel
                  </button>
                </div>
              )}
              {/* Organization Access - hide when plan is expired or no plan */}
              {!showNoPlanState && (
                <div
                  style={{
                    padding: "16px 0px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #E9EAEB",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>Organization Access</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#717680", marginTop: 4 }}>
                      Enable organization&apos;s access to Jia
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <OrganizationStatus status={orgAccessEnabled ? "active" : "inactive"} />
                    <Switch
                      checked={orgAccessEnabled}
                      onChange={async () => {
                        const newValue = !orgAccessEnabled;
                        setOrgAccessEnabled(newValue);
                        setTogglingFeature("status");

                        try {
                          await api.patch("/api/admin/toggle-org-access", {
                            orgId: organization._id,
                            status: newValue ? "active" : "inactive",
                          });

                          onUpdate({ status: newValue ? "active" : "inactive" });
                          candidateActionToast(
                            `Organization ${newValue ? "activated" : "deactivated"}`,
                            1300,
                            <i className={`la ${newValue ? "la-check-circle text-success" : "la-times-circle"}`} />
                          );
                        } catch (error) {
                          // Revert on error
                          setOrgAccessEnabled(!newValue);
                          errorToast("Error updating organization status", 1300);
                        } finally {
                          setTogglingFeature(null);
                        }
                      }}
                      disabled={togglingFeature === "status"}
                    />
                  </div>
                </div>
              )}

              <div style={!orgAccessEnabled ? { filter: "grayscale(1)", opacity: 0.6, pointerEvents: "none" } : {}}>
                {/* Credit-based Plan Section - only show if NOT pending AND NOT expired */}
                {planDetails?.assignedPlans?.creditBased && !planDetails.assignedPlans.creditBased.isPending && !isPlanExpired && (
                  <div style={{ padding: "20px 0px" }}>
                    <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>{planDetails.assignedPlans.creditBased.name}</div>
                          <PricingPlanBadge schema="credit-based" />
                          <span style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>{(() => {
                            const rawStart = organization.creditBasedPlan?.startDate || "";
                            if (!rawStart) return "Started on";
                            const start = new Date(rawStart);
                            // Normalize to local midnight for comparison
                            const startMidnight = new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
                            const todayStart = new Date();
                            todayStart.setHours(0, 0, 0, 0);
                            return startMidnight > todayStart ? "Starts on" : "Started on";
                          })()} {formatDate(organization.creditBasedPlan?.startDate)}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>Ends on {formatDate(organization.creditBasedPlan?.endDate)}</span>
                        </div>
                        <ul style={{ margin: "12px 0 0 18px", padding: 0, color: "#717680", fontSize: 13, lineHeight: "20px" }}>
                          <li>{planDetails.assignedPlans.creditBased.creditsPerMonth || 0} new credits / month</li>
                          <li>{planDetails.assignedPlans.creditBased.maxActiveJobPosts === null ? "Unlimited active credit-based job posts" : `Maximum ${planDetails.assignedPlans.creditBased.maxActiveJobPosts} active credit-based job posts`}</li>
                          <li>{planDetails.assignedPlans.creditBased.maxAdminSeats === null ? "Unlimited admin seats" : `${planDetails.assignedPlans.creditBased.maxAdminSeats} admin seats`}</li>
                          <li>10 credits per AI Interview</li>
                          <li>{planDetails.assignedPlans.creditBased.maxGuestHMSeats === null ? "Unlimited" : planDetails.assignedPlans.creditBased.maxGuestHMSeats} guests and hiring manager seats</li>
                        </ul>
                        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setChangePlanType("credit-based");
                              setShowChangePlanModal(true);
                            }}
                            disabled={hasPendingCreditBasedChange}
                            style={{
                              padding: "8px 16px",
                              borderRadius: 999,
                              border: "1px solid #181D27",
                              background: hasPendingCreditBasedChange ? "#717680" : "#181D27",
                              color: "#fff",
                              fontSize: 14,
                              fontWeight: 700,
                              cursor: hasPendingCreditBasedChange ? "not-allowed" : "pointer",
                              opacity: hasPendingCreditBasedChange ? 0.6 : 1
                            }}
                          >
                            Change organization plan
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditSchedulePlanType("credit-based");
                              setShowEditScheduleModal(true);
                            }}
                            style={{ padding: "8px 16px", borderRadius: 999, border: "1px solid #D5D7DA", background: "#fff", color: "#181D27", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                          >
                            Edit plan schedule
                          </button>
                        </div>
                      </div>

                      <div style={{ width: 460, maxWidth: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                            <div style={{ fontSize: 32, fontWeight: 800, color: "#181D27", lineHeight: "36px" }}>
                              {organization.creditBasedPlan?.creditsRemaining || 0}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>available credits</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowManageCreditsModal(true)}
                            style={{ padding: "8px 14px", borderRadius: 999, border: "1px solid #D5D7DA", background: "#fff", color: "#181D27", fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                          >
                            Manage organization credits
                          </button>
                        </div>

                        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#414651", display: "flex", alignItems: "center", gap: 6 }}>
                                {planDetails.usage.creditsUsed || 0} of {planDetails.assignedPlans.creditBased.creditsPerMonth || 0} credits used this month
                                <i className="la la-question-circle" style={{ color: "#717680" }} />
                              </div>
                              <div style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>Refreshes on {formatDate(organization.nextRenewalDate)}</div>
                            </div>
                            <div style={{ marginTop: 8 }}>
                              <UsageBar value={planDetails.usage.creditsUsed || 0} max={planDetails.assignedPlans.creditBased.creditsPerMonth || 1} />
                            </div>
                          </div>

                          <div>
                            {(() => {
                              const creditBasedUsed = planDetails.usage.perPlanJobPosts?.creditBased || 0;
                              const creditBasedMax = planDetails.assignedPlans.creditBased.maxActiveJobPosts;
                              const isUnlimited = creditBasedMax === null;
                              return (
                                <>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#414651", display: "flex", alignItems: "center" }}>
                                      {isUnlimited
                                        ? <>{creditBasedUsed} active credit-based job posts <UnlimitedBadge /></>
                                        : `${creditBasedUsed} of ${creditBasedMax} maximum active credit-based job posts`
                                      }
                                    </div>
                                    {!isUnlimited && creditBasedMax !== null && creditBasedUsed > creditBasedMax && (
                                      <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                        padding: "2px 8px",
                                        borderRadius: 999,
                                        border: "1px solid #FEF3F2",
                                        backgroundColor: "#FEF3F2",
                                      }}>
                                        <i className="la la-info-circle" style={{ fontSize: 14, color: "#B32318" }} />
                                        <span style={{ fontSize: 11, fontWeight: 700, color: "#B32318" }}>Overlimit</span>
                                      </div>
                                    )}
                                  </div>
                                  {!isUnlimited && (
                                    <div style={{ marginTop: 8 }}>
                                      <UsageBar value={creditBasedUsed} max={creditBasedMax || 1} isWarning={creditBasedUsed >= (creditBasedMax || 1) * 0.8} />
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>

                          {/* Admin Seats - uses combined limit from usage.maxAdminSeats */}
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#414651" }}>
                                {planDetails.usage.maxAdminSeats === null
                                  ? `${planDetails.usage.adminSeatsUsed} admin seats used (Unlimited)`
                                  : `${planDetails.usage.adminSeatsUsed} of ${planDetails.usage.maxAdminSeats} admin seats used`
                                }
                              </div>
                              {planDetails.usage.maxAdminSeats !== null && planDetails.usage.adminSeatsUsed > planDetails.usage.maxAdminSeats && (
                                <div style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  border: "1px solid #FEF3F2",
                                  backgroundColor: "#FEF3F2",
                                }}>
                                  <i className="la la-info-circle" style={{ fontSize: 14, color: "#B32318" }} />
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "#B32318" }}>Overlimit</span>
                                </div>
                              )}
                            </div>
                            {planDetails.usage.maxAdminSeats !== null && (
                              <div style={{ marginTop: 8 }}>
                                <UsageBar value={planDetails.usage.adminSeatsUsed} max={planDetails.usage.maxAdminSeats} isWarning={planDetails.usage.adminSeatsUsed >= planDetails.usage.maxAdminSeats * 0.8} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Premium Plan Section - only show if NOT pending AND NOT expired */}
                {planDetails?.assignedPlans?.premium && !planDetails.assignedPlans.premium.isPending && !isPlanExpired && (
                  <div style={{ padding: "20px 0px", borderTop: planDetails?.assignedPlans?.creditBased && !planDetails.assignedPlans.creditBased.isPending ? "1px solid #E9EAEB" : "none" }}>
                    <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>{planDetails.assignedPlans.premium.name}</div>
                          <PricingPlanBadge schema="premium" />
                          <span style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>{(() => {
                            const rawStart = organization.premiumPlan?.startDate || "";
                            if (!rawStart) return "Started on";
                            const start = new Date(rawStart);
                            // Normalize to local midnight for comparison
                            const startMidnight = new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
                            const todayStart = new Date();
                            todayStart.setHours(0, 0, 0, 0);
                            return startMidnight > todayStart ? "Starts on" : "Started on";
                          })()} {formatDate(organization.premiumPlan?.startDate)}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>Ends on {formatDate(organization.premiumPlan?.endDate)}</span>
                        </div>
                        <ul style={{ margin: "12px 0 0 18px", padding: 0, color: "#717680", fontSize: 13, lineHeight: "20px" }}>
                          <li>{planDetails.assignedPlans.premium.maxActiveJobPosts === null ? "Unlimited active premium job posts" : `Maximum ${(planDetails.assignedPlans.premium as any).effectiveMaxActiveJobPosts || planDetails.assignedPlans.premium.maxActiveJobPosts} active premium job posts`}</li>
                          <li>{planDetails.assignedPlans.premium.maxAdminSeats === null ? "Unlimited admin seats" : `${planDetails.assignedPlans.premium.maxAdminSeats} admin seats`}</li>
                          <li>Unlimited CV &amp; AI Interview analysis</li>
                          <li>{planDetails.assignedPlans.premium.maxGuestHMSeats === null ? "Unlimited" : planDetails.assignedPlans.premium.maxGuestHMSeats} guests and hiring manager seats</li>
                        </ul>
                        <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setChangePlanType("premium");
                              setShowChangePlanModal(true);
                            }}
                            disabled={hasPendingPremiumChange}
                            style={{
                              padding: "8px 16px",
                              borderRadius: 999,
                              border: "1px solid #181D27",
                              background: hasPendingPremiumChange ? "#717680" : "#181D27",
                              color: "#fff",
                              fontSize: 14,
                              fontWeight: 700,
                              cursor: hasPendingPremiumChange ? "not-allowed" : "pointer",
                              opacity: hasPendingPremiumChange ? 0.6 : 1
                            }}
                          >
                            Change organization plan
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditSchedulePlanType("premium");
                              setShowEditScheduleModal(true);
                            }}
                            style={{ padding: "8px 16px", borderRadius: 999, border: "1px solid #D5D7DA", background: "#fff", color: "#181D27", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                          >
                            Edit plan schedule
                          </button>
                        </div>
                      </div>

                      <div style={{ width: 460, maxWidth: "100%" }}>
                        {(() => {
                          const premiumUsed = planDetails.usage.perPlanJobPosts?.premium || 0;
                          const effectiveMax = (planDetails.assignedPlans.premium as any).effectiveMaxActiveJobPosts ?? planDetails.assignedPlans.premium.maxActiveJobPosts;
                          const isUnlimited = effectiveMax === null;
                          return (
                            <>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                                  <div style={{ fontSize: 32, fontWeight: 800, color: "#181D27", lineHeight: "36px" }}>
                                    {isUnlimited ? `${premiumUsed}` : `${premiumUsed}/${effectiveMax}`}
                                  </div>
                                  <div style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>
                                    active premium job posts{isUnlimited ? " (Unlimited)" : ""}
                                  </div>
                                </div>
                                {!isUnlimited && (
                                  <button
                                    type="button"
                                    onClick={() => setShowManageSlotsModal(true)}
                                    style={{ padding: "8px 14px", borderRadius: 999, border: "1px solid #D5D7DA", background: "#fff", color: "#181D27", fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                                  >
                                    Manage career slots
                                  </button>
                                )}
                              </div>

                              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                                <div>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#414651", display: "flex", alignItems: "center" }}>
                                      {isUnlimited
                                        ? <>{premiumUsed} active premium job posts <UnlimitedBadge /></>
                                        : `${premiumUsed} of ${effectiveMax} maximum active premium job posts`
                                      }
                                    </div>
                                    {!isUnlimited && effectiveMax !== null && premiumUsed > effectiveMax && (
                                      <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                        padding: "2px 8px",
                                        borderRadius: 999,
                                        border: "1px solid #FEF3F2",
                                        backgroundColor: "#FEF3F2",
                                      }}>
                                        <i className="la la-info-circle" style={{ fontSize: 14, color: "#B32318" }} />
                                        <span style={{ fontSize: 11, fontWeight: 700, color: "#B32318" }}>Overlimit</span>
                                      </div>
                                    )}
                                  </div>
                                  {!isUnlimited && (
                                    <div style={{ marginTop: 8 }}>
                                      <UsageBar value={premiumUsed} max={effectiveMax || 1} isWarning={premiumUsed >= (effectiveMax || 1) * 0.8} />
                                    </div>
                                  )}
                                </div>

                                {/* Admin Seats - uses combined limit from usage.maxAdminSeats */}
                                <div>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: "#414651" }}>
                                      {planDetails.usage.maxAdminSeats === null
                                        ? <>{planDetails.usage.adminSeatsUsed} admin seats used <UnlimitedBadge /></>
                                        : `${planDetails.usage.adminSeatsUsed} of ${planDetails.usage.maxAdminSeats} admin seats used`
                                      }
                                    </div>
                                    {planDetails.usage.maxAdminSeats !== null && planDetails.usage.adminSeatsUsed > planDetails.usage.maxAdminSeats && (
                                      <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                        padding: "2px 8px",
                                        borderRadius: 999,
                                        border: "1px solid #FEF3F2",
                                        backgroundColor: "#FEF3F2",
                                      }}>
                                        <i className="la la-info-circle" style={{ fontSize: 14, color: "#B32318" }} />
                                        <span style={{ fontSize: 11, fontWeight: 700, color: "#B32318" }}>Overlimit</span>
                                      </div>
                                    )}
                                  </div>
                                  {planDetails.usage.maxAdminSeats !== null && (
                                    <div style={{ marginTop: 8 }}>
                                      <UsageBar value={planDetails.usage.adminSeatsUsed} max={planDetails.usage.maxAdminSeats} isWarning={planDetails.usage.adminSeatsUsed >= planDetails.usage.maxAdminSeats * 0.8} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Loading skeleton */}
                {isLoadingPlan && (
                  <div style={{ padding: "20px 24px" }}>
                    <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
                      {/* Left side skeleton */}
                      <div style={{ flex: 1, minWidth: 280 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ width: 80, height: 20, background: "linear-gradient(90deg, #F8F9FC 25%, #E9EAEB 50%, #F8F9FC 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 4 }} />
                          <div style={{ width: 90, height: 24, background: "linear-gradient(90deg, #F8F9FC 25%, #E9EAEB 50%, #F8F9FC 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 999 }} />
                          <div style={{ width: 140, height: 16, background: "linear-gradient(90deg, #F8F9FC 25%, #E9EAEB 50%, #F8F9FC 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 4 }} />
                        </div>
                        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                          {[160, 200, 120, 180, 220].map((w, i) => (
                            <div key={i} style={{ width: w, height: 14, background: "linear-gradient(90deg, #F8F9FC 25%, #E9EAEB 50%, #F8F9FC 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 4 }} />
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                          <div style={{ width: 180, height: 40, background: "linear-gradient(90deg, #F8F9FC 25%, #E9EAEB 50%, #F8F9FC 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 999 }} />
                          <div style={{ width: 140, height: 40, background: "linear-gradient(90deg, #F8F9FC 25%, #E9EAEB 50%, #F8F9FC 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 999 }} />
                        </div>
                      </div>
                      {/* Right side skeleton */}
                      <div style={{ width: 460, maxWidth: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                            <div style={{ width: 60, height: 36, background: "linear-gradient(90deg, #F8F9FC 25%, #E9EAEB 50%, #F8F9FC 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 4 }} />
                            <div style={{ width: 100, height: 14, background: "linear-gradient(90deg, #F8F9FC 25%, #E9EAEB 50%, #F8F9FC 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 4 }} />
                          </div>
                          <div style={{ width: 180, height: 40, background: "linear-gradient(90deg, #F8F9FC 25%, #E9EAEB 50%, #F8F9FC 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 999 }} />
                        </div>
                        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                          {[1, 2, 3].map((i) => (
                            <div key={i}>
                              <div style={{ width: 280, height: 14, background: "linear-gradient(90deg, #F8F9FC 25%, #E9EAEB 50%, #F8F9FC 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 4 }} />
                              <div style={{ marginTop: 8, width: "100%", height: 8, background: "linear-gradient(90deg, #F8F9FC 25%, #E9EAEB 50%, #F8F9FC 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 999 }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Additional Features */}
        <div style={{ background: "#F8F9FC", borderRadius: 16, padding: 8, ...(!orgAccessEnabled ? { filter: "grayscale(1)", opacity: 0.6, pointerEvents: "none" } : {}) }}>
          <div style={{ padding: "10px 12px" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0 }}>Additional Features</h3>
          </div>
          <div style={{ background: "#fff", borderRadius: 12, padding: "16px 24px", boxShadow: "inset 0px 0px 2px 0px rgba(0,16,53,0.16)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Projects Toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>Projects</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#717680", marginTop: 4 }}>
                    Projects allow users to organize careers info folders.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <OrganizationStatus status={projectsEnabled ? "active" : "inactive"} />
                  <Switch
                    checked={projectsEnabled}
                    onChange={async () => {
                      const newValue = !projectsEnabled;
                      setTogglingFeature("projectsEnabled");
                      try {
                        await api.patch("/api/admin/toggle-org-feature", {
                          orgId: organization._id,
                          feature: "projectsEnabled",
                          enabled: newValue,
                        });

                        setProjectsEnabled(newValue);
                        const updates: Partial<Organization> = {
                          projectsEnabled: newValue,
                        };

                        onUpdate(updates);
                        candidateActionToast(
                          `Projects ${newValue ? "enabled" : "disabled"}`,
                          1300,
                          <i className={`la ${newValue ? "la-check-circle text-success" : "la-times-circle"}`} />
                        );
                      } catch (error) {
                        errorToast("Error updating feature", 1300);
                      } finally {
                        setTogglingFeature(null);
                      }
                    }}
                    disabled={togglingFeature === "projectsEnabled"}
                  />
                </div>
              </div>

              {/* Guest Portal Toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 1 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>Requisitions</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#717680", marginTop: 4 }}>
                    Allow guest hiring managers to access the portal.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <OrganizationStatus status={guestPortalEnabled ? "active" : "inactive"} />
                  <Switch
                    checked={guestPortalEnabled}
                    onChange={async () => {
                      const newValue = !guestPortalEnabled;
                      setTogglingFeature("guestPortalEnabled");
                      try {
                        await api.patch("/api/admin/toggle-org-feature", {
                          orgId: organization._id,
                          feature: "guestPortalEnabled",
                          enabled: newValue,
                        });

                        setGuestPortalEnabled(newValue);
                        onUpdate({
                          guestPortalEnabled: newValue,
                        });
                        candidateActionToast(
                          `Guest Portal ${newValue ? "enabled" : "disabled"}`,
                          1300,
                          <i className={`la ${newValue ? "la-check-circle text-success" : "la-times-circle"}`} />
                        );
                      } catch (error) {
                        errorToast("Error updating feature", 1300);
                      } finally {
                        setTogglingFeature(null);
                      }
                    }}
                    disabled={togglingFeature === "guestPortalEnabled"}
                  />
                </div>
              </div>

                            {/* Global Hiring Toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 1 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>Global Hiring</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#717680", marginTop: 4 }}>
                    Enable global hiring capabilities for this organization.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <OrganizationStatus status={globalHiringEnabled ? "active" : "inactive"} />
                  <Switch
                    checked={globalHiringEnabled}
                    onChange={async () => {
                      const newValue = !globalHiringEnabled;
                      setTogglingFeature("globalHiringEnabled");
                      try {
                        await api.patch("/api/admin/toggle-org-feature", {
                          orgId: organization._id,
                          feature: "globalHiringEnabled",
                          enabled: newValue,
                        });

                        setGlobalHiringEnabled(newValue);
                        onUpdate({
                          globalHiringEnabled: newValue,
                        });
                        candidateActionToast(
                          `Global Hiring ${newValue ? "enabled" : "disabled"}`,
                          1300,
                          <i className={`la ${newValue ? "la-check-circle text-success" : "la-times-circle"}`} />
                        );
                      } catch (error) {
                        errorToast("Error updating feature", 1300);
                      } finally {
                        setTogglingFeature(null);
                      }
                    }}
                    disabled={togglingFeature === "globalHiringEnabled"}
                  />
                </div>
              </div>

              {/* Branded Job Portal Toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 1 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>Branded Job Portal</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#717680", marginTop: 4 }}>
                    Enable organization&apos;s branded job portal.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <OrganizationStatus status={brandedPortalEnabled ? "active" : "inactive"} />
                  <Switch
                    checked={brandedPortalEnabled}
                    onChange={async () => {
                      const newValue = !brandedPortalEnabled;
                      setTogglingFeature("brandedPortalEnabled");
                      try {
                        await api.patch("/api/admin/toggle-org-feature", {
                          orgId: organization._id,
                          feature: "brandedPortalEnabled",
                          enabled: newValue,
                        });

                        setBrandedPortalEnabled(newValue);
                        onUpdate({
                          brandedPortalEnabled: newValue,
                        });
                        candidateActionToast(
                          `Branded Portal ${newValue ? "enabled" : "disabled"}`,
                          1300,
                          <i className={`la ${newValue ? "la-check-circle text-success" : "la-times-circle"}`} />
                        );
                      } catch (error) {
                        errorToast("Error updating feature", 1300);
                      } finally {
                        setTogglingFeature(null);
                      }
                    }}
                    disabled={togglingFeature === "brandedPortalEnabled"}
                  />
                </div>
              </div>

              {/* Linked Careers Toggle */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 1 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>Linked Careers</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#717680", marginTop: 4 }}>
                    Allows linking parent and child career posts for candidate pipeline management.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <OrganizationStatus status={linkedCareersEnabled ? "active" : "inactive"} />
                  <Switch
                    checked={linkedCareersEnabled}
                    onChange={async () => {
                      const newValue = !linkedCareersEnabled;
                      setTogglingFeature("linkedCareersEnabled");
                      try {
                        await api.patch("/api/admin/toggle-org-feature", {
                          orgId: organization._id,
                          feature: "linkedCareersEnabled",
                          enabled: newValue,
                        });

                        setLinkedCareersEnabled(newValue);
                        onUpdate({
                          linkedCareersEnabled: newValue,
                        } as Partial<Organization>);
                        candidateActionToast(
                          `Linked Careers ${newValue ? "enabled" : "disabled"}`,
                          1300,
                          <i className={`la ${newValue ? "la-check-circle text-success" : "la-times-circle"}`} />
                        );
                      } catch (error) {
                        errorToast("Error updating feature", 1300);
                      } finally {
                        setTogglingFeature(null);
                      }
                    }}
                    disabled={togglingFeature === "linkedCareersEnabled"}
                  />
                </div>
              </div>

              {/* Branded Job Portal Input */}
              {brandedPortalEnabled && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 13, color: "#717680", marginBottom: 12, marginTop: 0 }}>
                    Customize the subdomain for branded job portal.
                  </p>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ flex: 1, position: "relative" }}>
                      <input
                        type="text"
                        value={portalSlug}
                        onChange={(e) => setPortalSlug(e.target.value)}
                        placeholder="Enter portal slug"
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          paddingRight: 160,
                          border: "1px solid #D5D7DA",
                          borderRadius: 8,
                          fontSize: 14,
                          color: "#181D27",
                        }}
                      />
                      <div style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "#717680",
                        fontSize: 13,
                        pointerEvents: "none"
                      }}>
                        .{process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN || "hellojia.ai"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={savePortalSlug}
                      disabled={isSavingSlug || portalSlug === organization?.brandedJobPortalSubdomain}
                      style={{
                        padding: "8px 16px",
                        border: "none",
                        borderRadius: 8,
                        background: "#181D27",
                        color: "#fff",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: isSavingSlug || portalSlug === organization?.brandedJobPortalSubdomain ? "not-allowed" : "pointer",
                        opacity: isSavingSlug || portalSlug === organization?.brandedJobPortalSubdomain ? 0.6 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isSavingSlug ? "Saving..." : "Save"}
                    </button>
                  </div>

                  {portalSlug && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#717680", display: "flex", gap: 4, alignItems: "center" }}>
                      <span>Preview:</span>
                      <a
                        href={`https://${portalSlug}.${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN || "hellojia.ai"}/job-openings`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#175CD3", textDecoration: "none", fontWeight: 500 }}
                      >
                        {`${portalSlug}.${process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN || "hellojia.ai"}/job-openings`}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Credit Transaction History */}
        <div style={!orgAccessEnabled ? { filter: "grayscale(1)", opacity: 0.6, pointerEvents: "none" } : {}}>
          <CreditTransactionTable
            ref={transactionTableRef}
            orgId={organization._id || ""}
            frozenCredits={organization.frozenCredits || 0}
            hasPremiumPlan={hasActivePremiumPlan}
          />
        </div>

        {/* Change Organization Plan Modal */}
        <ChangeOrgPlanModal
          isOpen={showChangePlanModal}
          onClose={() => {
            setShowChangePlanModal(false);
            setChangePlanType(null);
          }}
          orgId={organization._id || ""}
          existingPlanTypes={planDetails?.existingPlanTypes || []}
          creditsRemaining={organization.creditBasedPlan?.creditsRemaining || 0}
          currentPlan={
            changePlanType === "credit-based" && planDetails?.assignedPlans?.creditBased
              ? {
                id: (planDetails.assignedPlans.creditBased as PricingPlan & { _id?: string })._id || "",
                name: planDetails.assignedPlans.creditBased.name,
                schema: "credit-based",
                startDate: organization.creditBasedPlan?.startDate,
                endDate: organization.creditBasedPlan?.endDate,
                costPerMonth: planDetails.assignedPlans.creditBased.costPerMonth,
                creditsPerMonth: planDetails.assignedPlans.creditBased.creditsPerMonth,
                maxActiveJobPosts: planDetails.assignedPlans.creditBased.maxActiveJobPosts,
                maxAdminSeats: planDetails.assignedPlans.creditBased.maxAdminSeats,
                maxGuestHMSeats: planDetails.assignedPlans.creditBased.maxGuestHMSeats ?? null,
              }
              : changePlanType === "premium" && planDetails?.assignedPlans?.premium
                ? {
                  id: (planDetails.assignedPlans.premium as PricingPlan & { _id?: string })._id || "",
                  name: planDetails.assignedPlans.premium.name,
                  schema: "premium",
                  startDate: organization.premiumPlan?.startDate,
                  endDate: organization.premiumPlan?.endDate,
                  costPerMonth: planDetails.assignedPlans.premium.costPerMonth,
                  creditsPerMonth: planDetails.assignedPlans.premium.creditsPerMonth,
                  maxActiveJobPosts: planDetails.assignedPlans.premium.maxActiveJobPosts,
                  maxAdminSeats: planDetails.assignedPlans.premium.maxAdminSeats,
                  maxGuestHMSeats: planDetails.assignedPlans.premium.maxGuestHMSeats ?? null,
                }
                : null
          }
          onSuccess={handleRefresh}
        />

        {/* Manage Organization Credits Modal */}
        <ManageOrgCreditsModal
          isOpen={showManageCreditsModal}
          onClose={() => setShowManageCreditsModal(false)}
          orgId={organization._id || ""}
          currentCredits={organization.creditBasedPlan?.creditsRemaining || 0}
          onSuccess={handleRefresh}
        />

        {/* Manage Career Slots Modal */}
        <ManageCareerSlotsModal
          isOpen={showManageSlotsModal}
          onClose={() => setShowManageSlotsModal(false)}
          orgId={organization._id || ""}
          currentActiveSlots={planDetails?.usage?.perPlanJobPosts?.premium || 0}
          currentMaxSlots={(planDetails?.assignedPlans?.premium as any)?.effectiveMaxActiveJobPosts || planDetails?.assignedPlans?.premium?.maxActiveJobPosts || 0}
          onSuccess={handleRefresh}
        />

        {/* Plan History Modal */}
        {showPlanHistoryModal && (
          <PlanHistoryModal
            orgId={organization._id || ""}
            onClose={() => setShowPlanHistoryModal(false)}
          />
        )}

        {/* Edit Plan Schedule Modal */}
        <EditOrgPlanScheduleModal
          isOpen={showEditScheduleModal}
          onClose={() => {
            setShowEditScheduleModal(false);
            setEditSchedulePlanType(null);
          }}
          orgId={organization._id || ""}
          currentPlan={
            editSchedulePlanType === "credit-based" && planDetails?.assignedPlans?.creditBased
              ? {
                id: (planDetails.assignedPlans.creditBased as PricingPlan & { _id?: string })._id || "",
                name: planDetails.assignedPlans.creditBased.name,
                schema: "credit-based",
                startDate: organization.creditBasedPlan?.startDate,
                endDate: organization.creditBasedPlan?.endDate,
                costPerMonth: planDetails.assignedPlans.creditBased.costPerMonth,
                creditsPerMonth: planDetails.assignedPlans.creditBased.creditsPerMonth,
                maxActiveJobPosts: planDetails.assignedPlans.creditBased.maxActiveJobPosts,
                maxAdminSeats: planDetails.assignedPlans.creditBased.maxAdminSeats,
                maxGuestHMSeats: planDetails.assignedPlans.creditBased.maxGuestHMSeats ?? null,
              }
              : editSchedulePlanType === "premium" && planDetails?.assignedPlans?.premium
                ? {
                  id: (planDetails.assignedPlans.premium as PricingPlan & { _id?: string })._id || "",
                  name: planDetails.assignedPlans.premium.name,
                  schema: "premium",
                  startDate: organization.premiumPlan?.startDate,
                  endDate: organization.premiumPlan?.endDate,
                  costPerMonth: planDetails.assignedPlans.premium.costPerMonth,
                  creditsPerMonth: planDetails.assignedPlans.premium.creditsPerMonth,
                  maxActiveJobPosts: planDetails.assignedPlans.premium.maxActiveJobPosts,
                  maxAdminSeats: planDetails.assignedPlans.premium.maxAdminSeats,
                  maxGuestHMSeats: planDetails.assignedPlans.premium.maxGuestHMSeats ?? null,
                }
                : null
          }
          onSuccess={handleRefresh}
        />

        {/* Add Organization Plan Modal */}
        <AddOrgPlanModal
          isOpen={showAddPlanModal}
          onClose={() => setShowAddPlanModal(false)}
          orgId={organization._id || ""}
          orgName={organization.name}
          currentCredits={organization.creditBasedPlan?.creditsRemaining}
          existingPlanTypes={planDetails?.existingPlanTypes || []}
          onSuccess={handleRefresh}
        />
      </div>
    </>
  );
}
