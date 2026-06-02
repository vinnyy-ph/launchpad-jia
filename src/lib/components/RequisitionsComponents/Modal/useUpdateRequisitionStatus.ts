import { useState, useCallback } from "react";
import type { RequisitionStatus } from "../types";
import { api } from "@/lib/utils/apiClient";

export type UpdateRequisitionStatusError = Error & {
  code?: string;
  careerId?: string | null;
  missingFields?: string[];
};

export function useUpdateRequisitionStatus() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateStatus = useCallback(async (
    requisitionId: string, 
    newStatus: RequisitionStatus,
    details?: string,
    fullRequisition?: any,
    extraMetadata?: Record<string, string>
  ): Promise<{ success: boolean; careerId?: string | null; actualStatus?: RequisitionStatus }> => {
    setIsUpdating(true);
    setError(null);
    try {
      console.log(`🟡 [useUpdateRequisitionStatus] Updating requisition ${requisitionId} to ${newStatus}`, details ? `with details: ${details}` : '');
      
      // Determine metadata based on status
      const metadata: any = { ...(extraMetadata || {}) };

      // If user is resuming an On Hold requisition to Active from this UI,
      // treat it as a publish activation so the API is allowed to proceed and
      // can republish the linked career.
      if (
        newStatus === "Active" &&
        fullRequisition?.status === "On Hold" &&
        !metadata.triggeredBy
      ) {
        metadata.triggeredBy = "career_publish";
      }
      if (newStatus === "Requires More Info" && details) {
        metadata.moreInfoReason = details;
        metadata.moreInfoBy = fullRequisition?.submittedBy?.name || "Admin";
      } else if (newStatus === "Request to Cancel" && details) {
        metadata.cancelReason = details;
      } else if (newStatus === "Cancelled" && details) {
        metadata.cancelReason = details;
      }
      
      // Call API to update status using apiClient (includes auth token)
      const response = await api.patch(`/api/requisitions/${requisitionId}/status`, {
        status: newStatus,
        metadata
      });
      
      const careerId = response.data?.careerId ?? null;
      // Get the actual status from the response (may differ from newStatus when resuming from On Hold)
      const actualStatus = response.data?.requisition?.status as RequisitionStatus | undefined;
      console.log(`✅ [useUpdateRequisitionStatus] Updated successfully`, actualStatus ? `to ${actualStatus}` : "", careerId ? `Created careerId=${careerId}` : "");
      return { success: true, careerId, actualStatus };
    } catch (err: any) {
      const apiData = err?.response?.data;
      const errorMessage =
        apiData?.message ||
        apiData?.error ||
        (err instanceof Error ? err.message : "Failed to update requisition status");

      const error: UpdateRequisitionStatusError = new Error(errorMessage);
      if (apiData?.code) error.code = apiData.code;
      if (typeof apiData?.careerId !== "undefined") error.careerId = apiData.careerId;
      if (Array.isArray(apiData?.missingFields)) error.missingFields = apiData.missingFields;

      setError(error);
      console.error("❌ [useUpdateRequisitionStatus] Error:", error.message);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return {
    updateStatus,
    isUpdating,
    error,
  };
}
