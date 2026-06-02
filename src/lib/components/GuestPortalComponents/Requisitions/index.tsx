"use client";

import React from "react";
import GuestPortalContainer from "../GuestPortalContainer";
import RequisitionsEmptyState from "./EmptyState";
import RequisitionTable from "./RequisitionTable";
import RequisitionTableSkeleton from "./RequisitionTableSkeleton";
import CareersEmptyState from "../Careers/EmptyState";
import CareersTable from "../Careers/CareersTable";
import CareersTableSkeleton from "../Careers/CareersTableSkeleton";
import { GuestPortalTab } from "../types";
import { RequisitionFormData } from "./types";
import { useCreateRequisition } from "./useCreateRequisition";
import { useFetchRequisitionsList } from "./useRequisitionData";

interface RequisitionsGuestPortalProps {
  orgId?: string | null;
}

export default function RequisitionsGuestPortal({ orgId }: RequisitionsGuestPortalProps) {
  const [activeTab, setActiveTab] = React.useState<GuestPortalTab>("requisitions");
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [sortOption, setSortOption] = React.useState<string>("Recent Activity");
  
  // Fetch requisitions from API
  const { 
    requisitions: requisitionsList, 
    isLoading: isLoadingRequisitions,
    refetch: refetchRequisitions 
  } = useFetchRequisitionsList({ orgId });

  // Hook for creating requisitions
  const { createRequisition, isLoading: isCreating } = useCreateRequisition({
    orgId,
    onSuccess: (newRequisition) => {
      // Refetch the list to show the new requisition
      refetchRequisitions();
    },
    onError: (error) => {
      console.error("Failed to create requisition:", error);
      // TODO: Show error toast/notification
    },
  });

  const isCareers = activeTab === "careers";

  const handleCreateRequisition = () => {
    setShowCreateForm(true);
  };

  const handleBackFromForm = () => {
    setShowCreateForm(false);
  };

  const handleSubmitForm = async (data: RequisitionFormData) => {
    
    try {
      // Call the hook to create requisition (will handle API call in future)
      await createRequisition(data);
      // Success callback will handle adding to the list
      // Don't hide the form immediately - let the success screen show first
    } catch (error) {
      // Error is already handled in the hook's onError callback
      console.error("Error in handleSubmitForm:", error);
    }
  };

  const handleViewRequisitions = () => {
    setActiveTab("requisitions");
    setShowCreateForm(false);
  };

  const handleBackToHome = () => {
    setActiveTab("requisitions");
    setShowCreateForm(false);
  };

  const handleSortChange = (option: string) => {
    setSortOption(option);
  };

  // Determine what content to show
  const getContent = () => {
    if (isCareers) {
      // TODO: Add careers loading state when needed
      return <CareersTable sortOption={sortOption} orgId={orgId} />;
    }
    
    // For requisitions tab
    if (isLoadingRequisitions) {
      return <RequisitionTableSkeleton />;
    }
    
    if (requisitionsList.length > 0) {
      return <RequisitionTable sortOption={sortOption} requisitions={requisitionsList} onRefetch={refetchRequisitions} />;
    }
    
    return <RequisitionsEmptyState onCreateRequisition={handleCreateRequisition} />;
  };

  return (
    <GuestPortalContainer
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        showCreateForm={showCreateForm}
        onCreateRequisition={handleCreateRequisition}
        onBackFromForm={handleBackFromForm}
        onSubmitForm={handleSubmitForm}
        onViewRequisitions={handleViewRequisitions}
        onBackToHome={handleBackToHome}
        onSortChange={handleSortChange}
      >
        {getContent()}
      </GuestPortalContainer>
  );
}
