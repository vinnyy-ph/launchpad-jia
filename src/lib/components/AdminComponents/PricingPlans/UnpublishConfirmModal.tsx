"use client";

interface UnpublishConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  planName?: string;
}

export default function UnpublishConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  planName,
}: UnpublishConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "24px",
          width: "100%",
          maxWidth: "400px",
          textAlign: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            backgroundColor: "#FEE2E2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <i className="la la-exclamation-triangle" style={{ fontSize: "24px", color: "#DC2626" }}></i>
        </div>
        <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#181D27", marginBottom: "8px" }}>
          Unpublish plan?
        </h3>
        <p style={{ fontSize: "14px", color: "#717680", marginBottom: "24px", lineHeight: 1.5 }}>
          Organizations currently on this plan will not be affected. However, this plan can no longer be selected for renewals or future plan changes.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              border: "1px solid #D5D7DA",
              backgroundColor: "white",
              color: "#414651",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#DC2626",
              color: "white",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Unpublish
          </button>
        </div>
      </div>
    </div>
  );
}
