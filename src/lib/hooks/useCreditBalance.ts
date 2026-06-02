"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/utils/apiClient";

// Inlined from planUtils.ts
const calculateCreditBalance = (organization: any, assignedPlans: any) => {
  const creditPlan = assignedPlans?.creditBased;
  if (!creditPlan) {
    return {
      balance: 0,
      total: 0,
      isLowCredit: false,
      isInsufficient: false,
      hasCreditBasedPlan: false,
      isUnlimited: false,
    };
  }
  const totalCredits = organization.creditBalanceAtRenewal ?? creditPlan.creditsPerMonth ?? 0;
  const balance = organization.creditBasedPlan?.creditsRemaining ?? 0;
  const lowCreditThreshold = Math.ceil(totalCredits * 0.2);
  const isLowCredit = balance > 0 && balance <= lowCreditThreshold;
  const isInsufficient = balance <= 0;
  return {
    balance,
    total: totalCredits,
    isLowCredit,
    isInsufficient,
    hasCreditBasedPlan: true,
    isUnlimited: totalCredits === 0,
  };
};

export interface CreditBalanceState {
  balance: number;
  isLowCredit: boolean;
  isInsufficient: boolean;
  hasCreditBasedPlan: boolean;
  hasActiveCreditBasedPlan: boolean;
  hasActivePremiumPlan: boolean;
  hasAnyActivePlan: boolean;
  isExpired: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Gets the active organization ID from localStorage.
 * This is consistent with how the app tracks the current org for multi-org users.
 */
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

/**
 * Hook to fetch and manage credit balance status for the current organization.
 * Returns balance, low/insufficient flags, and loading/error states.
 */
export function useCreditBalance() {
  const [creditStatus, setCreditStatus] = useState<CreditBalanceState>({
    balance: 0,
    isLowCredit: false,
    isInsufficient: false,
    hasCreditBasedPlan: false,
    hasActiveCreditBasedPlan: false,
    hasActivePremiumPlan: false,
    hasAnyActivePlan: false,
    isExpired: false,
    isLoading: true,
    error: null,
  });
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  // Monitor localStorage for activeOrg changes
  useEffect(() => {
    // Initial read
    setActiveOrgId(getActiveOrgId());

    // Poll for changes (localStorage doesn't have a native change event within same tab)
    // Reduced frequency for better performance
    const interval = setInterval(() => {
      const currentOrgId = getActiveOrgId();
      setActiveOrgId((prev) => {
        if (prev !== currentOrgId) {
          return currentOrgId;
        }
        return prev;
      });
    }, 2000);

    // Also listen for storage events (from other tabs)
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

  const fetchCreditStatus = useCallback(async (orgId: string | null) => {
    // Don't fetch if we don't have an org ID yet
    if (!orgId) {
      return;
    }

    try {
      setCreditStatus((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await api.get("/api/pricing-plan/get-credit-status", {
        params: { orgID: orgId },
      });

      // Use the values returned directly from the API
      const {
        balance,
        isLowCredit,
        isInsufficient,
        hasCreditBasedPlan,
        hasActiveCreditBasedPlan,
        hasActivePremiumPlan,
        hasAnyActivePlan,
        isExpired,
      } = response.data;

      setCreditStatus({
        balance: balance ?? 0,
        isLowCredit: isLowCredit ?? false,
        isInsufficient: isInsufficient ?? false,
        hasCreditBasedPlan: hasCreditBasedPlan ?? false,
        hasActiveCreditBasedPlan: hasActiveCreditBasedPlan ?? false,
        hasActivePremiumPlan: hasActivePremiumPlan ?? false,
        hasAnyActivePlan: hasAnyActivePlan ?? false,
        isExpired: isExpired ?? false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error fetching credit status:", error);
      setCreditStatus((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to fetch credit status",
      }));
    }
  }, []);

  // Fetch when activeOrgId changes
  useEffect(() => {
    if (activeOrgId) {
      fetchCreditStatus(activeOrgId);
    }
  }, [activeOrgId, fetchCreditStatus]);

  return {
    ...creditStatus,
    refetch: () => fetchCreditStatus(activeOrgId),
  };
}

