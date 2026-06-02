"use client";

import { useCreditBalance } from "@/lib/hooks/useCreditBalance";
import { useRecruiterContext } from "@/lib/context/RecruiterContext";
import LimitBanner from "./LimitBanner";

const SALES_EMAIL = "sales@hellojia.ai";
const SALES_SUBJECT = "Request for More Credits";

/**
 * Banner component that displays when credit balance is low (≤50) or insufficient (<10).
 * Only displays for organizations with credit-based plans.
 * Should be placed contextually on Application Timeline and Plan & Usage pages.
 */
export default function LowCreditBanner() {
  const { balance, isLowCredit, isInsufficient, hasActiveCreditBasedPlan, isLoading, error } = useCreditBalance();
  const { activeCareerUsageType } = useRecruiterContext();

  // Don't show banner if:
  // - Loading or error
  // - Organization doesn't have an active credit-based plan
  // - Credits are sufficient
  // - Current career context is "premium" (ignore credits for premium careers)
  if (
    isLoading ||
    error ||
    !hasActiveCreditBasedPlan ||
    (!isLowCredit && !isInsufficient) ||
    activeCareerUsageType === "premium"
  ) {
    return null;
  }

  const message = isInsufficient
    ? `Insufficient credit balance (${balance}). Candidate promotion to the AI Interview stage is disabled until you add more credits.`
    : `Low credit balance (${balance}). Candidate promotion to the AI Interview stage is temporarily disabled. Contact us to purchase more credits.`;

  const mailtoLink = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(SALES_SUBJECT)}`;

  return (
    <LimitBanner
      message={message}
      variant="warning"
    />
  );
}

