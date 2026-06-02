import React from "react";
import { Requisition, statusPillStyles, RequisitionStatus } from "../types";
import RequisitionActionsDropdown from "./RequisitionActionsDropdown";
import ViewFormModal from "../Modal/ViewFormModal";
import Tooltip from "@/lib/components/GuestPortalComponents/Requisitions/tooltip";
import UserAvatar from "../UserAvatar";
import RequisitionRowBadges from "../RequisitionRowBadges";

/**
 * Format a date string as relative time (e.g., "Just now", "2 hours ago", "Nov 28, 2025")
 */
function formatRelativeDate(dateString: string): string {
  // Handle legacy "Just now" strings
  if (dateString === "Just now") return dateString;
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString; // Return as-is if invalid
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  
  // For older dates, show formatted date
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type RequisitionRowProps = {
  requisition: Requisition;
  isLast: boolean;
  gridTemplateColumns: string;
  openActionsId: string | null;
  setOpenActionsId: React.Dispatch<React.SetStateAction<string | null>>;
  onUpdateStatus: (requisitionId: string, newStatus: RequisitionStatus) => void;
  requisitionsDisabled?: boolean;
};

const RequisitionRow: React.FC<RequisitionRowProps> = ({
  requisition,
  isLast,
  gridTemplateColumns,
  openActionsId,
  setOpenActionsId,
  onUpdateStatus,
  requisitionsDisabled = false,
}) => {
  const [isHoveringTitle, setIsHoveringTitle] = React.useState(false);
  const [showViewFormModal, setShowViewFormModal] = React.useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = React.useState(false);
  const [hideBadge, setHideBadge] = React.useState(false);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const isCancelled = requisition.status === "Cancelled";
  const isActionsOpen = openActionsId === requisition.id;

  // Show tooltip on click if it has a message
  const hasMoreInfoContent = requisition.status === "Requires More Info" && requisition.moreInfoReason;
  const hasCancelContent = requisition.status === "Request to Cancel" && requisition.cancelReason;
  const showTooltip = isTooltipOpen && (hasMoreInfoContent || hasCancelContent);

  // Determine tooltip content
  const getTooltipContent = () => {
    if (requisition.status === "Requires More Info") {
      return {
        title: "More Info Needed:",
        content: requisition.moreInfoReason || "",
        isRichText: true
      };
    } else if (requisition.status === "Request to Cancel") {
      let cancelContent = requisition.cancelReason || "";
      
      // Format "Others (please specify reason*) - value" to "Others: value"
      if (cancelContent.includes("Others (please specify reason*)")) {
        const customValue = cancelContent.split(" - ")[1] || "";
        cancelContent = customValue ? `Others: ${customValue}` : cancelContent;
      }
      
      return {
        title: "Reason:",
        content: cancelContent,
        isRichText: false
      };
    }
    return { title: "", content: "", isRichText: false };
  };

  const tooltipContent = getTooltipContent();

  // Close tooltip when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsTooltipOpen(false);
      }
    };

    if (isTooltipOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isTooltipOpen]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns,
        alignItems: "center",
        padding: "20px 24px",
        borderBottom: isLast ? "none" : "1px solid #EAECF0",
        background: "#FFFFFF",
        borderBottomLeftRadius: isLast ? 16 : 0,
        borderBottomRightRadius: isLast ? 16 : 0,
      }}
      onMouseEnter={() => {
        if (isCancelled) return;
        setIsHoveringTitle(true);
      }}
      onMouseLeave={() => {
        if (isCancelled) return;
        setIsHoveringTitle(false);
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
          <button
            type="button"
            style={{
              padding: 0,
              margin: 0,
              border: "none",
              background: "transparent",
              color: !isCancelled && isHoveringTitle ? "#175CD3" : "#101828",
              fontWeight: 600,
              fontSize: 14,
              textAlign: "left",
              cursor: isCancelled ? "default" : "pointer",
              textDecoration: !isCancelled && isHoveringTitle ? "underline" : "none",
            }}
          >
            {requisition.positionName}
          </button>
          {!hideBadge && <RequisitionRowBadges badges={requisition.badges} />}
        </div>
      </div>
      <div style={{ color: "#475467", fontSize: 14 }}>{requisition.referenceNo}</div>
      <div style={{ color: "#475467", fontSize: 14 }}>{formatRelativeDate(requisition.dateSubmitted)}</div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          style={{ position: "relative", display: "inline-flex" }}
          ref={tooltipRef}
          onClick={() => {
            if (hasMoreInfoContent || hasCancelContent) {
              setIsTooltipOpen(!isTooltipOpen);
            }
          }}
        >
          <span
            style={{
              ...statusPillStyles[requisition.status],
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              textTransform: "capitalize",
              cursor: (hasMoreInfoContent || hasCancelContent) ? "pointer" : "default",
            }}
          >
            {requisition.status}
            {requisition.status === "Requires More Info" && (
              <img
                src="/iconsV3/warning-icon.svg"
                alt=""
                style={{ width: 12, height: 12, marginLeft: 4 }}
              />
            )}
            {requisition.status === "Request to Cancel" && (
              <img
                src="/iconsV3/helper-red.svg"
                alt=""
                style={{ width: 12, height: 12, marginLeft: 4 }}
              />
            )}
          </span>
          {showTooltip && (
            <Tooltip
              title={tooltipContent.title}
              content={tooltipContent.content}
              isRichText={tooltipContent.isRichText}
            />
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <UserAvatar
          name={requisition.submittedBy.name}
          email={requisition.submittedBy.email}
          avatar={requisition.submittedBy.avatar}
          size={32}
        />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span
            style={{
              fontSize: 14,
              color: "#101828",
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {requisition.submittedBy.name}
          </span>
          <span
            style={{
              fontSize: 12,
              color: "#667085",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {requisition.submittedBy.email}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 16 }}>
        <button
          type="button"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
          }}
          onClick={(e) => {
            e.stopPropagation();
            setShowViewFormModal(true);
            setHideBadge(true); // Optimistically hide badge when modal opens
          }}
        >
          <img src="/iconsV3/eye.svg" alt="View requisition" style={{ width: 20, height: 20 }} />
        </button>
        <RequisitionActionsDropdown
          status={requisition.status}
          positionName={requisition.positionName}
          isOpen={isActionsOpen}
          onToggle={() => {
            if (requisitionsDisabled) return;
            setOpenActionsId((current) => (current === requisition.id ? null : requisition.id));
          }}
          onClose={() => {
            setOpenActionsId((current) => (current === requisition.id ? null : current));
          }}
          requisition={requisition}
          onUpdateStatus={onUpdateStatus}
          requisitionsDisabled={requisitionsDisabled}
        />
      </div>
      {showViewFormModal && (
        <ViewFormModal
          onClose={() => {
            setShowViewFormModal(false);
            // Refetch data when modal closes to update badges across all rows
            onUpdateStatus(requisition.id, requisition.status);
          }}
          requisition={requisition}
          onUpdateStatus={onUpdateStatus}
          onRefetch={() => onUpdateStatus(requisition.id, requisition.status)}
          isEditMode={false}
          requisitionsDisabled={requisitionsDisabled}
        />
      )}
    </div>
  );
};

export default RequisitionRow;
