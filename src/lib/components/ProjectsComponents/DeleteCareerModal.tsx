"use client";

import { useState } from "react";
import { api } from "@/lib/utils/apiClient";
import styles from "@/lib/styles/screens/projects.module.scss";
import { Career } from "@/lib/types/projects";
import { errorToast, successToast } from "@/lib/Utils";

interface DeleteCareerModalProps {
  career: Career;
  projectId: string;
  orgID: string;
  onClose: () => void;
  onDelete: () => void;
}

export default function DeleteCareerModal({
  career,
  projectId,
  orgID,
  onClose,
  onDelete,
}: DeleteCareerModalProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const response = await api.post("/api/projects/remove-career", {
        projectId,
        orgID,
        careerId: career._id,
      });

      if (response.status === 200) {
        successToast("Career removed from project successfully.", 2500);
        onDelete();
        onClose();
      }
    } catch (error) {
      errorToast(error.message, 2500)
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
      <div
        className={`modal-dialog modal-dialog-centered ${styles.modalDialog}`}
      >
        <div className={`modal-content ${styles.modalContent}`}>
          {/* Icon */}
          <div className={styles.iconContainer}>
            <div className={styles.iconOuterCircleDanger}>
              <div className={styles.iconInnerCircleDanger}>
                <i className="las la-minus-circle"></i>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className={styles.titleContainer}>
            <h5 className={`modal-title ${styles.modalTitle}`}>
              Remove career from project
            </h5>
            <p className={styles.helperText} style={{ marginTop: "8px" }}>
              Are you sure you want to remove <strong>{career.jobTitle}</strong> from this project?
            </p>
          </div>

          {/* Footer Buttons */}
          <div className={`modal-footer ${styles.modalFooter}`}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
            >
              Cancel
            </button>
            <button
              className={`btn ${styles.deleteButton}`}
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? "Removing..." : "Remove"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
