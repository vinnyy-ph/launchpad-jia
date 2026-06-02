"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GuestPortalContainer from "@/lib/components/GuestPortalComponents/GuestPortalContainer";
import { CreateRequisitionForm, SkeletonForm } from "@/lib/components/GuestPortalComponents/Form";
import { RequisitionFormData } from "../types";
import { useFetchRequisitionById } from "../useRequisitionData";
import { useUpdateRequisition } from "../useUpdateRequisition";

interface EditRequisitionPageProps {
  requisitionId: string;
  mode?: "view" | "edit";
  orgId?: string | null;
}

export default function EditRequisitionPage({ requisitionId, mode = "edit", orgId }: EditRequisitionPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Use orgId from prop or from URL query params
  const currentOrgId = orgId || searchParams.get("orgId");
  
  // Helper to build URL with orgId
  const buildUrl = (path: string) => {
    if (!currentOrgId) return path;
    return `${path}?orgId=${currentOrgId}`;
  };
  
  // Fetch requisition data by ID with loading state
  const { requisition, isLoading, error, refetch } = useFetchRequisitionById({
    requisitionId,
    enabled: !!requisitionId,
    onError: (error) => {
      console.error("Failed to fetch requisition:", error);
    },
  });

  // Hook for updating requisition
  const { updateRequisition, isLoading: isSubmitting } = useUpdateRequisition({
    onSuccess: (updatedRequisition) => {
      // Refetch to get latest data
      refetch();
      // After successful update, the success screen will show
      // Then user can navigate back to requisitions
    },
    onError: (error) => {
      console.error("Failed to update requisition:", error);
      // TODO: Show error toast/notification
    },
  });

  const handleBack = () => {
    router.push(buildUrl("/guest-portal/requisitions"));
  };

  const handleViewRequisitions = () => {
    router.push(buildUrl("/guest-portal/requisitions"));
  };

  const handleBackToHome = () => {
    router.push(buildUrl("/guest-portal/requisitions"));
  };

  const handleSubmit = async (data: RequisitionFormData) => {
    // When page is in view mode or requisition is no longer editable, do not submit edits
    const isEditableStatus =
      requisition?.status === "In Review" ||
      requisition?.status === "Requires More Info";

    if (mode === "view" || !isEditableStatus) {
      router.push(buildUrl("/guest-portal/requisitions"));
      return;
    }

    try {
      await updateRequisition(requisitionId, data);
      // Success callback will handle refetch
    } catch (error) {
      console.error("Error in handleSubmit:", error);
    }
  };

  // Redirect if requisition not found or error (only after loading completes)
  React.useEffect(() => {
    if (!isLoading && error) {
      console.error("Redirecting due to error:", error);
      router.push(buildUrl("/guest-portal/requisitions"));
    }
  }, [isLoading, error, router, currentOrgId]);

  // Show skeleton while loading
  if (isLoading) {
    return (
      <GuestPortalContainer
        activeTab="requisitions"
        hideHeaderControls={true}
      >
        <SkeletonForm />
      </GuestPortalContainer>
    );
  }

  // If requisition not found or error, return null (redirect handled by useEffect above)
  if (!requisition || error) {
    return null;
  }

  return (
    <GuestPortalContainer
      activeTab="requisitions"
      hideHeaderControls={true}
    >
      <CreateRequisitionForm
        onBack={handleBack}
        onSubmit={handleSubmit}
        onViewRequisitions={handleViewRequisitions}
        onBackToHome={handleBackToHome}
        initialData={requisition.formData}
        isEditMode={mode === "edit" && (requisition.status === "In Review" || requisition.status === "Requires More Info")}
        isViewMode={mode === "view" || !(requisition.status === "In Review" || requisition.status === "Requires More Info")}
        status={requisition.status}
        moreInfoReason={requisition.moreInfoReason}
        moreInfoBy={requisition.moreInfoBy}
        moreInfoEmail={requisition.moreInfoByEmail}
        moreInfoAvatar={requisition.moreInfoByAvatar}
      />
    </GuestPortalContainer>
  );
}
