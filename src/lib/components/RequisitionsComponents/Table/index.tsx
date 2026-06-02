import React from "react";
import TableHeader from "./TableHeader";
import RequisitionRow from "./RequisitionRow";
import type { Requisition, RequisitionStatus } from "../types";

const GRID_TEMPLATE = "1fr 1fr 1fr 1fr 1fr 72px";

// Skeleton shimmer animation styles
const skeletonKeyframes = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

const SkeletonBox: React.FC<{ width: string | number; height: number; borderRadius?: number }> = ({
  width,
  height,
  borderRadius = 4,
}) => (
  <div
    style={{
      width,
      height,
      borderRadius,
      background: "linear-gradient(90deg, #F2F4F7 25%, #E4E7EC 50%, #F2F4F7 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
    }}
  />
);

const SkeletonRow: React.FC<{ isLast: boolean; gridTemplateColumns: string }> = ({
  isLast,
  gridTemplateColumns,
}) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns,
      alignItems: "center",
      padding: "20px 24px",
      borderBottom: isLast ? "none" : "1px solid #EAECF0",
      background: "#FFFFFF",
      borderBottomLeftRadius: isLast ? 16 : 0,
      borderBottomRightRadius: isLast ? 16 : 0,
    }}
  >
    {/* Position Name */}
    <div>
      <SkeletonBox width="70%" height={16} />
    </div>
    {/* Reference No */}
    <div>
      <SkeletonBox width="80%" height={14} />
    </div>
    {/* Date Submitted */}
    <div>
      <SkeletonBox width="60%" height={14} />
    </div>
    {/* Status */}
    <div>
      <SkeletonBox width={80} height={24} borderRadius={999} />
    </div>
    {/* Submitted By */}
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <SkeletonBox width={32} height={32} borderRadius={16} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <SkeletonBox width={100} height={14} />
        <SkeletonBox width={140} height={12} />
      </div>
    </div>
    {/* Actions */}
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 16 }}>
      <SkeletonBox width={32} height={32} borderRadius={8} />
      <SkeletonBox width={32} height={32} borderRadius={8} />
    </div>
  </div>
);

type TableProps = {
  requisitions: Requisition[];
  onUpdateStatus: (requisitionId: string, newStatus: RequisitionStatus) => void;
  isLoading?: boolean;
  requisitionsDisabled?: boolean;
};

const Table: React.FC<TableProps> = ({
  requisitions,
  onUpdateStatus,
  isLoading = false,
  requisitionsDisabled = false,
}) => {
  const [openActionsId, setOpenActionsId] = React.useState<string | null>(null);

  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid #EAECF0",
        overflow: "visible",
        background: "#FFFFFF",
      }}
    >
      {/* Inject shimmer keyframes */}
      <style>{skeletonKeyframes}</style>

      <TableHeader
        gridTemplateColumns={GRID_TEMPLATE}
        columns={["Position Name", "Reference No.", "Date Submitted", "Status", "Submitted by", ""]}
      />

      <div>
        {isLoading ? (
          // Skeleton loading state
          <>
            {[...Array(5)].map((_, idx) => (
              <SkeletonRow
                key={idx}
                isLast={idx === 4}
                gridTemplateColumns={GRID_TEMPLATE}
              />
            ))}
          </>
        ) : requisitions.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "64px 24px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#1D2939",
                margin: 0,
                marginBottom: 4,
              }}
            >
              No requisitions found
            </p>
            <p
              style={{
                fontSize: 14,
                fontWeight: 400,
                color: "#667085",
                margin: 0,
              }}
            >
              Requisitions submitted by your organization will appear here.
            </p>
          </div>
        ) : (
          requisitions.map((req, idx) => (
            <RequisitionRow
              key={req.id}
              requisition={req}
              isLast={idx === requisitions.length - 1}
              gridTemplateColumns={GRID_TEMPLATE}
              openActionsId={openActionsId}
              setOpenActionsId={setOpenActionsId}
              onUpdateStatus={onUpdateStatus}
              requisitionsDisabled={requisitionsDisabled}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Table;
