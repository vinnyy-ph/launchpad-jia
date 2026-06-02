"use client";

import React from "react";
import styles from "./activityPreview.module.scss";

export default function SkeletonActivityPreview({
  isLast,
}: {
  isLast: boolean;
}) {
  return (
    <div className={styles.previewContainer} style={{ marginBottom: "24px" }}>
      {/* Avatar */}
      <div className={styles.previewAvatarGroup}>
        <div
          style={{
            width: "44px",
            height: "44px",
            minWidth: "44px",
            borderRadius: "50%",
            backgroundColor: "#e8e8e8",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            flexShrink: 0,
          }}
        />
        {!isLast && <div className={styles.previewConnector} />}
      </div>

      {/* Content */}
      <div className={styles.previewContent}>
        {/* Title Skeleton */}
        <div
          style={{
            height: "18px",
            backgroundColor: "#e8e8e8",
            borderRadius: "4px",
            marginBottom: "8px",
            width: "65%",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />

        {/* Subtitle Skeleton */}
        <div
          style={{
            height: "16px",
            backgroundColor: "#e8e8e8",
            borderRadius: "4px",
            marginBottom: "12px",
            width: "50%",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />

        {/* Meta Skeleton */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <div
            style={{
              height: "13px",
              backgroundColor: "#e8e8e8",
              borderRadius: "4px",
              width: "80px",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
          <span style={{ color: "#ddd" }}>•</span>
          <div
            style={{
              height: "13px",
              backgroundColor: "#e8e8e8",
              borderRadius: "4px",
              width: "100px",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
