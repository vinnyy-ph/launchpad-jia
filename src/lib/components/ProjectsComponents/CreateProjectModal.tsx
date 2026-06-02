"use client";

import { useAppContext } from "@/lib/context/AppContext";
import { api } from "@/lib/utils/apiClient";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MemberDropdown from "./MemberDropdown";
import styles from "@/lib/styles/screens/projects.module.scss";
import { Member } from "@/lib/types/projects";
import { errorToast } from "@/lib/Utils";
import { Button } from "../ui";

interface CreateProjectModalProps {
  onClose: () => void;
}

export default function CreateProjectModal({
  onClose,
}: CreateProjectModalProps) {
  const { orgID } = useAppContext();
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const maxNameLength = 40;

  const validateMembers = (members: Member[]): boolean => {
    if (members.length === 0) {
      setValidationError("Project must have at least one member");
      return false;
    }
    setValidationError(null);
    return true;
  };

  useEffect(() => {
    // Fetch organization members
    const fetchMembers = async () => {
      if (!orgID) return;

      try {
        setLoadingMembers(true);
        const response = await api.post(
          "/api/fetch-members",
          { orgID }
        );

        if (response.status === 200) {
          const userData = localStorage.user ? JSON.parse(localStorage.user) : null;
          const filteredMembers = userData
            ? response.data.filter((m: Member) => m.email !== userData.email)
            : response.data;
          setMembers(filteredMembers);
        }
      } catch (error) {
        errorToast(error.message, 2500)
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, [orgID]);

  const handleAddMember = (member: Member) => {
    const updatedMembers = [...selectedMembers, member];
    setSelectedMembers(updatedMembers);
    validateMembers(updatedMembers);
  };

  const handleRemoveMember = (email: string) => {
    const updatedMembers = selectedMembers.filter((m) => m.email !== email);
    setSelectedMembers(updatedMembers);
    validateMembers(updatedMembers);
  };

  const handleSubmit = async () => {
    if (!projectName.trim()) return;

    setLoading(true);
    try {
      const userData = localStorage.user ? JSON.parse(localStorage.user) : null;

      const response = await api.post("/api/projects/create", {
        orgID,
        name: projectName.trim(),
        owner: userData,
        members: selectedMembers,
      });

      if (response.status === 200 && response.data.projectID) {
        onClose();
        router.push(`/recruiter-dashboard/projects/manage/${response.data.projectID}?orgID=${orgID}`);
      }
    } catch (err) {
      console.error("Failed to create project:", err);
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
          {/* Top Icon */}
          <div className={styles.iconContainer}>
            <div className={styles.iconOuterCircle}>
              <div className={styles.iconInnerCircle}>
                <i className="las la-plus-circle"></i>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className={styles.titleContainer}>
            <h5 className={`modal-title ${styles.modalTitle}`}>
              Create new project
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
                  disabled={loading}
                />
                <div className={styles.charCounter}>
                  {projectName.length}/{maxNameLength}
                </div>
              </div>

              {/* Add Members */}
              <div className={styles.newProjecTitle}>
                <label htmlFor="addMembers" className={styles.labelTop}>
                  Add members
                </label>
                <p className={styles.helperText}>
                  You can add other users to view this project (atleast 1 member).
                </p>
                <MemberDropdown
                  members={members}
                  selectedMembers={selectedMembers}
                  onAddMember={handleAddMember}
                  onRemoveMember={handleRemoveMember}
                  loading={loadingMembers}
                  disabled={loading}
                />
                {validationError && (
                  <div className={styles.validationWarning}>
                    <i className="las la-exclamation-triangle"></i>
                    <span>{validationError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className={`modal-footer ${styles.modalFooter}`}>
              <Button
                type="button"
                onClick={onClose}
                variant="secondary"
                label="Cancel"
              >
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={!projectName.trim() || selectedMembers.length === 0 || loading}
                label={loading ? "Saving..." : "Create"}
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
