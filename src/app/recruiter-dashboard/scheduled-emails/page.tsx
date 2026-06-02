"use client";

import React, { useEffect, useState } from "react";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/utils/apiClient";
import { errorToast } from "@/lib/Utils";
import TablePagination from "@/lib/components/TablePagination";
import useDebounce from "@/lib/hooks/useDebounceHook";

const tableHeaderStyle: React.CSSProperties = {
  textTransform: "none",
  fontWeight: 700,
  fontSize: 12,
  color: "#717680",
  padding: "12px 16px",
  textAlign: "left",
  borderBottom: "1px solid #EAECF0",
};

const boldColumnStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 700,
  color: "#181D27",
  padding: "12px 16px",
};

const regularColumnStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 500,
  color: "#717680",
  padding: "12px 16px",
};

const statusBadgeStyle = (status: string): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    padding: "4px 12px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: 600,
    display: "inline-block",
  };

  switch (status) {
    case "active":
      return { ...baseStyle, backgroundColor: "#E0F2FE", color: "#0369A1" };
    case "sent":
      return { ...baseStyle, backgroundColor: "#D1FAE5", color: "#065F46" };
    case "failed":
      return { ...baseStyle, backgroundColor: "#FEE2E2", color: "#991B1B" };
    case "cancelled":
      return { ...baseStyle, backgroundColor: "#F3F4F6", color: "#6B7280" };
    default:
      return { ...baseStyle, backgroundColor: "#F3F4F6", color: "#6B7280" };
  }
};

export default function ScheduledEmailsPage() {
  const searchParams = useSearchParams();
  
  // Get orgID from URL params or localStorage (like other pages)
  const getOrgID = () => {
    const urlOrgID = searchParams.get("orgID") || searchParams.get("orgId") || searchParams.get("org");
    if (urlOrgID) return urlOrgID;
    
    // Fallback to localStorage like other pages
    if (typeof window !== "undefined") {
      try {
        const activeOrg = localStorage.getItem("activeOrg");
        if (activeOrg) {
          const org = JSON.parse(activeOrg);
          return org._id || org.id;
        }
      } catch (e) {
        console.error("Error parsing activeOrg from localStorage:", e);
      }
    }
    return null;
  };
  
  const orgID = getOrgID();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [page, setPage] = useState(1);
  const [limitPerPage, setLimitPerPage] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [scheduledEmails, setScheduledEmails] = useState<any[]>([]);
  const [totalEmails, setTotalEmails] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    if (!orgID) {
      console.warn("No orgID found - cannot fetch scheduled emails");
      setIsLoading(false);
      return;
    }

    const fetchScheduledEmails = async () => {
      try {
        setIsLoading(true);
        const params: any = {
          orgID,
          page,
          limit: limitPerPage,
        };

        if (statusFilter) {
          params.status = statusFilter;
        }

        if (debouncedSearch) {
          params.search = debouncedSearch;
        }

        const response = await api.get("/api/scheduled-emails", { params });
        const data = response.data;

        console.log("Scheduled emails response:", data);

        if (data.success) {
          setScheduledEmails(data.data || []);
          setTotalEmails(data.pagination?.total || 0);
          setTotalPages(data.pagination?.totalPages || 0);
        } else {
          console.error("API returned success: false", data);
          errorToast(data.error || "Failed to fetch scheduled emails", 1300);
        }
      } catch (error: any) {
        console.error("Error fetching scheduled emails:", error);
        console.error("Error response:", error.response?.data);
        errorToast(error.response?.data?.error || "Failed to fetch scheduled emails", 1300);
      } finally {
        setIsLoading(false);
      }
    };

    fetchScheduledEmails();
  }, [orgID, page, limitPerPage, statusFilter, debouncedSearch]);

  const formatDate = (date: string | Date) => {
    if (!date) return "N/A";
    try {
      const d = new Date(date);
      return d.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "N/A";
    }
  };

  const formatScheduleInfo = (email: any) => {
    if (email.scheduleDelay && email.scheduleDelayUnit) {
      const delay = `${email.scheduleDelay} ${email.scheduleDelayUnit}`;
      if (email.enablePreferredTime && email.preferredTime) {
        return `${delay} at ${email.preferredTime}`;
      }
      return delay;
    }
    if (email.enablePreferredTime && email.preferredTime) {
      return `Preferred time: ${email.preferredTime}`;
    }
    return "N/A";
  };

  const getTimeUntilSend = (sendDate: string | Date, status?: string) => {
    if (!sendDate) return "N/A";
    
    // If email is already sent, show "Sent"
    if (status === "sent") {
      return "Sent";
    }
    
    try {
      const now = new Date();
      const send = new Date(sendDate);
      const diff = send.getTime() - now.getTime();

      if (diff < 0) {
        // If status is failed or cancelled, show the status
        if (status === "failed") return "Failed";
        if (status === "cancelled") return "Cancelled";
        // Otherwise show "Past due" for active emails that missed their send time
        return "Past due";
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        return `${days}d ${hours}h`;
      } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else {
        return `${minutes}m`;
      }
    } catch {
      return "N/A";
    }
  };

  return (
    <>
      <HeaderBar
        activeLink="Scheduled Emails"
        currentPage="Overview"
        icon="la la-clock"
      />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
        <div className="row">
          <div className="col">
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
                  marginBottom: "8px",
                }}
              >
                Scheduled Emails
              </h1>
              <span
                style={{
                  fontSize: "16px",
                  color: "#717680",
                  fontWeight: 500,
                }}
              >
                View and manage all scheduled email sends.
              </span>
            </div>

            {/* Filters */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                marginBottom: "24px",
                flexWrap: "wrap",
              }}
            >
              <input
                type="text"
                placeholder="Search by recipient or subject..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  minWidth: "300px",
                  flex: 1,
                }}
              />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  backgroundColor: "white",
                  cursor: "pointer",
                }}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={limitPerPage}
                onChange={(e) => {
                  setLimitPerPage(Number(e.target.value));
                  setPage(1);
                }}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  backgroundColor: "white",
                  cursor: "pointer",
                }}
              >
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="30">30 per page</option>
                <option value="50">50 per page</option>
              </select>
            </div>

            {/* Table */}
            <div
              style={{
                borderRadius: "16px",
                border: "1px solid #EAECF0",
                overflow: "hidden",
                background: "#FFFFFF",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#F9FAFB" }}>
                    <th style={tableHeaderStyle}>Recipient</th>
                    <th style={tableHeaderStyle}>Subject</th>
                    <th style={tableHeaderStyle}>Sender</th>
                    <th style={tableHeaderStyle}>Schedule</th>
                    <th style={tableHeaderStyle}>Send Date</th>
                    <th style={tableHeaderStyle}>Time Until Send</th>
                    <th style={tableHeaderStyle}>Status</th>
                    <th style={tableHeaderStyle}>Mode</th>
                    <th style={tableHeaderStyle}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} style={{ ...regularColumnStyle, textAlign: "center" }}>
                        Loading...
                      </td>
                    </tr>
                  ) : scheduledEmails.length > 0 ? (
                    scheduledEmails.map((email) => (
                      <tr
                        key={email._id}
                        style={{
                          borderTop: "1px solid #EAECF0",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#F9FAFB";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <td style={boldColumnStyle}>{email.to || "N/A"}</td>
                        <td style={regularColumnStyle}>
                          {email.subject || "N/A"}
                        </td>
                        <td style={regularColumnStyle}>
                          {email.sender || "N/A"}
                        </td>
                        <td style={regularColumnStyle}>
                          {formatScheduleInfo(email)}
                        </td>
                        <td style={regularColumnStyle}>
                          {formatDate(email.sendDate)}
                        </td>
                        <td style={regularColumnStyle}>
                          {getTimeUntilSend(email.sendDate, email.status)}
                        </td>
                        <td style={regularColumnStyle}>
                          <span style={statusBadgeStyle(email.status)}>
                            {email.status || "N/A"}
                          </span>
                        </td>
                        <td style={regularColumnStyle}>
                          <span
                            style={{
                              textTransform: "uppercase",
                              fontSize: "12px",
                              fontWeight: 600,
                              color: email.mode === "gmail" ? "#0369A1" : "#7C3AED",
                            }}
                          >
                            {email.mode || "N/A"}
                          </span>
                        </td>
                        <td style={regularColumnStyle}>
                          {formatDate(email.createdAt)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} style={{ ...regularColumnStyle, textAlign: "center", padding: "48px" }}>
                        <div>
                          <p style={{ margin: 0, marginBottom: 4, fontWeight: 600, color: "#1D2939" }}>
                            No scheduled emails found
                          </p>
                          <p style={{ margin: 0, fontSize: "14px", color: "#667085" }}>
                            Scheduled emails will appear here.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ marginTop: "24px" }}>
                <TablePagination
                  currentPage={page}
                  totalPages={totalPages}
                  setCurrentPage={setPage}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
