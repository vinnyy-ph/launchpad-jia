"use client";

interface PricingPlanBadgeProps {
  schema: "credit-based" | "premium";
}

export default function PricingPlanBadge({ schema }: PricingPlanBadgeProps) {
  const isCredit = schema === "credit-based";
  
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 12px",
        borderRadius: "16px",
        fontSize: "12px",
        fontWeight: 500,
        backgroundColor: isCredit ? "#F4F3FF" : "#FDF2FA",
        color: isCredit ? "#5925DC" : "#C11574",
        border: `1px solid ${isCredit ? "#D9D6FE" : "#FCCEEE"}`,
      }}
    >
      {isCredit ? "Credit-based" : "Premium"}
    </span>
  );
}
