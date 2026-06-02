"use client";

export default function OrganizationStatus({ status }: { status: string }) {
  const normalized = status?.toLowerCase();

  const config: { label: string; bg: string; text: string; dot: string } =
    normalized === "active"
      ? {
        label: "Active",
        bg: "#ECFDF3",
        text: "#027A48",
        dot: "#12B76A",
      }
      : {
        label: "Inactive",
        bg: "#FFFAEB",
        text: "#B54708",
        dot: "#F79009",
      };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        backgroundColor: config.bg,
        color: config.text,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: config.dot,
        }}
      />
      {config.label}
    </span>
  );
}
