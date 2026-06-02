"use client";
import { useState, useEffect, useRef } from "react";
import CareerFit from "./CareerFit";
import {
  extractInterviewAssessment,
  formatDateToRelativeTime,
} from "../../Utils";
import CandidateAvatarWithTooltip from "../CandidateComponents/CandidateAvatarWithTooltip";
import { useAppContext } from "../../context/AppContext";
import CreditDeferredBadge from "../CreditDeferredBadge";

export default function CandidateCard({
  candidate,
  stage,
  substage,
  handleCandidateMenuOpen,
  handleCandidateCVOpen,
  handleEndorseCandidate,
  handleDropCandidate,
  handleCandidateHistoryOpen,
  handleRetakeInterview,
  handleInviteToJob,
  canManageCandidates = true,
  activeDropdown,
  setActiveDropdown,
  simplified = false, // New prop to hide assessment and menu
  boardId = "main",
}: any) {
  const { orgID } = useAppContext();
  const {
    name,
    email,
    image,
    updatedAt,
    currentStep,
    cvStatus,
    jobFit,
    cvScreeningReason,
    summary,
    status,
  } = candidate;
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownMenuPosition, setDropdownMenuPosition] = useState<"default" | "above">("default");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Listen for comments being viewed and refresh candidate data
  useEffect(() => {
    function handleCommentsViewed() {
      // Dispatch event that the parent list can listen to
      window.dispatchEvent(new CustomEvent('candidate-data-stale', {
        detail: { candidateId: candidate.id || candidate._id }
      }));
    }

    if (typeof window !== "undefined") {
      window.addEventListener(
        "candidate-comments-viewed",
        handleCommentsViewed as EventListener
      );
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "candidate-comments-viewed",
          handleCommentsViewed as EventListener
        );
      }
    };
  }, [candidate.id, candidate._id]);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleDropdownMenuPosition = (event?: any) => {
    if (!event) {
      return
    }
    const mouseEvent = event as MouseEvent
    const mousePosition = {
      x: mouseEvent.clientX,
      y: mouseEvent.clientY,
    }
    // container bounding client rect
    const careerStageContainer = document.querySelector(".career-stage-container");
    const candidateCardDropdownMenu = document.getElementById("candidate-card-dropdown-menu");
    if (careerStageContainer) {
      const careerStageContainerRect = careerStageContainer.getBoundingClientRect();
      const candidateCardDropdownMenuHeight = candidateCardDropdownMenu?.getBoundingClientRect()?.height || 280;

      if (mousePosition.y + candidateCardDropdownMenuHeight >= careerStageContainerRect.bottom) {
        setDropdownMenuPosition("above");
      } else {
        setDropdownMenuPosition("default");
      }
    }
  }

  const handleSelectMenuOption = () => {
    handleCandidateMenuOpen({ ...candidate, stage });
    setActiveDropdown(null);
  }

  const handleViewCV = () => {
    handleCandidateCVOpen({ ...candidate, stage });
    setActiveDropdown(null);
  }

  const handleViewHistory = () => {
    handleCandidateHistoryOpen({ ...candidate, stage });
    setActiveDropdown(null);
  }

  const hasPendingInterviewRetakeRequest =
    candidate?.retakeRequest &&
    !["Approved", "Rejected"].includes(candidate?.retakeRequest?.status);

  const invitedByLabel =
    candidate?.invitedFrom?.invitedBy?.name ||
    candidate?.invitedFrom?.invitedBy?.email ||
    "Unknown";
  const invitedAtSource =
    candidate?.invitedFrom?.invitedAt || updatedAt || candidate?.createdAt;
  const invitedAtDate = invitedAtSource ? new Date(invitedAtSource) : null;
  const invitedAtText =
    invitedAtDate && !Number.isNaN(invitedAtDate.getTime())
      ? formatDateToRelativeTime(invitedAtDate)
      : "N/A";
  const footerTimestampText =
    stage === "Invited"
      ? `Invited ${invitedAtText} by ${invitedByLabel}`
      : updatedAt
        ? formatDateToRelativeTime(new Date(updatedAt))
        : "N/A";

  return (
    <div
      draggable={canManageCandidates}
      onDragStart={(e) => {
        if (!canManageCandidates) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData("candidateId", candidate._id);
        e.dataTransfer.setData("stageKey", stage);
        e.dataTransfer.setData("substageKey", substage);
        e.dataTransfer.setData("boardId", boardId);
      }}
      className="candidate-card"
      style={{
        cursor: canManageCandidates ? "grab" : "pointer",
        background: hasPendingInterviewRetakeRequest ? "#FFFAEB" : "white",
      }}
      onClick={(e) => {
        if (e.defaultPrevented) return;
        handleCandidateMenuOpen({ ...candidate, stage, substage });
      }}
    >
      <div
        className="candidate-card-section"
        style={{
          justifyContent: "space-between",
        }}
      >
        <CareerFit
          fit={
            candidate.currentEvaluation?.matchFit
              ? candidate.currentEvaluation?.matchFit
              : currentStep === "CV Screening" ||
                (stage === "AI Interview" && substage === "Waiting Interview")
                ? cvStatus || "N/A"
                : jobFit || "N/A"
          }
          evaluatorName={candidate.currentEvaluation?.updatedBy?.name ? candidate.currentEvaluation?.updatedBy?.name?.split(" ")?.[0] : "Jia"}
          assessment={
            candidate.currentEvaluation?.matchFit
              ? candidate.currentEvaluation?.evaluationNotes
              : currentStep === "CV Screening" ||
                (stage === "AI Interview" && substage === "Waiting Interview")
                ? cvScreeningReason
                : extractInterviewAssessment(summary)
          }
          candidateDetails={candidate}
        />
        {(
          <div ref={dropdownRef} className="dropdown" style={{ marginLeft: "auto" }}>
          <button
            style={{ background: "none", border: "none", cursor: "pointer" }}
            className="safe-dropdown-toggle"
            onClick={(e) => {
              if (e.defaultPrevented) return;
              handleDropdownMenuPosition(e);
              e.preventDefault();
              e.stopPropagation();
              const dropdownKey = `candidate-${candidate._id}`;
              if (activeDropdown === dropdownKey) {
                setActiveDropdown(null);
              } else {
                setActiveDropdown(dropdownKey);
              }
            }}
          >
            <i
              className="la la-ellipsis-h"
              style={{ fontSize: 20, color: "#A4A7AE" }}
            ></i>
          </button>
          {activeDropdown === `candidate-${candidate._id}` && (
            <div
            id="candidate-card-dropdown-menu"
              className={`dropdown-menu dropdown-menu-right w-100 mt-1 org-dropdown-anim show safe-dropdown-menu`}
              style={{
                padding: "10px 0px",
                top: dropdownMenuPosition === "above" ? "auto" : "100%",
                bottom: dropdownMenuPosition === "above" ? "100%" : "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                onClick={(e) => {
                  e.preventDefault();
                }}
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#414651",
                  marginLeft: 15,
                  cursor: "default",
                }}
              >
                <span>Candidate Menu</span>
              </div>
              <div className="dropdown-divider"></div>
              <div
                className="dropdown-item"
                onClick={(e) => {
                  e.preventDefault();
                  handleSelectMenuOption();
                }}
              >
                <i
                  className="la la-bolt"
                  style={{ fontSize: 16, marginRight: 4 }}
                ></i>
                <span>View Analysis by Jia</span>
              </div>
              <div
                className="dropdown-item"
                onClick={(e) => {
                  e.preventDefault();
                  handleViewCV();
                }}
              >
                <i
                  className="la la-file-alt"
                  style={{ fontSize: 16, marginRight: 4 }}
                ></i>
                <span>View CV</span>
              </div>
              <div
                className="dropdown-item"
                onClick={(e) => {
                  e.preventDefault();
                  handleViewHistory();
                }}
              >
                <i
                  className="la la-history"
                  style={{ fontSize: 16, marginRight: 4 }}
                ></i>
                <span>View Application History</span>
              </div>
              <div
                className="dropdown-item"
                onClick={(e) => {
                  e.preventDefault();
                  handleInviteToJob?.({ ...candidate, stage, substage });
                  setActiveDropdown(null);
                }}
              >
                <i
                  className="la la-briefcase"
                  style={{ fontSize: 16, marginRight: 4 }}
                ></i>
                <span>Invite to a Job</span>
              </div>
              <div className="dropdown-divider"></div>
              {currentStep !== "Contract Signed" && (
                <>
                  {!simplified && (
                    <div
                      className="dropdown-item"
                      onClick={(e) => {
                        e.preventDefault();
                        handleEndorseCandidate({ ...candidate, stage, substage });
                        setActiveDropdown(null);
                      }}
                    >
                      <i
                        className="la la-user-check"
                        style={{ fontSize: 16, marginRight: 4 }}
                      ></i>
                      <span>Endorse Candidate</span>
                    </div>
                  )}
                </>
              )}
              <div
                className="dropdown-item"
                style={{ color: "#B42318" }}
                onClick={(e) => {
                  e.preventDefault();
                  handleDropCandidate({ ...candidate, stage, substage });
                  setActiveDropdown(null);
                }}
              >
                <i
                  className="la la-user-times"
                  style={{ fontSize: 16, marginRight: 4 }}
                ></i>
                <span>Drop Candidate</span>
              </div>
              {hasPendingInterviewRetakeRequest && (
                <>
                  <div className="dropdown-divider"></div>
                  <div
                    className="dropdown-item"
                    style={{ color: "#DC6803" }}
                    onClick={(e) => {
                      e.preventDefault();
                      handleRetakeInterview({ ...candidate, stage, substage });
                      setActiveDropdown(null);
                    }}
                  >
                    <span>Review Retake Request</span>
                  </div>
                </>
              )}
            </div>
          )}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          width: "100%",
        }}
      >
        <div
          className="candidate-card-section"
          style={{ position: "relative" }}
        >
          <CandidateAvatarWithTooltip candidate={candidate} orgID={orgID || ""} tooltipPosition="below">
            {image ? (
              <img
                src={image}
                alt={name}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#E0E0E0",
                  cursor: "pointer",
                }}
              />
            ) : (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  backgroundColor: "#F8F9FC",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#3E4784" }}>
                  {name?.split(" ").map((n: string) => n[0]).join("")}
                </span>
              </div>
            )}
          </CandidateAvatarWithTooltip>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>
                {name}
                {candidate.commentCount > 0 && (
                  <span
                    aria-label="Comment count"
                    title={
                      candidate.newCommentCount > 0
                        ? `${candidate.newCommentCount} new, ${candidate.commentCount} total`
                        : `${candidate.commentCount} comments`
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 20,
                      height: 20,
                      padding: "0 6px",
                      background: candidate.newCommentCount > 0 ? "#EF4444" : "#374151",
                      color: "#fff",
                      borderRadius: "999px",
                      fontSize: 11,
                      fontWeight: 700,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    {candidate.newCommentCount > 0 ? candidate.newCommentCount : candidate.commentCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        {hasPendingInterviewRetakeRequest && (
          <div
            style={{
              border: "1px solid #FEDF89",
              background: "#FEEFC7",
              borderRadius: "20px",
              color: "#B54708",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            <i
              className="la la-exclamation-circle"
              style={{ color: "#B54708", fontSize: 16, marginRight: 4 }}
            ></i>
            Requested to retake interview
          </div>
        )}
        {candidate.creditDeferred && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <CreditDeferredBadge />
          </div>
        )}
        <div style={{ width: "100%", height: 1, background: "#EAECF5" }}></div>
      </div>
      <div
        className="candidate-card-section"
        style={{ justifyContent: "space-between" }}
      >
        <div style={{ fontSize: 12, color: "#717680", fontWeight: 500 }}>
          {footerTimestampText}
        </div>
        {status !== "For CV Upload" && !simplified && <div>
          {candidate.applicationMetadata?.updatedBy?.image && <img
            src={
              candidate.applicationMetadata?.updatedBy?.image
            }
            alt="Jia Avatar"
            width={20}
            height={20}
            style={{ marginRight: 4, borderRadius: "50%" }}
          />}
          {candidate.applicationMetadata?.action &&
            candidate.applicationMetadata?.updatedBy
            ?
            <span style={{ fontSize: 12, color: "#717680", fontWeight: 500 }}>
              {candidate.applicationMetadata?.action} by
              <span style={{ fontWeight: 700 }}>{" "}{candidate.applicationMetadata?.updatedBy?.name?.split(" ")?.[0]}</span>
            </span>
            : <span style={{ fontSize: 12, color: "#717680", fontWeight: 500 }}>Assessed by <span style={{ fontWeight: 700 }}>Jia</span></span>}
        </div>}
      </div>
    </div>
  );
}
