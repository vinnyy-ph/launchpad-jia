"use client";

import { useEffect, useState } from "react";
import PricingPlanBadge from "../../PricingPlans/PricingPlanBadge";
import { candidateActionToast, errorToast } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient";
import type { PricingPlan } from "@/lib/types/pricing";
import SingleDatePicker from "@/lib/components/Dropdown/SingleDatePicker";

interface AddOrgPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  orgName?: string;
  currentCredits?: number;
  existingPlanTypes?: string[];
  onSuccess?: () => void;
}

interface PlanOption {
  id: string;
  name: string;
  schema: "credit-based" | "premium";
  costPerMonth: number;
  costPerYear?: number;
  creditsPerMonth?: number;
  maxActiveJobPosts: number | null; // null = unlimited
  maxAdminSeats: number | null; // null = unlimited
  maxGuestHMSeats: number | null; // null = unlimited
  additionalJobPostCost?: number;
}

const STEPS = [
  { id: 0, label: "Select new plan" },
  { id: 1, label: "Set schedule" },
  { id: 2, label: "Review" },
];

export default function AddOrgPlanModal({
  isOpen,
  onClose,
  orgId,
  orgName,
  currentCredits = 0,
  existingPlanTypes = [],
  onSuccess,
}: AddOrgPlanModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [availablePlans, setAvailablePlans] = useState<PlanOption[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const gradient =
    "linear-gradient(90deg, #9fcaed 0%, #ceb6da 33%, #ebacc9 66%, #fccec0 100%)";

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setSelectedPlanId(null);
      setStartDate("");
      setEndDate("");
      return;
    }

    let isCancelled = false;

    const fetchPlans = async () => {
      try {
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
            costPerYear: p.costPerYear,
            creditsPerMonth: p.creditsPerMonth,
            maxActiveJobPosts: p.maxActiveJobPosts ?? null, // null = unlimited
            maxAdminSeats: p.maxAdminSeats ?? null, // null = unlimited
            maxGuestHMSeats: p.maxGuestHMSeats ?? null, // null = unlimited
            additionalJobPostCost: p.additionalJobPostCost,
          }));

        if (!isCancelled) {
          setAvailablePlans(plans);
        }
      } catch (e) {
        console.error("Error fetching pricing plans:", e);
        if (!isCancelled) {
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

  const selectedPlan = availablePlans.find((p) => p.id === selectedPlanId);

  const formatCurrency = (amount: number) =>
    `₱ ${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDateForDisplay = (value: string) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return selectedPlanId !== null;
      case 1:
        return startDate && endDate;
      case 2:
        return true;
      default:
        return false;
    }
  };

  const hasStepProgress = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return selectedPlanId !== null;
      case 1:
        return startDate !== "" || endDate !== "";
      case 2:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConfirm = async () => {
    if (!selectedPlanId || !startDate || !endDate) return;

    try {
      setIsSubmitting(true);
      await api.post("/api/pricing-plan/admin/assign-org-plan", {
        orgId,
        planId: selectedPlanId,
        startDate,
        endDate,
      });

      candidateActionToast(
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>Organization plan updated.</span>
            <span style={{ fontSize: 14, color: "#717680", fontWeight: 500 }}>
              The {selectedPlan?.name} plan is now applied to this organization.
            </span>
          </div>
        </div>,
        4000,
        <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }} />
      );

      onSuccess?.();
      onClose();
    } catch (e) {
      console.error("Error assigning plan:", e);
      errorToast("Failed to assign plan", 2000);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const StepIndicator = () => (
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
                      width: isCompleted ? "100%" : (isCurrent && hasStepProgress(index)) ? "50%" : "0%",
                      height: "100%",
                      background: isCompleted || (isCurrent && hasStepProgress(index)) ? gradient : "#E9EAEB",
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
                color: index > currentStep ? "#717680" : "#181D27",
              }}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );

  const PlanCard = ({
    plan,
    isSelected,
    isDisabled,
    onSelect,
  }: {
    plan: PlanOption;
    isSelected?: boolean;
    isDisabled?: boolean;
    onSelect?: () => void;
  }) => (
    <div
      onClick={isDisabled ? undefined : onSelect}
      style={{
        border: `1px solid ${isSelected ? "#181D27" : "#E9EAEB"}`,
        borderRadius: 12,
        padding: 20,
        background: isDisabled ? "#F8F9FC" : "#fff",
        cursor: isDisabled ? "not-allowed" : onSelect ? "pointer" : "default",
        marginBottom: 16,
        opacity: isDisabled ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {onSelect && (
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: `2px solid ${isDisabled ? "#E9EAEB" : isSelected ? "#181D27" : "#D5D7DA"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isDisabled ? "#E9EAEB" : "#fff",
              }}
            >
              {isSelected && !isDisabled && (
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#181D27",
                  }}
                />
              )}
            </div>
          )}
          <span style={{ fontSize: 16, fontWeight: 600, color: isDisabled ? "#717680" : "#181D27" }}>{plan.name}</span>
          <PricingPlanBadge schema={plan.schema} />
          {isDisabled && (
            <span style={{ fontSize: 12, color: "#717680", fontStyle: "italic" }}>
              (Already assigned)
            </span>
          )}
        </div>
        {isSelected && (
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              background: "#ECFDF3",
              color: "#027A48",
              fontSize: 12,
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#12B76A" }} />
            Selected
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: "#717680", marginBottom: 4 }}>Plan Schema</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
            {plan.schema === "credit-based" ? "Credit-based" : "Premium"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: "#717680", marginBottom: 4 }}>Cost</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
            {formatCurrency(plan.costPerMonth)} / month
            {plan.costPerYear && ` or ${formatCurrency(plan.costPerYear)} / year`}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: "#717680", marginBottom: 4 }}>
            {plan.schema === "credit-based" ? "New Credits / month" : "Additional Job Post cost"}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
            {plan.schema === "credit-based"
              ? `${plan.creditsPerMonth?.toLocaleString() || 0} Credits`
              : formatCurrency(plan.additionalJobPostCost || 0)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: "#717680", marginBottom: 4 }}>
            Maximum Active {plan.schema === "credit-based" ? "Credit-based" : "Premium"} Job Posts
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
            {plan.maxActiveJobPosts === null ? "Unlimited" : `${plan.maxActiveJobPosts} ${plan.schema === "premium" ? "Premium " : ""}Job Posts`}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: "#717680", marginBottom: 4 }}>Maximum Admin Seats</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
            {plan.maxAdminSeats === null ? "Unlimited" : `${plan.maxAdminSeats} Admin Seats`}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: "#717680", marginBottom: 4 }}>Maximum Guest or HM Seats</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
            {plan.maxGuestHMSeats === null ? "Unlimited" : plan.maxGuestHMSeats}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div>
            {isLoadingPlans ? (
              <div style={{ padding: "12px 0", fontSize: 14, color: "#717680", fontWeight: 600 }}>Loading plans…</div>
            ) : availablePlans.length === 0 ? (
              <div style={{ padding: "12px 0", fontSize: 14, color: "#717680", fontWeight: 600 }}>
                No plans available.
              </div>
            ) : (
              availablePlans.map((plan) => {
                const isDisabled = existingPlanTypes.includes(plan.schema);
                return (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    isSelected={selectedPlanId === plan.id}
                    isDisabled={isDisabled}
                    onSelect={() => !isDisabled && setSelectedPlanId(plan.id)}
                  />
                );
              })
            )}
            {selectedPlan && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <i className="la la-check-circle" style={{ color: "#12B76A", fontSize: 18 }} />
                <span style={{ fontSize: 14, color: "#181D27" }}>
                  {selectedPlan.name} ({selectedPlan.schema === "premium" ? "Premium" : "Credit-based"}) plan selected.
                </span>
              </div>
            )}
          </div>
        );

      case 1:
        return (
          <div>
            {selectedPlan && <PlanCard plan={selectedPlan} isSelected />}



            <div style={{ marginTop: 24 }}>
              <h4 style={{ fontSize: 16, fontWeight: 600, color: "#181D27", marginBottom: 16 }}>
                Set schedule for this plan
              </h4>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginBottom: 6, display: "block" }}>
                    Start date
                  </label>
                  <SingleDatePicker
                    value={startDate}
                    onChange={(val) => setStartDate(val)}
                    placeholder="Select start date"
                    placement="top"
                    disabledDate={(date: Date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const currentDate = new Date(date);
                      currentDate.setHours(0, 0, 0, 0);
                      // Cannot be before today
                      if (currentDate < today) return true;
                      // Cannot be more than 5 years in the future
                      const fiveYearsFromNow = new Date(today);
                      fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
                      if (currentDate > fiveYearsFromNow) return true;
                      return false;
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 14, fontWeight: 500, color: "#414651", marginBottom: 6, display: "block" }}>
                    End date
                  </label>
                  <SingleDatePicker
                    value={endDate}
                    onChange={(val) => setEndDate(val)}
                    placeholder="Select end date"
                    placement="top"
                    disabledDate={(date: Date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const currentDate = new Date(date);
                      currentDate.setHours(0, 0, 0, 0);
                      // If no start date, only check absolute future limit
                      if (!startDate) {
                        const fiveYearsFromNow = new Date(today);
                        fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
                        return currentDate > fiveYearsFromNow;
                      }
                      const start = new Date(startDate);
                      start.setHours(0, 0, 0, 0);
                      // Cannot be on or before start date
                      if (currentDate <= start) return true;
                      // Cannot be more than 3 years from start date
                      const maxDurationEnd = new Date(start);
                      maxDurationEnd.setFullYear(maxDurationEnd.getFullYear() + 3);
                      if (currentDate > maxDurationEnd) return true;
                      // Cannot be more than 5 years from today
                      const fiveYearsFromNow = new Date(today);
                      fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
                      if (currentDate > fiveYearsFromNow) return true;
                      return false;
                    }}
                  />
                </div>
              </div>
            </div>

            {startDate && endDate ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
                <i className="la la-check-circle" style={{ color: "#12B76A", fontSize: 18 }} />
                <span style={{ fontSize: 14, color: "#181D27" }}>
                  Selected plan will start on {formatDateForDisplay(startDate)} and end on {formatDateForDisplay(endDate)}.
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
                <i className="la la-exclamation-triangle" style={{ color: "#F04438", fontSize: 18 }} />
                <span style={{ fontSize: 14, color: "#717680" }}>
                  Enter an end date to proceed.
                </span>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div>


            {selectedPlan && (
              <div
                style={{
                  border: "1px solid #E9EAEB",
                  borderRadius: 12,
                  padding: 20,
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 14, color: "#717680" }}>New Plan:</span>
                  <span style={{ fontSize: 16, fontWeight: 600, color: "#181D27" }}>{selectedPlan.name}</span>
                  <PricingPlanBadge schema={selectedPlan.schema} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#717680", marginBottom: 6 }}>Start Date</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>{formatDateForDisplay(startDate)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#717680", marginBottom: 6 }}>End Date</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>{formatDateForDisplay(endDate)}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#717680", marginBottom: 6 }}>Plan Schema</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                      {selectedPlan.schema === "credit-based" ? "Credit-based" : "Premium"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#717680", marginBottom: 6 }}>Cost</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                      {formatCurrency(selectedPlan.costPerMonth)} / month
                      {selectedPlan.costPerYear && ` or ${formatCurrency(selectedPlan.costPerYear)} / year`}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#717680", marginBottom: 6 }}>
                      {selectedPlan.schema === "credit-based" ? "New Credits / month" : "Additional Job Post cost"}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                      {selectedPlan.schema === "credit-based"
                        ? `${selectedPlan.creditsPerMonth?.toLocaleString() || 0} Credits`
                        : formatCurrency(selectedPlan.additionalJobPostCost || 0)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#717680", marginBottom: 6 }}>
                      Maximum Active {selectedPlan.schema === "credit-based" ? "Credit-based" : "Premium"} Job Posts
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                      {selectedPlan.maxActiveJobPosts === null ? "Unlimited" : `${selectedPlan.maxActiveJobPosts} ${selectedPlan.schema === "premium" ? "Premium " : ""}Job Posts`}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#717680", marginBottom: 6 }}>Maximum Admin Seats</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                      {selectedPlan.maxAdminSeats === null ? "Unlimited" : `${selectedPlan.maxAdminSeats} Admin Seats`}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#717680", marginBottom: 6 }}>Maximum Guest or HM Seats</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                      {selectedPlan.maxGuestHMSeats === null ? "Unlimited" : selectedPlan.maxGuestHMSeats}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: 16,
          width: "100%",
          maxWidth: 1000,
          maxHeight: "90vh",
          overflow: "auto",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
            Add a plan
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

        <div style={{ padding: 24 }}>
          <StepIndicator />
          {renderStepContent()}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            padding: "16px 24px",
            borderTop: "1px solid #E9EAEB",
          }}
        >
          {currentStep > 0 && (
            <button
              type="button"
              onClick={handleBack}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                border: "1px solid #D5D7DA",
                background: "#fff",
                color: "#181D27",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Back
            </button>
          )}
          {currentStep < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                border: "none",
                background: canProceed() ? "#181D27" : "#E9EAEB",
                color: canProceed() ? "#fff" : "#717680",
                fontSize: 14,
                fontWeight: 700,
                cursor: canProceed() ? "pointer" : "not-allowed",
              }}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                border: "none",
                background: "#181D27",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? "Confirming..." : "Confirm plan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
