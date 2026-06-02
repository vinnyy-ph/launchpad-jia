"use client";

import { useState } from "react";
import { api } from "@/lib/utils/apiClient";
import { candidateActionToast, errorToast, validateEmail } from "@/lib/Utils";
import { OrganizationMember } from "@/lib/types/organization";
import UsageProgressBar from "../../UsageProgressBar";

interface MemberListCardProps {
  orgId: string;
  orgName: string;
  members: OrganizationMember[];
  maxSeats: number | null; // null = unlimited
  adminCount: number;
  onUpdate: (members: OrganizationMember[]) => void;
}

const roleOptions = [
  { value: "hiring_manager", label: "Hiring Manager" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

export default function MemberListCard({
  orgId,
  orgName,
  members,
  maxSeats,
  adminCount,
  onUpdate,
}: MemberListCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedMembers, setEditedMembers] = useState<
    { email: string; role: string; error?: string }[]
  >(members.map((m) => ({ email: m.email, role: m.role })));

  const handleCancel = () => {
    setEditedMembers(members.map((m) => ({ email: m.email, role: m.role })));
    setIsEditing(false);
  };

  const validateMemberEmail = (email: string, index: number): string | null => {
    if (!email.trim()) return "Email is required";
    if (!validateEmail(email)) return "Invalid email address";
    const otherEmails = editedMembers.filter((_, i) => i !== index).map((m) => m.email);
    if (otherEmails.includes(email)) return "Duplicate email";
    return null;
  };

  const handleEmailChange = (index: number, email: string) => {
    const updated = [...editedMembers];
    updated[index].email = email;
    updated[index].error = validateMemberEmail(email, index) || undefined;
    setEditedMembers(updated);
  };

  const handleRoleChange = (index: number, role: string) => {
    const updated = [...editedMembers];
    updated[index].role = role;
    setEditedMembers(updated);
  };

  const handleDelete = (index: number) => {
    const updated = editedMembers.filter((_, i) => i !== index);
    setEditedMembers(updated);
  };

  const handleAddMember = () => {
    setEditedMembers([...editedMembers, { email: "", role: "hiring_manager" }]);
  };

  const handleSave = async () => {
    const validMembers = editedMembers.filter((m) => m.email.trim());
    const hasErrors = validMembers.some((m) => m.error);

    if (hasErrors) {
      errorToast("Please fix validation errors", 1300);
      return;
    }

    if (validMembers.length === 0) {
      errorToast("At least one member is required", 1300);
      return;
    }

    const newAdminCount = validMembers.filter(
      (m) => m.role === "admin"
    ).length;

    // Only check limit if not unlimited (maxSeats !== null)
    if (maxSeats !== null && newAdminCount > maxSeats) {
      errorToast(`Admin seats limit exceeded (max ${maxSeats})`, 1300);
      return;
    }

    setIsSaving(true);
    try {
      await api.post("/api/admin/update-organization", {
        orgID: orgId,
        members: validMembers,
      });

      const response = await api.get("/api/admin/get-organization-details", {
        params: { id: orgId },
      });

      onUpdate(response.data.members || []);
      candidateActionToast("Members updated", 1300, <i className="la la-check-circle text-success" />);
      setIsEditing(false);
    } catch (error: any) {
      errorToast(error.response?.data?.message || "Error updating members", 1300);
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleLabel = (role: string) => {
    return roleOptions.find((r) => r.value === role)?.label || role;
  };

  const getRoleBadgeStyle = (role: string) => {
    if (role === "super_admin") return { bg: "#FEF3F2", color: "#B42318" };
    if (role === "admin") return { bg: "#EEF4FF", color: "#3538CD", border: "1px solid #C7D7FE" };
    if (role === "hiring_manager") return { bg: "#FDF2FA", color: "#C11574", border: "1px solid #FCCEEE" };
    return { bg: "#F2F4F7", color: "#525866", border: "1px solid #D5D7DA" };
  };

  return (
    <div
      style={{
        background: "#F8F9FC",
        borderRadius: 16,
        padding: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          padding: "0 0 12px 0",
        }}
      >
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0 }}>
            Members
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>Maximum admin seats:</div>
            {maxSeats !== null ? (
              <>
                <div style={{ width: 110 }}>
                  <UsageProgressBar used={adminCount} total={maxSeats} showValues={false} height={6} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>
                  {adminCount}/{maxSeats}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>
                {adminCount} (Unlimited)
              </div>
            )}
          </div>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#fff",
              border: "1px solid #D5D7DA",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            <i className="la la-pencil" style={{ fontSize: 18, color: "#535862" }} />
          </button>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          boxShadow: "inset 0px 0px 2px 0px rgba(0,16,53,0.16)",
        }}
      >
        {isEditing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 40px", gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>Email</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>Role</span>
              <span></span>
            </div>

            {/* Member Rows */}
            {editedMembers.map((member, index) => (
              <div
                key={index}
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr 40px", gap: 12, alignItems: "start" }}
              >
                <div>
                  <input
                    type="email"
                    value={member.email}
                    onChange={(e) => handleEmailChange(index, e.target.value)}
                    placeholder="email@example.com"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      border: `1px solid ${member.error ? "#F04438" : "#E9EAEB"}`,
                      borderRadius: 8,
                      fontSize: 16,
                    }}
                  />
                  {member.error && (
                    <p style={{ fontSize: 12, color: "#F04438", margin: "4px 0 0" }}>{member.error}</p>
                  )}
                </div>
                <select
                  value={member.role}
                  onChange={(e) => handleRoleChange(index, e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "1px solid #E9EAEB",
                    borderRadius: 8,
                    fontSize: 16,
                    background: "#fff",
                  }}
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleDelete(index)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 8,
                  }}
                >
                  <i className="la la-trash" style={{ fontSize: 20, color: "#535862" }} />
                </button>
              </div>
            ))}

            {/* Add More Button */}
            <button
              onClick={handleAddMember}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                border: "1px solid #D5D7DA",
                borderRadius: 999,
                background: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                width: "fit-content",
              }}
            >
              <i className="la la-plus-circle" style={{ fontSize: 20 }} />
              Add more lines
            </button>

            {/* Actions */}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
              <button
                onClick={handleCancel}
                disabled={isSaving}
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
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
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
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {members.length === 0 ? (
              <p style={{ color: "#717680", textAlign: "center", padding: 24 }}>
                No members yet
              </p>
            ) : (
              members.map((member) => {
                const badgeStyle = getRoleBadgeStyle(member.role);
                return (
                  <div
                    key={member._id || member.email}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 0",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <img
                        src={member.image || `https://api.dicebear.com/9.x/shapes/svg?seed=${member.email}`}
                        alt=""
                        style={{ width: 40, height: 40, borderRadius: "50%" }}
                      />
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 500, color: "#181D27", margin: 0 }}>
                          {member.name || member.email.split("@")[0]}
                        </p>
                        <p style={{ fontSize: 12, color: "#717680", margin: 0 }}>
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <span
                      style={{
                        padding: "4px 12px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 500,
                        background: badgeStyle.bg,
                        color: badgeStyle.color,
                        border: (badgeStyle as any).border,
                      }}
                    >
                      {getRoleLabel(member.role)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
