"use client";

import React from "react";
import JobPostUsageBar from "./JobPostUsageBar";

interface JobPostUsageSummaryProps {
  premiumUsed: number;
  premiumMax: number | null; // null = unlimited
  creditBasedUsed: number;
  creditBasedMax: number | null; // null = unlimited
  hasPremiumPlan: boolean;
  hasCreditBasedPlan: boolean;
}

/**
 * Container showing job post usage progress bars for Premium and Credit-based plans.
 * Only shows progress bars for plan types the org has subscribed to.
 */
export default function JobPostUsageSummary({
  premiumUsed,
  premiumMax,
  creditBasedUsed,
  creditBasedMax,
  hasPremiumPlan,
  hasCreditBasedPlan,
}: JobPostUsageSummaryProps) {
  const showPremium = hasPremiumPlan && premiumMax !== null;
  const showCreditBased = hasCreditBasedPlan && creditBasedMax !== null;

  // Don't render if nothing to show
  if (!showPremium && !showCreditBased) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 16,
        padding: "0 20px 6px 20px",
      }}
    >
      {hasPremiumPlan && (
        <JobPostUsageBar
          label="Premium job posts"
          used={premiumUsed}
          max={premiumMax}
          color="#3538CD"
          tooltipText="Unlimited AI interviews per job post"
        />
      )}
      {hasCreditBasedPlan && (
        <JobPostUsageBar
          label="Credit-based job posts"
          used={creditBasedUsed}
          max={creditBasedMax}
          color="#B93815"
          tooltipText="10 credits consumed per AI interview"
        />
      )}
    </div>
  );
}

