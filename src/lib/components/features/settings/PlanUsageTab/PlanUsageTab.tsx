"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/utils/apiClient";
import PlanSummaryCard from "./PlanSummaryCard";
import UsageMetrics from "./UsageMetrics";
import CreditTransactionTable from "./CreditTransactionTable";
import { PlanTooltip } from "./PlanTooltip";

interface PlanDetails {
  organization: {
    _id: string;
    nextRenewalDate?: string;
    creditBasedPlan?: {
      planId?: string;
      startDate?: string;
      endDate?: string;
      creditsRemaining?: number;
    };
    premiumPlan?: {
      planId?: string;
      startDate?: string;
      endDate?: string;
      jobSlotAdjustment?: number;
    };
  };
  assignedPlans: {
    creditBased: {
      name: string;
      schema: "credit-based";
      creditsPerMonth?: number;
      maxActiveJobPosts: number | null; // null = unlimited
      effectiveMaxActiveJobPosts?: number | null;
      maxAdminSeats: number | null; // null = unlimited
      maxGuestHMSeats?: number | null; // null = unlimited
    } | null;
    premium: {
      name: string;
      schema: "premium";
      maxActiveJobPosts: number | null; // null = unlimited
      effectiveMaxActiveJobPosts?: number | null;
      jobSlotAdjustment?: number;
      maxAdminSeats: number | null; // null = unlimited
      maxGuestHMSeats?: number | null; // null = unlimited
    } | null;
  };
  usage: {
    creditsUsed: number;
    creditsTotal: number;
    activeJobPosts: number;
    maxJobPosts: number | null; // null = unlimited
    adminSeatsUsed: number;
    maxAdminSeats: number | null; // null = unlimited (combined from both plans)
    perPlanJobPosts?: {
      creditBased: number;
      premium: number;
    };
    perPlanAdminSeats?: {
      creditBased: number | null | undefined;
      premium: number | null | undefined;
    };
  };
  hasPlan: boolean;
  creditStatus?: {
    balance: number;
    isLowCredit: boolean;
    isInsufficient: boolean;
  };
  planStatus: "active" | "pending" | "expired" | "none";
}

export default function PlanUsageTab() {
  const searchParams = useSearchParams();
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string>("");

  const fetchPlanDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Optionally pass orgID from URL params if available
      const orgIDFromUrl = searchParams.get("orgID") || searchParams.get("orgId");
      const params = orgIDFromUrl ? { orgID: orgIDFromUrl } : {};

      const response = await api.get("/api/pricing-plan/get-plan-details", { params });
      setPlanDetails(response.data);
      setOrgId(response.data.organization._id);
    } catch (err) {
      console.error("Error fetching plan details:", err);
      setError("Failed to load plan details");
    } finally {
      setIsLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchPlanDetails();
  }, [fetchPlanDetails]);

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <i className="la la-spinner la-spin" style={{ fontSize: 32, color: "#717680" }} />
        <p style={{ color: "#717680", marginTop: 12 }}>Loading plan details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <i className="la la-exclamation-circle" style={{ fontSize: 48, color: "#B42318" }} />
        <p style={{ color: "#717680", marginTop: 12 }}>{error}</p>
        <button
          type="button"
          onClick={fetchPlanDetails}
          style={{
            marginTop: 16,
            padding: "8px 16px",
            borderRadius: 999,
            border: "1px solid #D5D7DA",
            background: "#fff",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!planDetails?.hasPlan) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <i className="la la-file-invoice" style={{ fontSize: 48, color: "#E9EAEB" }} />
        <p style={{ color: "#717680", marginTop: 12 }}>No active plan found for your organization.</p>
      </div>
    );
  }

  const { organization, assignedPlans, usage } = planDetails;
  const creditBasedPlan = assignedPlans?.creditBased;
  const premiumPlan = assignedPlans?.premium;
  const activePlan = creditBasedPlan || premiumPlan;

  if (!activePlan) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <i className="la la-file-invoice" style={{ fontSize: 48, color: "#E9EAEB" }} />
        <p style={{ color: "#717680", marginTop: 12 }}>No active plan found.</p>
      </div>
    );
  }

  const gradient =
    "linear-gradient(90deg, #fccec0 0%, #ebacc9 33%, #ceb6da 66%, #9fcaed 100%)";

  const UsageBar = ({ value, max, isWarning = false }: { value: number; max: number; isWarning?: boolean }) => {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    const barColor = isWarning ? "#F97066" : gradient;
    return (
      <div style={{ width: "100%", height: 8, background: "#E9EAEB", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: barColor }} />
      </div>
    );
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const UnlimitedBadge = () => (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 999,
      backgroundColor: "#EFF8FF",
      color: "#175CD3",
      border: "1px solid #B2DDFF",
      fontSize: 10,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.02em",
      marginLeft: 8,
    }}>
      Unlimited
    </span>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, overflowY: "auto", paddingBottom: 24 }}>
      {/* Plan & Usage Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#181D27", margin: 0 }}>Plan and Usage</h2>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#717680", margin: 0, marginTop: 4 }}>
            View your plan and credit usage details.
          </p>
        </div>

        {/* <div>
          <span style={{ fontSize: 40, fontWeight: 700, color: "#181D27", lineHeight: "52px", marginRight: 4 }}>50</span> <span style={{ fontSize: 14, fontWeight: 500, color: "#717680" }}>available credits</span>
        </div> */}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {organization.creditBasedPlan?.planId && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {planDetails.creditStatus?.isLowCredit && (
                <PlanTooltip
                  message="Low credit balances pause promotion to AI Interview regardless of candidate fit until you add more credits. Organizations with Premium plans have unlimited AI Interviews."
                  width={300}
                  position="bottom"
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      backgroundColor: "#FEE4E2",
                      border: "1px solid #FEE4E2",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <i
                      className="la la-exclamation-triangle"
                      style={{ color: "#D92D20", fontSize: 24 }}
                    />
                  </div>
                </PlanTooltip>
              )}
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{
                  fontSize: 36,
                  fontWeight: 800,
                  color: "#181D27",
                  lineHeight: "52px"
                }}>
                  {organization.creditBasedPlan?.creditsRemaining ?? 0}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#717680" }}>available credits</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Plan Details Card */}
      <div
        style={{
          background: "#F8F9FC",
          borderRadius: 16,
          padding: 8,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            boxShadow: "inset 0px 0px 2px 0px rgba(0,16,53,0.16)",
          }}
        >
          {/* Credit-based Plan Section */}
          {creditBasedPlan && (
            <div style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <PlanSummaryCard
                    planName={creditBasedPlan.name}
                    schema="credit-based"
                    startDate={organization.creditBasedPlan?.startDate}
                    endDate={organization.creditBasedPlan?.endDate}
                    creditsPerMonth={creditBasedPlan.creditsPerMonth}
                    maxActiveJobPosts={creditBasedPlan.maxActiveJobPosts}
                    maxAdminSeats={creditBasedPlan.maxAdminSeats}
                    maxGuestHMSeats={creditBasedPlan.maxGuestHMSeats}
                  />
                </div>

                <div style={{ width: 460, maxWidth: "100%" }}>


                  {/* Usage Metrics */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Credits Used */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#414651", display: "flex", alignItems: "center", gap: 6 }}>
                          {usage.creditsUsed || 0} of {creditBasedPlan.creditsPerMonth || 0} credits used this month
                          <PlanTooltip message="AI Interviews consume 10 credits each on credit-based plans. Premium plans include unlimited AI Interviews. Unused credits roll over monthly." width={300}>
                            <img
                              alt=""
                              src="/icons/help-circle.svg"
                              style={{
                                width: 16,
                                height: 16,
                                cursor: "pointer",
                                opacity: 0.6,
                              }}
                            />
                          </PlanTooltip>
                        </div>
                        {organization.nextRenewalDate && (
                          <div style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>
                            Refreshes on {formatDate(organization.nextRenewalDate)}
                          </div>
                        )}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <UsageBar value={usage.creditsUsed || 0} max={creditBasedPlan.creditsPerMonth || 1} isWarning={planDetails.creditStatus?.isLowCredit} />
                      </div>
                    </div>

                    {/* Active Job Posts */}
                    {(() => {
                      const creditBasedUsed = usage.perPlanJobPosts?.creditBased || 0;
                      const creditBasedMax = creditBasedPlan.maxActiveJobPosts;
                      const isUnlimited = creditBasedMax === null;
                      return (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#414651", display: "flex", alignItems: "center" }}>
                              {isUnlimited
                                ? <>{creditBasedUsed} active credit-based job posts <UnlimitedBadge /></>
                                : `${creditBasedUsed} of ${creditBasedMax} maximum active credit-based job posts`
                              }
                            </div>
                            {!isUnlimited && creditBasedMax !== null && creditBasedUsed > creditBasedMax && (
                              <PlanTooltip
                                message="You're over the job post limit for your current plan. You can keep existing posts active but can't publish new ones until you're within the limit."
                                width={300}
                                position="bottom"
                                align="right"
                              >
                                <div style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  border: "1px solid #FEF3F2",
                                  backgroundColor: "#FEF3F2",
                                  cursor: "pointer"
                                }}>
                                  <i className="la la-info-circle" style={{ fontSize: 14, color: "#B32318" }} />
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "#B32318" }}>Overlimit</span>
                                </div>
                              </PlanTooltip>
                            )}
                          </div>
                          {!isUnlimited && creditBasedMax !== null && (
                            <div style={{ marginTop: 8 }}>
                              <UsageBar
                                value={creditBasedUsed}
                                max={creditBasedMax || 1}
                                isWarning={creditBasedUsed >= (creditBasedMax || 1) * 0.8}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Admin Seats - uses combined limit from usage.maxAdminSeats */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#414651", display: "flex", alignItems: "center" }}>
                          {usage.maxAdminSeats === null
                            ? <>{usage.adminSeatsUsed || 0} admin seats used <UnlimitedBadge /></>
                            : `${usage.adminSeatsUsed || 0} of ${usage.maxAdminSeats} admin seats used`
                          }
                        </div>
                        {usage.maxAdminSeats !== null && (usage.adminSeatsUsed || 0) > usage.maxAdminSeats && (
                          <PlanTooltip
                            message="Your organization is over the admin seat limit. You can't add new admins until you're within the limit."
                            width={300}
                            position="bottom"
                            align="right"
                          >
                            <div style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "2px 8px",
                              borderRadius: 999,
                              border: "1px solid #FEF3F2",
                              backgroundColor: "#FEF3F2",
                              cursor: "pointer"
                            }}>
                              <i className="la la-info-circle" style={{ fontSize: 14, color: "#B32318" }} />
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#B32318" }}>Overlimit</span>
                            </div>
                          </PlanTooltip>
                        )}
                      </div>
                      {usage.maxAdminSeats !== null && (
                        <div style={{ marginTop: 8 }}>
                          <UsageBar
                            value={usage.adminSeatsUsed || 0}
                            max={usage.maxAdminSeats || 1}
                            isWarning={(usage.adminSeatsUsed || 0) >= (usage.maxAdminSeats || 1) * 0.8}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Premium Plan Section */}
          {premiumPlan && (
            <div style={{ padding: "20px 24px", borderTop: creditBasedPlan ? "1px solid #E9EAEB" : "none" }}>
              <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <PlanSummaryCard
                    planName={premiumPlan.name}
                    schema="premium"
                    startDate={organization.premiumPlan?.startDate}
                    endDate={organization.premiumPlan?.endDate}
                    maxActiveJobPosts={premiumPlan.effectiveMaxActiveJobPosts || premiumPlan.maxActiveJobPosts}
                    maxAdminSeats={premiumPlan.maxAdminSeats}
                    maxGuestHMSeats={premiumPlan.maxGuestHMSeats}
                  />
                </div>

                <div style={{ width: 460, maxWidth: "100%" }}>
                  {/* Active Premium Job Posts Header */}
                  {/* <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <div style={{ fontSize: 48, fontWeight: 800, color: "#181D27", lineHeight: "52px" }}>
                        {usage.activeJobPosts || 0}/{premiumPlan.maxActiveJobPosts || 0}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "#717680" }}>active premium job posts</div>
                    </div>
                  </div> */}

                  {/* Usage Metrics */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Active Premium Job Posts */}
                    <div>
                      {(() => {
                        const premiumUsed = usage.perPlanJobPosts?.premium || 0;
                        const effectiveMax = premiumPlan.effectiveMaxActiveJobPosts ?? premiumPlan.maxActiveJobPosts;
                        const isUnlimited = effectiveMax === null;
                        return (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#414651", display: "flex", alignItems: "center" }}>
                                {isUnlimited
                                  ? <>{premiumUsed} active premium job posts <UnlimitedBadge /></>
                                  : `${premiumUsed} of ${effectiveMax} maximum active premium job posts`
                                }
                              </div>
                              {!isUnlimited && effectiveMax !== null && premiumUsed > effectiveMax && (
                                <PlanTooltip
                                  message="You're over the job post limit for your current plan. You can keep existing posts active but can't publish new ones until you're within the limit."
                                  width={300}
                                  position="bottom"
                                  align="right"
                                >
                                  <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                    padding: "2px 8px",
                                    borderRadius: 999,
                                    border: "1px solid #FEF3F2",
                                    backgroundColor: "#FEF3F2",
                                    cursor: "pointer"
                                  }}>
                                    <i className="la la-info-circle" style={{ fontSize: 14, color: "#B32318" }} />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "#B32318" }}>Overlimit</span>
                                  </div>
                                </PlanTooltip>
                              )}
                            </div>
                            {!isUnlimited && effectiveMax !== null && (
                              <div style={{ marginTop: 8 }}>
                                <UsageBar
                                  value={premiumUsed}
                                  max={effectiveMax || 1}
                                  isWarning={premiumUsed >= (effectiveMax || 1) * 0.8}
                                />
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {/* Admin Seats - uses combined limit from usage.maxAdminSeats */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#414651", display: "flex", alignItems: "center" }}>
                          {usage.maxAdminSeats === null
                            ? <>{usage.adminSeatsUsed || 0} admin seats used <UnlimitedBadge /></>
                            : `${usage.adminSeatsUsed || 0} of ${usage.maxAdminSeats} admin seats used`
                          }
                        </div>
                        {usage.maxAdminSeats !== null && (usage.adminSeatsUsed || 0) > usage.maxAdminSeats && (
                          <PlanTooltip
                            message="Your organization is over the admin seat limit. You can't add new admins until you're within the limit."
                            width={300}
                            position="bottom"
                            align="right"
                          >
                            <div style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "2px 8px",
                              borderRadius: 999,
                              border: "1px solid #FEF3F2",
                              backgroundColor: "#FEF3F2",
                              cursor: "pointer"
                            }}>
                              <i className="la la-info-circle" style={{ fontSize: 14, color: "#B32318" }} />
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#B32318" }}>Overlimit</span>
                            </div>
                          </PlanTooltip>
                        )}
                      </div>
                      {usage.maxAdminSeats !== null && (
                        <div style={{ marginTop: 8 }}>
                          <UsageBar
                            value={usage.adminSeatsUsed || 0}
                            max={usage.maxAdminSeats || 1}
                            isWarning={(usage.adminSeatsUsed || 0) >= (usage.maxAdminSeats || 1) * 0.8}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {(creditBasedPlan || premiumPlan) && (
          <div style={{ padding: "0 24px 8px", marginTop: 8 }}>
            <a
              href="mailto:inquire@hellojia.ai?subject=Plan Change Request"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 14,
                fontWeight: 700,
                color: "#6172F3",
                textDecoration: "none",
              }}
            >
              Contact us to change your plan or purchase more credits
              <i className="la la-arrow-right" style={{ transform: "rotate(-45deg)" }} />
            </a>
          </div>
        )}
      </div>

      {/* Credit Transaction History */}
      {orgId && <CreditTransactionTable orgId={orgId} />}
    </div>
  );
}

