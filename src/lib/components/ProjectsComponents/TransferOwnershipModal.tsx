"use client";

import { useAppContext } from "@/lib/context/AppContext";
import { api } from "@/lib/utils/apiClient";
import { useState, useEffect, useRef } from "react";
import styles from "@/lib/styles/screens/projects.module.scss";
import SuccessModal from "./SuccessModal";
import { Member, Project } from "@/lib/types/projects";
import AvatarImage from "../AvatarImage/AvatarImage";
import { errorToast } from "@/lib/Utils";
import { Button } from "../ui";

interface TransferOwnershipModalProps {
  project: Project;
  onClose: () => void;
  onTransfer: (newOwner: Member) => void;
}

export default function TransferOwnershipModal({
  project,
  onClose,
  onTransfer,
}: TransferOwnershipModalProps) {
  const { orgID } = useAppContext();
  const [selectedOwner, setSelectedOwner] = useState<Member | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!orgID) return;

      try {
        setLoadingMembers(true);
        const response = await api.post("/api/fetch-members", { orgID });

        if (response.status === 200) {
          // Filter out current owner from the list
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

  const handleSelectMember = (member: Member) => {
    setSelectedOwner(member);
    setIsOpen(false);
  };

  const handleSubmit = async () => {

    if (!selectedOwner) return;

    setLoading(true);
    try {
      // Remove new owner from members list
      const updatedMembers = project.members.filter(
        (m) => m.email !== selectedOwner.email
      );

      // Add previous owner as a member if not already in the list
      const previousOwnerIsMember = updatedMembers.some(
        (m) => m.email === project.owner.email
      );

      if (!previousOwnerIsMember) {
        updatedMembers.push({
          _id: project.owner._id,
          name: project.owner.name,
          email: project.owner.email,
          image: project.owner.image,
        });
      }

      const response = await api.post("/api/projects/update", {
        ...project,
        projectId: project._id,
        owner: selectedOwner,
        members: updatedMembers,
      });

      if (response.status === 200) {
        setShowSuccess(true);
      }
    } catch (error) {
      errorToast(`${error.message}`, 2500)
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    if (selectedOwner) {
      onTransfer(selectedOwner);
    }
    onClose();
  };

  // Success Modal
  if (showSuccess && selectedOwner) {
    return (
      <SuccessModal
        title="Ownership has been transferred."
        description={`You have transferred the project ownership to ${selectedOwner.name}.`}
        onClose={handleSuccessClose}
      />
    );
  }

  // Transfer Modal
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
            <div className={styles.iconOuterCircleGradient}>
              <div className={styles.iconInnerCircleGradient}>
                <i className="las la-exchange-alt"></i>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className={styles.titleContainer}>
            <h5 className={`modal-title ${styles.modalTitle}`}>
              Transfer ownership
            </h5>
            <p className={styles.helperText} style={{ marginTop: "8px" }}>
              Select a new owner for this project
            </p>
          </div>

          <form>
            <div className={`modal-body ${styles.modalBody}`}>
              {/* Team member dropdown */}
              <div>
                <label className={styles.formLabel}>Team member</label>
                <div className={styles.triggerContainer} ref={dropdownRef}>
                  <i className={`las la-user ${styles.userIcon}`}></i>
                  <button
                    type="button"
                    className={`${styles.triggerButton} ${
                      loadingMembers
                        ? styles.disabled
                        : selectedOwner
                        ? styles.enabled
                        : styles.placeholder
                    }`}
                    onClick={() => !loadingMembers && setIsOpen(!isOpen)}
                    disabled={loadingMembers}
                  >
                    <span>
                      {loadingMembers
                        ? "Loading members..."
                        : selectedOwner
                        ? `${selectedOwner.name}`
                        : "Select a member"}
                    </span>
                    <i
                      className={`la la-angle-down ${styles.chevron} ${
                        isOpen ? styles.open : styles.closed
                      }`}
                    ></i>
                  </button>

                  {isOpen && (
                    <div className={styles.dropdownMenu}>
                      {members.length === 0 ? (
                        <div className={styles.emptyState}>
                          No members available
                        </div>
                      ) : (
                        members.map((member) => (
                          <div
                            key={member._id}
                            className={`${styles.memberItem} ${
                              selectedOwner?.email === member.email
                                ? styles.selected
                                : ""
                            }`}
                            onClick={() => handleSelectMember(member)}
                          >
                            <AvatarImage
                              src={member.image}
                              alt={member.name}
                              className={styles.memberAvatar}
                            />
                            <div className={styles.memberInfo}>
                              <p className={styles.memberName}>{member.name}</p>
                              <p className={styles.memberEmail}>{member.email}</p>
                            </div>
                            {selectedOwner?.email === member.email && (
                              <i
                                className="las la-check"
                                style={{ color: "#039855", fontSize: "20px" }}
                              ></i>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
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
                onClick={handleSubmit}
                style={{ flex: 1 }}
                variant="primary"
                type="submit"
                disabled={!selectedOwner || loading}
                label={loading ? "Transferring..." : "Transfer"}
                >
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
