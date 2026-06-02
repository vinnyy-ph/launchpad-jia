import React from "react";

function SkeletonBox({ width, height }: { width: string | number; height: string | number }) {
  return (
    <div
      style={{
        width,
        height,
        background: "linear-gradient(90deg, #F9FAFB 0%, #F3F4F6 50%, #F9FAFB 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        borderRadius: 4,
      }}
    />
  );
}

function SkeletonRow() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1.5fr 1.5fr 1.5fr 0.5fr",
        alignItems: "center",
        padding: "16px 24px",
        borderBottom: "1px solid #EAECF0",
        gap: 16,
        background: "#fff",
      }}
    >
      {/* Position Name */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <SkeletonBox width={180} height={14} />
      </div>

      {/* Reference No */}
      <SkeletonBox width={100} height={14} />

      {/* Date Submitted */}
      <SkeletonBox width={90} height={14} />

      {/* Status */}
      <SkeletonBox width={110} height={24} />

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
        <SkeletonBox width={20} height={20} />
        <SkeletonBox width={20} height={20} />
      </div>
    </div>
  );
}

export default function RequisitionTableSkeleton() {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Table Container */}
        <div
          style={{
            border: "1px solid #EAECF0",
            borderRadius: 12,
            boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
            overflow: "hidden",
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

          {/* Table Body - Skeleton Rows */}
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
