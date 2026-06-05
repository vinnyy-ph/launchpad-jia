"use client";

import React from "react";

interface ArchivedBannerProps {
  onRestore: () => void;
}

export default function ArchivedBanner({ onRestore }: ArchivedBannerProps) {
  return (
    <div
      style={{
        background: "#f9f9fb",
        border: "1px solid #e9eaeb",
        borderRadius: 12,
        padding: "12px 16px",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        width: "100%",
      }}
    >
      {/* Left: icon + text */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <i
          className="la la-archive"
          style={{ fontSize: 16, color: "#414651" }}
        />
        <span
          style={{ fontSize: 14, fontWeight: 500, color: "#181d27" }}
        >
          This career is archived.
        </span>
        <span
          style={{ fontSize: 14, fontWeight: 400, color: "#414651" }}
        >
          Restore this career to allow editing and publishing.
        </span>
      </div>

      {/* Right: Restore button */}
      <button
        onClick={onRestore}
        style={{
          background: "#ffffff",
          border: "1px solid #d5d7da",
          borderRadius: 8,
          padding: "6px 10px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          cursor: "pointer",
        }}
      >
        <i className="la la-redo-alt" style={{ fontSize: 16 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#414651" }}>
          Restore
        </span>
      </button>
    </div>
  );
}
