"use client";

import PricingPlanBadge from "@/lib/components/AdminComponents/PricingPlans/PricingPlanBadge";

interface PlanSummaryCardProps {
  planName: string;
  schema: "credit-based" | "premium";
  startDate?: string;
  endDate?: string;
  creditsPerMonth?: number;
  maxActiveJobPosts: number | null; // null = unlimited
  maxAdminSeats: number | null; // null = unlimited
  maxGuestHMSeats?: number | null; // null = unlimited
}

export default function PlanSummaryCard({
  planName,
  schema,
  startDate,
  endDate,
  creditsPerMonth,
  maxActiveJobPosts,
  maxAdminSeats,
  maxGuestHMSeats,
}: PlanSummaryCardProps) {
  const formatDate = (date: string | undefined) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const isCreditBased = schema === "credit-based";

  return (
    <div style={{ flex: 1, minWidth: 280 }}>
      {/* Plan Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>{planName}</div>
        <PricingPlanBadge schema={schema} />
        {startDate && (
          <span style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>
            {(() => {
              const start = new Date(startDate);
              // Normalize to local midnight for comparison
              const startMidnight = new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
              const todayStart = new Date();
              todayStart.setHours(0, 0, 0, 0);
              return startMidnight > todayStart ? "Starts on" : "Started on";
            })()} {formatDate(startDate)}
          </span>
        )}
        {endDate && (
          <span style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>
            Ends on {formatDate(endDate)}
          </span>
        )}
      </div>

      {/* Plan Features */}
      <ul style={{ margin: "12px 0 0 18px", padding: 0, color: "#717680", fontSize: 13, lineHeight: "20px" }}>
        {isCreditBased && creditsPerMonth !== undefined && (
          <li>{creditsPerMonth} new credits / month</li>
        )}
        <li>
          {maxActiveJobPosts === null
            ? `Unlimited active ${isCreditBased ? "credit-based" : "premium"} job posts`
            : `Maximum ${maxActiveJobPosts} active ${isCreditBased ? "credit-based" : "premium"} job posts`}
        </li>
        <li>{maxAdminSeats === null ? "Unlimited admin seats" : `${maxAdminSeats} admin seats`}</li>
        <li>{isCreditBased ? "10 credits per AI Interview" : "Unlimited CV & AI Interview analysis"}</li>
        <li>
          {maxGuestHMSeats === null
            ? "Unlimited guests and hiring manager seats"
            : `Maximum ${maxGuestHMSeats} guests and hiring manager seats`}
        </li>
      </ul>

    </div>
  );
}

