"use client";

import { useState } from "react";
import styles from "@/lib/styles/screens/projects.module.scss";
import { Career } from "@/lib/types/projects";
import { errorToast } from "@/lib/Utils";
import { restoreCareerRequest } from "@/lib/utils/careerArchiveActions";
import { showRestoreToast } from "@/lib/components/CareerComponents/careerArchiveToastHelpers";

interface RestoreCareerModalProps {
  career: Career;
  onClose: () => void;
  onRestored?: () => void;
}

export default function RestoreCareerModal({
  career,
  onClose,
  onRestored,
}: RestoreCareerModalProps) {
  const [loading, setLoading] = useState(false);

  const handleRestore = async () => {
    setLoading(true);
    try {
      const data = await restoreCareerRequest(career._id);
      if (data?.success) {
        showRestoreToast(career.jobTitle);
        onRestored?.();
        onClose();
      }
    } catch (err: any) {
      errorToast(
        err?.response?.data?.error || err?.message || "Failed to restore career",
        2500
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`modal show fade-in ${styles.modalBackdrop}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal-dialog modal-dialog-centered ${styles.modalDialog}`}>
        <div
          className={`modal-content ${styles.modalContent}`}
          style={{ maxWidth: 420, borderRadius: 16, padding: 0 }}
        >
          {/* Close button — top-right absolute */}
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              color: "#717680",
              lineHeight: 1,
              padding: 4,
              zIndex: 1,
            }}
          >
            ✕
          </button>

          {/* Header — vertical column: icon ON TOP, then text block */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              alignItems: "flex-start",
              padding: "24px 24px 0",
            }}
          >
            {/* Featured icon — green refresh */}
            <div
              style={{
                flexShrink: 0,
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#dcfae6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i
                className="las la-redo-alt"
                style={{ fontSize: 24, color: "#079455" }}
              ></i>
            </div>

            {/* Text block — title + body paragraphs, left-aligned */}
            <div>
              <h5
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#181d27",
                  margin: "0 0 8px 0",
                  textAlign: "left",
                }}
              >
                Restore &lsquo;{career.jobTitle}&rsquo;
              </h5>

              <p style={{ fontSize: 14, color: "#717680", margin: "0 0 12px 0", textAlign: "left" }}>
                Restoring this career will return it to your active list. It will
                remain unpublished until you choose to publish it.
              </p>
              <p style={{ fontSize: 14, color: "#717680", margin: 0, textAlign: "left" }}>
                You can continue editing or publish it when ready.
              </p>
            </div>
          </div>

          {/* Footer — divider + action row right-aligned */}
          <div style={{ padding: "16px 24px 24px" }}>
            <hr style={{ margin: "0 0 16px 0", borderColor: "#e9eaeb" }} />
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              {/* Cancel — outline */}
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  background: "#fff",
                  border: "1px solid #d5d7da",
                  color: "#414651",
                  borderRadius: 8,
                  fontSize: 14,
                  padding: "8px 16px",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                Cancel
              </button>

              {/* Restore career — solid dark */}
              <button
                type="button"
                onClick={handleRestore}
                disabled={loading}
                style={{
                  background: "#111322",
                  border: "none",
                  color: "#fff",
                  borderRadius: 8,
                  fontSize: 14,
                  padding: "8px 16px",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? "Restoring..." : "Restore career"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
