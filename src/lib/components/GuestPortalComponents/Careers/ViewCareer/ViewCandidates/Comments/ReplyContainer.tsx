import React from "react";

interface ReplyContainerProps {
  avatarSrc: string;
  name: string;
  role: string;
  timestamp: string;
  content: React.ReactNode;
  onReply?: () => void;
  isReply?: boolean;
}

export default function ReplyContainer({
  avatarSrc,
  name,
  role,
  timestamp,
  content,
  onReply,
  isReply = false,
}: ReplyContainerProps) {
  const avatarSize = isReply ? 32 : 40;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <img
          src={avatarSrc}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#101828" }}>
              {name}
            </div>
            <div style={{ fontSize: 12, color: "#667085" }}>
              {role} | {timestamp}
            </div>
          </div>
          {onReply && (
            <button
              type="button"
              onClick={onReply}
              style={{
                border: "none",
                background: "transparent",
                padding: 4,
                cursor: "pointer",
                color: "#98A2B3",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 13 13"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4.16829 7.50163L0.834961 4.16829M0.834961 4.16829L4.16829 0.834961M0.834961 4.16829H8.83496C9.54221 4.16829 10.2205 4.44925 10.7206 4.94934C11.2207 5.44944 11.5016 6.12772 11.5016 6.83496V11.5016"
                  stroke="#535862"
                  strokeWidth="1.67"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 14,
            lineHeight: "20px",
            color: "#475467",
          }}
        >
          {content}
        </div>
      </div>
    </div>
  );
}
