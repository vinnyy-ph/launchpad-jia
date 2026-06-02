import { useState, useCallback } from "react";
import { api } from "@/lib/utils/apiClient";

export function useUpdateRequisition() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateRequisition = useCallback(async (requisitionId: string, formData: any) => {
    setIsUpdating(true);
    setError(null);
    try {
      console.log(`🟡 [useUpdateRequisition] Updating requisition ${requisitionId}`);
      
      // Use apiClient which automatically adds auth token
      const response = await api.put(`/api/requisitions/${requisitionId}`, { formData });
      
      if (response.data.success) {
        console.log(`✅ [useUpdateRequisition] Updated successfully`);
        return response.data;
      } else {
        throw new Error(response.data.message || 'Failed to update requisition');
      }
    } catch (err: any) {
      const error = err?.response?.data?.message 
        ? new Error(err.response.data.message)
        : err instanceof Error 
          ? err 
          : new Error("Failed to update requisition");
      setError(error);
      console.error("❌ [useUpdateRequisition] Error:", error.message);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return {
    updateRequisition,
    isUpdating,
    error,
  };
}
