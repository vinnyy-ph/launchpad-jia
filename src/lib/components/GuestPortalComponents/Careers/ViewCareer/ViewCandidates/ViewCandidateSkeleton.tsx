import React from "react";

function SkeletonBox({
  width,
  height,
  borderRadius = 8,
}: {
  width: string | number;
  height: string | number;
  borderRadius?: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, #F3F4F6 0%, #E5E7EB 50%, #F3F4F6 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
      }}
    />
  );
}

export default function ViewCandidateSkeleton() {
  return (
    <>
      <style>
        {`
          @keyframes shimmer {
            0% {
              background-position: 200% 0;
            }
            100% {
              background-position: -200% 0;
            }
          }
        `}
      </style>
      
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header Section */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <SkeletonBox width={20} height={20} borderRadius={4} />
            <SkeletonBox width={150} height={20} borderRadius={4} />
          </div>
        </div>

        {/* Candidate Info Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: 16,
            background: "#F9FAFB",
            borderRadius: 12,
          }}
        >
          <SkeletonBox width={64} height={64} borderRadius={999} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <SkeletonBox width="40%" height={24} borderRadius={6} />
            <SkeletonBox width="30%" height={16} borderRadius={4} />
            <div style={{ display: "flex", gap: 8 }}>
              <SkeletonBox width={80} height={24} borderRadius={12} />
              <SkeletonBox width={100} height={24} borderRadius={12} />
            </div>
          </div>
          <SkeletonBox width={120} height={40} borderRadius={999} />
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            borderBottom: "1px solid #EAECF0",
            paddingBottom: 1,
          }}
        >
          {[1, 2, 3].map((tab) => (
            <div
              key={tab}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px",
              }}
            >
              <SkeletonBox width={20} height={20} borderRadius={4} />
              <SkeletonBox width={100} height={16} borderRadius={4} />
            </div>
          ))}
        </div>

        {/* Content Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Evaluation Cards */}
          <div
            style={{
              border: "1px solid #E5E7EB",
              borderRadius: 12,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SkeletonBox width={32} height={32} borderRadius={999} />
              <SkeletonBox width={150} height={20} borderRadius={4} />
            </div>
            <SkeletonBox width="100%" height={60} borderRadius={8} />
          </div>

          <div
            style={{
              border: "1px solid #E5E7EB",
              borderRadius: 12,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <SkeletonBox width={120} height={20} borderRadius={4} />
            <SkeletonBox width="100%" height={80} borderRadius={8} />
          </div>

          {/* Main Content Grid */}
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ flex: 7 }}>
              <div
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: 12,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <SkeletonBox width={100} height={20} borderRadius={4} />
                <SkeletonBox width="100%" height={200} borderRadius={8} />
              </div>
            </div>
            <div style={{ flex: 3, display: "flex", flexDirection: "column", gap: 16 }}>
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  style={{
                    border: "1px solid #E5E7EB",
                    borderRadius: 12,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <SkeletonBox width={80} height={16} borderRadius={4} />
                  <SkeletonBox width="100%" height={60} borderRadius={8} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
