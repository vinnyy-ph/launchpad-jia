import React from "react";
import { useRouter } from "next/navigation";
import { RequisitionItem, RequisitionStatus } from "./types";
import RequestCancelDialog from "./RequestCancelDialog";

type RequisitionActionsDropdownProps = {
  status: RequisitionStatus;
  positionName: string;
  requisitionId: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onCancelRequest: (requisitionId: string, reason: string) => Promise<void>;
  isUpdatingStatus?: boolean;
};

const RequisitionActionsDropdown: React.FC<RequisitionActionsDropdownProps> = ({
  status,
  positionName,
  requisitionId,
  isOpen,
  onToggle,
  onClose,
  onCancelRequest,
  isUpdatingStatus = false,
}) => {
  const router = useRouter();
  const [isHoveringActionsButton, setIsHoveringActionsButton] = React.useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = React.useState(false);

  // Determine disabled states based on status
  const isEditDisabled = status !== "Requires More Info";
  const isCancelDisabled =
    status === "Cancelled" ||
    status === "Completed" ||
    status === "Request to Cancel" ||
    status === "Active"; // Once Active, no more cancel requests

  const handleToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    onToggle();
  };

  const handleItemClick = (event: React.MouseEvent, action?: () => void, disabled?: boolean) => {
    event.stopPropagation();
    if (disabled) return;
    onClose();
    action?.();
  };

  const handleCancelRequest = async (reason: string, additionalInfo?: string) => {
      const fullReason = additionalInfo ? `${reason} - ${additionalInfo}` : reason;
      try {
        await onCancelRequest(requisitionId, fullReason);
        // Close dialog after successful operation
        setIsCancelDialogOpen(false);
      } catch (error) {
        // Close dialog even on error (error handling is done in parent)
        setIsCancelDialogOpen(false);
      }
  };

  return (
    <div className="dropdown" style={{ position: "relative" }}>
      <button
        type="button"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          border: "none",
          background: isHoveringActionsButton ? "#FAFAFA" : "transparent",
          padding: 0,
          cursor: "pointer",
          borderRadius: "50%",
          outline: "none",
          boxShadow: "none",
        }}
        onClick={handleToggle}
        onMouseEnter={() => setIsHoveringActionsButton(true)}
        onMouseLeave={() => setIsHoveringActionsButton(false)}
      >
        <img src="/iconsV3/more-vertical.svg" alt="More actions" style={{ width: 16, height: 16 }} />
      </button>
      {isOpen && (
        <div
          className={`dropdown-menu dropdown-menu-right mt-1 org-dropdown-anim${isOpen ? " show" : ""}`}
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            minWidth: 180,
            padding: "12px 0",
            borderRadius: 16,
            border: "none",
            boxShadow: "0px 18px 45px rgba(15, 23, 42, 0.12)",
            background: "#fff",
            zIndex: 1000,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="dropdown-item"
            style={{
              padding: "8px 20px",
              fontSize: 14,
              fontWeight: 400,
              color: isEditDisabled ? "#9CA3AF" : "#111827",
              backgroundColor: "transparent",
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              textAlign: "left",
              border: "none",
              cursor: isEditDisabled ? "not-allowed" : "pointer",
              opacity: isEditDisabled ? 0.5 : 1,
            }}
            onClick={(event) => handleItemClick(event, () => router.push(`/requisitions/edit/${requisitionId}`), isEditDisabled)}
            disabled={isEditDisabled}
          >
            <img src="/iconsV3/pen.svg" alt="Edit" style={{ width: 15, height: 15, opacity: isEditDisabled ? 0.5 : 1 }} />
            Edit Details
          </button>
          <button
            type="button"
            className="dropdown-item"
            style={{
              padding: "8px 20px",
              fontSize: 14,
              fontWeight: 400,
              color: isCancelDisabled ? "#9CA3AF" : "#111827",
              backgroundColor: "transparent",
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              textAlign: "left",
              border: "none",
              cursor: isCancelDisabled ? "not-allowed" : "pointer",
              opacity: isCancelDisabled ? 0.5 : 1,
            }}
            onClick={(event) => handleItemClick(event, () => setIsCancelDialogOpen(true), isCancelDisabled)}
            disabled={isCancelDisabled}
          >
            <img src="/iconsV3/cancel.svg" alt="Cancel" style={{ width: 14, height: 14, opacity: isCancelDisabled ? 0.5 : 1 }} />
            Request to Cancel
          </button>
        </div>
      )}
      <RequestCancelDialog
        isOpen={isCancelDialogOpen}
        onClose={() => setIsCancelDialogOpen(false)}
        onSubmit={handleCancelRequest}
        isLoading={isUpdatingStatus}
      />
    </div>
  );
};

export default RequisitionActionsDropdown;
