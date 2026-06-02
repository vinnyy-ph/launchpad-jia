import React from "react";

interface CommentInputFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
}

export default function CommentInputField({
  value,
  onChange,
  onSubmit,
  placeholder = "Write a comment about this candidate...",
}: CommentInputFieldProps) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "#EAECF0",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <img
          src="/good-fit-avatar.png"
          alt="Current user avatar"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      <div style={{ flex: 1 }}>
        <div
          style={{
            border: "1px solid #D0D5DD",
            borderRadius: 8,
            padding: "12px 14px",
            background: "white",
            boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
          }}
        >
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              resize: "none",
              fontSize: 14,
              lineHeight: "20px",
              color: "#101828",
              fontFamily: "inherit",
              height: "150px",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 12,
            }}
          >
            <button
              type="button"
              disabled={!value}
              onClick={onSubmit}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 9999,
                border: "none",
                background: value
                  ? "linear-gradient(270deg, #9fcaed -0.44%, #ceb6da 32.7%, #ebacc9 65.85%, #fccec0 100%)"
                  : "#EAECF0",
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: 600,
                cursor: value ? "pointer" : "default",
                boxShadow: "0px 1px 2px rgba(16, 24, 40, 0.05)",
              }}
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 19 19"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M17.5016 0.834961L8.33496 10.0016M17.5016 0.834961L11.6683 17.5016L8.33496 10.0016M17.5016 0.834961L0.834961 6.66829L8.33496 10.0016"
                  stroke="white"
                  strokeWidth="1.67"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
