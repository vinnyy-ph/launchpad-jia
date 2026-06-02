import React, { useEffect, useState } from "react";
import { OrgFormState, MEMBER_ROLE_OPTIONS } from "@/lib/types/orgForm";
import { validateEmail } from "@/lib/Utils";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import { api } from "@/lib/utils/apiClient";
import { PricingPlan } from "@/lib/types/organization";

interface OrgMembersStepProps {
  formState: OrgFormState;
  setFormState: React.Dispatch<React.SetStateAction<OrgFormState>>;
  validationErrors: Record<string, boolean>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export default function OrgMembersStep({
  formState,
  setFormState,
  validationErrors,
  setValidationErrors,
}: OrgMembersStepProps) {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setIsLoadingPlans(true);
        const response = await api.get("/api/pricing-plan/admin/get-pricing-plans");
        setPlans(response.data);
      } catch (error) {
        console.error("Error fetching plans:", error);
      } finally {
        setIsLoadingPlans(false);
      }
    };
    fetchPlans();
  }, []);

  const selectedPlan = plans.find((p) => p._id === formState.planId);
  const maxAdminSeats = selectedPlan?.maxAdminSeats ?? null;

  const adminCount = formState.members.filter(
    (m) => m.role === "admin"
  ).length;

  const handleEmailChange = (index: number, email: string) => {
    setFormState((prev) => {
      const newMembers = [...prev.members];
      const emailError =
        email && !validateEmail(email) ? "Please enter a valid email address" : undefined;
      const duplicateError =
        email &&
          newMembers.some(
            (m, i) => i !== index && m.email.toLowerCase() === email.toLowerCase()
          )
          ? "This email is already added"
          : undefined;
      newMembers[index] = {
        ...newMembers[index],
        email,
        error: emailError || duplicateError,
      };
      return { ...prev, members: newMembers };
    });
    if (validationErrors.members) {
      setValidationErrors((prev) => ({ ...prev, members: false }));
    }
  };

  const handleRoleChange = (index: number, role: string) => {
    setFormState((prev) => {
      const newMembers = [...prev.members];
      newMembers[index] = { ...newMembers[index], role };
      return { ...prev, members: newMembers };
    });
    if (validationErrors.members) {
      setValidationErrors((prev) => ({ ...prev, members: false }));
    }
  };

  const handleAddMember = () => {
    setFormState((prev) => ({
      ...prev,
      members: [...prev.members, { email: "", role: "" }],
    }));
  };

  const handleRemoveMember = (index: number) => {
    setFormState((prev) => {
      const newMembers = prev.members.filter((_, i) => i !== index);
      // Always keep at least one row
      if (newMembers.length === 0) {
        return { ...prev, members: [{ email: "", role: "" }] };
      }
      return { ...prev, members: newMembers };
    });
  };

  const formatRoleName = (role: string) => {
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const gradient = "linear-gradient(90deg, #fccec0 0%, #ebacc9 33%, #ceb6da 66%, #9fcaed 100%)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      {/* Members Card */}
      <div className="layered-card-outer">
        <div className="layered-card-middle">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>Members</span>
                {validationErrors.members && (
                  <span style={{ fontSize: 12, color: "#EF4444" }}>
                    (At least one member with valid email and role is required)
                  </span>
                )}
              </div>
              {!isLoadingPlans && formState.planId && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, color: "#717680", fontWeight: 500 }}>
                    Maximum admin seats:
                  </span>
                  <div
                    style={{
                      width: 120,
                      height: 8,
                      background: "#E9EAEB",
                      borderRadius: 999,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width:
                          maxAdminSeats === null
                            ? "100%"
                            : `${Math.min(100, (adminCount / maxAdminSeats) * 100)}%`,
                        height: "100%",
                        background: gradient,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 14, color: "#717680", fontWeight: 500 }}>
                    {adminCount}/{maxAdminSeats === null ? "Unlimited" : maxAdminSeats}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="layered-card-content">
            <span className="text-sm text-gray-500 mb-4">
              Adding new members automatically sends them an email invite link to Jia.
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Header Row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 50px",
                  gap: 16,
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: "#717680" }}>Email</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#717680" }}>Role</span>
                <span />
              </div>

              {/* Member Rows */}
              {formState.members.map((member, index) => (
                <div key={index} style={{ display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 50px",
                      gap: 16,
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="email"
                      value={member.email}
                      placeholder="Enter email address"
                      style={{
                        width: "100%",
                        height: "48px",
                        padding: "0.375rem 0.75rem",
                        fontSize: "1rem",
                        backgroundColor: "#FFFFFF",
                        border: `1px solid ${member.error ? "#EF4444" : "#E9EAEB"}`,
                        borderRadius: "8px",
                      }}
                      onChange={(e) => handleEmailChange(index, e.target.value)}
                    />
                    <CustomDropdown
                      onSelectSetting={(role) => handleRoleChange(index, role)}
                      screeningSetting={member.role}
                      settingList={MEMBER_ROLE_OPTIONS}
                      placeholder="Select role"
                      formatName={formatRoleName}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(index)}
                      style={{
                        width: 40,
                        height: 40,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#717680",
                      }}
                    >
                      <i className="la la-trash" style={{ fontSize: 20 }} />
                    </button>
                  </div>
                  {member.error && (
                    <span
                      style={{
                        fontSize: 12,
                        color: "#EF4444",
                        marginTop: 4,
                      }}
                    >
                      {member.error}
                    </span>
                  )}
                </div>
              ))}

              {/* Add More Button */}
              <button
                type="button"
                onClick={handleAddMember}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#414651",
                  fontSize: 14,
                  fontWeight: 500,
                  padding: "8px 0",
                }}
              >
                <i className="la la-plus-circle" style={{ fontSize: 20 }} />
                Add more lines
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

