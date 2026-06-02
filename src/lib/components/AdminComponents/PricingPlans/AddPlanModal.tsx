"use client";

import { useState } from "react";
import { PricingPlanFormData, DEFAULT_PRICING_PLAN } from "@/lib/types/pricing";
import PricingPlanForm from "./PricingPlanForm";

interface AddPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PricingPlanFormData) => Promise<void>;
  isLoading?: boolean;
}

export default function AddPlanModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: AddPlanModalProps) {
  const [formData, setFormData] = useState<PricingPlanFormData>(DEFAULT_PRICING_PLAN);
  const [hasChanges, setHasChanges] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const handleClose = () => {
    if (hasChanges) {
      setShowConfirmClose(true);
    } else {
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setFormData(DEFAULT_PRICING_PLAN);
    setHasChanges(false);
    setShowConfirmClose(false);
    onClose();
  };

  const handleSubmit = async (data: PricingPlanFormData) => {
    await onSubmit(data);
    resetAndClose();
  };

  const handleFormChange = () => {
    setHasChanges(true);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
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
        onClick={handleClose}
      >
        {/* Modal */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "720px",
            maxHeight: "90vh",
            overflow: "auto",
            position: "relative",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "20px 24px",
              borderBottom: "1px solid #E9EAEB",
            }}
          >
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#181D27", margin: 0 }}>
              Add new plan
            </h2>
            <button
              onClick={handleClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
              }}
            >
              <i className="la la-times" style={{ fontSize: "24px", color: "#717680" }}></i>
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "24px" }} onChange={handleFormChange}>
            <PricingPlanForm
              initialData={formData}
              onSubmit={handleSubmit}
              onCancel={handleClose}
              submitLabel="Create Plan"
              isLoading={isLoading}
              mode="create"
            />
          </div>
        </div>
      </div>

      {/* Confirm Close Modal */}
      {showConfirmClose && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 1001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
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
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "#FEF3C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <i className="la la-exclamation-triangle" style={{ fontSize: "24px", color: "#D97706" }}></i>
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#181D27", marginBottom: "8px" }}>
              Discard changes?
            </h3>
            <p style={{ fontSize: "14px", color: "#717680", marginBottom: "24px" }}>
              You have unsaved changes. Are you sure you want to close without saving?
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => setShowConfirmClose(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "1px solid #D5D7DA",
                  backgroundColor: "white",
                  color: "#414651",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Keep editing
              </button>
              <button
                onClick={resetAndClose}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: "#DC2626",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
