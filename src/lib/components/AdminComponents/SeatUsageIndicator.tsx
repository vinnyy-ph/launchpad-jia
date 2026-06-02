"use client";

import UsageProgressBar from "./UsageProgressBar";

interface SeatUsageIndicatorProps {
  used: number;
  total: number;
}

export default function SeatUsageIndicator({ used, total }: SeatUsageIndicatorProps) {
  return (
    <div
      style={{
        background: "#F8F9FC",
        borderRadius: 16,
        padding: 8,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "16px 24px",
          boxShadow: "inset 0px 0px 2px 0px rgba(0,16,53,0.16)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0, marginBottom: 8 }}>
              Admin Seats
            </h3>
            <UsageProgressBar used={used} total={total} showValues={false} height={8} />
          </div>
          <div style={{ textAlign: "right" }}>
            <span
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: used >= total ? "#F04438" : "#181D27",
              }}
            >
              {used}
            </span>
            <span style={{ fontSize: 14, color: "#717680" }}> / {total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
