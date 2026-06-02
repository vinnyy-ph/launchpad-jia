import { useState, useCallback } from "react";
import { api } from "@/lib/utils/apiClient";
import type { RequisitionStatus } from "./types";

export function useUpdateRequisitionStatus() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateStatus = useCallback(async (
    requisitionId: string, 
    newStatus: RequisitionStatus,
    details?: string,
    fullRequisition?: any
  ): Promise<{ success: boolean }> => {
    setIsUpdating(true);
    setError(null);
    try {
      console.log(`🟡 [useUpdateRequisitionStatus] Updating requisition ${requisitionId} to ${newStatus}`, details ? `with details: ${details}` : '');
      
      // Determine metadata based on status
      const metadata: any = {};
      if (newStatus === "Requires More Info" && details) {
        metadata.moreInfoReason = details;
        metadata.moreInfoBy = fullRequisition?.submittedBy?.name || "Admin";
      } else if (newStatus === "Request to Cancel" && details) {
        metadata.cancelReason = details;
      } else if (newStatus === "Cancelled" && details) {
        metadata.cancelReason = details;
      }
      
      // Use apiClient which automatically adds auth token
      const response = await api.patch(`/api/requisitions/${requisitionId}/status`, {
        status: newStatus,
        metadata
      });
      
      if (response.data.success) {
        console.log(`✅ [useUpdateRequisitionStatus] Updated successfully`);
        return { success: true };
      } else {
        throw new Error(response.data.message || 'Failed to update requisition status');
      }
    } catch (err: any) {
      const error = err?.response?.data?.message 
        ? new Error(err.response.data.message)
        : err instanceof Error 
          ? err 
          : new Error("Failed to update requisition status");
      setError(error);
      console.error('❌ [useUpdateRequisitionStatus] Error:', error.message);
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
