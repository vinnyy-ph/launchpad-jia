"use client";

import { useEffect, useMemo, useState } from "react";
import PricingPlanBadge from "../../PricingPlans/PricingPlanBadge";
import { api } from "@/lib/utils/apiClient";
import { candidateActionToast, errorToast } from "@/lib/Utils";
import SingleDatePicker from "@/lib/components/Dropdown/SingleDatePicker";

interface EditOrgPlanScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  currentPlan: {
    id: string;
    name: string;
    schema: "credit-based" | "premium";
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    costPerMonth: number;
    creditsPerMonth?: number;
    maxActiveJobPosts: number;
    maxAdminSeats: number;
    maxGuestHMSeats: number | null;
  } | null;
  onSuccess?: () => void;
}

function formatForInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function EditOrgPlanScheduleModal({
  isOpen,
  onClose,
  orgId,
  currentPlan,
  onSuccess,
}: EditOrgPlanScheduleModalProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const planForDisplay = useMemo(() => {
    if (!currentPlan) return null;

    const startedOn = currentPlan.startDate
      ? new Date(currentPlan.startDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      : "";

    const endsOn = currentPlan.endDate
      ? new Date(currentPlan.endDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      : "";

    return {
      ...currentPlan,
      startedOn,
      endsOn,
    };
  }, [currentPlan]);

  useEffect(() => {
    if (!isOpen || !currentPlan) return;
    setStartDate(formatForInput(currentPlan.startDate ?? null));
    setEndDate(formatForInput(currentPlan.endDate ?? null));
  }, [isOpen, currentPlan]);

  if (!isOpen) return null;

  // Validate date logic
  const getDateValidationError = (): string | null => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const normalizedStart = new Date(start);
      normalizedStart.setHours(0, 0, 0, 0);
      const normalizedEnd = new Date(end);
      normalizedEnd.setHours(0, 0, 0, 0);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Basic: end date must be after start date
      if (normalizedEnd <= normalizedStart) {
        return "End date must be after the start date";
      }

      // Additional validation: prevent dates too far in the future (more than 5 years)
      const fiveYearsFromNow = new Date(todayStart);
      fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);

      if (normalizedStart > fiveYearsFromNow) {
        return "Start date cannot be more than 5 years in the future";
      }

      if (normalizedEnd > fiveYearsFromNow) {
        return "End date cannot be more than 5 years in the future";
      }

      // Additional validation: prevent very long plan durations (more than 3 years)
      const maxDuration = 3 * 365 * 24 * 60 * 60 * 1000; // 3 years in milliseconds
      if (normalizedEnd.getTime() - normalizedStart.getTime() > maxDuration) {
        return "Plan duration cannot exceed 3 years";
      }
    }
    return null;
  };

  const dateValidationError = getDateValidationError();
  const canSave = !!(startDate && endDate && !dateValidationError);

  const handleSave = async () => {
    if (!orgId || !canSave) return;

    try {
      setIsSubmitting(true);
      await api.put("/api/pricing-plan/admin/update-org-plan-schedule", {
        orgId,
        startDate,
        endDate,
        schemaType: currentPlan?.schema,
      });

      candidateActionToast(
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>Plan schedule updated.</span>
            <span style={{ fontSize: 14, color: "#717680", fontWeight: 500 }}>
              The schedule for this plan has been updated.
            </span>
          </div>
        </div>,
        4000,
        <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }} />
      );

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Error updating plan schedule:", error);
      // Extract error message from API response
      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to update plan schedule";
      errorToast(errorMessage, 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 840,
          maxHeight: "90vh",
          background: "#F9FAFB",
          borderRadius: 16,
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>Edit plan schedule</h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 4,
              marginLeft: 8,
            }}
          >
            <i className="la la-times" style={{ fontSize: 20, color: "#6B7280" }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto" }}>
          {planForDisplay && (
            <div
              style={{
                borderRadius: 16,
                border: "1px solid #E9EAEB",
                background: "#FFFFFF",
                padding: 20,
                marginBottom: 24,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#181D27" }}>{planForDisplay.name}</div>
                  <PricingPlanBadge schema={planForDisplay.schema} />
                  {planForDisplay.startedOn && (
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>
                      Started on {planForDisplay.startedOn}
                    </span>
                  )}
                  {planForDisplay.endsOn && (
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>
                      Ends on {planForDisplay.endsOn}
                    </span>
                  )}
                </div>
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
                  Current
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 24,
                  fontSize: 13,
                  color: "#4B5563",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 2 }}>Plan Schema</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                      {planForDisplay.schema === "credit-based" ? "Credit-based" : "Premium"}
                    </div>
                  </div>
                  {planForDisplay.schema === "credit-based" && (
                    <div>
                      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 2 }}>New credits / month</div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                        {planForDisplay.creditsPerMonth || 0} Credits
                      </div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 2 }}>Maximum Admin Seats</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                      {planForDisplay.maxAdminSeats} Admin Seats
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 2 }}>Cost / month</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                      ₱ {planForDisplay.costPerMonth.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 2 }}>
                      Maximum active {planForDisplay.schema === "credit-based" ? "credit-based" : "premium"} job posts
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                      {planForDisplay.maxActiveJobPosts} {planForDisplay.schema === "credit-based" ? "Credit-based Job Posts" : "Premium Job Posts"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 2 }}>Maximum Guest or HM Seats</div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>
                      {planForDisplay.maxGuestHMSeats === null ? "Unlimited" : planForDisplay.maxGuestHMSeats}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Set new schedule */}
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 600, color: "#181D27", marginBottom: 16 }}>
              Set new schedule for this plan
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
                  disabled
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
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const currentDate = new Date(date);
                    currentDate.setHours(0, 0, 0, 0);
                    // If no start date, only check absolute future limit
                    if (!startDate) {
                      const fiveYearsFromNow = new Date(todayStart);
                      fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
                      return currentDate > fiveYearsFromNow;
                    }
                    const startNormalized = new Date(startDate);
                    startNormalized.setHours(0, 0, 0, 0);
                    // Cannot be on or before start date
                    if (currentDate <= startNormalized) return true;
                    // Cannot be more than 3 years from start date
                    const maxDurationEnd = new Date(startNormalized);
                    maxDurationEnd.setFullYear(maxDurationEnd.getFullYear() + 3);
                    if (currentDate > maxDurationEnd) return true;
                    // Cannot be more than 5 years from today
                    const fiveYearsFromNow = new Date(todayStart);
                    fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
                    if (currentDate > fiveYearsFromNow) return true;
                    return false;
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px 16px",
            borderTop: "1px solid #E5E7EB",
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              border: "1px solid #D0D5DD",
              background: "#FFFFFF",
              color: "#344054",
              fontSize: 14,
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || isSubmitting}
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              border: "none",
              background: !canSave || isSubmitting ? "#E5E7EB" : "#181D27",
              color: !canSave || isSubmitting ? "#9CA3AF" : "#FFFFFF",
              fontSize: 14,
              fontWeight: 700,
              cursor: !canSave || isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
