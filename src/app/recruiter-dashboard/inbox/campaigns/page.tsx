"use client";

import React, { useEffect, useState, useMemo } from "react";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/utils/apiClient";
import Button from "@/lib/components/ui/button/Button";

interface Campaign {
  _id: string;
  subject: string;
  senderEmail: string;
  recipientCount: number;
  createdAt: string;
}

const tableHeaderStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#717680",
  textTransform: "none",
  letterSpacing: "0",
};

export default function () {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgID =
    searchParams.get("orgID") ||
    searchParams.get("orgId") ||
    searchParams.get("org");

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(campaigns.length / ITEMS_PER_PAGE));
  const paginatedCampaigns = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return campaigns.slice(start, start + ITEMS_PER_PAGE);
  }, [campaigns, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages >= 1) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    if (!orgID) return;

    const fetchCampaigns = async () => {
      try {
        setIsLoading(true);
        const response = await api.get("/api/add-email-campaign", {
          params: { orgId: orgID },
        });
        setCampaigns(response.data.campaigns || []);
        setCurrentPage(1);
      } catch (error) {
        console.error("Failed to fetch campaigns:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCampaigns();
  }, [orgID]);

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
                marginBottom: "35px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                }}
              >
                <h1
                  style={{
                    fontSize: "24px",
                    fontWeight: 550,
                    color: "#111827",
                  }}
                >
                  Campaigns
                </h1>
                <span
                  style={{
                    fontSize: "16px",
                    color: "#717680",
                    fontWeight: 500,
                  }}
                >
                  Easily keep track of all email campaigns.
                </span>
              </div>
            </div>

            <div className="layered-card-outer">
              <div
                className="layered-card-content"
                style={{ padding: 0, gap: 0 }}
              >
                {/* Card header */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: "15px 20px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: 600,
                          color: "#181D27",
                        }}
                      >
                        Email Campaigns
                      </div>
                      <div
                        style={{
                          borderRadius: 999,
                          border: "1px solid #D5D9EB",
                          backgroundColor: "#F8F9FC",
                          color: "#363F72",
                          fontSize: "12px",
                          padding: "2px 10px",
                          fontWeight: 500,
                        }}
                      >
                        {campaigns.length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Campaigns table */}
                <div className="table-responsive">
                  <table className="table table-hover" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={tableHeaderStyle}>Email Subject</th>
                        <th style={tableHeaderStyle}>Sender Email</th>
                        <th style={tableHeaderStyle}>Recipients</th>
                        <th style={tableHeaderStyle}>Created On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="text-center py-4"
                            style={{ fontWeight: 500, color: "#000" }}
                          >
                            Loading campaigns...
                          </td>
                        </tr>
                      ) : campaigns.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="text-center py-4"
                            style={{ fontWeight: 500, color: "#000" }}
                          >
                            No campaigns found.
                          </td>
                        </tr>
                      ) : (
                        paginatedCampaigns.map((campaign) => (
                          <tr
                            key={campaign._id}
                            style={{
                              cursor: "pointer",
                              transition: "background-color 0.2s ease",
                            }}
                            onClick={() =>
                              router.push(
                                `/recruiter-dashboard/inbox/campaigns/${campaign._id}?orgId=${orgID}`,
                              )
                            }
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#f8f9fa";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "transparent";
                            }}
                          >
                            <td style={{ fontWeight: 500, color: "#000" }}>
                              {campaign.subject}
                            </td>
                            <td style={{ fontWeight: 500, color: "#000" }}>
                              {campaign.senderEmail}
                            </td>
                            <td style={{ fontWeight: 500, color: "#000" }}>
                              {campaign.recipientCount}
                            </td>
                            <td style={{ fontWeight: 500, color: "#000" }}>
                              {new Date(campaign.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "numeric",
                                  minute: "numeric",
                                  hour12: true,
                                },
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                <div
                  className="d-flex justify-content-between align-items-center border-top"
                  style={{ padding: "15px 20px" }}
                >
                  <Button
                    variant="secondary"
                    disabled={currentPage === 1}
                    onClick={() => {
                      if (currentPage > 1) {
                        setCurrentPage(currentPage - 1);
                      }
                    }}
                    label="Previous"
                    icon="/icons/arrow.svg"
                  ></Button>

                  <div>
                    {Array.from({ length: totalPages }, (_, index) => (
                      <button
                        key={index}
                        className={`btn shadow-none ${currentPage === index + 1 ? "btn-primary" : ""}`}
                        style={{
                          backgroundColor:
                            currentPage === index + 1 ? "#F8F8F8" : "white",
                          color: "black",
                          border: "none",
                          fontSize: "14px",
                          fontWeight: 550,
                        }}
                        onClick={() => {
                          setCurrentPage(index + 1);
                        }}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>

                  <Button
                    variant="secondary"
                    disabled={currentPage >= totalPages}
                    onClick={() => {
                      if (currentPage < totalPages) {
                        setCurrentPage(currentPage + 1);
                      }
                    }}
                    label="Next"
                    icon="/icons/arrow.svg"
                    iconStyle={{ transform: "rotate(180deg)" }}
                    iconPosition="right"
                  ></Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
