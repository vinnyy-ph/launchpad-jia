"use client";

import React, { useState, useRef, useMemo, useCallback } from "react";
import { CandidateHoverCard } from "../CandidateHoverCard";
import { useCandidateDetailsData } from "./useCandidateDetailsData";
import { useRegenerateCV } from "../../CandidateCVUtils";
import { EvaluationByJiaSection } from "./sections/EvaluationByJiaSection";
import { ExperienceSection } from "./sections/ExperienceSection";
import { ContactInformationSection } from "./sections/ContactInformationSection";
import { EducationSection } from "./sections/EducationSection";
import { CertificationsSection } from "./sections/CertificationsSection";
import { ProjectsSection } from "./sections/ProjectsSection";
import { SkillsSection } from "./sections/SkillsSection";

type CandidateDetailsModalProps = {
  candidate: {
    _id?: string;
    interviewID?: string;
    name: string;
    email: string;
    image?: string;
    fit?: string;
    endorsedBy?: string;
    endorsedByAvatar?: string;
  };
  onClose: () => void;
};

export function CandidateDetailsModal({ candidate, onClose }: CandidateDetailsModalProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeoutRef = useRef<number | null>(null);
  const [hoveredAnchorRect, setHoveredAnchorRect] = useState<DOMRect | null>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  // Prevent setState-after-unmount if a tooltip hide timeout is pending
  React.useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
        tooltipTimeoutRef.current = null;
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

  const interviewID = candidate.interviewID || candidate._id?.toString() || "";
  const { interviewData, cvData, orgSkills, cvSkills, isLoading, error, refetch } = useCandidateDetailsData(
    interviewID,
    candidate.email,
    guestOrgId,
  );

  // Use the shared regenerate hook
  const {
    regenerate: handleRegenerate,
    isLoading: regenerateLoading,
    error: regenerateError,
    clearError: clearRegenerateError,
  } = useRegenerateCV(interviewID, candidate.email, refetch);

  const handleTooltipMouseEnter = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    if (avatarRef.current) {
      setHoveredAnchorRect(avatarRef.current.getBoundingClientRect());
    }
    setShowTooltip(true);
  }, []);

  const handleTooltipMouseLeave = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = window.setTimeout(() => {
      setShowTooltip(false);
      setHoveredAnchorRect(null);
      tooltipTimeoutRef.current = null;
    }, 200);
  }, []);

  return (
    <div className="modal-background fade-in-bottom" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div
          className="modal-content"
          style={{
            overflowY: "auto",
            height: "100vh",
            maxWidth: "80vw",
            background: "#fff",
            border: `1.5px solid #E9EAEB`,
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(30,32,60,0.18)",
          }}
        >
          <div className="modal-header">
            <h3 className="modal-title">Candidate Details</h3>
            <button
              type="button"
              className="close"
              data-dismiss="modal"
              aria-label="Close"
              onClick={onClose}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>

          <div className="modal-body">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  ref={avatarRef}
                  className="candidate-avatar-container"
                  style={{ position: "relative", display: "inline-block" }}
                  onMouseEnter={handleTooltipMouseEnter}
                  onMouseLeave={handleTooltipMouseLeave}
                >
                  {candidate.image ? (
                    <img
                      src={candidate.image}
                      alt={candidate.name}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: "#E0E0E0",
                        cursor: "pointer",
                        transition: "transform 0.2s ease",
                        transform: showTooltip ? "scale(1.05)" : "scale(1)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "50%",
                        backgroundColor: "#F8F9FC",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        transition: "transform 0.2s ease",
                        transform: showTooltip ? "scale(1.05)" : "scale(1)",
                      }}
                    >
                      <span style={{ fontSize: "18px", color: "#3E4784", fontWeight: 500 }}>
                        {candidate.name
                          ?.split(" ")
                          .map((name: string) => name[0])
                          .join("")}
                      </span>
                    </div>
                  )}

                  {showTooltip && (
                    <CandidateHoverCard
                      candidate={{
                        name: candidate.name,
                        email: candidate.email,
                        avatar: candidate.image,
                        fit: candidate.fit,
                        endorsedBy: candidate.endorsedBy,
                        endorsedByAvatar: candidate.endorsedByAvatar,
                      }}
                      guestOrgId={guestOrgId}
                      onMouseEnter={handleTooltipMouseEnter}
                      onMouseLeave={handleTooltipMouseLeave}
                      usePortal={true}
                      anchorRect={hoveredAnchorRect}
                    />
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{candidate.name}</div>
                  <div style={{ fontSize: 12, color: "#787486" }}>{candidate.email}</div>
                </div>
              </div>
            </div>

            {regenerateError && (
              <div
                style={{
                  padding: "12px 16px",
                  marginBottom: "16px",
                  backgroundColor: "#FEF3F2",
                  border: "1px solid #FECDCA",
                  borderRadius: 8,
                  color: "#B42318",
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>{regenerateError}</span>
                <button
                  onClick={clearRegenerateError}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#B42318",
                    fontSize: 18,
                    padding: 0,
                    marginLeft: 8,
                  }}
                >
                  &times;
                </button>
              </div>
            )}

            {error ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#B32318" }}>
                <p>Error loading candidate details: {error}</p>
                <button onClick={onClose} style={{ marginTop: "10px", padding: "8px 16px", cursor: "pointer" }}>
                  Close
                </button>
              </div>
            ) : isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Skeleton loading state */}
                <div className="layered-card-outer">
                  <div className="layered-card-middle">
                    <div className="skeleton-bar" style={{ width: "30%", height: "20px", marginBottom: 12 }}></div>
                    <div className="layered-card-content">
                      <div className="skeleton-bar" style={{ width: "100%", height: "16px", marginBottom: 8 }}></div>
                      <div className="skeleton-bar" style={{ width: "80%", height: "16px" }}></div>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%", gap: 16, alignItems: "flex-start" }}>
                  <div style={{ width: "60%", display: "flex", flexDirection: "column", gap: 8 }}>
                    {[1, 2, 3, 4].map((idx) => (
                      <div key={idx} className="layered-card-middle">
                        <div className="skeleton-bar" style={{ width: "30%", height: "20px", marginBottom: 8 }}></div>
                        <div className="skeleton-bar" style={{ width: "100%", height: "20px" }}></div>
                      </div>
                    ))}
                  </div>
                  <div style={{ width: "40%", display: "flex", flexDirection: "column", gap: 8 }}>
                    {[1, 2].map((idx) => (
                      <div key={idx} className="layered-card-middle">
                        <div className="skeleton-bar" style={{ width: "30%", height: "20px", marginBottom: 8 }}></div>
                        <div className="skeleton-bar" style={{ width: "100%", height: "20px" }}></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Evaluation by JIA section with Regenerate and Download CV buttons */}
                <EvaluationByJiaSection
                  interviewData={interviewData}
                  cvData={cvData}
                  candidateEmail={candidate.email}
                  candidateName={candidate.name}
                  onRegenerate={handleRegenerate}
                  regenerateLoading={regenerateLoading}
                />

                {/* Two-column layout for CV sections */}
                <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: "100%", gap: 16, alignItems: "flex-start" }}>
                  {/* Left column (60%): Experience, Education, Certifications, Projects */}
                  <div style={{ width: "60%", display: "flex", flexDirection: "column", gap: 8 }}>
                    <ExperienceSection cvData={cvData} />
                    <EducationSection cvData={cvData} />
                    <CertificationsSection cvData={cvData} />
                    <ProjectsSection cvData={cvData} />
                  </div>

                  {/* Right column (40%): Contact Information, Skills */}
                  <div style={{ width: "40%", display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 8 }}>
                    <ContactInformationSection cvData={cvData} />
                    <SkillsSection orgSkills={orgSkills} cvSkills={cvSkills} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
