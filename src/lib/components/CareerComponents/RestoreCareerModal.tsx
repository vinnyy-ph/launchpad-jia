"use client";

import { useState } from "react";
import styles from "@/lib/styles/screens/projects.module.scss";
import { Career } from "@/lib/types/projects";
import { errorToast, successToast } from "@/lib/Utils";
import { restoreCareerRequest } from "@/lib/utils/careerArchiveActions";

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
        successToast("Career restored.", 2500);
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
          style={{ maxWidth: 480, borderRadius: 16 }}
        >
          {/* Featured icon */}
          <div className={styles.iconContainer}>
            <div
              style={{
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
          </div>

          {/* Title */}
          <div className={styles.titleContainer}>
            <h5
              className={`modal-title ${styles.modalTitle}`}
              style={{ fontSize: 16, fontWeight: 600, color: "#181d27" }}
            >
              Restore &lsquo;{career.jobTitle}&rsquo;
            </h5>
          </div>

          {/* Body */}
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 14, color: "#717680", margin: "0 0 12px 0" }}>
              Restoring this career will return it to your active list. It will
              remain unpublished until you choose to publish it.
            </p>
            <p style={{ fontSize: 14, color: "#717680", margin: 0 }}>
              You can continue editing or publish it when ready.
            </p>
          </div>

          {/* Footer */}
          <div className={`modal-footer ${styles.modalFooter}`}>
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
  );
}
