"use client";

import React from "react";
import GuestPortalContainer from "../GuestPortalContainer";
import CareersTable from "./CareersTable";
import RequisitionsEmptyState from "../Requisitions/EmptyState";
import RequisitionTable from "../Requisitions/RequisitionTable";
import { useFetchRequisitionsList } from "../Requisitions/useRequisitionData";
import { GuestPortalTab } from "../types";

interface CareersGuestPortalProps {
  orgId?: string | null;
}

export default function CareersGuestPortal({ orgId }: CareersGuestPortalProps) {
  const [activeTab, setActiveTab] = React.useState<GuestPortalTab>("careers");
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [sortOption, setSortOption] = React.useState<string>("Recent Activity");

  // Fetch requisitions from API
  const { requisitions, refetch: refetchRequisitions } = useFetchRequisitionsList({
    orgId,
    enabled: activeTab === "requisitions",
  });

  const isCareers = activeTab === "careers";

  const handleCreateRequisition = () => {
    setShowCreateForm(true);
  };

  const handleBackFromForm = () => {
    setShowCreateForm(false);
  };

  const handleSubmitForm = (_data: unknown) => {
    // Don't hide the form immediately - let the success screen show first
    // setShowCreateForm(false);
    // Add your API call or data handling here
  };

  const handleViewRequisitions = () => {
    setActiveTab("requisitions");
    setShowCreateForm(false);
  };

  const handleBackToHome = () => {
    setActiveTab("careers");
    setShowCreateForm(false);
  };

  const handleSortChange = (option: string) => {
    setSortOption(option);
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
      {isCareers ? (
        <CareersTable sortOption={sortOption} orgId={orgId} />
      ) : requisitions.length > 0 ? (
        <RequisitionTable 
          requisitions={requisitions} 
          sortOption={sortOption} 
          onRefetch={refetchRequisitions}
        />
      ) : (
        <RequisitionsEmptyState onCreateRequisition={handleCreateRequisition} />
      )}
    </GuestPortalContainer>
  );
}
