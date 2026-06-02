"use client";

import React, { useEffect, useState } from "react";
import { OrgFormState } from "@/lib/types/orgForm";
import { api } from "@/lib/utils/apiClient";
import { PricingPlan } from "@/lib/types/organization";
import PricingPlanBadge from "@/lib/components/AdminComponents/PricingPlans/PricingPlanBadge";
import OrganizationStatus from "../../OrgEditing/OrganizationStatus";
import SingleDatePicker from "@/lib/components/Dropdown/SingleDatePicker";
import { RESERVED_SUBDOMAINS } from "@/lib/utils/subdomainUtils";

interface OrgPlanStepProps {
  formState: OrgFormState;
  setFormState: React.Dispatch<React.SetStateAction<OrgFormState>>;
  validationErrors: Record<string, boolean>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export default function OrgPlanStep({
  formState,
  setFormState,
  validationErrors,
  setValidationErrors,
}: OrgPlanStepProps) {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await api.get("/api/pricing-plan/admin/get-pricing-plans");
        const publishedPlans = response.data.filter(
          (plan: PricingPlan) => plan.status === "published"
        );
        setPlans(publishedPlans);
      } catch (error) {
        console.error("Error fetching plans:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return "₱ 0";
    return `₱ ${amount.toLocaleString()}`;
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return "";
    const d = new Date(date);
    return d.toISOString().split("T")[0];
  };

  const parseDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    return new Date(dateString);
  };

  const handleStartDateChange = (dateString: string) => {
    setFormState((prev) => ({
      ...prev,
      planStartDate: parseDate(dateString),
    }));
    if (validationErrors.planStartDate) {
      setValidationErrors((prev) => ({ ...prev, planStartDate: false }));
    }
  };

  const handleEndDateChange = (dateString: string) => {
    setFormState((prev) => ({
      ...prev,
      planEndDate: parseDate(dateString),
    }));
    if (validationErrors.planEndDate) {
      setValidationErrors((prev) => ({ ...prev, planEndDate: false }));
    }
  };

  const handlePlanSelect = (planId: string) => {
    setFormState((prev) => ({ ...prev, planId }));
    if (validationErrors.planId) {
      setValidationErrors((prev) => ({ ...prev, planId: false }));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      {/* Organization Access Card */}
      <div className="layered-card-outer">
        <div className="layered-card-middle">
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>
              Organization Access
            </span>
          </div>
          <div className="layered-card-content">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>Access</div>
                <div style={{ fontSize: 12, color: "#717680", marginTop: 4 }}>
                  Enable organization&apos;s access to Jia immediately after creation
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <OrganizationStatus status={formState.accessEnabled ? "active" : "inactive"} />
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={formState.accessEnabled}
                    onChange={() =>
                      setFormState((prev) => ({ ...prev, accessEnabled: !prev.accessEnabled }))
                    }
                  />
                  <span className="slider round" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Selection Card */}
      <div className="layered-card-outer">
        <div className="layered-card-middle">
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>1. Select Plan</span>
            {validationErrors.planId && (
              <span style={{ fontSize: 12, color: "#EF4444" }}>
                (Please select a plan)
              </span>
            )}
          </div>
          <div className="layered-card-content">
            {isLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#717680" }}>
                <i className="la la-spinner la-spin" style={{ fontSize: 32 }} />
                <p style={{ marginTop: 12 }}>Loading plans...</p>
              </div>
            ) : plans.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#717680" }}>
                <i className="la la-exclamation-circle" style={{ fontSize: 32 }} />
                <p style={{ marginTop: 12 }}>No plans available. Please create a plan first.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {plans.map((plan) => (
                  <div
                    key={plan._id}
                    onClick={() => handlePlanSelect(plan._id!)}
                    style={{
                      border: `1px solid ${formState.planId === plan._id ? "#E9EAEB" : "#E9EAEB"}`,
                      borderRadius: "12px",
                      cursor: "pointer",
                      backgroundColor: formState.planId === plan._id ? "#FAFAFA" : "#FFFFFF",
                      transition: "all 0.2s ease",
                      overflow: "hidden",
                    }}
                  >
                    {/* Header Section */}
                    <div
                      style={{
                        backgroundColor: "#F8F9FC",
                        padding: "16px 20px",
                        borderBottom: `1px solid ${formState.planId === plan._id ? "#E9EAEB" : "#E9EAEB"}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              border: `2px solid ${formState.planId === plan._id ? "#D5D7DA" : "#D5D7DA"
                                }`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {formState.planId === plan._id && (
                              <div
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: "50%",
                                  backgroundColor: "#414651",
                                }}
                              />
                            )}
                          </div>
                          <span style={{ fontSize: 16, fontWeight: 700, color: "#181D27" }}>
                            {plan.name}
                          </span>
                          <PricingPlanBadge schema={plan.schema} />
                        </div>
                        {formState.planId === plan._id && (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              color: "#039855",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <i className="la la-check-circle" style={{ fontSize: 16 }} />
                            Selected
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div style={{ padding: "16px 20px" }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, 1fr)",
                          gap: 16,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12, color: "#717680", marginBottom: 4 }}>
                            Plan Schema
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                            {plan.schema === "credit-based" ? "Credit-based" : "Premium"}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#717680", marginBottom: 4 }}>
                            {plan.schema === "premium" ? "Cost" : "Cost / month"}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                            {formatCurrency(plan.costPerMonth)}
                            <span style={{ color: "#717680" }}> / month</span>
                            {plan.schema === "premium" && !!plan.costPerYear && (
                              <>
                                <span style={{ color: "#717680" }}> or </span>
                                {formatCurrency(plan.costPerYear)}
                                <span style={{ color: "#717680" }}> / year</span>
                              </>
                            )}
                          </div>
                        </div>
                        {plan.schema === "credit-based" && (
                          <div>
                            <div style={{ fontSize: 12, color: "#717680", marginBottom: 4 }}>
                              New Credits / month
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                              {plan.creditsPerMonth || 0} Credits
                            </div>
                          </div>
                        )}
                        {plan.schema === "premium" && (
                          <div>
                            <div style={{ fontSize: 12, color: "#717680", marginBottom: 4 }}>
                              Additional Job Post cost
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                              {formatCurrency(plan.additionalJobPostCost)}
                            </div>
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, 1fr)",
                          gap: 16,
                          marginTop: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12, color: "#717680", marginBottom: 4 }}>
                            Maximum Active {plan.schema === "credit-based" ? "Credit-based" : "Premium"} Job Posts
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                            {plan.maxActiveJobPosts === null
                              ? "Unlimited"
                              : `${plan.maxActiveJobPosts} ${plan.schema === "credit-based" ? "Credit-based" : "Premium"} Job Posts`}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#717680", marginBottom: 4 }}>
                            Maximum Admin Seats
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                            {plan.maxAdminSeats === null ? "Unlimited" : `${plan.maxAdminSeats} Admin Seats`}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: "#717680", marginBottom: 4 }}>
                            Maximum Guest or HM Seats
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: "#181D27" }}>
                            {plan.maxGuestHMSeats === null ? "Unlimited" : plan.maxGuestHMSeats}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plan Schedule Card */}
      <div className="layered-card-outer">
        <div className="layered-card-middle">
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>
              2. Set Plan Schedule
            </span>
          </div>
          <div className="layered-card-content">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <span style={{ marginBottom: 8, display: "block" }}>Start date</span>
                <SingleDatePicker
                  value={formatDate(formState.planStartDate)}
                  onChange={handleStartDateChange}
                  placeholder="Select start date"
                  error={!!validationErrors.planStartDate}
                  placement="top"
                  disabledDate={(date: Date) => {
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const currentDate = new Date(date);
                    currentDate.setHours(0, 0, 0, 0);
                    // Cannot be before today
                    if (currentDate < todayStart) return true;
                    // Cannot be more than 5 years in the future
                    const fiveYearsFromNow = new Date(todayStart);
                    fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
                    if (currentDate > fiveYearsFromNow) return true;
                    return false;
                  }}
                />
                {validationErrors.planStartDate && (
                  <span style={{ fontSize: 12, color: "#EF4444", marginTop: 4 }}>
                    Start date is required
                  </span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ marginBottom: 8, display: "block" }}>End date</span>
                <SingleDatePicker
                  value={formatDate(formState.planEndDate)}
                  onChange={handleEndDateChange}
                  placeholder="Select end date"
                  error={!!validationErrors.planEndDate}
                  placement="top"
                  disabledDate={(date: Date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const currentDate = new Date(date);
                    currentDate.setHours(0, 0, 0, 0);
                    // If no start date, only check absolute future limit
                    if (!formState.planStartDate) {
                      const fiveYearsFromNow = new Date(today);
                      fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
                      return currentDate > fiveYearsFromNow;
                    }
                    const start = new Date(formState.planStartDate);
                    start.setHours(0, 0, 0, 0);
                    // Cannot be on or before start date
                    if (currentDate <= start) return true;
                    // Cannot be more than 3 years from start date
                    const maxDurationEnd = new Date(start);
                    maxDurationEnd.setFullYear(maxDurationEnd.getFullYear() + 3);
                    if (currentDate > maxDurationEnd) return true;
                    // Cannot be more than 5 years from today
                    const fiveYearsFromNow = new Date(today);
                    fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
                    if (currentDate > fiveYearsFromNow) return true;
                    return false;
                  }}
                  disabled={!formState.planStartDate}
                />
                {validationErrors.planEndDate && (
                  <span style={{ fontSize: 12, color: "#EF4444", marginTop: 4 }}>
                    {formState.planStartDate &&
                      formState.planEndDate &&
                      new Date(formState.planEndDate).setHours(0, 0, 0, 0) <= new Date(formState.planStartDate).setHours(0, 0, 0, 0)
                      ? "End date must be after start date"
                      : "End date is required"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Features Card */}
      <div className="layered-card-outer">
        <div className="layered-card-middle">
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>
              3. Additional Features
            </span>
          </div>
          <div className="layered-card-content">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>Projects</div>
                  <div style={{ fontSize: 12, color: "#717680", marginTop: 4 }}>
                    Projects allow users to organize careers into folders.
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <OrganizationStatus
                    status={formState.projectsEnabled ? "active" : "inactive"}
                  />
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={formState.projectsEnabled}
                      onChange={() =>
                        setFormState((prev) => ({
                          ...prev,
                          projectsEnabled: !prev.projectsEnabled,
                        }))
                      }
                    />
                    <span className="slider round" />
                  </label>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  opacity: 1, // Always enabled - independent of Projects
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>
                    Requisitions
                  </div>
                  <div style={{ fontSize: 12, color: "#717680", marginTop: 4 }}>
                    Requisitions allow users to create and manage job requests for open roles.
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <OrganizationStatus
                    status={formState.guestPortalEnabled ? "active" : "inactive"}
                  />
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={formState.guestPortalEnabled}
                      onChange={() =>
                        setFormState((prev) => ({
                          ...prev,
                          guestPortalEnabled: !prev.guestPortalEnabled,
                        }))
                      }
                    />
                    <span className="slider round" />
                  </label>
                </div>
              </div>

              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>
                      Branded Job Portal
                    </div>
                    <div style={{ fontSize: 12, color: "#717680", marginTop: 4 }}>
                      Customize the subdomain for branded job portal.
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <OrganizationStatus
                      status={formState.brandedPortalEnabled ? "active" : "inactive"}
                    />
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={formState.brandedPortalEnabled}
                        onChange={() =>
                          setFormState((prev) => ({
                            ...prev,
                            brandedPortalEnabled: !prev.brandedPortalEnabled,
                          }))
                        }
                      />
                      <span className="slider round" />
                    </label>
                  </div>
                </div>

                {formState.brandedPortalEnabled && (
                  <div style={{ marginTop: 16 }}>
                    <label
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#717680",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Branded Portal Slug
                    </label>
                      <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={formState.brandedJobPortalSubdomain || ""}
                        onChange={(e) => {
                          const value = e.target.value.toLowerCase().trim();
                          
                          if (RESERVED_SUBDOMAINS.includes(value)) {
                            // Don't update state if reserved, or handle error
                            setValidationErrors((prev) => ({ ...prev, brandedJobPortalSubdomain: true }));
                            // For better UX, we might want to let them type but show error, but here let's just flag it
                          }
                          
                          setFormState((prev) => ({
                            ...prev,
                            brandedJobPortalSubdomain: value,
                          }));
                          
                          if (validationErrors.brandedJobPortalSubdomain) {
                             // Only clear if valid
                             if (!RESERVED_SUBDOMAINS.includes(value)) {
                                setValidationErrors((prev) => ({ ...prev, brandedJobPortalSubdomain: false }));
                             }
                          }
                        }}
                        placeholder="Enter portal slug"
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          paddingRight: 160,
                          border: `1px solid ${validationErrors.brandedJobPortalSubdomain ? "#EF4444" : "#D5D7DA"}`,
                          borderRadius: 8,
                          fontSize: 14,
                          color: "#181D27",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          right: 14,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#717680",
                          fontSize: 14,
                          pointerEvents: "none",
                        }}
                      >
                        .{process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN || "hellojia.ai"}
                      </div>
                    </div>
                    {validationErrors.brandedJobPortalSubdomain && (
                      <span style={{ fontSize: 12, color: "#EF4444", marginTop: 4, display: "block" }}>
                        {RESERVED_SUBDOMAINS.includes(formState.brandedJobPortalSubdomain || "") 
                          ? "This subdomain is reserved and cannot be used" 
                          : "Subdomain is required"}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>
                    Global Hiring
                  </div>
                  <div style={{ fontSize: 12, color: "#717680", marginTop: 4 }}>
                    Allows users to configure whether they accept applicants outside their country for specific careers.
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <OrganizationStatus
                    status={formState.globalHiringEnabled ? "active" : "inactive"}
                  />
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={formState.globalHiringEnabled}
                      onChange={() =>
                        setFormState((prev) => ({
                          ...prev,
                          globalHiringEnabled: !prev.globalHiringEnabled,
                        }))
                      }
                    />
                    <span className="slider round" />
                  </label>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}>
                    Linked Careers
                  </div>
                  <div style={{ fontSize: 12, color: "#717680", marginTop: 4 }}>
                    Allows linking parent and child career posts for candidate pipeline management.
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <OrganizationStatus
                    status={formState.linkedCareersEnabled ? "active" : "inactive"}
                  />
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={formState.linkedCareersEnabled}
                      onChange={() =>
                        setFormState((prev) => ({
                          ...prev,
                          linkedCareersEnabled: !prev.linkedCareersEnabled,
                        }))
                      }
                    />
                    <span className="slider round" />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

