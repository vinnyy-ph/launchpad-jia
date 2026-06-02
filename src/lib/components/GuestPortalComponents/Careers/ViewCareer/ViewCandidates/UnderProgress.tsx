import React from "react";

type Props = {
  title?: string;
  message?: string;
};

const WrenchIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#175CD3"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const ClockIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#B42318"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export default function UnderProgress({
  title = "Under Progress",
  message = "This feature is currently being developed. Please check back later.",
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        backgroundColor: "#F9FAFB",
        borderRadius: 12,
        border: "1px dashed #D0D5DD",
        minHeight: 200,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 56,
          height: 56,
          borderRadius: "50%",
          backgroundColor: "#EFF8FF",
          marginBottom: 16,
        }}
      >
        <WrenchIcon />
      </div>

      <h3
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "#101828",
          margin: "0 0 8px 0",
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: 14,
          color: "#475467",
          margin: 0,
          maxWidth: 320,
          lineHeight: "20px",
        }}
      >
        {message}
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginTop: 16,
          padding: "6px 12px",
          backgroundColor: "#FEF3F2",
          borderRadius: 16,
          border: "1px solid #FECDCA",
        }}
      >
        <ClockIcon />
        <span style={{ fontSize: 12, fontWeight: 500, color: "#B42318" }}>
          Coming Soon
        </span>
      </div>
    </div>
  );
}
