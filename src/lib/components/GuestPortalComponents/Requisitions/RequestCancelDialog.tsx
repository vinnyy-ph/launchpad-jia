import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

type RequestCancelDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, additionalInfo?: string) => void;
  isLoading?: boolean;
};

const REASONS = [
  "Position no longer needed",
  "Role has been filled internally",
  "Budget or headcount frozen",
  "Incorrect details in requisition",
  "Duplicate requisition created",
  "Hiring plans postponed",
  "Others (please specify reason*)",
];

const RequestCancelDialog: React.FC<RequestCancelDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [otherReason, setOtherReason] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Lock body scroll
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    } else {
        // Reset state on close
        setSelectedReason("");
        setOtherReason("");
    }
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const isOthersSelected = selectedReason === "Others (please specify reason*)";
  const isValid =
    selectedReason &&
    (!isOthersSelected || (isOthersSelected && otherReason.trim().length > 0));

  const handleSubmit = () => {
    if (isValid) {
      onSubmit(selectedReason, isOthersSelected ? otherReason : undefined);
    }
  };

  const dialogContent = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "16px",
          padding: "32px",
          width: "428px",
          maxWidth: "90%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: "0px 20px 24px -4px rgba(16, 24, 40, 0.1), 0px 8px 8px -4px rgba(16, 24, 40, 0.04)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading State */}
        {isLoading ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "60px 40px",
              gap: 16,
            }}
          >
            <Image
              src="/gifs/loading.gif"
              alt="Loading"
              width={64}
              height={64}
            />
            <p
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: "#374151",
                margin: 0,
                textAlign: "center",
              }}
            >
              Updating Request to Cancel
            </p>
          </div>
        ) : (
          <>
            <img
              src="/iconsV3/trash-circle.svg"
              alt="Trash"
              style={{ width: 48, height: 48, marginBottom: 16 }}
            />

            <h3
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#101828",
                margin: "0 0 8px 0",
                textAlign: "center",
              }}
            >
              Request to cancel requisition
            </h3>

            <p
              style={{
                fontSize: "16px",
                color: "rgba(113, 118, 128, 1)",
                fontWeight: 500,
                margin: "0 0 24px 0",
                textAlign: "center",
              }}
            >
              Please tell us why you want to cancel:
            </p>

            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
              {REASONS.map((reason) => (
                <label
                  key={reason}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    color: "#344054",
                    fontWeight: 500,
                  }}
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    style={{ display: "none" }}
                  />
                  <div
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      border: selectedReason === reason ? "1.5px solid #111827" : "1px solid #D0D5DD",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#fff",
                      flexShrink: 0,
                      boxSizing: "border-box",
                    }}
                  >
                    {selectedReason === reason && (
                      <div
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          backgroundColor: "#111827",
                        }}
                      />
                    )}
                  </div>
                  {reason}
                </label>
              ))}
            </div>

            {isOthersSelected && (
              <div style={{ width: "100%", marginBottom: "24px" }}>
                 <textarea
                  ref={(el) => {
                    if (el) el.style.setProperty("height", "100px", "important");
                  }}
                  placeholder="Tell us what happened..."
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #D0D5DD",
                    fontSize: "14px",
                    resize: "none",
                    outline: "none",
                    fontFamily: "inherit"
                  }}
                />
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", width: "100%", justifyContent: "space-between" }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: "10px 18px",
                  borderRadius: "30px", // Pill shape
                  border: "1px solid #D0D5DD",
                  backgroundColor: "#fff",
                  color: "#344054",
                  fontSize: "16px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Go back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!isValid}
                style={{
                  flex: 1,
                  padding: "10px 18px",
                  borderRadius: "30px", // Pill shape
                  border: "none",
                  backgroundColor: isValid ? "rgba(217, 45, 32, 1)" : "rgba(254, 205, 202, 1)",
                  color: "#fff",
                  fontSize: "16px",
                  fontWeight: 600,
                  cursor: isValid ? "pointer" : "not-allowed",
                  transition: "background-color 0.2s",
                }}
              >
                Request to cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
};

export default RequestCancelDialog;
