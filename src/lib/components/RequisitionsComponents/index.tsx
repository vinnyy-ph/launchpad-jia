"use client";

import React from "react";

import Header from "./Header";
import Table from "./Table";
import type { Requisition, RequisitionStatus } from "./types";
import { useRequisitionsTable } from "./Table/useRequisitionsTable";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { useAppContext } from "@/lib/context/AppContext";
import CreateRequisitionForm from "@/lib/components/GuestPortalComponents/Form/CreateRequisitionForm";
import { useCreateRequisition } from "@/lib/components/GuestPortalComponents/Requisitions/useCreateRequisition";
import type { RequisitionFormData } from "@/lib/components/GuestPortalComponents/Requisitions/types";
import { errorToast } from "@/lib/Utils";

export default function EmployerRequisitions() {
  const SORT_OPTIONS = [
    "Submitted date (Newest to oldest)",
    "Submitted date (Oldest to newest)",
    "Position name (A - Z)",
    "Position name (Z - A)",
  ] as const;

  type SortOption = (typeof SORT_OPTIONS)[number];

  const [sortBy, setSortBy] = React.useState<SortOption>("Submitted date (Newest to oldest)");
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const { orgID } = useAppContext();
  const [activeOrg] = useLocalStorage<any>("activeOrg", null);

  // Backwards-compatible effective flag:
  // - old orgs might not have guestPortalEnabled saved yet (fallback to projectsEnabled)
  const projectsEnabled = !!activeOrg?.projectsEnabled;
  const guestPortalEnabledEffective =
    typeof activeOrg?.guestPortalEnabled === "boolean"
      ? activeOrg.guestPortalEnabled
      : projectsEnabled;
  const requisitionsEnabledEffective = guestPortalEnabledEffective;
  const requisitionsDisabled = !requisitionsEnabledEffective;

  // Fetch requisitions from API
  const { requisitions, isLoading, error, refetchRequisitions } = useRequisitionsTable();

  const { createRequisition, isLoading: isCreating } = useCreateRequisition({
    orgId: orgID,
    onSuccess: () => {
      refetchRequisitions();
    },
    onError: (error) => {
      errorToast(error.message, 2500);
    },
  });

  const updateRequisitionStatus = React.useCallback(async (requisitionId: string, newStatus: RequisitionStatus) => {
    // Refetch data after status update
    await refetchRequisitions();
  }, [refetchRequisitions]);

  const handleCreateRequisition = () => {
    setShowCreateForm(true);
  };

  const handleBackFromForm = () => {
    setShowCreateForm(false);
  };

  const handleSubmitForm = async (data: RequisitionFormData) => {
    try {
      await createRequisition(data);
    } catch (error) {
      errorToast(error.message, 2500);
    }
  };

  const handleViewRequisitions = () => {
    setShowCreateForm(false);
  };

  const handleBackToHome = () => {
    setShowCreateForm(false);
  };

  // Parse relative date string to minutes for accurate sorting
  const parseRelativeDate = (label: string): number => {
    if (!label || label === "Unknown") return Number.MAX_SAFE_INTEGER;
    
    const lowerLabel = label.toLowerCase();
    
    // Handle "Just now" - 0 minutes ago
    if (lowerLabel === "just now") return 0;
    
    // Handle "Yesterday" - approximately 1 day ago
    if (lowerLabel === "yesterday") return 24 * 60;
    
    // Handle relative time formats: "X unit(s) ago"
    const parts = label.split(" ");
    const value = parseInt(parts[0], 10);
    const unit = parts[1]?.toLowerCase();

    if (!Number.isNaN(value) && unit) {
      if (unit.startsWith("min")) return value; // minutes
      if (unit.startsWith("hour")) return value * 60; // hours to minutes
      if (unit.startsWith("day")) return value * 24 * 60; // days to minutes
      if (unit.startsWith("week")) return value * 7 * 24 * 60; // weeks to minutes
      if (unit.startsWith("month")) return value * 30 * 24 * 60; // months to minutes
    }
    
    // Handle formatted dates (e.g., "Nov 30, 2024") - parse as actual date
    const parsedDate = new Date(label);
    if (!isNaN(parsedDate.getTime())) {
      const now = new Date();
      const diffMs = now.getTime() - parsedDate.getTime();
      return Math.floor(diffMs / (1000 * 60)); // Convert to minutes
    }

    // Unknown format - put at the end
    return Number.MAX_SAFE_INTEGER;
  };

  const sortedRequisitions = React.useMemo(() => {
    const reqs = [...requisitions];

    if (sortBy === "Position name (A - Z)") {
      return reqs.sort((a, b) => a.positionName.localeCompare(b.positionName));
    }

    if (sortBy === "Position name (Z - A)") {
      return reqs.sort((a, b) => b.positionName.localeCompare(a.positionName));
    }

    if (sortBy === "Submitted date (Newest to oldest)") {
      return reqs.sort(
        (a, b) => parseRelativeDate(a.dateSubmitted) - parseRelativeDate(b.dateSubmitted)
      );
    }

    // Submitted date (Oldest to newest)
    return reqs.sort(
      (a, b) => parseRelativeDate(b.dateSubmitted) - parseRelativeDate(a.dateSubmitted)
    );
  }, [sortBy, requisitions]);

  if (showCreateForm) {
    return (
      <div
        className="layered-card-content"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: 0,
          border: "none",
          background: "transparent",
        }}
      >
        <CreateRequisitionForm
          onBack={handleBackFromForm}
          onSubmit={handleSubmitForm}
          onViewRequisitions={handleViewRequisitions}
          onBackToHome={handleBackToHome}
        />
      </div>
    );
  }

  return (
    <div
      className="layered-card-content"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 0,
        border: "none",
        background: "transparent",
      }}
    >
      <Header
        totalCount={sortedRequisitions.length}
        sortLabel="Sort by"
        sortBy={sortBy}
        sortOptions={SORT_OPTIONS as unknown as string[]}
        onChangeSort={(value) => setSortBy(value as SortOption)}
        onCreateRequisition={handleCreateRequisition}
        requisitionsDisabled={requisitionsDisabled}
      />

      {requisitionsDisabled && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px 16px",
            borderRadius: "8px",
            backgroundColor: "#FEF3C7",
            border: "1px solid #FDE68A",
            color: "#92400E",
          }}
        >
          <strong>Requisitions are disabled for this organization.</strong>
          <div>
            All requisition actions are blocked. Contact your admin to enable the Requisitions feature.
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div style={{
          padding: "40px",
          textAlign: "center",
          color: "#B42318",
          fontSize: "14px",
          background: "#FEF3F2",
          borderRadius: "8px",
          border: "1px solid #FECDCA"
        }}>
          <div style={{ fontWeight: 600, marginBottom: "8px" }}>
            Failed to load requisitions
          </div>
          <div style={{ fontSize: "13px", color: "#667085" }}>
            {error.message}
          </div>
          <button
            onClick={() => refetchRequisitions()}
            style={{
              marginTop: "16px",
              padding: "8px 16px",
              background: "#fff",
              border: "1px solid #D0D5DD",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 500
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Table - Show skeleton when loading, empty/data state handled inside */}
      {!error && (
        <Table
          requisitions={sortedRequisitions}
          onUpdateStatus={updateRequisitionStatus}
          isLoading={isLoading}
          requisitionsDisabled={requisitionsDisabled}
        />
      )}
    </div>
  );
}

