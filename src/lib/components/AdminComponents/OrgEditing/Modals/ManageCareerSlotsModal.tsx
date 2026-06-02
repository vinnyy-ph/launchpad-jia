"use client";

import { useState } from "react";
import { api } from "@/lib/utils/apiClient";
import { candidateActionToast, errorToast } from "@/lib/Utils";

interface ManageCareerSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  currentActiveSlots: number;
  currentMaxSlots: number;
  onSuccess?: () => void;
}

type Mode = "add" | "deduct";

export default function ManageCareerSlotsModal({
  isOpen,
  onClose,
  orgId,
  currentActiveSlots,
  currentMaxSlots,
  onSuccess,
}: ManageCareerSlotsModalProps) {
  const [mode, setMode] = useState<Mode>("add");
  const [amountInput, setAmountInput] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedAmount = (() => {
    const value = parseInt(amountInput, 10);
    if (Number.isNaN(value) || value <= 0) return 0;
    return value;
  })();

  const signedAmount = mode === "add" ? parsedAmount : -parsedAmount;
  const totalSlotsAfterChange = currentMaxSlots + signedAmount;

  const isReasonValid = reason.trim().length > 0;
  const doesNotGoBelowActive = totalSlotsAfterChange >= currentActiveSlots;
  const canSave =
    parsedAmount > 0 &&
    isReasonValid &&
    !isSubmitting &&
    totalSlotsAfterChange >= 0 &&
    doesNotGoBelowActive;

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSave = async () => {
    if (!canSave || !orgId) return;

    try {
      setIsSubmitting(true);

      await api.post("/api/pricing-plan/admin/adjust-job-slots", {
        orgId,
        amount: signedAmount,
        reason: reason.trim(),
      });

      const actionLabel = mode === "add" ? "added" : "deducted";

      candidateActionToast(
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>Job post slots updated.</span>
            <span style={{ fontSize: 14, color: "#717680", fontWeight: 500 }}>
              {parsedAmount} slots have been {actionLabel} for this organization.
            </span>
          </div>
        </div>,
        4000,
        <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }} />
      );

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Error adjusting job slots:", error);
      const errorMessage = error?.response?.data?.error || "Failed to adjust job slots. Please try again.";
      errorToast(errorMessage, 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const labelForAmount = mode === "add" ? "Slots to be added:" : "Slots to be deducted:";
  const labelForReason = mode === "add" ? "Reason for adding slots*" : "Reason for deducting slots*";

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "90vh",
          background: "#FFFFFF",
          borderRadius: 16,
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>Manage Job Post Slots</h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <i className="la la-times" style={{ fontSize: 20, color: "#6B7280" }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px 16px", overflowY: "auto" }}>
          {/* Current job slots centered above toggle */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#6B7280",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>Current Job Slots:</span>
              <span style={{ fontWeight: 700, color: "#111827" }}>
                {currentActiveSlots}/{currentMaxSlots}
              </span>
            </div>
          </div>

          {/* Add / Deduct toggle */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                borderRadius: 999,
                border: "1px solid #E5E7EB",
                background: "#F3F4F6",
                padding: 2,
                gap: 2,
              }}
            >
              <button
                type="button"
                onClick={() => setMode("add")}
                style={{
                  minWidth: 120,
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: "none",
                  background: mode === "add" ? "#FFFFFF" : "transparent",
                  color: mode === "add" ? "#111827" : "#6B7280",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setMode("deduct")}
                style={{
                  minWidth: 120,
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: "none",
                  background: mode === "deduct" ? "#FFFFFF" : "transparent",
                  color: mode === "deduct" ? "#111827" : "#6B7280",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Deduct
              </button>
            </div>
          </div>

          {/* Amount input */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
              {labelForAmount}
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: 999,
                border: "1px solid #E5E7EB",
                padding: "8px 14px",
                background: "#FFFFFF",
                width: "100%",
              }}
            >
              <span style={{ fontSize: 16, color: "#9CA3AF", marginRight: 8 }}>
                {mode === "add" ? "+" : "-"}
              </span>
              <input
                type="number"
                min={0}
                step={1}
                placeholder="e.g. 5"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  width: "100%",
                  fontSize: 16,
                  color: "#111827",
                }}
              />
            </div>
          </div>

          {/* Reason input */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
              {labelForReason}
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason"
              style={{
                width: "100%",
                maxWidth: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #E5E7EB",
                fontSize: 14,
                resize: "none",
                minHeight: 80,
                maxHeight: 96,
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px 16px",
            borderTop: "1px solid #E5E7EB",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}
        >
          {/* Job post slots after change on the left */}
          <div style={{ fontSize: 14, color: "#4B5563" }}>
            <span style={{ color: "#6B7280" }}>Job post slots after change: </span>
            <span style={{ fontWeight: 700, color: "#111827" }}>{Number.isNaN(totalSlotsAfterChange) ? currentMaxSlots : totalSlotsAfterChange}</span>
          </div>

          {/* Actions on the right */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                border: "1px solid #D0D5DD",
                background: "#FFFFFF",
                color: "#344054",
                fontSize: 14,
                fontWeight: 600,
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                border: "none",
                background: !canSave ? "#E5E7EB" : "#181D27",
                color: !canSave ? "#9CA3AF" : "#FFFFFF",
                fontSize: 14,
                fontWeight: 700,
                cursor: !canSave ? "not-allowed" : "pointer",
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
