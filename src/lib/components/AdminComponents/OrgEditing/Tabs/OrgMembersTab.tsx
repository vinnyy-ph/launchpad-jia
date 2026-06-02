"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/utils/apiClient";
import { errorToast } from "@/lib/Utils";
import { Organization, OrganizationMember } from "@/lib/types/organization";
import MemberListCard from "../Cards/MemberListCard";

interface OrgMembersTabProps {
  organization: Organization;
  onUpdate: (updates: Partial<Organization>) => void;
}

export default function OrgMembersTab({ organization, onUpdate }: OrgMembersTabProps) {
  const [members, setMembers] = useState<OrganizationMember[]>(organization.members || []);
  const [maxSeats, setMaxSeats] = useState<number | null>(5);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [orgResponse, planResponse] = await Promise.all([
          api.get("/api/admin/get-organization-details", { params: { id: organization._id } }),
          api.get("/api/pricing-plan/admin/get-org-plan-details", { params: { orgId: organization._id } }),
        ]);

        setMembers(orgResponse.data.members || []);
        // Use the combined admin seats from usage (which sums both plan types)
        const combinedMaxSeats = planResponse?.data?.usage?.maxAdminSeats;
        if (combinedMaxSeats !== undefined) {
          setMaxSeats(combinedMaxSeats); // Can be null for unlimited
        }
      } catch (error) {
        console.error("Error fetching members:", error);
        errorToast("Error fetching members", 1300);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [organization._id]);

  const handleMembersUpdate = (updatedMembers: OrganizationMember[]) => {
    setMembers(updatedMembers);
    onUpdate({ members: updatedMembers });
  };

  const adminCount = members.filter(
    (m) => m.role === "admin"
  ).length;

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <i className="la la-spinner la-spin" style={{ fontSize: 32, color: "#717680" }} />
        <p style={{ color: "#717680", marginTop: 12 }}>Loading members...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <MemberListCard
        orgId={organization._id!}
        orgName={organization.name}
        members={members}
        maxSeats={maxSeats}
        adminCount={adminCount}
        onUpdate={handleMembersUpdate}
      />
    </div>
  );
}
