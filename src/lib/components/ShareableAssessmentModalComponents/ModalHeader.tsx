"use client";

import styles from "@/lib/styles/shareable-assessment.module.scss";

type Props = {
  title: string;
  subtitle?: string;
  iconSrc?: string;
  iconAlt?: string;
  setShowModal(show: boolean): void;
  showShareIcon?: boolean;
};

export default function ModalHeader({
  title,
  subtitle,
  iconSrc,
  iconAlt = "Modal icon",
  setShowModal,
  showShareIcon = true,
}: Props) {
  return (
    <div className={styles.modalHeader}>
      <div className={styles.headerMain}>
        {iconSrc && (
          <div className={styles.headerIcon}>
            <img src={iconSrc} alt={iconAlt} width={24} height={24} />
          </div>
        )}

        <div className={styles.modalTitles}>
          <h3 className="modal-title">{title}</h3>

          {subtitle && (
            <span className={styles.modalSubtitle}>
              {subtitle}
            </span>
          )}
        </div>
      </div>

      <button 
        type="button" 
        className={styles.closeButton}
        data-dismiss="modal" 
        aria-label="Close" 
        onClick={() => setShowModal(false)}
      >
        <i className="la la-times" />
      </button>

    </div>
  )
}
