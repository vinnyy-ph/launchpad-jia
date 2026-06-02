"use client";

import React, { useState } from "react";
import RequisitionRow from "./RequisitionRow";
import { RequisitionItem } from "./types";
import { useUpdateRequisitionStatus } from "../../RequisitionsComponents/Modal/useUpdateRequisitionStatus";

interface RequisitionTableProps {
  sortOption?: string;
  requisitions: RequisitionItem[];
  onRefetch: () => Promise<void>;
}

export default function RequisitionTable({ sortOption, requisitions, onRefetch }: RequisitionTableProps) {
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [localRequisitions, setLocalRequisitions] = useState<RequisitionItem[]>(requisitions);
  const [updatingRequisitionId, setUpdatingRequisitionId] = useState<string | null>(null);
  const { updateStatus } = useUpdateRequisitionStatus();

  // Sync local state when prop changes
  React.useEffect(() => {
    setLocalRequisitions(requisitions);
  }, [requisitions]);

  const handleCancelRequest = async (requisitionId: string, reason: string): Promise<void> => {
    setUpdatingRequisitionId(requisitionId);
    try {
      // Call API to update status
      await updateStatus(
        requisitionId, 
        "Request to Cancel",
        reason
      );
      
      // Refetch to get updated data from server
      await onRefetch();
    } catch (error) {
      console.error("Failed to update requisition status:", error);
      // TODO: Show error toast
      throw error; // Re-throw to let the dropdown handle dialog closing
    } finally {
      setUpdatingRequisitionId(null);
    }
  };

  // Sort requisitions based on sortOption
  const sortedRequisitions = React.useMemo(() => {
    const sorted = [...localRequisitions];
    
    // Helper to parse date string (handles ISO dates and relative date strings)
    const parseDate = (dateStr: string): Date => {
      // Handle "Just now" case
      if (dateStr === "Just now") {
        return new Date(); // Current time
      }
      
      // Try parsing as ISO date first
      const isoDate = new Date(dateStr);
      if (!isNaN(isoDate.getTime()) && dateStr.includes('T')) {
        return isoDate;
      }
      
      // Parse relative date strings like "2 days ago", "1 week ago", etc.
      const now = new Date();
      const match = dateStr.match(/(\d+)\s*(minute|hour|day|week|month)s?\s*ago/i);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        
        switch (unit) {
          case 'minute':
            return new Date(now.getTime() - value * 60 * 1000);
          case 'hour':
            return new Date(now.getTime() - value * 60 * 60 * 1000);
          case 'day':
            return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
          case 'week':
            return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
          case 'month':
            return new Date(now.getTime() - value * 30 * 24 * 60 * 60 * 1000);
          default:
            return now;
        }
      }
      
      // Try parsing as a formatted date (e.g., "Nov 28, 2024")
      const formattedDate = new Date(dateStr);
      if (!isNaN(formattedDate.getTime())) {
        return formattedDate;
      }
      
      // Fallback to current time if all parsing fails
      return now;
    };
    
    switch (sortOption) {
      case "Recent Activity":
        // Sort by most recent date first
        return sorted.sort((a, b) => {
          const dateA = parseDate(a.dateSubmitted);
          const dateB = parseDate(b.dateSubmitted);
          return dateB.getTime() - dateA.getTime();
        });
      case "Newest to Oldest":
        return sorted.sort((a, b) => {
          const dateA = parseDate(a.dateSubmitted);
          const dateB = parseDate(b.dateSubmitted);
          return dateB.getTime() - dateA.getTime();
        });
      case "Oldest to Newest":
        return sorted.sort((a, b) => {
          const dateA = parseDate(a.dateSubmitted);
          const dateB = parseDate(b.dateSubmitted);
          return dateA.getTime() - dateB.getTime();
        });
      case "A - Z":
        return sorted.sort((a, b) => a.positionName.localeCompare(b.positionName));
      case "Z - A":
        return sorted.sort((a, b) => b.positionName.localeCompare(a.positionName));
      default:
        return sorted;
    }
  }, [localRequisitions, sortOption]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Table Container */}
      <div
        style={{
          border: "1px solid #EAECF0",
          borderRadius: 12,
          boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
          overflow: "visible",
        }}
      >
        {/* Table Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1.5fr 1.5fr 1.5fr 0.5fr",
            background: "#F9FAFB",
            borderBottom: "1px solid #EAECF0",
            padding: "12px 24px",
            alignItems: "center",
            gap: 16,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#475467" }}>Position Name</span>
            <img
              src="/iconsV3/helper-badge.svg"
              alt="Help"
              style={{ width: 16, height: 16, opacity: 0.5 }}
            />
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#475467" }}>Reference No.</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#475467" }}>Date Submitted</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#475467" }}>Status</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#475467" }}></div>
        </div>

        {/* Table Body */}
        <div>
          {sortedRequisitions.map((item, index) => (
            <RequisitionRow 
              key={item.id} 
              item={item}
              openActionsId={openActionsId}
              setOpenActionsId={setOpenActionsId}
              onCancelRequest={handleCancelRequest}
              isUpdatingStatus={updatingRequisitionId === item.id}
              isLastRow={index === sortedRequisitions.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
