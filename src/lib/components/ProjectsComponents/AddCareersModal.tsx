"use client";

import styles from "@/lib/styles/screens/manage-project.module.scss";

interface AddCareersModalProps {
  onClose: () => void;
  onSelectExisting: () => void;
  onSelectNew: () => void;
}

export default function AddCareersModal({
  onClose,
  onSelectExisting,
  onSelectNew,
}: AddCareersModalProps) {
  return (
    <div
      className={`${styles.modalBackdrop} fade-in`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.addCareersModal}>
        {/* Header */}
        <div className={styles.addCareersModalHeader}>
          <h5 className={styles.addCareersModalTitle}>
            <span>Add careers to this project</span>
            <button className={styles.closeButton} onClick={onClose}>
              <i className="las la-times"></i>
            </button>
          </h5>
          <p className={styles.addCareersModalSubtitle}>
            Choose to either add existing careers or create a new career.
          </p>
        </div>

        {/* Options */}
        <div className={styles.careerOptionsContainer}>
          <div
            className={styles.careerOptionCard}
            onClick={onSelectExisting}
          >
            <div className={styles.careerOptionIconContainer}>
              <div className={styles.iconOuterCircleGray}>
                <div className={styles.iconInnerCircleGray}>
                  <i className="la la-briefcase"></i>
                </div>
              </div>
            </div>
            <h6 className={styles.careerOptionTitle}>Existing Career</h6>
            <p className={styles.careerOptionDescription}>
              Select career that's already listed and link it to this project.
            </p>
          </div>

          <div
            className={styles.careerOptionCard}
            onClick={onSelectNew}
          >
            <div className={styles.careerOptionIconContainer}>
              <div className={styles.iconOuterCircleGradient}>
                <div className={styles.iconInnerCircleGradient}>
                  <i className="la la-plus"></i>
                </div>
              </div>
            </div>
            <h6 className={styles.careerOptionTitle}>New Career</h6>
            <p className={styles.careerOptionDescription}>
              Set up a new career listing to include in this project.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
