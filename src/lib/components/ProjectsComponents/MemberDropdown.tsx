"use client";

import { useState, useRef, useEffect } from "react";
import AvatarImage from "../AvatarImage/AvatarImage";
import styles from "@/lib/styles/screens/projects.module.scss";
import { Member } from "@/lib/types/projects";

interface MemberDropdownProps {
  members: Member[];
  selectedMembers: Member[];
  onAddMember: (member: Member) => void;
  onRemoveMember: (email: string) => void;
  loading: boolean;
  mode?: "create" | "update";
  disabled?: boolean;
}

export default function MemberDropdown({
  members,
  selectedMembers,
  onAddMember,
  onRemoveMember,
  loading,
  mode = "create",
  disabled = false,
}: MemberDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleAddMember = (member: Member) => {
    onAddMember(member);
    setIsOpen(false);
  };

  const selectedEmails = selectedMembers.map((m) => m.email);
  const availableMembers = members.filter(
    (m) => !selectedEmails.includes(m.email)
  );

  return (
    <div className={styles.dropdownContainer}>
      {/* Trigger Button */}
      <div ref={dropdownRef} className={styles.triggerContainer}>
        <i className={`las la-user ${styles.userIcon}`}></i>
        <button
          type="button"
          onClick={() => !loading && !disabled && setIsOpen(!isOpen)}
          disabled={loading || disabled}
          className={`${styles.triggerButton} ${loading || disabled ? styles.disabled : styles.placeholder
            }`}
        >
          <span>{loading ? "Loading members..." : "Add member"}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            className={`${styles.chevron} ${isOpen ? styles.open : styles.closed}`}
          >
            <path fill="#999" d="M6 9L1 4h10z" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isOpen && !loading && !disabled && (
          <div className={styles.dropdownMenu}>
            {/* Member List */}
            {availableMembers.length === 0 ? (
              <div className={styles.emptyState}>No members available</div>
            ) : (
              availableMembers.map((member) => (
                <div
                  key={member._id}
                  onClick={() => handleAddMember(member)}
                  className={styles.memberItem}
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
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {mode === "update" && selectedMembers.length > 0 && (
        <p className={styles.helperText}>
          The following users have access to this project:
        </p>
      )}

      {/* Selected Members List */}
      {selectedMembers.length > 0 && (
        <div className={styles.selectedMembersList}>
          {selectedMembers.map((member) => (
            <div key={member._id} className={styles.selectedMemberItem}>
              <AvatarImage
                src={member.image}
                alt={member.name}
                className={styles.memberAvatar}
              />
              <div className={styles.memberInfo}>
                <p className={styles.memberName}>{member.name}</p>
                <p className={styles.memberEmail}>{member.email}</p>
              </div>
              <button
                type="button"
                onClick={() => onRemoveMember(member.email)}
                className={styles.removeButton}
                disabled={disabled}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}