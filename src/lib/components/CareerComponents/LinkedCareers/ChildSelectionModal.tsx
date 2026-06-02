"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import styles from "./linked-careers.module.scss";
import { Button } from "../../ui";

interface ChildCareer {
  _id: string;
  id: string;
  jobTitle: string;
  childTitle?: string;
}

interface ChildSelectionModalProps {
  open: boolean;
  onClose: () => void;
  parentTitle: string;
  childCareers: ChildCareer[];
  onSelectChild: (childId: string, childTitle: string) => void;
}

export default function ChildSelectionModal({
  open,
  onClose,
  parentTitle,
  childCareers,
  onSelectChild,
}: ChildSelectionModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const [search, setSearch] = useState("");

  const filteredChildCareers = useMemo(() => {
    if (!search.trim()) return childCareers;
    const query = search.toLowerCase();
    return childCareers.filter((child) =>
      (child.childTitle || child.jobTitle).toLowerCase().includes(query)
    );
  }, [childCareers, search]);

  if (!open) {
    return null;
  }

  const modalContent = (
    <div className={styles.modalBackground} onClick={onClose}>
      <div className={styles.modalContainer}>
        <div
          className={styles.modalContent}
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="child-selection-modal-title"
        >
          <div className={styles.modalHeader}>
            <div className={styles.modalHeaderContent}>
              <h3 id="child-selection-modal-title" className={styles.modalTitle}>
                Show Child
              </h3>
              <p className={styles.modalDescription}>
                Enable a child timeline to display it with the parent timeline.
              </p>
            </div>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>

          <div className={styles.searchBarWrapper}>
            <div className={`table-search-bar ${styles.searchBar}`}>
              <div className="icon mr-2">
                <i className="la la-search"></i>
              </div>
              <input
                type="search"
                className="form-control ml-auto search-input"
                placeholder="Search by child posts name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.modalBody}>
            {filteredChildCareers.length === 0 ? (
              <p className={styles.emptyState}>No child posts found.</p>
            ) : (
              filteredChildCareers.map((child, index) => (
                <div key={child.id}>
                  {index > 0 && <div className={styles.itemDivider} />}
                  <div className={styles.childItem}>
                    <div>
                      <div className={styles.childItemParentTitle}>{parentTitle}</div>
                      <div className={styles.childItemTitle}>{child.childTitle || child.jobTitle}</div>
                    </div>
                    <Button onClick={() => { onSelectChild(child.id, child.jobTitle); onClose(); }} icon="/eye.svg" iconPosition="left" variant="primary" label="Show" size="default" />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={styles.footerDivider} />

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(modalContent, document.body);
}
