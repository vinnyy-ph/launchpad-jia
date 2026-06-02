"use client";

import React, { useState, useRef, useMemo, useCallback } from "react";
import TableLoader from "@/lib/Loader/TableLoader";
import ApplicantStatusBadge from "@/lib/components/CareerComponents/ApplicantStatusBadge";
import { CandidateHoverCard } from "./CandidateHoverCard";

const tableHeaderStyle: React.CSSProperties = {
  textTransform: "none",
  fontWeight: 550,
};

type Props = {
  loading: boolean;
  applicants: any[];
  totalApplicants: number;
  totalPages: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  onRowClick?: (applicant: any) => void;
};

export default function ApplicantsTable({
  loading,
  applicants,
  totalApplicants,
  totalPages,
  currentPage,
  setCurrentPage,
  onRowClick,
}: Props) {
  const [hoveredApplicantId, setHoveredApplicantId] = useState<string | null>(null);
  const [hoveredAnchorRect, setHoveredAnchorRect] = useState<DOMRect | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  // Prevent setState-after-unmount if a hover timeout is pending
  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
    };
  }, []);

  const guestOrgId = useMemo(() => {
    try {
      if (typeof window === "undefined") return null;
      const raw = localStorage.getItem("guestOrg");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?._id || null;
    } catch {
      return null;
    }
  }, []);

  const handleHoverEnter = useCallback((applicantId: string, rect: DOMRect) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredApplicantId(applicantId);
    setHoveredAnchorRect(rect);
  }, []);

  const handleHoverLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      setHoveredApplicantId(null);
      setHoveredAnchorRect(null);
      hoverTimeoutRef.current = null;
    }, 200);
  }, []);

  const handleHoverCardEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  return (
    <div className="layered-card-outer">
      <div className="layered-card-content" style={{ padding: 0 }}>
        <div style={{ margin: "15px 20px" }}>
          <h3
            className="mb-0 mr-auto d-flex align-items-center"
            style={{ fontSize: "18px", fontWeight: 550, color: "#111827" }}
          >
            Applicants
            <div
              style={{
                borderRadius: "20px",
                border: "1px solid #D5D9EB",
                backgroundColor: "#F8F9FC",
                color: "#363F72",
                fontSize: "12px",
                padding: "0 10px",
                marginLeft: "10px",
              }}
            >
              {totalApplicants}
            </div>
          </h3>
        </div>

        <div className="table-responsive">
          {loading ? (
            <table className="table align-items-center table-flush">
              <thead>
                <tr>
                  <th scope="col" style={tableHeaderStyle}>
                    Candidates
                  </th>
                  <th scope="col" style={tableHeaderStyle}>
                    Application Status
                  </th>
                  <th scope="col" style={tableHeaderStyle}>
                    Stage
                  </th>
                  <th scope="col" style={tableHeaderStyle}>
                    Date Applied
                  </th>
                  <th scope="col" style={tableHeaderStyle}>
                    Stage Updated
                  </th>
                </tr>
              </thead>
              <tbody className="list">
                <TableLoader type="career-applicants" />
              </tbody>
            </table>
          ) : (
            <table className="table align-items-center table-flush">
              <thead>
                <tr>
                  <th scope="col" style={tableHeaderStyle}>
                    Candidates
                  </th>
                  <th scope="col" style={tableHeaderStyle}>
                    Application Status
                  </th>
                  <th scope="col" style={tableHeaderStyle}>
                    Stage
                  </th>
                  <th scope="col" style={tableHeaderStyle}>
                    Date Applied
                  </th>
                  <th scope="col" style={tableHeaderStyle}>
                    Stage Updated
                  </th>
                </tr>
              </thead>
              <tbody className="list">
                {applicants.length === 0 ? (
                  <tr style={{ cursor: "default", pointerEvents: "none" }}>
                    <td
                      colSpan={8}
                      className="text-center py-4"
                      style={{ verticalAlign: "middle", height: "200px" }}
                    >
                      <div
                        className="d-flex justify-content-center align-items-center w-100 h-100"
                        style={{ minHeight: "100px" }}
                      >
                        No applicants found
                      </div>
                    </td>
                  </tr>
                ) : (
                  applicants.map((applicant: any) => {
                    const applicantId = applicant._id?.toString() || applicant.interviewID || "";
                    const isHovered = hoveredApplicantId === applicantId;

                    return (
                      <tr
                        key={applicant._id}
                        style={{ cursor: onRowClick ? "pointer" : "default" }}
                        onClick={() => {
                          if (!onRowClick) return;
                          onRowClick(applicant);
                        }}
                      >
                        <td>
                          <div
                            className="candidate-card-section"
                            style={{ position: "relative" }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              handleHoverEnter(applicantId, rect);
                            }}
                            onMouseLeave={handleHoverLeave}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onRowClick) {
                                onRowClick(applicant);
                              }
                            }}
                          >
                            <img
                              src={applicant?.image || "/default-avatar.png"}
                              alt={applicant?.name}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: "#E0E0E0",
                                cursor: onRowClick ? "pointer" : "default",
                                transition: "transform 0.2s ease",
                                transform: isHovered ? "scale(1.05)" : "scale(1)",
                              }}
                            />
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 14 }}>{applicant?.name || ""}</div>
                              <div style={{ fontSize: 12, color: "#787486" }}>{applicant?.email || ""}</div>
                            </div>

                            {isHovered && (
                              <CandidateHoverCard
                                candidate={{
                                  name: applicant?.name || "",
                                  email: applicant?.email || "",
                                  avatar: applicant?.image || "/default-avatar.png",
                                  fit: applicant?.cvStatus,
                                  endorsedBy: applicant?.endorsedBy,
                                  endorsedByAvatar: applicant?.endorsedByAvatar,
                                }}
                                guestOrgId={guestOrgId}
                                onMouseEnter={handleHoverCardEnter}
                                onMouseLeave={handleHoverLeave}
                                usePortal={true}
                                anchorRect={hoveredAnchorRect}
                              />
                            )}
                          </div>
                        </td>
                        <td>
                          <ApplicantStatusBadge status={applicant?.applicationStatus || "Ongoing"} />
                        </td>
                        <td>{applicant.stage}</td>
                        <td>
                          {applicant.createdAt
                            ? new Date(applicant.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "N/A"}
                        </td>
                        <td>
                          {applicant.updatedAt
                            ? new Date(applicant.updatedAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "N/A"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          <div
            className="d-flex justify-content-between align-items-center border-top"
            style={{ padding: "15px 20px" }}
          >
            <button
              className={`btn btn-primary shadow-none ${currentPage === 1 ? "invisible" : ""}`}
              style={{
                backgroundColor: "white",
                color: "black",
                border: "1px solid lightgray",
                borderRadius: "60px",
              }}
              onClick={() => {
                if (currentPage > 1) {
                  setCurrentPage(currentPage - 1);
                }
              }}
            >
              <i className="la la-arrow-left"></i> Previous
            </button>

            <div>
              {Array.from({ length: totalPages }, (_, index) => (
                <button
                  key={index}
                  className={`btn shadow-none ${currentPage === index + 1 ? "btn-primary" : ""}`}
                  style={{
                    backgroundColor: currentPage === index + 1 ? "#F8F8F8" : "white",
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

            <button
              className={`btn btn-primary shadow-none ${currentPage >= totalPages ? "invisible" : ""}`}
              style={{
                backgroundColor: "white",
                color: "black",
                border: "1px solid lightgray",
                fontSize: "14px",
                fontWeight: 550,
                borderRadius: "60px",
              }}
              onClick={() => {
                if (currentPage < totalPages) {
                  setCurrentPage(currentPage + 1);
                }
              }}
            >
              <i className="la la-arrow-right"></i> Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
