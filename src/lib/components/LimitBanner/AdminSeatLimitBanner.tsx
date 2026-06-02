"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/utils/apiClient";
import LimitBanner from "./LimitBanner";

interface AdminSeatLimitState {
  used: number;
  max: number | null; // null = unlimited
  isOverLimit: boolean;
  isUnlimited: boolean;
  isLoading: boolean;
  error: string | null;
}

// Local implementation to avoid dependency on useAdminSeatLimit hook
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

function calculateAdminSeatLimits(organization: any, assignedPlans: any[]) {
  let creditBasedLimit: number | null = 5; // Default
  let premiumLimit: number | null = 5; // Default
  let isUnlimited = false;

  // Check credit-based plan
  const creditBasedPlan = assignedPlans?.find((plan: any) => plan.schema === "credit-based");
  if (creditBasedPlan) {
    creditBasedLimit = creditBasedPlan.maxAdminSeats;
    if (creditBasedLimit === null) isUnlimited = true;
  }

  // Check premium plan
  const premiumPlan = assignedPlans?.find((plan: any) => plan.schema === "premium");
  if (premiumPlan) {
    premiumLimit = premiumPlan.maxAdminSeats;
    if (premiumLimit === null) isUnlimited = true;
  }

  // Calculate combined limit
  let combinedLimit: number | null;
  if (isUnlimited) {
    combinedLimit = null;
  } else if (creditBasedPlan && premiumPlan) {
    combinedLimit = (creditBasedLimit || 0) + (premiumLimit || 0);
  } else if (creditBasedPlan) {
    combinedLimit = creditBasedLimit;
  } else if (premiumPlan) {
    combinedLimit = premiumLimit;
  } else {
    combinedLimit = 5; // Default when no plans
  }

  return {
    creditBased: { limit: creditBasedLimit, isUnlimited: creditBasedLimit === null },
    premium: { limit: premiumLimit, isUnlimited: premiumLimit === null },
    combined: { limit: combinedLimit, isUnlimited },
  };
}

function getAdminSeatLimitStatus(organization: any, assignedPlans: any, adminCount: number) {
  const limits = calculateAdminSeatLimits(organization, assignedPlans);
  const combinedLimit = limits.combined;

  return {
    used: adminCount,
    limit: combinedLimit.limit,
    isUnlimited: combinedLimit.isUnlimited,
    isOverLimit: !combinedLimit.isUnlimited && adminCount > combinedLimit.limit,
    percentage: combinedLimit.limit && combinedLimit.limit > 0 ? Math.round((adminCount / combinedLimit.limit) * 100) : 0,
  };
}

function useAdminSeatLimitLocal() {
  const [state, setState] = useState<AdminSeatLimitState>({
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

  const fetchAdminSeatUsage = useCallback(async (orgId: string | null) => {
    if (!orgId) {
      return;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Fetch plan details which includes admin seat usage
      const response = await api.get("/api/pricing-plan/get-plan-details", {
        params: { orgID: orgId },
      });

      // Use the pre-calculated values from the API
      const { usage } = response.data;
      const adminSeatsUsed = usage?.adminSeatsUsed || 0;
      const maxAdminSeats = usage?.maxAdminSeats; // null = unlimited

      const isUnlimited = maxAdminSeats === null;
      // Only show as over limit when EXCEEDING the limit (> not >=)
      const isOverLimit = !isUnlimited && maxAdminSeats !== null && maxAdminSeats > 0 && adminSeatsUsed > maxAdminSeats;

      setState({
        used: adminSeatsUsed,
        max: maxAdminSeats,
        isOverLimit,
        isUnlimited,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error fetching admin seat usage:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to fetch admin seat usage",
      }));
    }
  }, []);

  useEffect(() => {
    if (activeOrgId) {
      fetchAdminSeatUsage(activeOrgId);
    }
  }, [activeOrgId, fetchAdminSeatUsage]);

  return {
    ...state,
    refetch: () => fetchAdminSeatUsage(activeOrgId),
  };
}

/**
 * Banner component that displays when admin seat limit is exceeded.
 * Should be placed on the Members page.
 * Non-dismissible - always visible while over limit.
 */
export default function AdminSeatLimitBanner() {
  const { used, max, isOverLimit, isUnlimited, isLoading, error } = useAdminSeatLimitLocal();

  // Don't show banner if:
  // - Loading or error
  // - Not over limit
  // - No max limit set (unlimited plan)
  if (isLoading || error || !isOverLimit || isUnlimited || max === null || max === 0) {
    return null;
  }

  const message = `You're over the admin seat limit for your current plan (${used}/${max}). You can't add new admins until you reduce admin seats under the allowable limit.`;

  return (
    <LimitBanner
      message={message}
      variant="warning"
    />
  );
}

