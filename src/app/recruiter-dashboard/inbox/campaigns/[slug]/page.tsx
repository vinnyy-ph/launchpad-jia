"use client";

import React, { useEffect, useState } from "react";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import { useParams, useSearchParams } from "next/navigation";
import EmailModule from "@/lib/components/MailgunComponents/EmailModuleV2";
import { api } from "@/lib/utils/apiClient";

interface CampaignDetails {
  _id: string;
  subject: string;
  senderEmail: string;
  recipientCount: number;
  careerId?: string | null;
}

export default function () {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgID =
    searchParams.get("orgID") ||
    searchParams.get("orgId") ||
    searchParams.get("org");

  const campaignId = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  const [campaignDetails, setCampaignDetails] =
    useState<CampaignDetails | null>(null);

  useEffect(() => {
    if (!campaignId || !orgID) return;

    const fetchCampaignDetails = async () => {
      try {
        // Fetch all campaigns and find the matching one
        const response = await api.get("/api/add-email-campaign", {
          params: { orgId: orgID },
        });
        const campaigns = response.data.campaigns || [];
        const found = campaigns.find(
          (c: any) => String(c._id) === String(campaignId),
        );
        if (found) {
          setCampaignDetails(found);
        }
      } catch (error) {
        console.error("Failed to fetch campaign details:", error);
      }
    };

    fetchCampaignDetails();
  }, [campaignId, orgID]);

  return (
    <>
      <HeaderBar
        activeLink="Inbox"
        currentPage="Campaigns"
        icon="la la-envelope"
      />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
        <div className="row">
          <div className="col">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  marginBottom: "35px",
                }}
              >
                <h1
                  style={{
                    fontSize: "24px",
                    fontWeight: 550,
                    color: "#111827",
                  }}
                >
                  {campaignDetails ? campaignDetails.subject : "Loading..."}
                </h1>
                <span
                  style={{
                    fontSize: "16px",
                    color: "#717680",
                    fontWeight: 500,
                  }}
                >
                  {campaignDetails
                    ? `${campaignDetails.recipientCount} recipients`
                    : ""}
                </span>
              </div>
            </div>

            {/* Email Module (filtered for campaign) */}
            {campaignId && (
              <EmailModule
                campaignId={campaignId}
                careerId={campaignDetails?.careerId ?? undefined}
                hideCompose={true}
                orgId={orgID ?? undefined}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
