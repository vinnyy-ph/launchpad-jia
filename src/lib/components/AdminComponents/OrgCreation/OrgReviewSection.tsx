"use client";

import React, { useState } from "react";

interface OrgReviewSectionProps {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

export default function OrgReviewSection({
  title,
  onEdit,
  children,
  defaultExpanded = true,
}: OrgReviewSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="layered-card-outer" style={{ marginTop: 0 }}>
      <div className="layered-card-middle">
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
          }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <i
              className={`la la-angle-${isExpanded ? "up" : "down"}`}
              style={{ fontSize: 18, color: "#717680" }}
            />
            <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>{title}</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            style={{
              background: "#FFFFFF",
              border: "1px solid #E9EAEB",
              cursor: "pointer",
              padding: 8,
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="la la-pencil" style={{ fontSize: 18, color: "#535862" }} />
          </button>
        </div>
        {isExpanded && <div className="layered-card-content">{children}</div>}
      </div>
    </div>
  );
}

