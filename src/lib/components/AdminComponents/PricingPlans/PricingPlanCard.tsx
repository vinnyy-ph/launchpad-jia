"use client";

import { useState } from "react";
import { PricingPlan, PricingPlanFormData } from "@/lib/types/pricing";
import PricingPlanBadge from "./PricingPlanBadge";
import PricingPlanForm from "./PricingPlanForm";
import PublishStatus from "./PublishStatus";

interface PricingPlanCardProps {
  plan: PricingPlan;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (data: PricingPlanFormData) => Promise<void>;
  onToggleStatus: (planId: string, newStatus: "published" | "unpublished") => void;
  onDelete: (planId: string) => void;
  isSaving?: boolean;
}

export default function PricingPlanCard({
  plan,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  onToggleStatus,
  onDelete,
  isSaving = false,
}: PricingPlanCardProps) {
  const [showKebabMenu, setShowKebabMenu] = useState(false);

  const formatCurrency = (amount: number) => {
    return `₱ ${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleToggle = () => {
    const newStatus = plan.status === "published" ? "unpublished" : "published";
    onToggleStatus(plan._id, newStatus);
  };

  const handleSave = async (data: PricingPlanFormData) => {
    await onSave(data);
  };

  const initialFormData: PricingPlanFormData = {
    name: plan.name,
    schema: plan.schema || "credit-based",
    costPerMonth: plan.costPerMonth || 0,
    maxActiveJobPosts: plan.maxActiveJobPosts, // null = unlimited
    maxAdminSeats: plan.maxAdminSeats, // null = unlimited
    maxGuestHMSeats: plan.maxGuestHMSeats, // null = unlimited
    creditsPerMonth: plan.creditsPerMonth,
    costPerYear: plan.costPerYear,
    additionalJobPostCost: plan.additionalJobPostCost,
  };

  if (isEditing) {
    return (
      <div
        style={{
          border: "1px solid #E9EAEB",
          borderRadius: "12px",
          padding: "24px",
          backgroundColor: "white",
        }}
      >
        {/* Edit Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "18px", fontWeight: 600, color: "#181D27" }}>{plan.name}</span>
            <PricingPlanBadge schema={plan.schema || "credit-based"} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={() => onDelete(plan._id)}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                border: "1px solid #D5D7DA",
                backgroundColor: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i className="la la-trash" style={{ fontSize: "18px", color: "#DC2626" }}></i>
            </button>
            <button
              onClick={onCancelEdit}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #D5D7DA",
                backgroundColor: "white",
                color: "#414651",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const form = document.getElementById(`pricing-form-${plan._id}`) as HTMLFormElement | null;
                if (form) {
                  if (typeof form.requestSubmit === "function") {
                    form.requestSubmit();
                  } else {
                    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
                  }
                }
              }}
              disabled={isSaving}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#181D27",
                color: "white",
                fontSize: "14px",
                fontWeight: 500,
                cursor: isSaving ? "not-allowed" : "pointer",
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #E9EAEB", paddingTop: "20px" }}>
          <PricingPlanForm
            initialData={initialFormData}
            onSubmit={handleSave}
            onCancel={onCancelEdit}
            mode="edit"
            isLoading={isSaving}
            formId={`pricing-form-${plan._id}`}
          />
        </div>
      </div>
    );
  }

  // View Mode
  return (
    <div
      style={{
        border: "1px solid #E9EAEB",
        borderRadius: "12px",
        padding: "24px",
        backgroundColor: "white",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "18px", fontWeight: 600, color: "#181D27" }}>{plan.name}</span>
          <PricingPlanBadge schema={plan.schema || "credit-based"} />
          <button
            onClick={onEdit}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <i className="la la-pencil" style={{ fontSize: "18px", color: "#717680" }}></i>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Status Badge and Toggle */}
          <div style={{ display: "flex", gap: "8px" }}>
            <PublishStatus status={plan.status} />
            <label className="switch" style={{ display: "flex", alignItems: "center", lineHeight: 0 }}>
              <input type="checkbox" checked={plan.status === "published"} onChange={handleToggle} />
              <span className="slider round"></span>
            </label>
          </div>

          {/* Kebab Menu */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowKebabMenu(!showKebabMenu)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              <i className="la la-ellipsis-v" style={{ fontSize: "20px", color: "#717680" }}></i>
            </button>
            {showKebabMenu && (
              <>
                <div
                  style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}
                  onClick={() => setShowKebabMenu(false)}
                />
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    backgroundColor: "white",
                    border: "1px solid #E9EAEB",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    zIndex: 20,
                    minWidth: "120px",
                  }}
                >
                  <button
                    onClick={() => {
                      setShowKebabMenu(false);
                      onDelete(plan._id);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      width: "100%",
                      padding: "10px 16px",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#DC2626",
                      fontSize: "14px",
                    }}
                  >
                    <i className="la la-trash" style={{ fontSize: "16px" }}></i>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Plan Details */}
      <div style={{ borderTop: "1px solid #E9EAEB", paddingTop: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "13px", color: "#717680", marginBottom: "4px" }}>Plan Schema</div>
              <div style={{ fontSize: "14px", color: "#181D27", fontWeight: 500 }}>
                {plan.schema === "credit-based" ? "Credit-based" : "Premium"}
              </div>
            </div>

            {plan.schema === "credit-based" ? (
              <div>
                <div style={{ fontSize: "13px", color: "#717680", marginBottom: "4px" }}>New credits / month</div>
                <div style={{ fontSize: "14px", color: "#181D27", fontWeight: 500 }}>
                  {(plan.creditsPerMonth || 0).toLocaleString()} Credits
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: "13px", color: "#717680", marginBottom: "4px" }}>Additional Job Post cost</div>
                <div style={{ fontSize: "14px", color: "#181D27", fontWeight: 500 }}>
                  {formatCurrency(plan.additionalJobPostCost || 0)}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: "13px", color: "#717680", marginBottom: "4px" }}>Maximum Admin Seats</div>
              <div style={{ fontSize: "14px", color: "#181D27", fontWeight: 500 }}>
                {plan.maxAdminSeats === null ? "Unlimited" : `${plan.maxAdminSeats} Admin Seats`}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <div style={{ fontSize: "13px", color: "#717680", marginBottom: "4px" }}>
                {plan.schema === "premium" ? "Cost" : "Cost / month"}
              </div>
              <div style={{ fontSize: "14px", color: "#181D27", fontWeight: 500 }}>
                {plan.schema === "premium"
                  ? `${formatCurrency(plan.costPerMonth || 0)} / month or ${formatCurrency(plan.costPerYear || 0)} / year`
                  : formatCurrency(plan.costPerMonth || 0)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "13px", color: "#717680", marginBottom: "4px" }}>
                {plan.schema === "credit-based"
                  ? "Maximum Active Credit-based Job Posts"
                  : "Maximum Active Premium Job Posts"}
              </div>
              <div style={{ fontSize: "14px", color: "#181D27", fontWeight: 500 }}>
                {plan.maxActiveJobPosts === null
                  ? "Unlimited"
                  : plan.schema === "credit-based"
                    ? `${plan.maxActiveJobPosts} Credit-based Job Posts`
                    : `${plan.maxActiveJobPosts} Premium Job Posts`}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "13px", color: "#717680", marginBottom: "4px" }}>Maximum Guest or HM Seats</div>
              <div style={{ fontSize: "14px", color: "#181D27", fontWeight: 500 }}>
                {plan.maxGuestHMSeats === null ? "Unlimited" : plan.maxGuestHMSeats}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
