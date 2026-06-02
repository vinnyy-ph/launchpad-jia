"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/utils/apiClient";
import LimitBanner from "./LimitBanner";

interface JobPostLimitState {
  used: number;
  max: number | null; // null = unlimited
  isOverLimit: boolean;
  isUnlimited: boolean;
  isLoading: boolean;
  error: string | null;
  // Per-plan tracking for plan-specific messages
  premiumUsed?: number;
  premiumMax?: number | null;
  creditBasedUsed?: number;
  creditBasedMax?: number | null;
  isPremiumOverLimit?: boolean;
  isCreditBasedOverLimit?: boolean;
}

// Local implementation to avoid dependency on useJobPostLimit hook
function getActiveOrgId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const activeOrgStr = localStorage.getItem("activeOrg");
    if (activeOrgStr) {
      const activeOrg = JSON.parse(activeOrgStr);
      return activeOrg?._id || null;
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}

function calculateJobPostLimits(organization: any, assignedPlans: any) {
  const creditBasedPlan = assignedPlans?.creditBased;
  const premiumPlan = assignedPlans?.premium;

  // Calculate effective limits with adjustments
  const creditBasedBaseLimit = creditBasedPlan?.maxActiveJobPosts || 0;
  const creditBasedAdjustment = organization.creditBasedJobSlotAdjustment || 0;
  const effectiveCreditBasedLimit = creditBasedBaseLimit + creditBasedAdjustment;

  const premiumBaseLimit = premiumPlan?.maxActiveJobPosts || 0;
  const premiumAdjustment = organization.premiumJobSlotAdjustment || 0;
  const effectivePremiumLimit = premiumBaseLimit + premiumAdjustment;

  // Sum both plan limits for total
  const totalLimit = effectiveCreditBasedLimit + effectivePremiumLimit;

  return {
    creditBased: {
      base: creditBasedBaseLimit,
      adjustment: creditBasedAdjustment,
      effective: effectiveCreditBasedLimit,
      isUnlimited: creditBasedPlan?.maxActiveJobPosts === null,
    },
    premium: {
      base: premiumBaseLimit,
      adjustment: premiumAdjustment,
      effective: effectivePremiumLimit,
      isUnlimited: premiumPlan?.maxActiveJobPosts === null,
    },
    total: {
      limit: totalLimit,
      isUnlimited: (creditBasedPlan?.maxActiveJobPosts === null && premiumPlan?.maxActiveJobPosts === null) ||
        (creditBasedPlan?.maxActiveJobPosts === null && !premiumPlan) ||
        (premiumPlan?.maxActiveJobPosts === null && !creditBasedPlan),
    },
  };
}

function getJobPostLimitStatus(organization: any, assignedPlans: any, usedCount: number) {
  const limits = calculateJobPostLimits(organization, assignedPlans);
  const totalLimit = limits.total;

  return {
    used: usedCount,
    limit: totalLimit.limit,
    isUnlimited: totalLimit.isUnlimited,
    isOverLimit: !totalLimit.isUnlimited && usedCount >= totalLimit.limit,
    percentage: totalLimit.limit > 0 ? Math.round((usedCount / totalLimit.limit) * 100) : 0,
  };
}

function useJobPostLimitLocal() {
  const [state, setState] = useState<JobPostLimitState>({
    used: 0,
    max: 0,
    isOverLimit: false,
    isUnlimited: false,
    isLoading: true,
    error: null,
  });
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  // Monitor localStorage for activeOrg changes
  useEffect(() => {
    setActiveOrgId(getActiveOrgId());

    // Poll for localStorage changes
    const interval = setInterval(() => {
      const currentOrgId = getActiveOrgId();
      setActiveOrgId((prev) => {
        if (prev !== currentOrgId) {
          return currentOrgId;
        }
        return prev;
      });
    }, 2000);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "activeOrg") {
        setActiveOrgId(getActiveOrgId());
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const fetchJobPostUsage = useCallback(async (orgId: string | null) => {
    if (!orgId) {
      return;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await api.get("/api/pricing-plan/get-job-post-usage", {
        params: { orgID: orgId },
      });

      // Parse the API response correctly
      // API returns: { premium: { used, max }, creditBased: { used, max }, noPlan, availableTypes }
      const { premium, creditBased } = response.data;

      const premiumUsed = premium?.used || 0;
      const creditBasedUsed = creditBased?.used || 0;
      const totalUsed = premiumUsed + creditBasedUsed;

      const premiumMax = premium?.max; // null = unlimited
      const creditBasedMax = creditBased?.max; // null = unlimited

      // Check per-plan over limit status (> not >=, only when exceeding)
      const isPremiumOverLimit = premiumMax !== null && premiumMax !== undefined && premiumMax > 0 && premiumUsed > premiumMax;
      const isCreditBasedOverLimit = creditBasedMax !== null && creditBasedMax !== undefined && creditBasedMax > 0 && creditBasedUsed > creditBasedMax;

      // Calculate total limit - null means unlimited
      let totalMax: number | null = 0;
      const premiumIsUnlimited = premiumMax === null && (premium !== undefined);
      const creditBasedIsUnlimited = creditBasedMax === null && (creditBased !== undefined);

      if (premiumIsUnlimited || creditBasedIsUnlimited) {
        totalMax = null; // Unlimited if any plan is unlimited
      } else {
        totalMax = (premiumMax || 0) + (creditBasedMax || 0);
      }

      const isUnlimited = totalMax === null;
      // Only show as over limit when EXCEEDING the limit (> not >=)
      const isOverLimit = isPremiumOverLimit || isCreditBasedOverLimit;

      setState({
        used: totalUsed,
        max: totalMax,
        isOverLimit,
        isUnlimited,
        isLoading: false,
        error: null,
        // Store per-plan details for message generation
        premiumUsed,
        premiumMax,
        creditBasedUsed,
        creditBasedMax,
        isPremiumOverLimit,
        isCreditBasedOverLimit,
      });
    } catch (error) {
      console.error("Error fetching job post usage:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to fetch job post usage",
      }));
    }
  }, []);

  useEffect(() => {
    if (activeOrgId) {
      fetchJobPostUsage(activeOrgId);
    }
  }, [activeOrgId, fetchJobPostUsage]);

  return {
    ...state,
    refetch: () => fetchJobPostUsage(activeOrgId),
  };
}

/**
 * Banner component that displays when job post limit is exceeded.
 * Should be placed on the Careers page.
 * Shows plan-specific messages (credit-based, premium, or both).
 */
export default function JobPostLimitBanner() {
  const state = useJobPostLimitLocal();
  const { isOverLimit, isUnlimited, isLoading, error, isPremiumOverLimit, isCreditBasedOverLimit, premiumUsed, premiumMax, creditBasedUsed, creditBasedMax, max } = state as any;

  // Don't show banner if:
  // - Loading or error
  // - Not over limit
  // - Unlimited plan (max is null)
  // - No max limit set
  if (isLoading || error || !isOverLimit || isUnlimited || max === null || max === 0) {
    return null;
  }

  // Generate plan-specific message
  let message = "";

  if (isPremiumOverLimit && isCreditBasedOverLimit) {
    // Both plans are over limit
    message = `You're over the job post limit for both your premium plan (${premiumUsed}/${premiumMax}) and credit-based plan (${creditBasedUsed}/${creditBasedMax}). You can continue hiring on existing careers, but you can't create or publish new or inactive careers.`;
  } else if (isPremiumOverLimit) {
    // Only premium is over limit
    message = `You're over the job post limit for your premium plan (${premiumUsed}/${premiumMax}). You can continue hiring on existing careers, but you can't create or publish new premium careers.`;
  } else if (isCreditBasedOverLimit) {
    // Only credit-based is over limit
    message = `You're over the job post limit for your credit-based plan (${creditBasedUsed}/${creditBasedMax}). You can continue hiring on existing careers, but you can't create or publish new credit-based careers.`;
  }

  if (!message) {
    return null;
  }

  return (
    <LimitBanner
      message={message}
      variant="warning"
    />
  );
}

