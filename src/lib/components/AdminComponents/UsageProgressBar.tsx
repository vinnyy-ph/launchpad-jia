"use client";

interface UsageProgressBarProps {
  used: number;
  total: number;
  label?: string;
  showValues?: boolean;
  height?: number;
}

export default function UsageProgressBar({
  used,
  total,
  label,
  showValues = true,
  height = 8,
}: UsageProgressBarProps) {
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const isWarning = percentage >= 80;

  const getProgressBarStyle = () => {
    if (isWarning) {
      return { background: "#F04438" };
    }
    return {
      background: "linear-gradient(90deg, #9FCAED, #CEB6DA, #EBACC9, #FCCEC0)",
    };
  };

  return (
    <div style={{ width: "100%" }}>
      {(label || showValues) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          {label && (
            <span
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "#717680",
              }}
            >
              {label}
            </span>
          )}
          {showValues && (
            <span
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: isWarning ? "#F04438" : "#181D27",
              }}
            >
              {used} / {total}
            </span>
          )}
        </div>
      )}
      <div
        style={{
          width: "100%",
          height,
          borderRadius: 10,
          background: "#E9EAEB",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            borderRadius: 10,
            transition: "width 0.3s ease",
            ...getProgressBarStyle(),
          }}
        />
      </div>
    </div>
  );
}
