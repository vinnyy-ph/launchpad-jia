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


export default function SkeletonViewCareer() {
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
      
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            width: "fit-content",
            marginLeft: 10,
          }}
        >
          <SkeletonBox width={20} height={20} borderRadius={4} />
          <SkeletonBox width={100} height={16} borderRadius={4} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <SkeletonBox width={200} height={32} borderRadius={8} />
            <SkeletonBox width={80} height={24} borderRadius={999} />
          </div>
          <SkeletonBox width={140} height={40} borderRadius={999} />
        </div>

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
              <SkeletonBox width={120} height={16} borderRadius={4} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
