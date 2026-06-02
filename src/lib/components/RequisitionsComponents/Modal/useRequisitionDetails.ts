import { useState, useCallback } from "react";
import { api } from "@/lib/utils/apiClient";

export function useRequisitionDetails(requisitionId?: string) {
  const [requisitionDetails, setRequisitionDetails] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRequisitionDetails = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Use apiClient which automatically adds auth token
      const response = await api.get(`/api/requisitions/${id}`);
      
      if (response.data.success) {
        setRequisitionDetails(response.data.requisition);
      } else {
        throw new Error(response.data.message || 'Failed to fetch requisition details');
      }
    } catch (err: any) {
      const error = err?.response?.data?.message 
        ? new Error(err.response.data.message)
        : err instanceof Error 
          ? err 
          : new Error("Failed to fetch requisition details");
      setError(error);
      console.error("Error fetching requisition details:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    requisitionDetails,
    isLoading,
    error,
    fetchRequisitionDetails,
  };
}
