"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type CareerItem, type CareerStatus } from "./types";
import { Label } from "../label";
import { useCareers } from "./useGuestCareersData";
import CareersTableSkeleton from "./CareersTableSkeleton";
import EmptyState from "./EmptyState";

interface CareersTableProps {
  sortOption?: string;
  orgId?: string | null;
}

function currency(amount: number, currency: string | null) {
  try {
    if (!currency) return amount.toLocaleString();
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(amount)
      .replace("PHP", "₱");
  } catch {
    return `₱${amount.toLocaleString()}`;
  }
}

function formatSalaryRange(item: CareerItem) {
  const { min, max, currency: cur } = item.salaryRange;
  if (min === null && max === null) return "—";

  const left = min === null ? "—" : currency(min, cur);
  const right = max === null ? "—" : currency(max, cur);
  return `${left} - ${right}`.replace(/\.00/g, "");
}

const statusConfig: Record<CareerStatus, { bgColor: string; strokeColor: string; textColor: string }> = {
  Active: {
    bgColor: "#ECFDF3",
    strokeColor: "#A6F4C5",
    textColor: "#027948",
  },
  Unpublished: {
    bgColor: "#F5F5F5",
    strokeColor: "#E9EAEB",
    textColor: "#414651",
  },
  "On Hold": {
    bgColor: "#F5F5F5",
    strokeColor: "#E9EAEB",
    textColor: "#414651",
  },
  Completed: {
    bgColor: "#EEFDF3",
    strokeColor: "#B7F3CA",
    textColor: "#027948",
  },
  Cancelled: {
    bgColor: "#FEF3F2",
    strokeColor: "#FECDCA",
    textColor: "#B32318",
  },
};

function Metric({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 6,
          height: 6,
          background: color,
          borderRadius: 999,
          display: "inline-block",
        }}
      />
      <span style={{ color: "#667085", fontSize: 14 }}>{label}</span>
      <span style={{ fontWeight: 700, color: "#101828", fontSize: 18 }}>{value}</span>
    </div>
  );
}

function Separator() {
  return <span style={{ width: 1, height: 20, background: "#EAECF0", display: "inline-block" }} />;
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: "#EAECF0",
        margin: "16px 0",
        width: "100%",
      }}
    />
  );
}

export default function CareersTable({ sortOption, orgId }: CareersTableProps) {
  const searchParams = useSearchParams();
  const currentOrgId = orgId || searchParams.get("orgId");
  
  // Helper to build URL with orgId
  const buildUrl = (path: string) => {
    if (!currentOrgId) return path;
    return `${path}?orgId=${currentOrgId}`;
  };
  
  // Fetch careers from API
  const { data: careers, isLoading, error } = useCareers(currentOrgId);

  // Sort careers based on sortOption
  const sortedCareers = React.useMemo(() => {
    const sorted = [...careers];
    
    switch (sortOption) {
      case "Recent Activity":
        // Sort by most recent first
        return sorted.sort((a, b) => {
          const timeA = a.postedOn ? new Date(a.postedOn).getTime() : 0;
          const timeB = b.postedOn ? new Date(b.postedOn).getTime() : 0;
          return timeB - timeA;
        });
      case "Newest to Oldest":
        return sorted.sort((a, b) => {
          const timeA = a.postedOn ? new Date(a.postedOn).getTime() : 0;
          const timeB = b.postedOn ? new Date(b.postedOn).getTime() : 0;
          return timeB - timeA;
        });
      case "Oldest to Newest":
        return sorted.sort((a, b) => {
          const timeA = a.postedOn ? new Date(a.postedOn).getTime() : 0;
          const timeB = b.postedOn ? new Date(b.postedOn).getTime() : 0;
          return timeA - timeB;
        });
      case "A - Z":
        return sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      case "Z - A":
        return sorted.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
      default:
        return sorted;
    }
  }, [careers, sortOption]);

  // Show loading state
  if (isLoading) {
    return <CareersTableSkeleton />;
  }

  // Show error state
  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "#EF4444" }}>
        <p>Error loading careers: {error.message}</p>
      </div>
    );
  }

  // Show empty state
  if (careers.length === 0) {
    return <EmptyState />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {sortedCareers.map((item) => (
        <div
          key={item.id}
          style={
            {
              border: "1px solid #EAECF0",
              borderRadius: 16,
              ["--card-px"]: "24px",
              ["--card-py"]: "16px",
              padding: "var(--card-py) var(--card-px)",
              display: "flex",
              flexDirection: "column",
              gap: 0,
            } as React.CSSProperties
          }
        >
          {/* Header: Title + Status on left, Metrics on right */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#101828" }}>{item.title || "—"}</h3>
              <Label
                bgColor={statusConfig[item.status].bgColor}
                strokeColor={statusConfig[item.status].strokeColor}
                textColor={statusConfig[item.status].textColor}
              >
                {item.status === "Active"
                  ? "Active"
                  : item.status === "Unpublished"
                    ? "On Hold"
                    : item.status}
                {item.status === "Completed" && (
                  <img
                    src="/iconsV3/check-circle-outline.svg"
                    alt=""
                    style={{ width: 12, height: 12 }}
                  />
                )}
              </Label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
              <Metric color="#5D5FEF" label="Ongoing" value={item.metrics.ongoing} />
              <Separator />
              <Metric color="#F04438" label="Dropped" value={item.metrics.dropped} />
              <Separator />
              <Metric color="#12B76A" label="Hired" value={item.metrics.hired} />
            </div>
          </div>

          <Divider />

          {/* Body: Details grid on left, View button on right */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 24,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, minmax(140px, 1fr))",
                gap: 12,
                flex: 1,
                minWidth: 0,
              }}
            >
              <Field label="Posted on" value={item.postedOn || "—"} />
              <Field label="Job Owner" value={item.jobOwner || "—"} />
              <Field label="Employment Type" value={item.employmentType || "—"} />
              <Field label="Work Setup" value={item.workSetup || "—"} />
              <Field label="Location" value={item.location || "—"} />
              <Field label="Salary Range" value={formatSalaryRange(item)} />
            </div>

            <Link
              href={buildUrl(`/guest-portal/careers/${item.id}`)}
              style={{
                padding: "10px 14px",
                background: "#fff",
                border: "1px solid #EAECF0",
                borderRadius: 999,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 550,
                color: "#344054",
                flexShrink: 0,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              View career
              <span style={{ fontSize: 16 }}>&rarr;</span>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 12, color: "#667085" }}>{label}</span>
      <span style={{ fontSize: 14, color: "#101828", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {value}
      </span>
    </div>
  );
}

