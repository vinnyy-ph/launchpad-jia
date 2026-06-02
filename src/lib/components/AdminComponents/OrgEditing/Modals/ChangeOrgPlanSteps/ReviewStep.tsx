"use client";

import PricingPlanBadge from "../../../PricingPlans/PricingPlanBadge";
import type { CurrentPlanDisplay, PlanOption } from "./types";

interface ReviewStepProps {
  currentPlan: CurrentPlanDisplay;
  selectedPlan: PlanOption | undefined;
  endDate: string;
  startDate: string;
  newEndDate: string;
  creditsRemaining: number;
  formatCurrency: (amount: number) => string;
  formatDateForUi: (date: string) => string;
  isEndDateInPast: (date: string) => boolean;
  additionalJobPostCost?: number;
}

export default function ReviewStep({
  currentPlan,
  selectedPlan,
  endDate,
  startDate,
  newEndDate,
  creditsRemaining,
  formatCurrency,
  formatDateForUi,
  isEndDateInPast,
  additionalJobPostCost = 0,
}: ReviewStepProps) {
  const endDateInPast = isEndDateInPast(endDate);

  // Check if end date is today or in the past
  const isEndDateTodayOrPast = (dateString: string): boolean => {
    if (!dateString) return false;
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return false;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const dateNormalized = new Date(date);
    dateNormalized.setHours(0, 0, 0, 0);
    return dateNormalized <= todayStart;
  };

  const endDateTodayOrPast = isEndDateTodayOrPast(endDate);

  return (
    <div>
      {currentPlan.schema === "credit-based" && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              border: "1px solid #E9EAEB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              flex: "0 0 auto",
              marginTop: 2,
            }}
          >
            <i className="la la-info" style={{ color: "#717680", fontSize: 12 }} />
          </div>
          <div style={{ fontSize: 14, color: "#717680", lineHeight: "20px" }}>
            <span style={{ fontWeight: 700, color: "#181D27" }}>{creditsRemaining.toLocaleString()}</span>{" "}
            {selectedPlan?.schema === "credit-based"
              ? "remaining credits will be rolled over for this organization."
              : "remaining credits will be frozen. They will become usable again if the organization switches back to a credit-based plan."
            }
            {selectedPlan?.schema === "credit-based" && (
              <span style={{ color: "#717680" }}>
                {" "}Existing credit balance will be retained; only future monthly replenishments will follow the new plan.
              </span>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Previous Plan Card */}
        <div
          style={{
            border: "1px solid #E9EAEB",
            borderRadius: 12,
            padding: 20,
            background: "#fff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 14, color: "#717680" }}>Previous plan:</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: "#181D27" }}>{currentPlan.name}</span>
            <PricingPlanBadge schema={currentPlan.schema} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: "#717680", marginBottom: 6 }}>Start Date</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>{currentPlan.startedOn || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#717680", marginBottom: 6 }}>End Date</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>{formatDateForUi(endDate)}</span>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "#FEF3F2",
                    color: "#B42318",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {endDateTodayOrPast ? "Ended" : "Expiring"}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: "#717680", marginBottom: 6 }}>Cost / month</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>{formatCurrency(currentPlan.costPerMonth)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#717680", marginBottom: 6 }}>
                {currentPlan.schema === "credit-based" ? "New Credits / month" : "Additional Job Post cost"}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                {currentPlan.schema === "credit-based"
                  ? `${currentPlan.creditsPerMonth?.toLocaleString() || 0} Credits`
                  : formatCurrency(additionalJobPostCost)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#717680", marginBottom: 6 }}>
                {currentPlan.schema === "credit-based"
                  ? "Maximum Active Credit-based Job Posts"
                  : "Maximum Active Premium Job Posts"}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                {currentPlan.maxActiveJobPosts === null
                  ? "Unlimited"
                  : `${currentPlan.maxActiveJobPosts} ${currentPlan.schema === "credit-based" ? "Credit-based" : "Premium"} Job Posts`}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#717680", marginBottom: 6 }}>Maximum Admin Seats</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                {currentPlan.maxAdminSeats === null ? "Unlimited" : `${currentPlan.maxAdminSeats} Admin Seats`}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#717680", marginBottom: 6 }}>Maximum Guest or HM Seats</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                {currentPlan.maxGuestHMSeats === null ? "Unlimited" : currentPlan.maxGuestHMSeats}
              </div>
            </div>
          </div>
        </div>

        {/* New Plan Card */}
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
                <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>{formatDateForUi(startDate)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#717680", marginBottom: 6 }}>End Date</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>{formatDateForUi(newEndDate)}</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: "#717680", marginBottom: 6 }}>Cost / month</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>{formatCurrency(selectedPlan.costPerMonth)}</div>
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
                  {selectedPlan.schema === "credit-based"
                    ? "Maximum Active Credit-based Job Posts"
                    : "Maximum Active Premium Job Posts"}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                  {selectedPlan.maxActiveJobPosts === null
                    ? "Unlimited"
                    : `${selectedPlan.maxActiveJobPosts} ${selectedPlan.schema === "credit-based" ? "Credit-based" : "Premium"} Job Posts`}
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
    </div>
  );
}
