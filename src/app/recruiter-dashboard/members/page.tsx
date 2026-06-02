"use client";

import React, { useState, useEffect } from "react";
import MembersV2Table from "@/lib/components/DataTables/MembersTableV2";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import { AdminSeatLimitBanner } from "@/lib/components/LimitBanner";
import { api } from "@/lib/utils/apiClient";
import { useSearchParams } from "next/navigation";
import { Tooltip } from "react-tooltip";
import { Button } from "@/lib/components/ui";

export default function MembersPage() {
  const searchParams = useSearchParams();
  const orgID = searchParams.get("orgID");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [hasPlan, setHasPlan] = useState(false);
  const [adminSeatUsage, setAdminSeatUsage] = useState<{ used: number; max: number | null }>({ used: 0, max: null });

  // Fetch plan status and admin seat usage to determine if invite button should be disabled
  useEffect(() => {
    const fetchPlanStatus = async () => {
      if (!orgID) return;
      try {
        const response = await api.get("/api/pricing-plan/get-plan-details", {
          params: { orgID },
        });
        setHasPlan(response.data.hasPlan || false);
        const usage = response.data.usage || {};
        setAdminSeatUsage({
          used: usage.adminSeatsUsed || 0,
          max: usage.maxAdminSeats !== undefined ? usage.maxAdminSeats : null,
        });
      } catch (error) {
        console.error("Error fetching plan status:", error);
      }
    };
    fetchPlanStatus();
  }, [orgID]);

  // Check if admin seats are at or over limit
  const isAdminSeatLimitReached = adminSeatUsage.max !== null && adminSeatUsage.used >= adminSeatUsage.max;
  const isButtonDisabled = !hasPlan || isAdminSeatLimitReached;

  // Determine tooltip message
  const getTooltipMessage = () => {
    if (!hasPlan) {
      return "This organization does not have an active plan. Please contact your administrator to assign a plan.";
    }
    if (isAdminSeatLimitReached) {
      return `Admin seat limit reached (${adminSeatUsage.used}/${adminSeatUsage.max}). Remove an admin before inviting new members.`;
    }
    return "";
  };

  return (
    <>
      <AdminSeatLimitBanner />
      <HeaderBar activeLink="Members" currentPage="Overview" icon="la la-users" />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
        <div className="row">
          <div className="col">
            {/* Page Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "35px"
            }}>
              <div>
                <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#181D27", marginBottom: 4 }}>Members</h1>
                <span style={{ fontSize: "16px", color: "#717680", fontWeight: 500 }}>
                  Manage your team members and their account permissions here.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  data-tooltip-id="invite-member-tooltip"
                  data-tooltip-html={getTooltipMessage()}
                  style={{ display: "inline-block" }}
                >
                  <Button
                    onClick={() => setShowInviteModal(true)}
                    disabled={isButtonDisabled}
                    variant="primary"
                    label="Invite members"
                    icon="/icons/plus.svg"
                    style={{
                      opacity: isButtonDisabled ? 0.5 : 1,
                    }}
                  />
                </div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  borderRadius: 999,
                  border: "1px solid #D5D7DA",
                  background: "#fff",
                  minWidth: 200,
                }}>
                  <i className="la la-search" style={{ fontSize: 18, color: "#717680" }} />
                  <input
                    type="text"
                    placeholder="Search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      border: "none",
                      outline: "none",
                      fontSize: 14,
                      color: "#181D27",
                      background: "transparent",
                      width: "100%",
                    }}
                  />
                </div>
              </div>
            </div>
            <MembersV2Table
              externalShowInviteModal={showInviteModal}
              onCloseInviteModal={() => setShowInviteModal(false)}
              externalSearch={searchTerm}
            />
          </div>
        </div>
      </div>
      {isButtonDisabled && <Tooltip className="career-fit-tooltip fade-in" id="invite-member-tooltip" />}
    </>
  );
}