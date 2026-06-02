"use client";

import { useState } from "react";
import { api } from "@/lib/utils/apiClient";
import { useAppContext } from "@/lib/context/AppContext";
import SuccessModal from "./SuccessModal";
import styles from "@/lib/styles/screens/projects.module.scss";
import { Project } from "@/lib/types/projects";
import { errorToast } from "@/lib/Utils";
import { Button } from "../ui";

interface RenameProjectModalProps {
  project: Project;
  onClose: () => void;
  onRename: (newName: string) => void;
}

export default function RenameProjectModal({
  project,
  onClose,
  onRename,
}: RenameProjectModalProps) {
  const { orgID } = useAppContext();
  const [projectName, setProjectName] = useState(project.name);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const maxNameLength = 40;

  const handleSubmit = async () => {
    if (!projectName.trim() || projectName.trim() === project.name) return;

    setLoading(true);
    try {
      const response = await api.post("/api/projects/update", {
        projectId: project._id,
        orgID,
        name: projectName.trim(),
      });

      if (response.status === 200) {
        setShowSuccess(true);
      }
    } catch (error) {
      errorToast(error.message, 2500)
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    onRename(projectName.trim());
    onClose();
  };

  if (showSuccess) {
    return (
      <SuccessModal
        title="Project renamed"
        description={`Project has been renamed to "${projectName.trim()}".`}
        onClose={handleSuccessClose}
      />
    );
  }

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
          {/* Top Icon */}
          <div className={styles.iconContainer}>
            <div className={styles.iconOuterCircle}>
              <div className={styles.iconInnerCircle}>
                <i className="las la-pen"></i>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className={styles.titleContainer}>
            <h5 className={`modal-title ${styles.modalTitle}`}>
              Rename project
            </h5>
          </div>

          <form>
            <div className={`modal-body ${styles.modalBody}`}>
              {/* Project Name */}
              <div>
                <label htmlFor="projectName" className={styles.formLabel}>
                  Project Name<span className={styles.required}>*</span>
                </label>
                <input
                  id="projectName"
                  className={`form-control ${styles.formInput}`}
                  type="text"
                  placeholder="Enter project name"
                  value={projectName}
                  onChange={(e) => {
                    if (e.target.value.length <= maxNameLength) {
                      setProjectName(e.target.value);
                    }
                  }}
                  maxLength={maxNameLength}
                  required
                  autoFocus
                />
                <div className={styles.charCounter}>
                  {projectName.length}/{maxNameLength}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className={`modal-footer ${styles.modalFooter}`}>
              <Button
                // type="button"
                onClick={onClose}
                style={{ flex: 1 }}
                variant="secondary"
                label="Cancel"
              >
              </Button>
              <Button
                style={{ flex: 1 }}
                variant="primary"
                type="submit"
                disabled={!projectName.trim() || projectName.trim() === project.name || loading}
                label={loading ? "Saving..." : "Save"}
                onClick={handleSubmit}
              >
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
