"use client";

import React from "react";

interface LoadingScreenProps {
  isEditMode?: boolean;
  onCancel?: () => void;
}

export default function LoadingScreen({ isEditMode = false, onCancel }: LoadingScreenProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "400px",
        gap: 24,
        padding: "48px 24px",
      }}
    >
      {/* Loading Spinner */}
      <div
        style={{
          width: 64,
          height: 64,
          border: "4px solid #F2F4F7",
          borderTop: "4px solid #101828",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />

      {/* Loading Text */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <h3
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: "#101828",
            margin: 0,
          }}
        >
          {isEditMode ? "Updating Requisition..." : "Creating Requisition..."}
        </h3>
        <p
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: "#667085",
            margin: 0,
            textAlign: "center",
          }}
        >
          Please wait while we process your request
        </p>
      </div>

      {/* Cancel Button */}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "10px 18px",
            borderRadius: 999,
            border: "1px solid #D0D5DD",
            background: "#FFFFFF",
            fontSize: 14,
            fontWeight: 500,
            color: "#344054",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: "center",
            marginTop: 8,
          }}
        >
          Cancel
        </button>
      )}

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
