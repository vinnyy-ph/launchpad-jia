"use client";

import React from "react";
import CareerDescriptionDisplay, {
  type CareerDescriptionData,
} from "./CareerDescriptionDisplay";
import { useCareerDescription } from "./useCareerDescription";

// Skeleton shimmer style
const shimmerStyle: React.CSSProperties = {
  background: "linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s ease-in-out infinite",
};

// Loading skeleton for the career description
function CareerDescriptionSkeleton() {
  return (
    <>
      <style>
        {`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}
      </style>
      <div style={{ display: "flex", gap: 24 }}>
        {/* Left Column */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E9EAEB",
                borderRadius: 16,
                padding: 20,
                height: i === 1 ? 300 : 150,
              }}
            >
              <div
                style={{
                  height: 20,
                  width: "40%",
                  borderRadius: 4,
                  ...shimmerStyle,
                }}
              />
              <div
                style={{
                  marginTop: 16,
                  height: 16,
                  width: "80%",
                  borderRadius: 4,
                  ...shimmerStyle,
                }}
              />
              <div
                style={{
                  marginTop: 8,
                  height: 16,
                  width: "60%",
                  borderRadius: 4,
                  ...shimmerStyle,
                }}
              />
            </div>
          ))}
        </div>

        {/* Right Column */}
        <div
          style={{
            width: 360,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E9EAEB",
              borderRadius: 16,
              padding: 20,
              height: 200,
            }}
          >
            <div
              style={{
                height: 20,
                width: "50%",
                borderRadius: 4,
                ...shimmerStyle,
              }}
            />
            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  ...shimmerStyle,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: 14,
                    width: "70%",
                    borderRadius: 4,
                    marginBottom: 6,
                    ...shimmerStyle,
                  }}
                />
                <div
                  style={{
                    height: 12,
                    width: "50%",
                    borderRadius: 4,
                    ...shimmerStyle,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Error display component
function CareerDescriptionError({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        background: "#FEF3F2",
        border: "1px solid #FECDCA",
        borderRadius: 16,
      }}
    >
      <i
        className="la la-exclamation-circle"
        style={{ fontSize: 48, color: "#D92D20", marginBottom: 16 }}
      />
      <span
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "#B42318",
          marginBottom: 8,
        }}
      >
        Failed to load career description
      </span>
      <span style={{ fontSize: 14, color: "#D92D20" }}>{message}</span>
    </div>
  );
}

// Props interface for the combined component
interface CareerDescriptionProps {
  careerId: string;
  orgId?: string | null;
  // Optional: pass data directly instead of fetching
  data?: CareerDescriptionData;
}

export default function CareerDescription({
  careerId,
  orgId,
  data: propData,
}: CareerDescriptionProps) {
  // If data is passed directly, use it without fetching
  const shouldFetch = !propData;
  const {
    data: fetchedData,
    isLoading,
    error,
  } = useCareerDescription(shouldFetch ? careerId : "", orgId);

  const data = propData || fetchedData;

  if (shouldFetch && isLoading) {
    return <CareerDescriptionSkeleton />;
  }

  if (shouldFetch && error) {
    return <CareerDescriptionError message={error.message} />;
  }

  if (!data) {
    return <CareerDescriptionError message="No career data available" />;
  }

  return <CareerDescriptionDisplay data={data} />;
}

// Export sub-components and types for flexibility
export { CareerDescriptionDisplay, useCareerDescription };
export type { CareerDescriptionData };
