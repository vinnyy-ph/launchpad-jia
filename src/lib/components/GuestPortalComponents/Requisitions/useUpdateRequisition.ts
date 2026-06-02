import { useState } from "react";
import { RequisitionFormData, RequisitionItem } from "./types";
import { api } from "@/lib/utils/apiClient";

interface UseUpdateRequisitionOptions {
  onSuccess?: (updatedRequisition: RequisitionItem) => void;
  onError?: (error: Error) => void;
}

interface UseUpdateRequisitionReturn {
  updateRequisition: (id: string, data: RequisitionFormData) => Promise<RequisitionItem>;
  isLoading: boolean;
  error: Error | null;
}

export function useUpdateRequisition(
  options?: UseUpdateRequisitionOptions
): UseUpdateRequisitionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateRequisition = async (
    id: string,
    data: RequisitionFormData
  ): Promise<RequisitionItem> => {
    setIsLoading(true);
    setError(null);

    try {
      // Call API to update requisition using apiClient (includes auth token)
      console.log("[Update Requisition] Sending payload:", JSON.stringify({ formData: data }, null, 2));
      const response = await api.put(`/api/requisitions/${id}`, {
        formData: data,
      });

      const result = response.data;
      const updatedRequisition: RequisitionItem = {
        id: result.requisition.id,
        positionName: result.requisition.positionName,
        referenceNo: result.requisition.referenceNo,
        dateSubmitted: result.requisition.dateSubmitted,
        status: result.requisition.status,
        formData: data,
      };

      options?.onSuccess?.(updatedRequisition);
      return updatedRequisition;
    } catch (err: any) {
      // Log the full error response for debugging
      console.error("[Update Requisition] Error:", err?.response?.data || err);
      const errorMessage = err?.response?.data?.message || err?.message || "Failed to update requisition";
      const error = new Error(errorMessage);
      setError(error);
      options?.onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    updateRequisition,
    isLoading,
    error,
  };
}
