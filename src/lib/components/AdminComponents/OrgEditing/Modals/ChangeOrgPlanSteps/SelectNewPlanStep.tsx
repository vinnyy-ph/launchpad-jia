"use client";

import PlanCard from "./PlanCard";
import type { PlanOption } from "./types";

interface SelectNewPlanStepProps {
  availablePlans: PlanOption[];
  selectedPlanId: string | null;
  onSelectPlan: (planId: string) => void;
  isLoadingPlans: boolean;
  plansError: string | null;
  allowedSchema: "credit-based" | "premium" | null;
  formatCurrency: (amount: number) => string;
}

export default function SelectNewPlanStep({
  availablePlans,
  selectedPlanId,
  onSelectPlan,
  isLoadingPlans,
  plansError,
  allowedSchema,
  formatCurrency,
}: SelectNewPlanStepProps) {
  if (isLoadingPlans) {
    return (
      <div style={{ padding: "12px 0", fontSize: 14, color: "#717680", fontWeight: 600 }}>
        Loading plans…
      </div>
    );
  }

  if (plansError) {
    return (
      <div style={{ padding: "12px 0", fontSize: 14, color: "#717680", fontWeight: 600 }}>
        Unable to load plans.
      </div>
    );
  }

  if (availablePlans.length === 0) {
    return (
      <div style={{ padding: "12px 0", fontSize: 14, color: "#717680", fontWeight: 600 }}>
        No plans available.
      </div>
    );
  }

  return (
    <div>
      {availablePlans.map((plan) => {
        const isDisabled = allowedSchema !== null && plan.schema !== allowedSchema;
        return (
          <PlanCard
            key={plan.id}
            plan={plan}
            showRadio
            isSelected={selectedPlanId === plan.id}
            isDisabled={isDisabled}
            onSelect={() => !isDisabled && onSelectPlan(plan.id)}
            formatCurrency={formatCurrency}
          />
        );
      })}
    </div>
  );
}
