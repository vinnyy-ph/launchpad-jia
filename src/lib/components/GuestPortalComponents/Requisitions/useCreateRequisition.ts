import { useState } from "react";
import { RequisitionFormData, RequisitionItem } from "./types";
import { api } from "@/lib/utils/apiClient";

interface UseCreateRequisitionOptions {
  orgId?: string | null;
  onSuccess?: (newRequisition: RequisitionItem) => void;
  onError?: (error: Error) => void;
}

interface UseCreateRequisitionReturn {
  createRequisition: (data: RequisitionFormData) => Promise<RequisitionItem>;
  isLoading: boolean;
  error: Error | null;
}

export function useCreateRequisition(
  options?: UseCreateRequisitionOptions
): UseCreateRequisitionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createRequisition = async (
    data: RequisitionFormData
  ): Promise<RequisitionItem> => {
    setIsLoading(true);
    setError(null);

    try {
      // Use orgId from options, fallback to localStorage
      let orgID = options?.orgId;
      if (!orgID && typeof window !== 'undefined' && localStorage.guestOrg) {
        const guestOrg = JSON.parse(localStorage.guestOrg);
        orgID = guestOrg?._id;
      }
      
      const user = typeof window !== 'undefined' && localStorage.user 
        ? JSON.parse(localStorage.user) 
        : null;

      if (!orgID) {
        throw new Error("No organization ID available");
      }

      // Call API to create requisition using apiClient (includes auth token)
      const response = await api.post('/api/requisitions', {
        formData: data,
        orgID,
        submittedBy: {
          memberID: user?.uid || "temp-member-id",
          name: user?.displayName || user?.name || "Guest User",
          email: user?.email || "guest@example.com",
          avatar: user?.image || user?.photoURL || "",
        },
      });

      const result = response.data;
      const newRequisition: RequisitionItem = {
        id: result.requisition.id,
        positionName: result.requisition.positionName,
        referenceNo: result.requisition.referenceNo,
        dateSubmitted: result.requisition.dateSubmitted,
        status: result.requisition.status,
        formData: data,
      };

      options?.onSuccess?.(newRequisition);
      return newRequisition;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to create requisition");
      setError(error);
      options?.onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    createRequisition,
    isLoading,
    error,
  };
}
