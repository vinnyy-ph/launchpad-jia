"use client";

import { useState } from "react";
import styles from "@/lib/styles/screens/projects.module.scss";
import { Career } from "@/lib/types/projects";
import { errorToast } from "@/lib/Utils";
import { archiveCareerRequest } from "@/lib/utils/careerArchiveActions";
import { showArchiveToast } from "@/lib/components/CareerComponents/careerArchiveToastHelpers";

interface ArchiveCareerModalProps {
  career: Career;
  onClose: () => void;
  onArchived?: () => void;
}

export default function ArchiveCareerModal({
  career,
  onClose,
  onArchived,
}: ArchiveCareerModalProps) {
  const [loading, setLoading] = useState(false);

  const handleArchive = async (dropCandidates: boolean) => {
    setLoading(true);
    try {
      const data = await archiveCareerRequest(career._id, dropCandidates);
      if (data?.success) {
        showArchiveToast({
          careerTitle: career.jobTitle,
          dropped: dropCandidates,
          batchId: data?.archiveBatchId,
          onUndone: onArchived,
        });
        onArchived?.();
        onClose();
      }
    } catch (err: any) {
      errorToast(
        err?.response?.data?.error || err?.message || "Failed to archive career",
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
          style={{ maxWidth: 640, borderRadius: 16, padding: 0 }}
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

          {/* Header — horizontal: icon LEFT, text RIGHT */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 16,
              alignItems: "flex-start",
              padding: "24px 24px 0",
            }}
          >
            {/* Featured icon */}
            <div
              style={{
                flexShrink: 0,
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#eff1f5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src="/careers/archived.svg"
                alt="Archive"
                style={{ width: 24, height: 24 }}
              />
            </div>

            {/* Title + body — left-aligned */}
            <div style={{ flex: 1 }}>
              <h5
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#181d27",
                  margin: "0 0 12px 0",
                  textAlign: "left",
                }}
              >
                Archive &lsquo;{career.jobTitle}&rsquo;
              </h5>

              <p style={{ fontSize: 14, color: "#717680", margin: "0 0 12px 0", textAlign: "left" }}>
                Archiving this career will remove it from active use and exclude it
                from analytics. It will also be set to unpublished and inactive. You
                may restore this career later in the Archived tab.
              </p>
              <p style={{ fontSize: 14, color: "#717680", margin: "0 0 12px 0", textAlign: "left" }}>
                What would you like to do with candidates who are not in the Hired
                stage?
              </p>
              <p style={{ fontSize: 14, color: "#717680", margin: "0 0 8px 0", textAlign: "left" }}>
                <strong style={{ color: "#181d27", fontWeight: 500 }}>
                  Archive and drop all candidates:
                </strong>{" "}
                All candidates not in the Hired stage will be marked as dropped.
              </p>
              <p style={{ fontSize: 14, color: "#717680", margin: 0, textAlign: "left" }}>
                <strong style={{ color: "#181d27", fontWeight: 500 }}>
                  Archive without dropping candidates:
                </strong>{" "}
                Candidates will remain in their current stages.
              </p>
            </div>
          </div>

          {/* Footer — divider + action row */}
          <div style={{ padding: "16px 24px 24px" }}>
            <hr style={{ margin: "0 0 16px 0", borderColor: "#e9eaeb" }} />
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {/* Cancel — pinned far-left, ghost */}
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#717680",
                  cursor: "pointer",
                  fontSize: 14,
                  padding: "8px 12px",
                  borderRadius: 8,
                }}
              >
                Cancel
              </button>

              {/* Right group */}
              <div style={{ display: "flex", gap: 8 }}>
                {/* Archive without dropping — outline */}
                <button
                  type="button"
                  onClick={() => handleArchive(false)}
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
                  Archive without dropping
                </button>

                {/* Archive and drop all — solid dark */}
                <button
                  type="button"
                  onClick={() => handleArchive(true)}
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
                  Archive and drop all
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
