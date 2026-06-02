import React from "react";

export default function SkeletonForm() {
  return (
    <div style={{ padding: "32px 0" }}>
      {/* Breadcrumb Skeleton */}
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            height: 20,
            width: 200,
            background: "linear-gradient(90deg, #F3F4F6 0%, #E5E7EB 50%, #F3F4F6 100%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite",
            borderRadius: 4,
          }}
        />
      </div>

      {/* Form Container */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #EAECF0",
          borderRadius: 12,
          padding: 32,
        }}
      >
        {/* Header Skeleton */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              height: 32,
              width: 250,
              background: "linear-gradient(90deg, #F3F4F6 0%, #E5E7EB 50%, #F3F4F6 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
              borderRadius: 4,
              marginBottom: 8,
            }}
          />
          <div
            style={{
              height: 16,
              width: 400,
              background: "linear-gradient(90deg, #F3F4F6 0%, #E5E7EB 50%, #F3F4F6 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
              borderRadius: 4,
            }}
          />
        </div>

        {/* Form Fields Skeleton */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Position Name Field */}
          <SkeletonField />

          {/* Job Description Field (Larger) */}
          <SkeletonField height={120} />

          {/* Two Column Fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <SkeletonField />
            <SkeletonField />
          </div>

          {/* Work Days Field */}
          <SkeletonField />

          {/* Office Location (Three Columns) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <SkeletonField />
            <SkeletonField />
            <SkeletonField />
          </div>

          {/* Salary Range */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <SkeletonField />
            <SkeletonField />
            <SkeletonField />
          </div>

          {/* Employment Type */}
          <SkeletonField />

          {/* Reason Field (Larger) */}
          <SkeletonField height={100} />
        </div>

        {/* Action Buttons Skeleton */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            marginTop: 32,
            paddingTop: 24,
            borderTop: "1px solid #EAECF0",
          }}
        >
          <div
            style={{
              height: 44,
              width: 100,
              background: "linear-gradient(90deg, #F3F4F6 0%, #E5E7EB 50%, #F3F4F6 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
              borderRadius: 8,
            }}
          />
          <div
            style={{
              height: 44,
              width: 120,
              background: "linear-gradient(90deg, #F3F4F6 0%, #E5E7EB 50%, #F3F4F6 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
              borderRadius: 8,
            }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
}

function SkeletonField({ height = 40 }: { height?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Label */}
      <div
        style={{
          height: 14,
          width: 120,
          background: "linear-gradient(90deg, #F3F4F6 0%, #E5E7EB 50%, #F3F4F6 100%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          borderRadius: 4,
        }}
      />
      {/* Input */}
      <div
        style={{
          height,
          width: "100%",
          background: "linear-gradient(90deg, #F3F4F6 0%, #E5E7EB 50%, #F3F4F6 100%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          borderRadius: 8,
        }}
      />
    </div>
  );
}
