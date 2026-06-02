"use client";

import PricingPlanBadge from "../../../PricingPlans/PricingPlanBadge";
import type { PlanOption } from "./types";

interface PlanCardProps {
  plan: PlanOption;
  isSelected?: boolean;
  isCurrent?: boolean;
  isExpiring?: boolean;
  isEnded?: boolean;
  isDisabled?: boolean;
  showRadio?: boolean;
  onSelect?: () => void;
  startedOn?: string;
  endsOn?: string;
  formatCurrency: (amount: number) => string;
}

export default function PlanCard({
  plan,
  isSelected,
  isCurrent,
  isExpiring,
  isEnded,
  isDisabled,
  showRadio = false,
  onSelect,
  startedOn,
  endsOn,
  formatCurrency,
}: PlanCardProps) {
  return (
    <div
      onClick={isDisabled ? undefined : onSelect}
      style={{
        border: `1px solid ${isSelected ? "#181D27" : "#E9EAEB"}`,
        borderRadius: 12,
        padding: 20,
        background: isDisabled ? "#F8F9FC" : "#fff",
        cursor: isDisabled ? "not-allowed" : showRadio ? "pointer" : "default",
        marginBottom: 16,
        opacity: isDisabled ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {showRadio && (
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
          <span style={{ fontSize: 16, fontWeight: 600, color: isDisabled ? "#717680" : "#181D27" }}>
            {plan.name}
          </span>
          <PricingPlanBadge schema={plan.schema} />
          {isDisabled && (
            <span style={{ fontSize: 12, color: "#717680", fontStyle: "italic" }}>
              (Different plan type)
            </span>
          )}
          {startedOn && (
            <span style={{ fontSize: 12, color: "#717680" }}>Started on {startedOn}</span>
          )}
          {endsOn && (
            <span style={{ fontSize: 12, color: "#717680" }}>
              {isEnded ? `Ended on ${endsOn}` : `Ends on ${endsOn}`}
            </span>
          )}
        </div>

        {/* Badge display - only show one badge at a time */}
        {isCurrent && !isExpiring && !isEnded && (
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
        )}
        {isExpiring && (
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              background: "#FEF3F2",
              color: "#B42318",
              fontSize: 12,
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F04438" }} />
            Expiring
          </span>
        )}
        {isEnded && (
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              background: "#FEF3F2",
              color: "#B42318",
              fontSize: 12,
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#F04438" }} />
            Ended
          </span>
        )}
        {isSelected && !isCurrent && !isEnded && !isExpiring && (
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

      {/* Plan Details Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: "#717680", marginBottom: 4 }}>Plan Schema</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
            {plan.schema === "credit-based" ? "Credit-based" : "Premium"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: "#717680", marginBottom: 4 }}>Cost / month</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
            {formatCurrency(plan.costPerMonth)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: "#717680", marginBottom: 4 }}>
            {plan.schema === "credit-based" ? "New Credits / month" : "Additional Job Post cost"}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
            {plan.schema === "credit-based"
              ? `${plan.creditsPerMonth?.toLocaleString()} Credits`
              : formatCurrency(plan.additionalJobPostCost || 0)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, color: "#717680", marginBottom: 4 }}>
            {plan.schema === "credit-based" ? "Maximum Active Credit-based Job Posts" : "Maximum Active Premium Job Posts"}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
            {plan.maxActiveJobPosts === null 
              ? "Unlimited" 
              : `${plan.maxActiveJobPosts} ${plan.schema === "credit-based" ? "Credit-based" : "Premium"} Job Posts`}
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
}
