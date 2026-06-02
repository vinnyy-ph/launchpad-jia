"use client";

import { useState } from "react";
import { api } from "@/lib/utils/apiClient";
import { useAppContext } from "@/lib/context/AppContext";
import styles from "@/lib/styles/screens/projects.module.scss";
import { Project } from "@/lib/types/projects";
import { errorToast, successToast } from "@/lib/Utils";
import { Button } from "../ui";

interface DeleteProjectModalProps {
  project: Project;
  onClose: () => void;
  onDelete: () => void;
}

export default function DeleteProjectModal({
  project,
  onClose,
  onDelete,
}: DeleteProjectModalProps) {
  const { orgID } = useAppContext();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const response = await api.post("/api/projects/delete", {
        projectId: project._id,
        orgID
      });

      if (response.status === 200) {
        successToast("Project removed successfully.", 2500);
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
              Remove project
            </h5>
            <p className={styles.helperText} style={{ marginTop: "8px" }}>
              Are you sure you want to remove <strong>{project.name}</strong> from this project?
            </p>
          </div>

          {/* Footer Buttons */}
          <div className={`modal-footer ${styles.modalFooter}`}>
            <Button
              type="button"
              onClick={onClose}
              style={{ flex: 1 }}
              variant="secondary"
              label="Cancel"
              >
            </Button>
            <Button
              style={{ flex: 1 }}
              variant="tertiary"
              onClick={handleDelete}
              disabled={loading}
              label={loading ? "Removing..." : "Remove"}
              >
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
