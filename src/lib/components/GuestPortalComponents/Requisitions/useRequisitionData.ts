import { useState, useEffect } from "react";
import { RequisitionFormData, RequisitionItem } from "./types";
import { api } from "@/lib/utils/apiClient";

/**
 * Hook for fetching a single requisition by ID
 * Used for view/edit modes to prepopulate form data
 */
interface UseFetchRequisitionByIdOptions {
  requisitionId: string | null;
  enabled?: boolean;
  onSuccess?: (requisition: RequisitionItem) => void;
  onError?: (error: Error) => void;
}

interface UseFetchRequisitionByIdReturn {
  requisition: RequisitionItem | null;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useFetchRequisitionById(
  options: UseFetchRequisitionByIdOptions
): UseFetchRequisitionByIdReturn {
  const { requisitionId, enabled = true, onSuccess, onError } = options;
  const [requisition, setRequisition] = useState<RequisitionItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRequisition = async () => {
    if (!requisitionId || !enabled) return;

    setIsFetching(true);
    if (!requisition) {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Call API using apiClient (includes auth token)
      const response = await api.get(`/api/requisitions/${requisitionId}`);
      const result = response.data;
      const fetchedRequisition: RequisitionItem = {
        id: result.requisition.id,
        positionName: result.requisition.positionName,
        referenceNo: result.requisition.referenceNo,
        dateSubmitted: result.requisition.dateSubmitted,
        status: result.requisition.status,
        submittedBy: result.requisition.submittedBy,
        formData: result.requisition.formData,
        moreInfoReason: result.requisition.moreInfoReason,
        moreInfoBy: result.requisition.moreInfoBy,
        moreInfoByEmail: result.requisition.moreInfoByEmail,
        moreInfoByAvatar: result.requisition.moreInfoByAvatar,
        cancelReason: result.requisition.cancelReason,
      };

      setRequisition(fetchedRequisition);
      onSuccess?.(fetchedRequisition);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch requisition");
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchRequisition();
  }, [requisitionId, enabled]);

  return {
    requisition,
    isLoading,
    isFetching,
    error,
    refetch: fetchRequisition,
  };
}

/**
 * Hook for fetching all requisitions list
 * Used for displaying requisitions table
 */
interface UseFetchRequisitionsListOptions {
  orgId?: string | null;
  enabled?: boolean;
  onSuccess?: (requisitions: RequisitionItem[]) => void;
  onError?: (error: Error) => void;
}

interface UseFetchRequisitionsListReturn {
  requisitions: RequisitionItem[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useFetchRequisitionsList(
  options?: UseFetchRequisitionsListOptions
): UseFetchRequisitionsListReturn {
  const { orgId, enabled = true, onSuccess, onError } = options || {};
  const [requisitions, setRequisitions] = useState<RequisitionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRequisitions = async () => {
    if (!enabled) return;

    setIsFetching(true);
    setIsLoading(true);
    setError(null);

    try {
      // Use orgId from parameter, fallback to localStorage
      let orgID = orgId;
      if (!orgID && typeof window !== 'undefined' && localStorage.guestOrg) {
        const guestOrg = JSON.parse(localStorage.guestOrg);
        orgID = guestOrg?._id;
      }
      
      if (!orgID) {
        throw new Error("No organization ID available");
      }
      
      // Call API using apiClient (includes auth token)
      // filterByUser=true ensures only current user's requisitions are returned
      const response = await api.get(`/api/requisitions?orgID=${orgID}&filterByUser=true`);
      const result = response.data;
      const fetchedRequisitions: RequisitionItem[] = result.requisitions.map((req: any) => ({
        id: req.id,
        positionName: req.positionName,
        referenceNo: req.referenceNo,
        dateSubmitted: req.dateSubmitted,
        status: req.status,
        submittedBy: req.submittedBy,
        formData: req.formData,
        moreInfoReason: req.moreInfoReason,
        moreInfoBy: req.moreInfoBy,
        moreInfoByEmail: req.moreInfoByEmail,
        moreInfoByAvatar: req.moreInfoByAvatar,
        cancelReason: req.cancelReason,
      }));

      setRequisitions(fetchedRequisitions);
      setIsLoading(false);
      setIsFetching(false);
      onSuccess?.(fetchedRequisitions);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch requisitions");
      setError(error);
      setIsLoading(false);
      setIsFetching(false);
      onError?.(error);
    }
  };

  useEffect(() => {
    fetchRequisitions();
  }, [enabled, orgId]);

  return {
    requisitions,
    isLoading,
    isFetching,
    error,
    refetch: fetchRequisitions,
  };
}

