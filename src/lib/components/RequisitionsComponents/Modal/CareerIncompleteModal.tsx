"use client";

import { useEffect } from "react";

type CareerIncompleteModalProps = {
  onClose: () => void;
  onEditCareer: () => void;
  missingFields: string[];
};

export default function CareerIncompleteModal({
  onClose,
  onEditCareer,
  missingFields,
}: CareerIncompleteModalProps) {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div
      className="modal show fade-in-bottom"
      style={{
        display: "block",
        fontFamily: "Open Sans, sans-serif",
        background: "rgba(0,0,0,0.45)",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1050,
        overflow: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100%",
          padding: "20px",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "none",
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            width: 460,
            maxWidth: "none",
            position: "relative",
            padding: 24,
            textAlign: "center",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              marginBottom: 16,
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src="/iconsV3/edit-requisition-data.svg"
                alt="Career incomplete"
                style={{ width: 56, height: 56 }}
              />
            </div>

            <h2
              style={{
                fontSize: 18,
                fontWeight: 500,
                color: "#1F2937",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              Career draft is incomplete
            </h2>

            <p
              style={{
                fontSize: 14,
                fontWeight: 400,
                color: "#6B7280",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Complete the career draft before making this requisition Active.
            </p>
          </div>

          {missingFields?.length > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid #E5E7EB",
                borderRadius: 12,
                background: "#FAFAFA",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#111827",
                  marginBottom: 8,
                }}
              >
                Missing requirements
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: "#374151" }}>
                {missingFields.map((field) => (
                  <li key={field} style={{ fontSize: 14, lineHeight: 1.6 }}>
                    {field}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 12,
              width: "100%",
              marginTop: 20,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                fontFamily: "Open Sans, sans-serif",
                fontWeight: 400,
                fontSize: 14,
                background: "#fff",
                border: "1px solid #D1D5DB",
                borderRadius: 60,
                padding: "10px 16px",
                cursor: "pointer",
                color: "#1F2937",
              }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={onEditCareer}
              style={{
                flex: 1,
                fontFamily: "Open Sans, sans-serif",
                fontWeight: 500,
                fontSize: 14,
                background: "#181D27",
                color: "#fff",
                border: "1px solid #181D27",
                borderRadius: 60,
                padding: "10px 16px",
                cursor: "pointer",
              }}
            >
              Edit Career Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
