"use client";

interface NoPlanBannerProps {
  expiredPlanName?: string;
  expiredDate?: string;
  onChoosePlan: () => void;
}

export default function NoPlanBanner({
  expiredPlanName = "Basic",
  expiredDate = "Sep 14, 2025",
  onChoosePlan,
}: NoPlanBannerProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 20px",
        background: "#fff",
        border: "1px solid #E9EAEB",
        borderRadius: 12,
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "#FEF3F2",
            border: "1px solid #FECDCA",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <i
            className="la la-exclamation-triangle"
            style={{ color: "#F04438", fontSize: 18 }}
          />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#181D27" }}>
          This organization&apos;s previous plan ({expiredPlanName}) has expired on {expiredDate}.
        </span>
      </div>
      <button
        type="button"
        onClick={onChoosePlan}
        style={{
          padding: "10px 18px",
          borderRadius: 999,
          border: "none",
          background: "#181D27",
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Choose new plan
      </button>
    </div>
  );
}
