import React from "react";

import type { RequisitionStatus, Requisition } from "../types";
import StatusChangeModal from "../Modal/StatusChangeModal";
import ViewFormModal from "../Modal/ViewFormModal";
import { useUpdateRequisitionStatus } from "../Modal/useUpdateRequisitionStatus";
import CareerIncompleteModal from "../Modal/CareerIncompleteModal";
import NoCareerLinkedModal from "../Modal/NoCareerLinkedModal";

type RequisitionActionsDropdownProps = {
  status: RequisitionStatus;
  positionName: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  requisition: Requisition;
  onUpdateStatus: (requisitionId: string, newStatus: RequisitionStatus) => void;
  requisitionsDisabled?: boolean;
};

const RequisitionActionsDropdown: React.FC<RequisitionActionsDropdownProps> = ({
  status,
  positionName,
  isOpen,
  onToggle,
  onClose,
  requisition,
  onUpdateStatus,
  requisitionsDisabled = false,
}) => {
  const { updateStatus, isUpdating } = useUpdateRequisitionStatus();
  const [showMoreOptions, setShowMoreOptions] = React.useState(false);
  const [showMakeActiveModal, setShowMakeActiveModal] = React.useState(false);
  const [showPutOnHoldModal, setShowPutOnHoldModal] = React.useState(false);
  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [showDeclineCancelRequestModal, setShowDeclineCancelRequestModal] = React.useState(false);
  const [showRequestMoreInfoModal, setShowRequestMoreInfoModal] = React.useState(false);
  const [showApproveModal, setShowApproveModal] = React.useState(false);
  const [showViewFormModal, setShowViewFormModal] = React.useState(false);
  const [showCareerIncompleteModal, setShowCareerIncompleteModal] = React.useState(false);
  const [careerIncompleteFields, setCareerIncompleteFields] = React.useState<string[]>([]);
  const [careerIncompleteCareerId, setCareerIncompleteCareerId] = React.useState<string | null>(null);
  const [showNoCareerLinkedModal, setShowNoCareerLinkedModal] = React.useState(false);
  const [noCareerLinkedPreviousStatus, setNoCareerLinkedPreviousStatus] = React.useState<string | undefined>(undefined);
  const moreOptionsButtonRef = React.useRef<HTMLButtonElement>(null);
  const [isHoveringActionsButton, setIsHoveringActionsButton] = React.useState(false);
  const featureDisabled = requisitionsDisabled;
  const featureDisabledTitle = "Requisitions are disabled for this organization.";

  // Disable Put on Hold for: already On Hold, In Review (not approved), or Requires More Info (not approved)
  // These statuses don't have a linked career yet, so putting on hold would cause issues when resuming
  const disablePutOnHold = status === "On Hold" || status === "In Review" || status === "Requires More Info";
  const isCancelled = status === "Cancelled";
  // Edit Requisition Data is only available for "In Review" status
  const isEditableStatus = status === "In Review";
  const isLocked = status === "Active";
  const cancelRequestPreviousStatus = requisition.cancelRequestPreviousStatus || requisition.previousStatus;
  const disableDeclineCancelRequest = status !== "Request to Cancel" || !cancelRequestPreviousStatus;
  const disablePrimary =
    isCancelled ||
    status === "Active" ||
    status === "Requires More Info";
  const disableRequestMoreInfo = status !== "In Review" || isCancelled;
  const primaryLabel = "Make Active";

  React.useEffect(() => {
    if (featureDisabled && isOpen) {
      onClose();
    }
  }, [featureDisabled, isOpen, onClose]);

  const handleToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (featureDisabled) return;
    onToggle();
    setShowMoreOptions(false);
  };

  const handleItemClick = (event: React.MouseEvent, action?: () => void) => {
    if (featureDisabled) {
      event.stopPropagation();
      return;
    }
    if (isCancelled) {
      event.stopPropagation();
      return;
    }
    event.stopPropagation();
    onClose();
    action?.();
  };

  const handleMakeActiveClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (featureDisabled) return;
    onClose();
    setShowMoreOptions(false);
    setShowMakeActiveModal(true);
  };

  const handleConfirmMakeActive = async () => {
    try {
      if (requisition.status === "On Hold" && (requisition as any).approvalCareerId) {
        const careerId = (requisition as any).approvalCareerId as string;
        if (typeof window !== "undefined") {
          window.location.href = `/recruiter-dashboard/careers/edit-career/${careerId}`;
        }
        setShowMakeActiveModal(false);
        return;
      }

      const { actualStatus } = await updateStatus(
        requisition.id,
        "Active",
        undefined,
        requisition,
        requisition.status === "On Hold" ? { triggeredBy: "career_publish" } : undefined
      );
      const finalStatus = actualStatus || "Active";
      onUpdateStatus(requisition.id, finalStatus);
      console.log("Updated requisition to:", finalStatus, positionName);
      setShowMakeActiveModal(false);
    } catch (error) {
      const anyError = error as any;
      if (anyError?.code === "CAREER_INCOMPLETE") {
        setCareerIncompleteCareerId(anyError?.careerId || null);
        setCareerIncompleteFields(Array.isArray(anyError?.missingFields) ? anyError.missingFields : []);
        setShowMakeActiveModal(false);
        setShowCareerIncompleteModal(true);
        return;
      }
      if (anyError?.code === "NO_CAREER_LINKED") {
        setNoCareerLinkedPreviousStatus(anyError?.previousStatus || "In Review");
        setShowMakeActiveModal(false);
        setShowNoCareerLinkedModal(true);
        return;
      }
      console.error("Failed to resume requisition:", error);
    }
  };

  const handlePutOnHoldClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (featureDisabled) return;
    onClose();
    setShowPutOnHoldModal(true);
  };

  const handleConfirmPutOnHold = async () => {
    try {
      await updateStatus(requisition.id, "On Hold", undefined, requisition, {
        triggeredBy: "requisition_put_on_hold",
      });
      onUpdateStatus(requisition.id, "On Hold");
      console.log("Putting requisition on hold:", positionName);
      setShowPutOnHoldModal(false);
    } catch (error) {
      console.error("Failed to put requisition on hold:", error);
    }
  };

  const handleCancelRequisitionClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (featureDisabled) return;
    onClose();
    setShowCancelModal(true);
  };

  const handleDeclineCancelRequestClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (featureDisabled) return;
    onClose();
    if (disableDeclineCancelRequest) return;
    setShowDeclineCancelRequestModal(true);
  };

  const handleConfirmDeclineCancelRequest = async () => {
    if (!cancelRequestPreviousStatus) {
      setShowDeclineCancelRequestModal(false);
      return;
    }
    try {
      await updateStatus(requisition.id, cancelRequestPreviousStatus, undefined, requisition, {
        triggeredBy: "decline_cancel_request",
      });
      onUpdateStatus(requisition.id, cancelRequestPreviousStatus);
      setShowDeclineCancelRequestModal(false);
    } catch (error) {
      console.error("Failed to decline cancel request:", error);
      setShowDeclineCancelRequestModal(false);
    }
  };

  const handleConfirmCancel = async () => {
    try {
      await updateStatus(requisition.id, "Cancelled", undefined, requisition, {
        triggeredBy: "requisition_cancel",
      });
      onUpdateStatus(requisition.id, "Cancelled");
      console.log("Cancelling requisition:", positionName);
      setShowCancelModal(false);
    } catch (error) {
      console.error("Failed to cancel requisition:", error);
    }
  };

  const handleRequestMoreInfoClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (featureDisabled) return;
    onClose();
    setShowMoreOptions(false);
    setShowRequestMoreInfoModal(true);
  };

  const handleConfirmRequestMoreInfo = async (details?: string) => {
    try {
      await updateStatus(requisition.id, "Requires More Info", details, requisition);
      onUpdateStatus(requisition.id, "Requires More Info");
      console.log("Requesting more info for requisition:", positionName);
      setShowRequestMoreInfoModal(false);
    } catch (error) {
      console.error("Failed to request more info:", error);
    }
  };

  const handleEditRequisitionClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (featureDisabled) return;
    onClose();
    setShowMoreOptions(false);
    // Only open in edit mode for editable statuses; otherwise open read-only
    setShowViewFormModal(true);
  };

  const handleApproveClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (featureDisabled) return;
    onClose();
    setShowApproveModal(true);
  };

  const handleConfirmApprove = async () => {
    try {
      const { careerId } = await updateStatus(
        requisition.id,
        "On Hold",
        undefined,
        requisition,
        { triggeredBy: "approve" }
      );
      onUpdateStatus(requisition.id, "On Hold");
      console.log("Approving requisition:", positionName);
      setShowApproveModal(false);

      // If backend created a draft career, redirect recruiter to edit-career page
      if (careerId) {
        if (typeof window !== "undefined") {
          window.location.href = `/recruiter-dashboard/careers/edit-career/${careerId}`;
        }
      }
    } catch (error) {
      console.error("Failed to approve requisition:", error);
    }
  };

  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <>
      <div className="dropdown" style={{ position: "relative" }} ref={dropdownRef}>
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
            cursor: featureDisabled ? "not-allowed" : "pointer",
            borderRadius: "50%",
            outline: "none",
            boxShadow: "none",
            opacity: featureDisabled ? 0.5 : 1,
          }}
          onClick={handleToggle}
          onMouseEnter={() => setIsHoveringActionsButton(true)}
          onMouseLeave={() => setIsHoveringActionsButton(false)}
          aria-disabled={featureDisabled}
          disabled={featureDisabled}
          title={featureDisabled ? featureDisabledTitle : "More actions"}
        >
          <img src="/iconsV3/more-vertical.svg" alt="More actions" style={{ width: 16, height: 16 }} />
        </button>
        {isOpen && (
          <div
            className={`dropdown-menu dropdown-menu-right mt-1 org-dropdown-anim${isOpen ? " show" : ""}`}
            style={{
              minWidth: 228,
              padding: "12px 0",
              borderRadius: 16,
              border: "none",
              boxShadow: "0px 18px 45px rgba(15, 23, 42, 0.12)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
          {status === "In Review" ? (
            <>
              <button
                type="button"
                className="dropdown-item"
                style={{
                  padding: "8px 20px",
                  fontSize: 14,
                  fontWeight: 400,
                  color: "#111827",
                  backgroundColor: "transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
                onClick={handleApproveClick}
                disabled={featureDisabled}
                title={featureDisabled ? featureDisabledTitle : undefined}
              >
                <span style={{ fontSize: 16 }}>✓</span>
                <span>Approve</span>
              </button>
              <div style={{ position: "relative" }}>
                <button
                  ref={moreOptionsButtonRef}
                  type="button"
                  className="dropdown-item"
                  style={{
                    padding: "8px 20px",
                    fontSize: 14,
                    fontWeight: 400,
                    color: "#111827",
                    backgroundColor: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    width: "100%",
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (featureDisabled) return;
                    setShowMoreOptions((prev) => !prev);
                  }}
                  disabled={featureDisabled}
                  title={featureDisabled ? featureDisabledTitle : undefined}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>⋯</span>
                    <span>More options</span>
                  </span>
                  <span style={{ fontSize: 16 }}>›</span>
                </button>
                {showMoreOptions && (
                  <div
                    className="dropdown-menu org-dropdown-anim show"
                    style={{
                      position: "absolute",
                      top: 0,
                      right: "100%",
                      marginRight: 4,
                      marginLeft: "-250px",
                      minWidth: 200,
                      padding: "12px 0",
                      borderRadius: 16,
                      border: "none",
                      boxShadow: "0px 18px 45px rgba(15, 23, 42, 0.12)",
                      backgroundColor: "white",
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
                        color: featureDisabled || disableRequestMoreInfo ? "#D0D5DD" : "#111827",
                        backgroundColor: "transparent",
                        cursor: featureDisabled || disableRequestMoreInfo ? "not-allowed" : "pointer",
                        pointerEvents: featureDisabled || disableRequestMoreInfo ? "none" : "auto",
                      }}
                      onClick={handleRequestMoreInfoClick}
                      disabled={featureDisabled || disableRequestMoreInfo}
                      title={featureDisabled ? featureDisabledTitle : undefined}
                    >
                      Request More Info
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      style={{
                        padding: "8px 20px",
                        fontSize: 14,
                        fontWeight: 400,
                        color:
                          featureDisabled || !isEditableStatus || isCancelled ? "#D0D5DD" : "#111827",
                        backgroundColor: "transparent",
                        cursor:
                          featureDisabled || !isEditableStatus || isCancelled
                            ? "not-allowed"
                            : "pointer",
                        pointerEvents:
                          featureDisabled || !isEditableStatus || isCancelled ? "none" : "auto",
                      }}
                      onClick={handleEditRequisitionClick}
                      disabled={featureDisabled || !isEditableStatus || isCancelled}
                      title={featureDisabled ? featureDisabledTitle : undefined}
                    >
                      Edit Requisition Data
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      style={{
                        padding: "8px 20px",
                        fontSize: 14,
                        fontWeight: 400,
                        color:
                          featureDisabled || isCancelled || disablePutOnHold
                            ? "#D0D5DD"
                            : "#111827",
                        cursor:
                          featureDisabled || isCancelled || disablePutOnHold
                            ? "not-allowed"
                            : "pointer",
                        backgroundColor: "transparent",
                        pointerEvents:
                          featureDisabled || isCancelled || disablePutOnHold
                            ? "none"
                            : "auto",
                      }}
                      onClick={(event) => {
                        handlePutOnHoldClick(event);
                        setShowMoreOptions(false);
                      }}
                      disabled={featureDisabled || isCancelled || disablePutOnHold}
                      title={featureDisabled ? featureDisabledTitle : undefined}
                    >
                      Put On Hold
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      style={{
                        padding: "8px 20px",
                        fontSize: 14,
                        fontWeight: 400,
                        color: featureDisabled || isCancelled ? "#D0D5DD" : "#111827",
                        backgroundColor: "transparent",
                        cursor:
                          featureDisabled || isCancelled ? "not-allowed" : "pointer",
                        pointerEvents:
                          featureDisabled || isCancelled ? "none" : "auto",
                      }}
                      onClick={(event) => {
                        handleCancelRequisitionClick(event);
                        setShowMoreOptions(false);
                      }}
                      disabled={featureDisabled || isCancelled}
                      title={featureDisabled ? featureDisabledTitle : undefined}
                    >
                      Cancel Requisition
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : status === "Request to Cancel" ? (
            <>
              <button
                type="button"
                className="dropdown-item"
                style={{
                  padding: "8px 20px",
                  fontSize: 14,
                  fontWeight: 400,
                  color: featureDisabled || disableDeclineCancelRequest ? "#D0D5DD" : "#111827",
                  backgroundColor: "transparent",
                  cursor: featureDisabled || disableDeclineCancelRequest ? "not-allowed" : "pointer",
                  pointerEvents: featureDisabled || disableDeclineCancelRequest ? "none" : "auto",
                }}
                onClick={(event) => handleDeclineCancelRequestClick(event)}
                disabled={featureDisabled || disableDeclineCancelRequest}
                title={featureDisabled ? featureDisabledTitle : undefined}
              >
                Decline Cancel Request
              </button>
              <button
                type="button"
                className="dropdown-item"
                style={{
                  padding: "8px 20px",
                  fontSize: 14,
                  fontWeight: 400,
                  color: featureDisabled || isCancelled ? "#D0D5DD" : "#111827",
                  backgroundColor: "transparent",
                  cursor: featureDisabled || isCancelled ? "not-allowed" : "pointer",
                  pointerEvents: featureDisabled || isCancelled ? "none" : "auto",
                }}
                onClick={(event) => handleCancelRequisitionClick(event)}
                disabled={featureDisabled || isCancelled}
                title={featureDisabled ? featureDisabledTitle : undefined}
              >
                Cancel Requisition
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="dropdown-item"
                style={{
                  padding: "8px 20px",
                  fontSize: 14,
                  fontWeight: 400,
                  color: featureDisabled || disablePrimary ? "#D0D5DD" : "#111827",
                  backgroundColor: "transparent",
                  cursor: featureDisabled || disablePrimary ? "not-allowed" : "pointer",
                  pointerEvents: featureDisabled || disablePrimary ? "none" : "auto",
                }}
                onClick={(event) => handleMakeActiveClick(event)}
                disabled={featureDisabled || disablePrimary}
                title={featureDisabled ? featureDisabledTitle : undefined}
              >
                {primaryLabel}
              </button>
              <button
                type="button"
                className="dropdown-item"
                style={{
                  padding: "8px 20px",
                  fontSize: 14,
                  fontWeight: 400,
                  color:
                    featureDisabled || !isEditableStatus || isCancelled || isLocked
                      ? "#D0D5DD"
                      : "#111827",
                  backgroundColor: "transparent",
                  cursor:
                    featureDisabled || !isEditableStatus || isCancelled || isLocked
                      ? "not-allowed"
                      : "pointer",
                  pointerEvents:
                    featureDisabled || !isEditableStatus || isCancelled || isLocked
                      ? "none"
                      : "auto",
                }}
                onClick={(event) => handleEditRequisitionClick(event)}
                disabled={featureDisabled || !isEditableStatus || isCancelled || isLocked}
                title={featureDisabled ? featureDisabledTitle : undefined}
              >
                Edit Requisition Data
              </button>
              <button
                type="button"
                className="dropdown-item"
                style={{
                  padding: "8px 20px",
                  fontSize: 14,
                  fontWeight: 400,
                  color:
                    featureDisabled || isCancelled || disablePutOnHold
                      ? "#D0D5DD"
                      : "#111827",
                  cursor:
                    featureDisabled || isCancelled || disablePutOnHold
                      ? "not-allowed"
                      : "pointer",
                  backgroundColor: "transparent",
                  pointerEvents:
                    featureDisabled || isCancelled || disablePutOnHold
                      ? "none"
                      : "auto",
                }}
                onClick={(event) => handlePutOnHoldClick(event)}
                disabled={featureDisabled || isCancelled || disablePutOnHold}
                title={featureDisabled ? featureDisabledTitle : undefined}
              >
                Put On Hold
              </button>
              <button
                type="button"
                className="dropdown-item"
                style={{
                  padding: "8px 20px",
                  fontSize: 14,
                  fontWeight: 400,
                  color: featureDisabled || isCancelled ? "#D0D5DD" : "#111827",
                  backgroundColor: "transparent",
                  cursor:
                    featureDisabled || isCancelled ? "not-allowed" : "pointer",
                  pointerEvents:
                    featureDisabled || isCancelled ? "none" : "auto",
                }}
                onClick={(event) => handleCancelRequisitionClick(event)}
                disabled={featureDisabled || isCancelled}
                title={featureDisabled ? featureDisabledTitle : undefined}
              >
                Cancel Requisition
              </button>
            </>
          )}
        </div>
      )}
      </div>


      {showMakeActiveModal && (
        <StatusChangeModal
          onClose={() => setShowMakeActiveModal(false)}
          onConfirm={handleConfirmMakeActive}
          title="Make this requisition active?"
          description="Making this requisition Active will publish the linked career."
          iconSrc="/iconsV3/make-it-active.svg"
          confirmButtonText="Make Active"
          isLoading={isUpdating}
        />
      )}

      {showCareerIncompleteModal && (
        <CareerIncompleteModal
          onClose={() => setShowCareerIncompleteModal(false)}
          onEditCareer={() => {
            const careerId = careerIncompleteCareerId;
            setShowCareerIncompleteModal(false);
            if (careerId && typeof window !== "undefined") {
              window.location.href = `/recruiter-dashboard/careers/edit-career/${careerId}`;
            }
          }}
          missingFields={careerIncompleteFields}
        />
      )}
      {showNoCareerLinkedModal && (
        <NoCareerLinkedModal
          onClose={() => setShowNoCareerLinkedModal(false)}
          onApprove={async () => {
            try {
              const { careerId } = await updateStatus(
                requisition.id,
                "On Hold",
                undefined,
                requisition,
                { triggeredBy: "approve" }
              );
              onUpdateStatus(requisition.id, "On Hold");
              setShowNoCareerLinkedModal(false);
              if (careerId && typeof window !== "undefined") {
                window.location.href = `/recruiter-dashboard/careers/edit-career/${careerId}`;
              }
            } catch (err) {
              console.error("Failed to approve requisition:", err);
            }
          }}
          previousStatus={noCareerLinkedPreviousStatus}
          isLoading={isUpdating}
        />
      )}
      {showPutOnHoldModal && (
        <StatusChangeModal
          onClose={() => setShowPutOnHoldModal(false)}
          onConfirm={handleConfirmPutOnHold}
          title="Put this requisition on hold?"
          description="Placing the requisition on hold keeps it paused until further action is taken."
          iconSrc="/iconsV3/put-on-hold.svg"
          confirmButtonText="Put On Hold"
          isLoading={isUpdating}
        />
      )}
      {showCancelModal && (
        <StatusChangeModal
          onClose={() => setShowCancelModal(false)}
          onConfirm={handleConfirmCancel}
          title="Cancel requisition?"
          description="Cancelling the requisition will prevent it from any future edits or approvals."
          iconSrc="/iconsV3/cancel-circle.svg"
          confirmButtonText="Yes, Cancel"
          cancelButtonText="Go back"
          confirmButtonColor="#D92D20"
          isLoading={isUpdating}
        />
      )}
      {showDeclineCancelRequestModal && (
        <StatusChangeModal
          onClose={() => setShowDeclineCancelRequestModal(false)}
          onConfirm={handleConfirmDeclineCancelRequest}
          title="Decline cancel request?"
          description={`This will revert the requisition back to '${cancelRequestPreviousStatus || "previous"}' status.`}
          iconSrc="/iconsV3/cancel-circle.svg"
          confirmButtonText="Decline Request"
          cancelButtonText="Go back"
          isLoading={isUpdating}
        />
      )}
      {showRequestMoreInfoModal && (
        <StatusChangeModal
          onClose={() => setShowRequestMoreInfoModal(false)}
          onConfirm={handleConfirmRequestMoreInfo}
          title="Request for more information"
          description="The requisition creator will be asked to provide additional details or clarifications."
          iconSrc="/iconsV3/edit-requisition-data.svg"
          confirmButtonText="Request"
          showDetailsInput
          detailsPlaceholder="Specify details"
          isLoading={isUpdating}
        />
      )}
      {showApproveModal && (
        <StatusChangeModal
          onClose={() => setShowApproveModal(false)}
          onConfirm={handleConfirmApprove}
          title="Approve requisition?"
          description="After approving the requisition, you will be prompted to fill out the career details based on the submitted form."
          iconSrc="/iconsV3/make-it-active.svg"
          confirmButtonText="Approve & Proceed"
          isLoading={isUpdating}
        />
      )}
      {showViewFormModal && (
        <ViewFormModal
          onClose={() => setShowViewFormModal(false)}
          requisition={requisition}
          // Only allow edit mode when status is editable; otherwise show read-only
          isEditMode={isEditableStatus && !featureDisabled}
          requisitionsDisabled={featureDisabled}
          onUpdateStatus={onUpdateStatus}
          onRefetch={() => onUpdateStatus(requisition.id, requisition.status)}
        />
      )}
    </>
  );
};

export default RequisitionActionsDropdown;
