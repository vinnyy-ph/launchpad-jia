"use client";

import React from "react";

interface OrgActionModalProps {
  action: string;
  onAction: (action: string) => void;
}

export default function OrgActionModal({ action, onAction }: OrgActionModalProps) {
  const isPublish = action === "active";

  return (
    <div className="modal-background fade-in-bottom" onClick={() => onAction("cancel")}>
      <div className="modal-container">
        <div
          className="modal-content"
          style={{
            overflowY: "auto",
            height: "fit-content",
            width: "fit-content",
            background: "#fff",
            border: "1.5px solid #E9EAEB",
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(30,32,60,0.18)",
            padding: "24px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              textAlign: "center",
            }}
          >
            <div
              style={{
                border: "1px solid #E9EAEB",
                borderRadius: "50%",
                width: "48px",
                height: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isPublish
                  ? "linear-gradient(135deg, #9FCAED 0%, #CEB6DA 50%, #EBACC9 100%)"
                  : "#F8F9FC",
                background: isPublish
                  ? "linear-gradient(135deg, #9FCAED 0%, #CEB6DA 50%, #EBACC9 100%)"
                  : "#F8F9FC",
              }}
            >
              <i
                className={isPublish ? "la la-building" : "la la-save"}
                style={{
                  fontSize: 24,
                  color: isPublish ? "#FFFFFF" : "#717680",
                }}
              />
            </div>
            <h3
              className="modal-title"
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#181D27",
                margin: 0,
              }}
            >
              {isPublish ? "Create new organization?" : "Save as draft?"}
            </h3>
            <p style={{ maxWidth: "352px", fontSize: 14, color: "#717680", lineHeight: 1.5 }}>
              {isPublish
                ? "This will add a new organization to the system. You can configure its plan and settings after creation."
                : "The organization will be saved as inactive. You can publish it later from the organizations list."}
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 16,
                width: "100%",
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onAction("cancel");
                }}
                style={{
                  display: "flex",
                  width: "50%",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  gap: 8,
                  backgroundColor: "#FFFFFF",
                  borderRadius: "60px",
                  border: "1px solid #D5D7DA",
                  cursor: "pointer",
                  padding: "10px 0px",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#414651",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onAction("create");
                }}
                style={{
                  display: "flex",
                  width: "50%",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  gap: 8,
                  backgroundColor: isPublish ? "#000000" : "#414651",
                  color: "#FFFFFF",
                  borderRadius: "60px",
                  border: "none",
                  cursor: "pointer",
                  padding: "10px 0px",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {isPublish ? "Create Organization" : "Save as Draft"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
