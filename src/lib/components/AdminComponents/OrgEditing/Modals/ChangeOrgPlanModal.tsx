"use client";

/* Imports */
import { useEffect, useMemo, useState } from "react";
import { candidateActionToast, errorToast } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient";
import type { PricingPlan } from "@/lib/types/pricing";
import {
  CurrentPlanStep,
  SelectNewPlanStep,
  SetScheduleStep,
  ReviewStep,
  type PlanOption,
} from "./ChangeOrgPlanSteps";

/* Types & Interfaces */
interface CurrentPlanData {
  id: string;
  name: string;
  schema: "credit-based" | "premium";
  startDate?: Date | string;
  endDate?: Date | string;
  costPerMonth: number;
  creditsPerMonth?: number;
  maxActiveJobPosts: number | null;
  maxAdminSeats: number | null;
  maxGuestHMSeats: number | null;
  additionalJobPostCost?: number;
}

interface ChangeOrgPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan?: CurrentPlanData | null;
  orgId?: string;
  existingPlanTypes?: string[];
  onSuccess?: () => void;
  creditsRemaining?: number;
}

interface CurrentPlanDisplay {
  id: string;
  name: string;
  schema: "credit-based" | "premium";
  startedOn: string;
  endsOn: string;
  costPerMonth: number;
  creditsPerMonth?: number;
  maxActiveJobPosts: number | null;
  maxAdminSeats: number | null;
  maxGuestHMSeats: number | null;
}

/* Constants */
const STEPS = [
  { id: 0, label: "Current plan" },
  { id: 1, label: "Select new plan" },
  { id: 2, label: "Set schedule" },
  { id: 3, label: "Review" },
];

const GRADIENT = "linear-gradient(90deg, #9fcaed 0%, #ceb6da 33%, #ebacc9 66%, #fccec0 100%)";

const MAX_DURATION_MS = 3 * 365 * 24 * 60 * 60 * 1000; // 3 years in ms
const MAX_FUTURE_YEARS = 5;

/* Utils */
const isDateInPast = (dateString: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return false;
  if (Number.isNaN(date.getTime())) return false;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const dateStart = new Date(dateString);
  dateStart.setHours(0, 0, 0, 0);
  return dateStart < todayStart;
};

const formatCurrency = (amount: number): string =>
  `₱ ${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateForUi = (value: string): string => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const validatePlanDates = (
  currentEndDate: string,
  newStartDate: string,
  newEndDate: string
) => {
  const errors = {
    currentEndDate: null as string | null,
    startDate: null as string | null,
    endDate: null as string | null,
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  if (currentEndDate && isDateInPast(currentEndDate)) {
    errors.currentEndDate = "End date cannot be in the past";
  }

  if (newStartDate && newEndDate) {
    const start = new Date(newStartDate);
    const end = new Date(newEndDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (end <= start) {
      errors.endDate = "End date must be after the start date";
    }

    if (currentEndDate) {
      const currentEnd = new Date(currentEndDate);
      currentEnd.setHours(0, 0, 0, 0);
      const startNormalized = new Date(newStartDate);
      startNormalized.setHours(0, 0, 0, 0);
      if (startNormalized < currentEnd) {
        errors.startDate = "New plan start date must be on or after the current plan end date";
      }
    }

    const fiveYearsFromNow = new Date(todayStart);
    fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + MAX_FUTURE_YEARS);

    if (start > fiveYearsFromNow) {
      errors.startDate = "Start date cannot be more than 5 years in the future";
    }
    if (end > fiveYearsFromNow) {
      errors.endDate = "End date cannot be more than 5 years in the future";
    }
    if (end.getTime() - start.getTime() > MAX_DURATION_MS) {
      errors.endDate = "Plan duration cannot exceed 3 years";
    }
  }

  return errors;
};

/* Sub-Components */
interface StepIndicatorProps {
  currentStep: number;
  hasStepProgress: (stepIndex: number) => boolean;
}

function StepIndicator({ currentStep, hasStepProgress }: StepIndicatorProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        marginBottom: 24,
      }}
    >
      {STEPS.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isPending = index > currentStep;

        return (
          <div
            key={step.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 8,
              position: "relative",
              flex: index === STEPS.length - 1 ? "0 0 auto" : "1 1 0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isCompleted ? (
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#181D27",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i className="la la-check" style={{ color: "#fff", fontSize: 14 }} />
                </div>
              ) : (
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    border: `2px solid ${isCurrent ? "#181D27" : "#D5D7DA"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: isCurrent ? "#181D27" : "#D5D7DA",
                    }}
                  />
                </div>
              )}

              {index !== STEPS.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 36,
                    right: 12,
                    height: 4,
                    background: "#E9EAEB",
                    borderRadius: 2,
                    transform: "translateY(-50%)",
                  }}
                >
                  <div
                    style={{
                      width: isCompleted ? "100%" : isCurrent && hasStepProgress(index) ? "50%" : "0%",
                      height: "100%",
                      background: isCompleted || (isCurrent && hasStepProgress(index)) ? GRADIENT : "#E9EAEB",
                      borderRadius: 2,
                    }}
                  />
                </div>
              )}
            </div>

            <span
              style={{
                fontSize: 14,
                fontWeight: isCompleted || isCurrent ? 600 : 400,
                color: isPending ? "#717680" : "#181D27",
              }}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* Main Component */
export default function ChangeOrgPlanModal({
  isOpen,
  onClose,
  currentPlan: currentPlanProp,
  orgId,
  existingPlanTypes = [],
  onSuccess,
  creditsRemaining = 0,
}: ChangeOrgPlanModalProps) {
  /* State */
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPlanEnded, setCurrentPlanEnded] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [availablePlans, setAvailablePlans] = useState<PlanOption[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [plansError, setPlansError] = useState<string | null>(null);

  /* Derived Values */
  const currentPlan = useMemo((): CurrentPlanDisplay | null => {
    if (!currentPlanProp) return null;
    return {
      id: currentPlanProp.id,
      name: currentPlanProp.name,
      schema: currentPlanProp.schema,
      startedOn: currentPlanProp.startDate
        ? new Date(currentPlanProp.startDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        : "",
      endsOn: currentPlanProp.endDate
        ? new Date(currentPlanProp.endDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        : "",
      costPerMonth: currentPlanProp.costPerMonth,
      creditsPerMonth: currentPlanProp.creditsPerMonth,
      maxActiveJobPosts: currentPlanProp.maxActiveJobPosts ?? null,
      maxAdminSeats: currentPlanProp.maxAdminSeats ?? null,
      maxGuestHMSeats: currentPlanProp.maxGuestHMSeats ?? null,
    };
  }, [currentPlanProp]);

  const selectedPlan = availablePlans.find((p) => p.id === selectedPlanId);

  const hasBothPlanTypes = existingPlanTypes.length >= 2;
  const allowedSchema = hasBothPlanTypes && currentPlan ? currentPlan.schema : null;

  const validationErrors = validatePlanDates(endDate, startDate, newEndDate);
  const hasDateValidationErrors = !!(
    validationErrors.startDate ||
    validationErrors.endDate ||
    validationErrors.currentEndDate
  );

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0:
        return currentPlan && currentPlanEnded && endDate && !validationErrors.currentEndDate;
      case 1:
        return selectedPlanId !== null;
      case 2:
        return newEndDate && !hasDateValidationErrors;
      case 3:
        return true;
      default:
        return false;
    }
  }, [currentStep, currentPlan, currentPlanEnded, endDate, selectedPlanId, newEndDate, hasDateValidationErrors, validationErrors.currentEndDate]);

  /* Effects */

  // Reset modal state when closed
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setCurrentPlanEnded(false);
      setEndDate("");
      setSelectedPlanId(null);
      setStartDate("");
      setNewEndDate("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Fetch available plans when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;

    const fetchPlans = async () => {
      try {
        setPlansError(null);
        setIsLoadingPlans(true);

        const response = await api.get("/api/pricing-plan/admin/get-pricing-plans");
        const data = (response.data || []) as PricingPlan[];
        const plans = data
          .filter((p) => p.status === "published")
          .map<PlanOption>((p) => ({
            id: p._id,
            name: p.name,
            schema: p.schema,
            costPerMonth: p.costPerMonth,
            creditsPerMonth: p.creditsPerMonth,
            maxActiveJobPosts: p.maxActiveJobPosts ?? null,
            maxAdminSeats: p.maxAdminSeats ?? null,
            maxGuestHMSeats: p.maxGuestHMSeats ?? null,
            additionalJobPostCost: p.additionalJobPostCost,
          }));

        if (!isCancelled) {
          setAvailablePlans(plans);
        }
      } catch (e) {
        console.error("Error fetching pricing plans:", e);
        if (!isCancelled) {
          setPlansError("Error fetching pricing plans");
          errorToast("Error fetching pricing plans", 1500);
          setAvailablePlans([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingPlans(false);
        }
      }
    };

    fetchPlans();

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  // Set default start date when entering schedule step
  useEffect(() => {
    if (currentStep === 2 && endDate) {
      const currentEndDate = new Date(endDate);
      currentEndDate.setHours(0, 0, 0, 0);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let defaultStartDate: Date;

      // If previous plan ends today or in the past, default to today
      if (currentEndDate <= todayStart) {
        defaultStartDate = new Date(); // Use actualNow for the timestamp, will be normalized by caller if needed
      } else {
        // Otherwise (future end date), default to the day after
        defaultStartDate = new Date(currentEndDate);
        defaultStartDate.setDate(defaultStartDate.getDate() + 1);
      }

      setStartDate(defaultStartDate.toLocaleDateString("en-CA"));
    }
  }, [endDate, currentStep]);

  /* Handlers */
  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      if (currentStep === 1 && endDate) {
        const currentEndDate = new Date(endDate);
        currentEndDate.setHours(0, 0, 0, 0);

        const defaultStartDate = new Date(currentEndDate);
        defaultStartDate.setDate(defaultStartDate.getDate() + 1);

        setStartDate(defaultStartDate.toISOString().split("T")[0]);
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleEndPlan = () => {
    setCurrentPlanEnded(true);
  };

  const handleConfirmPlanChange = async () => {
    if (!orgId || !selectedPlanId || !startDate || !newEndDate || !currentPlan) return;

    try {
      setIsSubmitting(true);

      await api.post("/api/pricing-plan/admin/atomic-plan-change", {
        orgId,
        currentPlanSchemaType: currentPlan.schema,
        currentPlanEndDate: endDate,
        newPlanId: selectedPlanId,
        newPlanStartDate: startDate,
        newPlanEndDate: newEndDate,
      });

      const planName = selectedPlan?.name || "Selected";
      const isStartingToday = (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        return start <= today;
      })();

      candidateActionToast(
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>Organization plan updated.</span>
            <span style={{ fontSize: 14, color: "#717680", fontWeight: 500 }}>
              {isStartingToday
                ? `The ${planName} plan is now applied to this organization.`
                : `The ${planName} plan will be applied to this organization on ${formatDateForUi(startDate)}.`}
            </span>
          </div>
        </div>,
        4000,
        <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }} />
      );

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Error changing plan:", error);
      const errorMessage = error?.response?.data?.error || "Failed to change plan";
      errorToast(errorMessage, 2000);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* Render Helpers */
  const hasStepProgress = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0:
        return endDate !== "" || currentPlanEnded;
      case 1:
        return selectedPlanId !== null;
      case 2:
        return startDate !== "" || newEndDate !== "";
      case 3:
        return true;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        if (!currentPlan) {
          return (
            <div style={{ padding: "12px 0", fontSize: 14, color: "#717680", fontWeight: 600 }}>
              No current plan data available.
            </div>
          );
        }
        return (
          <CurrentPlanStep
            currentPlan={currentPlan}
            currentPlanEnded={currentPlanEnded}
            endDate={endDate}
            onEndDateChange={setEndDate}
            onEndPlan={handleEndPlan}
            formatCurrency={formatCurrency}
            formatDateForUi={formatDateForUi}
            isEndDateInPast={isDateInPast}
            planStartDate={currentPlanProp?.startDate}
          />
        );

      case 1:
        return (
          <SelectNewPlanStep
            availablePlans={availablePlans}
            selectedPlanId={selectedPlanId}
            onSelectPlan={setSelectedPlanId}
            isLoadingPlans={isLoadingPlans}
            plansError={plansError}
            allowedSchema={allowedSchema}
            formatCurrency={formatCurrency}
          />
        );

      case 2:
        return (
          <SetScheduleStep
            selectedPlan={selectedPlan}
            startDate={startDate}
            newEndDate={newEndDate}
            currentPlanEndDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setNewEndDate}
            creditsRemaining={creditsRemaining}
            currentPlanSchema={currentPlan?.schema || "credit-based"}
            formatCurrency={formatCurrency}
          />
        );

      case 3:
        if (!currentPlan) return null;
        return (
          <ReviewStep
            currentPlan={currentPlan}
            selectedPlan={selectedPlan}
            endDate={endDate}
            startDate={startDate}
            newEndDate={newEndDate}
            creditsRemaining={creditsRemaining}
            formatCurrency={formatCurrency}
            formatDateForUi={formatDateForUi}
            isEndDateInPast={isDateInPast}
            additionalJobPostCost={currentPlanProp?.additionalJobPostCost}
          />
        );

      default:
        return null;
    }
  };

  const renderFooterMessage = () => {
    if (currentStep === 1 && selectedPlan) {
      return (
        <span style={{ fontSize: 14, color: "#027A48", display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
          <i className="la la-check-circle" style={{ fontSize: 16 }} />
          {selectedPlan.name} ({selectedPlan.schema === "credit-based" ? "Credit-based" : "Premium"}) selected.
        </span>
      );
    }

    if (currentStep === 2 && startDate && newEndDate) {
      return (
        <span style={{ fontSize: 14, color: "#027A48", display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
          <i className="la la-check-circle" style={{ fontSize: 16 }} />
          Selected plan will start on {formatDateForUi(startDate)} and end on {formatDateForUi(newEndDate)}.
        </span>
      );
    }

    if (!canProceed && currentStep < 3) {
      const messages: Record<number, string> = {
        0: "You must end the current plan before assigning a new one.",
        1: "Select a plan to proceed.",
        2: "Enter start and end dates to proceed.",
      };

      return (
        <span style={{ fontSize: 14, color: "#181D27", display: "flex", alignItems: "center", gap: 10, fontWeight: 600 }}>
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#FEF0C7",
              border: "1px solid #FEC84B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 auto",
            }}
          >
            <i className="la la-exclamation" style={{ fontSize: 12, color: "#DC6803" }} />
          </span>
          {messages[currentStep]}
        </span>
      );
    }

    return null;
  };

  /* Early Returns */
  if (!isOpen) return null;

  /* JSX */
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 1100,
          minHeight: 640,
          maxHeight: "92vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 24px",
            borderBottom: "1px solid #E9EAEB",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#181D27", margin: 0 }}>
            Change organization plan
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <i className="la la-times" style={{ fontSize: 24, color: "#717680" }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          <StepIndicator currentStep={currentStep} hasStepProgress={hasStepProgress} />
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            borderTop: "1px solid #E9EAEB",
          }}
        >
          <div>{renderFooterMessage()}</div>

          <div style={{ display: "flex", gap: 12 }}>
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: "1px solid #D5D7DA",
                  background: "#fff",
                  color: "#414651",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Back
              </button>
            )}
            <button
              onClick={currentStep === 3 ? handleConfirmPlanChange : handleNext}
              disabled={!canProceed || (currentStep === 3 && isSubmitting)}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: "none",
                background: canProceed && !(currentStep === 3 && isSubmitting) ? "#181D27" : "#D5D7DA",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: canProceed && !(currentStep === 3 && isSubmitting) ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {currentStep === 3 && isSubmitting && (
                <i className="la la-spinner la-spin" style={{ fontSize: 14 }} />
              )}
              {currentStep === 3 ? (isSubmitting ? "Processing..." : "Confirm plan change") : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
