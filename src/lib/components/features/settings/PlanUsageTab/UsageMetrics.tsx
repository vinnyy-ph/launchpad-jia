"use client";

import { CREDIT_THRESHOLDS } from "@/lib/utils/constants";

interface UsageMetricsProps {
  creditsRemaining: number;
  creditsUsed: number;
  creditsTotal: number; // Represents the monthly allocation (e.g., 400), not the total available balance if it includes rollover/adjustments
  activeJobPosts: number;
  maxJobPosts: number;
  adminSeatsUsed: number;
  maxAdminSeats: number;
  nextRenewalDate?: string;
  isLowCredit?: boolean;
  isInsufficient?: boolean;
}

export default function UsageMetrics({
  creditsRemaining,
  creditsUsed,
  creditsTotal,
  activeJobPosts,
  maxJobPosts,
  adminSeatsUsed,
  maxAdminSeats,
  nextRenewalDate,
  isLowCredit,
  isInsufficient,
}: UsageMetricsProps) {
  const gradient =
    "linear-gradient(90deg, rgba(159, 202, 237, 0.5) 0%, rgba(206, 182, 218, 0.5) 34%, rgba(235, 172, 201, 0.5) 67%, rgba(252, 206, 192, 0.5) 100%)";

  // Determine credit warning state
  const showWarning = isLowCredit ?? creditsRemaining <= CREDIT_THRESHOLDS.LOW_BALANCE;
  const isCritical = isInsufficient ?? creditsRemaining < CREDIT_THRESHOLDS.INSUFFICIENT;

  // Warning colors
  const warningColor = isCritical ? "#B42318" : "#B54708";
  const creditsColor = showWarning ? warningColor : "#181D27";

  const UsageBar = ({ value, max }: { value: number; max: number }) => {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return (
      <div style={{ width: "100%", height: 8, background: "#E9EAEB", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: gradient }} />
      </div>
    );
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div style={{ width: 460, maxWidth: "100%" }}>
      {/* Available Credits Header */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {showWarning && (
            <i
              className="la la-exclamation-triangle"
              style={{
                fontSize: 24,
                color: warningColor,
              }}
            />
          )}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: creditsColor, lineHeight: "52px" }}>
              {creditsRemaining}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#717680" }}>available credits</div>
          </div>
        </div>
      </div>

      {/* Usage Bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Credits Used */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#414651", display: "flex", alignItems: "center", gap: 6 }}>
              {creditsUsed} of {creditsTotal} credits used this month
              <i className="la la-question-circle" style={{ color: "#717680" }} />
            </div>
            {nextRenewalDate && (
              <div style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>
                Refreshes on {formatDate(nextRenewalDate)}
              </div>
            )}
          </div>
          <div style={{ marginTop: 8 }}>
            <UsageBar value={creditsUsed} max={creditsTotal || 1} />
          </div>
        </div>

        {/* Active Job Posts */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#414651" }}>
            {activeJobPosts} of {maxJobPosts} maximum active credit-based job posts
          </div>
          <div style={{ marginTop: 8 }}>
            <UsageBar value={activeJobPosts} max={maxJobPosts || 1} />
          </div>
        </div>

        {/* Admin Seats */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#414651" }}>
            {adminSeatsUsed} of {maxAdminSeats} admin seats used
          </div>
          <div style={{ marginTop: 8 }}>
            <UsageBar value={adminSeatsUsed} max={maxAdminSeats || 1} />
          </div>
        </div>
      </div>
    </div>
  );
}

