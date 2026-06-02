"use client";

import { useAppContext } from "@/lib/context/AppContext";
import { api } from "@/lib/utils/apiClient";
import { useState, useEffect } from "react";
import MemberDropdown from "./MemberDropdown";
import styles from "@/lib/styles/screens/projects.module.scss";
import { Member, Project } from "@/lib/types/projects";
import { errorToast } from "@/lib/Utils";
import { Button } from "../ui";

interface ManageMembersModalProps {
  project: Project;
  onClose: () => void;
  onSave: (updatedMembers: Member[]) => void;
}

export default function ManageMembersModal({
  project,
  onClose,
  onSave,
}: ManageMembersModalProps) {
  const { orgID } = useAppContext();
  const [selectedMembers, setSelectedMembers] = useState<Member[]>(project.members);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const validateMembers = (members: Member[]): boolean => {
    if (members.length === 0) {
      setValidationError("Project must have at least one member");
      return false;
    }
    setValidationError(null);
    return true;
  };

  useEffect(() => {
    const fetchMembers = async () => {
      if (!orgID) return;

      try {
        setLoadingMembers(true);
        const response = await api.post("/api/fetch-members", { orgID });

        if (response.status === 200) {
          const filteredMembers = response.data.filter(
            (m: Member) => m.email !== project.owner.email
          );
          setMembers(filteredMembers);
        }
      } catch (error) {
        errorToast(error.message, 2500)
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, [orgID, project.owner.email]);

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

    setLoading(true);
    try {
      const response = await api.post("/api/projects/update", {
        projectId: project._id,
        members: selectedMembers,
        orgID,
      });

      if (response.status === 200) {
        onSave(selectedMembers);
        onClose();
      }
    } catch (err) {
      console.error("Failed to update project members:", err);
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
          {/* Title */}
          <div className={`${styles.titleContainer} ${styles.manageModal}`}>
            <h5 className={`modal-title ${styles.modalTitle}`}>Members</h5>
          </div>

          <form>
            <div className={`modal-body ${styles.modalBody}`}>
              <MemberDropdown
                members={members}
                selectedMembers={selectedMembers}
                onAddMember={handleAddMember}
                onRemoveMember={handleRemoveMember}
                loading={loadingMembers}
                mode="update"
              />
              {validationError && (
                <div className={styles.validationWarning}>
                  <i className="las la-exclamation-triangle"></i>
                  <span>{validationError}</span>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className={`modal-footer ${styles.modalFooter}`}>
              <Button
                type="button"
                onClick={onClose}
                style={{ flex: 1 }}
                variant="secondary"
                label="Close"
              >
              </Button>
              <Button
                style={{ flex: 1 }}
                variant="primary"
                type="submit"
                disabled={loading || selectedMembers.length === 0}
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
