import React from "react";
import type { RequisitionStatus } from "../types";
import { statusPillStyles } from "../types";
import StatusChangeModal from "./StatusChangeModal";
import CareerIncompleteModal from "./CareerIncompleteModal";
import NoCareerLinkedModal from "./NoCareerLinkedModal";
import { RenderField } from "./FormFieldVariants";
import { useUpdateRequisitionStatus } from "./useUpdateRequisitionStatus";
import { useUpdateRequisition } from "./useUpdateRequisition";
import UserAvatar from "../UserAvatar";
import { api } from "@/lib/utils/apiClient";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";

type ViewFormModalProps = {
  onClose: () => void;
  onUpdateStatus?: (requisitionId: string, newStatus: RequisitionStatus) => void;
  onRefetch?: () => void;
  requisition: {
    id?: string;
    positionName: string;
    dateSubmitted?: string;
    status: RequisitionStatus;
    previousStatus?: RequisitionStatus;
    submittedBy: {
      name: string;
      email: string;
      avatar: string;
    };
    formData?: {
      positionName?: string;
      jobDescription?: string;
      headcount?: string;
      workArrangement?: string;
      workDays?: string;
      officeLocation?: {
        country?: string;
        stateProvince?: string;
        city?: string;
      };
      salaryRange?: {
        min?: string;
        max?: string;
        currency?: string;
      };
      employmentType?: string;
      duration?: {
        value?: string;
        unit?: string;
      } | string;
      reason?: string;
    };
  };
  isEditMode?: boolean;
  requisitionsDisabled?: boolean;
};

/**
 * Format a date string for display (e.g., "Nov 28, 2025")
 */
function formatDateForDisplay(dateString?: string): string {
  if (!dateString) return "N/A";
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString; // Return as-is if invalid
  
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const ViewFormModal: React.FC<ViewFormModalProps> = ({
  onClose,
  onUpdateStatus,
  onRefetch,
  requisition,
  isEditMode: initialEditMode = false,
  requisitionsDisabled = false,
}) => {
  // Edit Requisition Data is only available for "In Review" status
  const isEditableStatus = requisition.status === "In Review";
  const featureDisabled = requisitionsDisabled;
  const featureDisabledTitle = "Requisitions are disabled for this organization.";
  const [isEditMode, setIsEditMode] = React.useState(
    initialEditMode && isEditableStatus && !featureDisabled
  );
  const [showMoreOptions, setShowMoreOptions] = React.useState(false);
  const [showMakeActiveModal, setShowMakeActiveModal] = React.useState(false);
  const [showPutOnHoldModal, setShowPutOnHoldModal] = React.useState(false);
  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [showRequestMoreInfoModal, setShowRequestMoreInfoModal] = React.useState(false);
  const [showApproveModal, setShowApproveModal] = React.useState(false);
  const [showUpdateModal, setShowUpdateModal] = React.useState(false);
  const [showDeclineCancelRequestModal, setShowDeclineCancelRequestModal] = React.useState(false);
  const [showCareerIncompleteModal, setShowCareerIncompleteModal] = React.useState(false);
  const [careerIncompleteFields, setCareerIncompleteFields] = React.useState<string[]>([]);
  const [careerIncompleteCareerId, setCareerIncompleteCareerId] = React.useState<string | null>(null);
  const [showNoCareerLinkedModal, setShowNoCareerLinkedModal] = React.useState(false);
  const [noCareerLinkedPreviousStatus, setNoCareerLinkedPreviousStatus] = React.useState<string | undefined>(undefined);
  
  // Form state management for Update button
  const [formValues, setFormValues] = React.useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  
  // Use the hook for status updates
  const { updateStatus, isUpdating } = useUpdateRequisitionStatus();

  // Use the hook for requisition data updates
  const { updateRequisition, isUpdating: isUpdatingRequisition } = useUpdateRequisition();
  const [activeOrg] = useLocalStorage<any>("activeOrg", null);

  // Mark requisition as viewed when modal opens
  React.useEffect(() => {
    const markAsViewed = async () => {
      if (!requisition.id || !activeOrg?._id) return;

      try {
        await api.post("/api/requisitions/mark-viewed", {
          requisitionId: requisition.id,
          orgID: activeOrg._id,
        });
      } catch (error) {
        console.error("Failed to mark requisition as viewed:", error);
      }
    };

    markAsViewed();
  }, [requisition.id, activeOrg?._id]);

  // Store original values for comparison (memoized to not change on re-renders)
  // Structure must match what field components send via onValueChange
  const originalValues = React.useMemo(() => {
    const fd = requisition.formData;
    if (!fd) return {};
    return {
      positionName: (fd.positionName || requisition.positionName || "").trim(),
      jobDescription: (fd.jobDescription || "").trim(),
      headcount: (fd.headcount || "").trim(),
      // WorkArrangementField sends { workArrangement, workDays }
      workArrangement: {
        workArrangement: (fd.workArrangement || "").trim(),
        workDays: (fd.workDays || "").trim(),
      },
      // OfficeLocationField sends { country, stateOrProvince, city }
      officeLocation: {
        country: (fd.officeLocation?.country || "").trim(),
        stateOrProvince: (fd.officeLocation?.stateProvince || "").trim(),
        city: (fd.officeLocation?.city || "").trim(),
      },
      // SalaryRangeField sends { min, max, currency }
      salaryRange: {
        min: (fd.salaryRange?.min || "").toString().trim(),
        max: (fd.salaryRange?.max || "").toString().trim(),
        currency: (fd.salaryRange?.currency || "PHP").trim(),
      },
      // EmploymentTypeField sends { employmentType, duration, durationUnit }
      employmentType: {
        employmentType: (fd.employmentType || "").trim(),
        duration: (typeof fd.duration === "object" ? fd.duration?.value || "" : "").trim(),
        durationUnit: (typeof fd.duration === "object" ? fd.duration?.unit || "Months" : "Months").trim(),
      },
      reasonForRequisition: (fd.reason || "").trim(),
    };
  }, [requisition]);
  
  // Callbacks for field value/error changes - only update if value actually changed
  const handleValueChange = React.useCallback((fieldId: string, value: any) => {
    setFormValues(prev => {
      const currentValue = prev[fieldId];
      // For objects, compare JSON strings
      if (typeof value === "object" && typeof currentValue === "object") {
        if (JSON.stringify(value) === JSON.stringify(currentValue)) return prev;
      } else if (currentValue === value) {
        return prev; // No change, return same reference to avoid re-render
      }
      return { ...prev, [fieldId]: value };
    });
  }, []);
  
  const handleErrorChange = React.useCallback((fieldId: string, error: string) => {
    setFormErrors(prev => {
      if (prev[fieldId] === error) return prev; // No change, return same reference
      return { ...prev, [fieldId]: error };
    });
  }, []);
  
  // Use actual form data
  const formData = requisition.formData;
  const positionNameField = formData ? {
    id: "positionName",
    type: "textfield" as const,
    label: "Position Name",
    required: true,
    value: formData.positionName || requisition.positionName,
  } : null;

  const jobDescriptionField = formData ? {
    id: "jobDescription",
    type: "richtext" as const,
    label: "Job Description",
    required: true,
    contentHtml: formData.jobDescription ? `<div>${formData.jobDescription}</div>` : "",
  } : null;

  const headcountField = formData ? {
    id: "headcount",
    type: "textfield" as const,
    label: "Headcount",
    required: true,
    value: formData.headcount || "",
  } : null;

  const workArrangementField = formData ? {
    id: "workArrangement",
    type: "workArrangement" as const,
    label: "Work Arrangement",
    required: true,
    workArrangement: formData.workArrangement || "",
    workDays: formData.workDays,
  } : null;

  const officeLocationField = formData ? {
    id: "officeLocation",
    type: "officeLocation" as const,
    label: "Office Location",
    required: true,
    country: formData.officeLocation?.country || "",
    stateOrProvince: formData.officeLocation?.stateProvince || "",
    city: formData.officeLocation?.city || "",
  } : null;

  const salaryRangeField = formData ? {
    id: "salaryRange",
    type: "salaryRange" as const,
    label: "Salary Range",
    required: true,
    min: formData.salaryRange?.min || "",
    max: formData.salaryRange?.max || "",
    currency: formData.salaryRange?.currency || "PHP",
  } : null;

  const employmentTypeField = formData ? {
    id: "employmentType",
    type: "employmentType" as const,
    label: "Employment Type",
    required: false,
    employmentType: formData.employmentType || "",
    duration: typeof formData.duration === "object" ? formData.duration?.value : undefined,
    durationUnit: typeof formData.duration === "object" ? formData.duration?.unit : undefined,
  } : null;

  const reasonForRequisitionField = formData ? {
    id: "reasonForRequisition",
    type: "textarea" as const,
    label: "Reason for Requisition",
    required: true,
    value: formData.reason || "",
  } : null;

  // Disable Put on Hold for: already On Hold, In Review (not approved), or Requires More Info (not approved)
  // These statuses don't have a linked career yet, so putting on hold would cause issues when resuming
  const disablePutOnHold = requisition.status === "On Hold" || requisition.status === "In Review" || requisition.status === "Requires More Info";
  const isCancelled = requisition.status === "Cancelled";
  const isLocked = requisition.status === "Active";
  const cancelRequestPreviousStatus = (requisition as any).cancelRequestPreviousStatus || (requisition as any).previousStatus;
  const disableDeclineCancelRequest = requisition.status !== "Request to Cancel" || !cancelRequestPreviousStatus;
  const disablePrimary =
    isCancelled ||
    requisition.status === "Active" ||
    requisition.status === "Requires More Info";
  const primaryLabel = requisition.status === "Requires More Info" ? "Request More Info" : "Make Active";

  // Helper to strip HTML and get plain text
  const stripHtml = (html: string): string => {
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  };

  // Helper to normalize values for comparison
  const normalizeForComparison = (val: any, isRichText = false): string => {
    if (val === null || val === undefined) return "";
    if (typeof val === "string") {
      const trimmed = val.trim();
      return isRichText ? stripHtml(trimmed) : trimmed;
    }
    if (typeof val === "object") {
      // Normalize object values by trimming all string properties and sorting keys
      const normalized: Record<string, string> = {};
      const sortedKeys = Object.keys(val).sort();
      for (const k of sortedKeys) {
        const v = val[k];
        normalized[k] = typeof v === "string" ? v.trim() : String(v || "");
      }
      return JSON.stringify(normalized);
    }
    return String(val).trim();
  };

  // Check if form has any actual changes from original data
  const hasChanges = React.useMemo(() => {
    if (Object.keys(formValues).length === 0) return false;
    
    for (const [fieldId, currentValue] of Object.entries(formValues)) {
      const originalValue = originalValues[fieldId as keyof typeof originalValues];
      const isRichTextField = fieldId === "jobDescription";
      
      // For string values, compare normalized strings
      if (typeof currentValue === "string") {
        const currentNormalized = normalizeForComparison(currentValue, isRichTextField);
        const originalNormalized = normalizeForComparison(originalValue, isRichTextField);
        if (currentNormalized !== originalNormalized) {
          return true;
        }
      }
      // For object values (like salaryRange, officeLocation, etc.)
      else if (typeof currentValue === "object" && currentValue !== null) {
        const currentNormalized = normalizeForComparison(currentValue);
        const originalNormalized = normalizeForComparison(originalValue);
        if (currentNormalized !== originalNormalized) {
          return true;
        }
      }
    }
    return false;
  }, [formValues, originalValues]);

  // Check if form has any errors
  const hasErrors = React.useMemo(() => {
    return Object.values(formErrors).some(error => error !== "");
  }, [formErrors]);

  // Disable Update button if no changes or has errors
  const isUpdateDisabled = !isEditableStatus || !hasChanges || hasErrors;

  const handleMakeActiveClick = () => {
    if (featureDisabled) return;
    setShowMoreOptions(false);
    setShowMakeActiveModal(true);
  };

  const handleConfirmMakeActive = async () => {
    console.log("Resuming requisition:", requisition.positionName);
    if (featureDisabled) {
      setShowMakeActiveModal(false);
      return;
    }
    if (requisition.id) {
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
          requisition as any,
          requisition.status === "On Hold" ? { triggeredBy: "career_publish" } : undefined
        );
        const finalStatus = actualStatus || "Active";
        onUpdateStatus?.(requisition.id, finalStatus);
        console.log("Updated to status:", finalStatus);
      } catch (error) {
        const anyError = error as any;
        if (anyError?.code === "CAREER_INCOMPLETE") {
          setCareerIncompleteCareerId(anyError?.careerId || null);
          setCareerIncompleteFields(
            Array.isArray(anyError?.missingFields) ? anyError.missingFields : []
          );
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
        console.error("Failed to update status:", error);
      }
    }
    setShowMakeActiveModal(false);
  };

  const handlePutOnHoldClick = () => {
    if (featureDisabled) return;
    setShowMoreOptions(false);
    setShowPutOnHoldModal(true);
  };

  const handleConfirmPutOnHold = async () => {
    console.log("Putting requisition on hold:", requisition.positionName);
    if (featureDisabled) {
      setShowPutOnHoldModal(false);
      return;
    }
    if (requisition.id) {
      try {
        await updateStatus(requisition.id, "On Hold", undefined, requisition as any, {
          triggeredBy: "requisition_put_on_hold",
        });
        onUpdateStatus?.(requisition.id, "On Hold");
      } catch (error) {
        console.error("Failed to update status:", error);
      }
    }
    setShowPutOnHoldModal(false);
  };

  const handleCancelRequisitionClick = () => {
    if (featureDisabled) return;
    setShowMoreOptions(false);
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    console.log("Cancelling requisition:", requisition.positionName);
    if (featureDisabled) {
      setShowCancelModal(false);
      return;
    }
    if (requisition.id) {
      try {
        await updateStatus(requisition.id, "Cancelled", undefined, requisition as any, {
          triggeredBy: "requisition_cancel",
        });
        onUpdateStatus?.(requisition.id, "Cancelled");
      } catch (error) {
        console.error("Failed to update status:", error);
      }
    }
    setShowCancelModal(false);
  };

  const handleRequestMoreInfoClick = () => {
    if (featureDisabled) return;
    setShowMoreOptions(false);
    setShowRequestMoreInfoModal(true);
  };

  const handleConfirmRequestMoreInfo = async (details?: string) => {
    console.log("🔵 [ViewFormModal] Requesting more info:", {
      positionName: requisition.positionName,
      id: requisition.id,
      details,
      requester: requisition.submittedBy.name
    });
    
    if (requisition.id && details) {
      try {
        await updateStatus(requisition.id, "Requires More Info", details, requisition as any);
        onUpdateStatus?.(requisition.id, "Requires More Info");
      } catch (error) {
        console.error("Failed to update status:", error);
      }
    }
    setShowRequestMoreInfoModal(false);
  };

  const handleEditRequisitionClick = () => {
    if (featureDisabled) return;
    setShowMoreOptions(false);
    setIsEditMode(true);
  };

  const handleDeclineCancelRequestClick = () => {
    if (featureDisabled) return;
    setShowMoreOptions(false);
    if (disableDeclineCancelRequest) return;
    setShowDeclineCancelRequestModal(true);
  };

  const handleConfirmDeclineCancelRequest = async () => {
    if (!cancelRequestPreviousStatus) {
      setShowDeclineCancelRequestModal(false);
      return;
    }
    if (featureDisabled) {
      setShowDeclineCancelRequestModal(false);
      return;
    }
    try {
      await updateStatus(requisition.id!, cancelRequestPreviousStatus, undefined, requisition as any, {
        triggeredBy: "decline_cancel_request",
      });
      onUpdateStatus?.(requisition.id!, cancelRequestPreviousStatus);
      setShowDeclineCancelRequestModal(false);
    } catch (error) {
      console.error("Failed to decline cancel request:", error);
      setShowDeclineCancelRequestModal(false);
    }
  };

  const handleApproveClick = () => {
    if (featureDisabled) return;
    setShowMoreOptions(false);
    setShowApproveModal(true);
  };

  const handleConfirmApprove = async () => {
    console.log("Approving requisition:", requisition.positionName);
    if (featureDisabled) {
      setShowApproveModal(false);
      return;
    }
    if (requisition.id) {
      try {
        const { careerId } = await updateStatus(
          requisition.id,
          "On Hold",
          undefined,
          requisition as any,
          { triggeredBy: "approve" }
        );
        onUpdateStatus?.(requisition.id, "On Hold");

        if (careerId && typeof window !== "undefined") {
          window.location.href = `/recruiter-dashboard/careers/edit-career/${careerId}`;
        }
      } catch (error) {
        console.error("Failed to update status:", error);
      }
    }
    setShowApproveModal(false);
  };

  const handleUpdateClick = () => {
    if (featureDisabled) return;
    setShowUpdateModal(true);
  };

  const handleConfirmUpdate = async () => {
    if (!requisition.id) {
      console.error("Cannot update: requisition ID is missing");
      return;
    }
    if (featureDisabled) {
      setShowUpdateModal(false);
      return;
    }
    
    try {
      // Build the updated form data from current form values
      const updatedFormData = {
        positionName: formValues.positionName ?? requisition.formData?.positionName ?? requisition.positionName,
        jobDescription: formValues.jobDescription ?? requisition.formData?.jobDescription,
        headcount: formValues.headcount ?? requisition.formData?.headcount,
        workArrangement: formValues.workArrangement?.workArrangement ?? requisition.formData?.workArrangement,
        workDays: formValues.workArrangement?.workDays ?? requisition.formData?.workDays,
        officeLocation: formValues.officeLocation ? {
          country: formValues.officeLocation.country,
          stateProvince: formValues.officeLocation.stateOrProvince,
          city: formValues.officeLocation.city,
        } : requisition.formData?.officeLocation,
        salaryRange: formValues.salaryRange ? {
          min: formValues.salaryRange.min,
          max: formValues.salaryRange.max,
          currency: formValues.salaryRange.currency,
        } : requisition.formData?.salaryRange,
        employmentType: formValues.employmentType?.employmentType ?? requisition.formData?.employmentType,
        duration: formValues.employmentType ? {
          value: formValues.employmentType.duration,
          unit: formValues.employmentType.durationUnit,
        } : requisition.formData?.duration,
        reason: formValues.reasonForRequisition ?? requisition.formData?.reason,
      };
      
      console.log("Updating requisition:", requisition.positionName, updatedFormData);
      
      await updateRequisition(requisition.id, updatedFormData);
      
      // Trigger refetch to update the table data
      onRefetch?.();
      
      setShowUpdateModal(false);
      onClose();
    } catch (error) {
      console.error("Failed to update requisition:", error);
      // Keep modal open on error so user can see the error or retry
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 1050,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onClick={onClose}
      >
        {/* Modal Container */}
        <div
          style={{
            position: "relative",
            width: 1000,
            height: 780,
            backgroundColor: "#FFFFFF",
            borderRadius: 24,
            boxShadow: "0px 20px 60px rgba(0, 0, 0, 0.15)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 24px",
              borderBottom: "1px solid #EAECF0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ fontSize: 20, fontWeight: 550, color: "#101828", margin: 0 }}>View Form</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* More Options Dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => {
                    if (featureDisabled) return;
                    setShowMoreOptions(!showMoreOptions);
                  }}
                  disabled={featureDisabled}
                  aria-disabled={featureDisabled}
                  title={featureDisabled ? featureDisabledTitle : undefined}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 999,
                    border: "1px solid #D0D5DD",
                    background: "#FFFFFF",
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#344054",
                    cursor: featureDisabled ? "not-allowed" : "pointer",
                    opacity: featureDisabled ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  More options
                  <img src="/icons/chevron.svg" alt="" style={{ width: 16, height: 16 }} />
                </button>
                {showMoreOptions && (
                  <div
                    className="dropdown-menu dropdown-menu-right mt-1 org-dropdown-anim show"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      right: 0,
                      minWidth: 228,
                      padding: "12px 0",
                      borderRadius: 16,
                      border: "none",
                      boxShadow: "0px 18px 45px rgba(15, 23, 42, 0.12)",
                      backgroundColor: "white",
                      zIndex: 1000,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {requisition.status === "In Review" ? (
                      <>
                        <button
                          type="button"
                          className="dropdown-item"
                          style={{
                            padding: "8px 20px",
                            fontSize: 14,
                            fontWeight: 400,
                            color: featureDisabled ? "#D0D5DD" : "#111827",
                            backgroundColor: "transparent",
                            width: "100%",
                            border: "none",
                            textAlign: "left",
                            cursor: featureDisabled ? "not-allowed" : "pointer",
                            pointerEvents: featureDisabled ? "none" : "auto",
                          }}
                          onClick={handleRequestMoreInfoClick}
                          disabled={featureDisabled}
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
                            color: featureDisabled ? "#D0D5DD" : "#111827",
                            backgroundColor: "transparent",
                            width: "100%",
                            border: "none",
                            textAlign: "left",
                            cursor: featureDisabled ? "not-allowed" : "pointer",
                            pointerEvents: featureDisabled ? "none" : "auto",
                          }}
                          onClick={handleEditRequisitionClick}
                          disabled={featureDisabled}
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
                            color: featureDisabled || disablePutOnHold ? "#D0D5DD" : "#111827",
                            backgroundColor: "transparent",
                            cursor: featureDisabled || disablePutOnHold ? "not-allowed" : "pointer",
                            pointerEvents: featureDisabled || disablePutOnHold ? "none" : "auto",
                            width: "100%",
                            border: "none",
                            textAlign: "left",
                          }}
                          onClick={handlePutOnHoldClick}
                          disabled={featureDisabled || disablePutOnHold}
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
                            color: featureDisabled ? "#D0D5DD" : "#111827",
                            backgroundColor: "transparent",
                            width: "100%",
                            border: "none",
                            textAlign: "left",
                            cursor: featureDisabled ? "not-allowed" : "pointer",
                            pointerEvents: featureDisabled ? "none" : "auto",
                          }}
                          onClick={handleCancelRequisitionClick}
                          disabled={featureDisabled}
                          title={featureDisabled ? featureDisabledTitle : undefined}
                        >
                          Cancel Requisition
                        </button>
                      </>
                    ) : requisition.status === "Request to Cancel" ? (
                      <>
                        <button
                          type="button"
                          className="dropdown-item"
                          style={{
                            padding: "8px 20px",
                            fontSize: 14,
                            fontWeight: 400,
                            color:
                              featureDisabled || disableDeclineCancelRequest
                                ? "#D0D5DD"
                                : "#111827",
                            backgroundColor: "transparent",
                            cursor:
                              featureDisabled || disableDeclineCancelRequest
                                ? "not-allowed"
                                : "pointer",
                            pointerEvents:
                              featureDisabled || disableDeclineCancelRequest
                                ? "none"
                                : "auto",
                            width: "100%",
                            border: "none",
                            textAlign: "left",
                          }}
                          onClick={handleDeclineCancelRequestClick}
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
                            color: featureDisabled ? "#D0D5DD" : "#111827",
                            backgroundColor: "transparent",
                            width: "100%",
                            border: "none",
                            textAlign: "left",
                            cursor: featureDisabled ? "not-allowed" : "pointer",
                            pointerEvents: featureDisabled ? "none" : "auto",
                          }}
                          onClick={handleCancelRequisitionClick}
                          disabled={featureDisabled}
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
                            width: "100%",
                            border: "none",
                            textAlign: "left",
                          }}
                          onClick={
                            requisition.status === "Requires More Info"
                              ? handleRequestMoreInfoClick
                              : handleMakeActiveClick
                          }
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
                            width: "100%",
                            border: "none",
                            textAlign: "left",
                          }}
                          onClick={handleEditRequisitionClick}
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
                            width: "100%",
                            border: "none",
                            textAlign: "left",
                          }}
                          onClick={handlePutOnHoldClick}
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
                            width: "100%",
                            border: "none",
                            textAlign: "left",
                          }}
                          onClick={handleCancelRequisitionClick}
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
              {/* Primary Action Button - Approve or Update based on edit mode (only for In Review) */}
              {requisition.status === "In Review" && (
                <button
                  type="button"
                  onClick={isEditMode ? handleUpdateClick : handleApproveClick}
                  disabled={
                    featureDisabled ||
                    (isEditMode ? (isUpdateDisabled || isUpdatingRequisition) : isUpdating)
                  }
                  title={featureDisabled ? featureDisabledTitle : undefined}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 999,
                    border: "none",
                    background: isEditMode 
                      ? (isUpdateDisabled || isUpdatingRequisition ? "#E5E7EB" : "#FEC84B")
                      : "#181D27",
                    fontSize: 14,
                    fontWeight: 500,
                    color: isEditMode 
                      ? (isUpdateDisabled || isUpdatingRequisition ? "#9CA3AF" : "#181D27")
                      : "#FFFFFF",
                    cursor:
                      featureDisabled ||
                      (isEditMode ? (isUpdateDisabled || isUpdatingRequisition) : isUpdating)
                        ? "not-allowed"
                        : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    whiteSpace: "nowrap",
                    opacity: featureDisabled ? 0.7 : 1,
                  }}
                >
                  {!isEditMode && <img src="/iconsV3/check.svg" alt="" style={{ width: 20, height: 20 }} />}
                  {isEditMode 
                    ? (isUpdatingRequisition ? "Updating..." : "Update")
                    : (isUpdating ? "Approving..." : "Approve")
                  }
                </button>
              )}
              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: 8,
                  borderRadius: 999,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 20, color: "#667085" }}>×</span>
              </button>
            </div>
          </div>

          {/* User Info Row - border spans full width, content has padding */}
          <div style={{ borderBottom: "1px solid #EAECF0" }}>
            <div
              style={{
                padding: "12px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img
                  src={requisition.submittedBy.avatar || `https://api.dicebear.com/9.x/shapes/svg?seed=${requisition.submittedBy.email}`}
                  alt={requisition.submittedBy.name}
                  style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
                />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>{requisition.submittedBy.name}</div>
                  <div style={{ fontSize: 13, color: "#667085" }}>{requisition.submittedBy.email}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#667085" }}>
                  <span>Submitted:</span>
                  <span style={{ fontWeight: 500 }}>{formatDateForDisplay(requisition.dateSubmitted)}</span>
                </div>
                <span
                  style={{
                    ...statusPillStyles[requisition.status],
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {requisition.status}
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              flex: 1,
              overflowY: "auto",
            }}
          >
            {featureDisabled && (
              <div
                style={{
                  marginBottom: 8,
                  padding: "12px 16px",
                  borderRadius: 8,
                  backgroundColor: "#FEF3C7",
                  border: "1px solid #FDE68A",
                  color: "#92400E",
                }}
              >
                <strong>Requisitions are disabled for this organization.</strong>
                <div>All requisition actions are blocked.</div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <h3 style={{ fontSize: 24, fontWeight: 600, color: "#101828", marginTop: 0, marginBottom: 0 }}>
                  Requisition Form
                </h3>
                <p style={{ fontSize: 16, fontWeight: 500 ,color: "#717680", marginTop: 0, marginBottom: 0, lineHeight: 1 }}>
                  Use this form to request the creation of a new position, define job details, and begin the hiring
                  process.
                </p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 500, color: "#D92D20", marginTop: 0, marginBottom: 0 }}>
                * Indicates required question
              </p>
            </div>

            {/* Form Fields Container */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Position Name */}
              {positionNameField && <RenderField field={positionNameField} isEditMode={isEditMode} onValueChange={handleValueChange} onErrorChange={handleErrorChange} />}

              {/* Job Description */}
              {jobDescriptionField && <RenderField field={jobDescriptionField} isEditMode={isEditMode} onValueChange={handleValueChange} onErrorChange={handleErrorChange} />}

              {/* Headcount */}
              {headcountField && <RenderField field={headcountField} isEditMode={isEditMode} onValueChange={handleValueChange} onErrorChange={handleErrorChange} />}

              {/* Work Arrangement */}
              {workArrangementField && <RenderField field={workArrangementField} isEditMode={isEditMode} onValueChange={handleValueChange} onErrorChange={handleErrorChange} />}

              {/* Office Location */}
              {officeLocationField && <RenderField field={officeLocationField} isEditMode={isEditMode} onValueChange={handleValueChange} onErrorChange={handleErrorChange} />}

              {/* Salary Range */}
              {salaryRangeField && <RenderField field={salaryRangeField} isEditMode={isEditMode} onValueChange={handleValueChange} onErrorChange={handleErrorChange} />}

              {/* Employment Type */}
              {employmentTypeField && <RenderField field={employmentTypeField} isEditMode={isEditMode} onValueChange={handleValueChange} onErrorChange={handleErrorChange} />}

              {/* Reason for Requisition */}
              {reasonForRequisitionField && <RenderField field={reasonForRequisitionField} isEditMode={isEditMode} onValueChange={handleValueChange} onErrorChange={handleErrorChange} />}
            </div>
          </div>

        </div>
      </div>

      {/* Status Change Modals */}
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
            if (!requisition.id) return;
            try {
              const { careerId } = await updateStatus(
                requisition.id,
                "On Hold",
                undefined,
                requisition as any,
                { triggeredBy: "approve" }
              );
              onUpdateStatus?.(requisition.id, "On Hold");
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
          title="Approve this requisition?"
          description="Approving this requisition will change its status to 'On Hold', create a draft career, and redirect you to edit the career before publishing."
          iconSrc="/iconsV3/make-it-active.svg"
          confirmButtonText={isUpdating ? "Approving..." : "Approve"}
          cancelButtonText="Cancel"
          isLoading={isUpdating}
        />
      )}
      {showUpdateModal && (
        <StatusChangeModal
          onClose={() => setShowUpdateModal(false)}
          onConfirm={handleConfirmUpdate}
          title="Update this requisition?"
          description="The changes you made will be saved and the requisition data will be updated."
          iconSrc="/iconsV3/edit-requisition-data.svg"
          confirmButtonText="Update"
          confirmButtonColor="#FEC84B"
          confirmButtonTextColor="#181D27"
          isLoading={isUpdatingRequisition}
        />
      )}
      {showDeclineCancelRequestModal && (
        <StatusChangeModal
          onClose={() => setShowDeclineCancelRequestModal(false)}
          onConfirm={handleConfirmDeclineCancelRequest}
          title="Decline cancel request?"
          description={`This will restore the requisition to its previous status: "${cancelRequestPreviousStatus || "Unknown"}".`}
          iconSrc="/iconsV3/make-it-active.svg"
          confirmButtonText="Decline Request"
          isLoading={isUpdating}
        />
      )}
    </>
  );
};

export default ViewFormModal;
