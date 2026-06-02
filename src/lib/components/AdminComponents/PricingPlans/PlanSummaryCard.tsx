"use client";

import { useState } from "react";
import { Organization, PricingPlan } from "@/lib/types/organization";
import UsageProgressBar from "../UsageProgressBar";
import PlanHistoryModal from "../OrgEditing/Modals/PlanHistoryModal";

interface PlanSummaryCardProps {
  organization: Organization;
  plan: PricingPlan | null;
  usage: {
    creditsUsed?: number;
    creditsTotal?: number;
    activeJobPosts?: number;
    maxJobPosts?: number;
    adminSeatsUsed: number;
    maxAdminSeats: number;
  } | null;
  onPlanUpdate: () => void;
}

export default function PlanSummaryCard({
  organization,
  plan,
  usage,
  onPlanUpdate,
}: PlanSummaryCardProps) {
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isCreditBased = plan?.schema === "credit-based";

  return (
    <>
      <div
        style={{
          background: "#F8F9FC",
          borderRadius: 16,
          padding: 8,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 12px",
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0 }}>
            Plan
          </h3>
          <button
            onClick={() => setShowHistoryModal(true)}
            style={{
              background: "#fff",
              border: "1px solid #D5D7DA",
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <i className="la la-history" />
            Plan history
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 24,
            boxShadow: "inset 0px 0px 2px 0px rgba(0,16,53,0.16)",
          }}
        >
          {plan ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Plan Name & Type */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#181D27" }}>
                  {plan.name}
                </span>
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 500,
                    background: isCreditBased ? "#EEF4FF" : "#FEF6EE",
                    color: isCreditBased ? "#3538CD" : "#B93815",
                  }}
                >
                  {isCreditBased ? "Credit-based" : "Premium"}
                </span>
              </div>

              {/* Plan Details Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
                <div>
                  <p style={{ fontSize: 14, color: "#717680", margin: 0, marginBottom: 4 }}>
                    Start Date
                  </p>
                  <p style={{ fontSize: 16, fontWeight: 500, color: "#181D27", margin: 0 }}>
                    {formatDate(organization.creditBasedPlan?.startDate || organization.premiumPlan?.startDate)}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 14, color: "#717680", margin: 0, marginBottom: 4 }}>
                    End Date
                  </p>
                  <p style={{ fontSize: 16, fontWeight: 500, color: "#181D27", margin: 0 }}>
                    {formatDate(organization.creditBasedPlan?.endDate || organization.premiumPlan?.endDate)}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 14, color: "#717680", margin: 0, marginBottom: 4 }}>
                    Status
                  </p>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "2px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 500,
                      background: "#ECFDF3",
                      color: "#027A48",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#12B76A",
                      }}
                    />
                    Active
                  </span>
                </div>
              </div>

              {/* Usage Indicators */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {isCreditBased && usage?.creditsTotal !== undefined && (
                  <div>
                    <UsageProgressBar
                      used={usage.creditsUsed || 0}
                      total={usage.creditsTotal}
                      label="Credits"
                    />
                    {organization.nextRenewalDate && (
                      <p style={{ fontSize: 12, color: "#717680", margin: 0, marginTop: 4 }}>
                        Refreshes on {formatDate(organization.nextRenewalDate)}
                      </p>
                    )}
                  </div>
                )}

                {!isCreditBased && usage?.maxJobPosts !== undefined && (
                  <UsageProgressBar
                    used={usage.activeJobPosts || 0}
                    total={usage.maxJobPosts}
                    label="Active Job Posts"
                  />
                )}

                <UsageProgressBar
                  used={usage?.adminSeatsUsed || 0}
                  total={usage?.maxAdminSeats || 5}
                  label="Admin Seats"
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  style={{
                    padding: "8px 16px",
                    border: "1px solid #D5D7DA",
                    borderRadius: 999,
                    background: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Change organization plan
                </button>
                <button
                  style={{
                    padding: "8px 16px",
                    border: "1px solid #D5D7DA",
                    borderRadius: 999,
                    background: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Edit plan schedule
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 40 }}>
              <i className="la la-file-alt" style={{ fontSize: 48, color: "#E9EAEB" }} />
              <p style={{ color: "#717680", marginTop: 12 }}>No plan assigned</p>
              <button
                style={{
                  marginTop: 12,
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: 999,
                  background: "#181D27",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Assign a plan
              </button>
            </div>
          )}
        </div>
      </div>

      {showHistoryModal && (
        <PlanHistoryModal
          orgId={organization._id!}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </>
  );
}
