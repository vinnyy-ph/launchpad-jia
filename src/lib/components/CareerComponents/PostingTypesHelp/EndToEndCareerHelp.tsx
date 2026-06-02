import styles from "./postingtypes-help-modal.module.scss";

export default function EndToEndCareerHelp() {
  return (
    <div>
      <div>
        <h3>End-to-end Career</h3>
        <p>
          An end-to-end job post is a comprehensive recruitment workflow that covers the entire hiring process,{" "}
          from sourcing candidates to extending a job offer. Unlike linked career posts that separate stages into{" "}
          parent and child posts, end-to-end posts manage all stages under a single job post.
        </p>
      </div>

      <div className={styles.helpContentSection}>
        <div className={styles.helpGradientCard}>
          <div className={styles.helpCardInner}>
            <div className={styles.helpCardTitle}>Applicant for Software Engineer</div>
            <div className={styles.helpRowCenter}>
              <div className={styles.helpAvatar}>
                <img className={styles.helpAvatarImg} src="/icons/userV2.svg" alt="Placeholder profile photo" />
              </div>
              <span className={styles.helpText}>Gerald Frialde</span>
            </div>
          </div>

          <div className={`${styles.helpPill} ${styles.helpPillTopMargin}`}>
            <span className={styles.helpText}>Applies on hellojia.ai</span>
          </div>
        </div>

        <img className={styles.helpConnectorLine} src="/icons/connector-line.svg" alt="Connector Line" />

        <div className={styles.helpGrayCard}>
          <div className={styles.helpGrayCardTop}>
            <div className={styles.helpTextCenter}>
              <div className={styles.helpCardTitle}>Software Engineer</div>
              <div className={styles.helpText}>End-to-end Career</div>
            </div>
            <div className={styles.helpColumnGap12}>
              <div className={styles.helpPillShadow}>
                <span className={styles.helpText}>CV Screening</span>
              </div>

              <img className={styles.helpConnectorLineSm} src="/icons/connector-line-sm.svg" alt="Connector Line Small" />

              <div className={styles.helpPillShadow}>
                <span className={styles.helpText}>AI Interview</span>
              </div>

              <img className={styles.helpConnectorLineSm} src="/icons/connector-line-sm.svg" alt="Connector Line Small" />

              <div className={styles.helpPillShadow}>
                <span className={styles.helpText}>HR Interview</span>
              </div>

              <img className={styles.helpConnectorLineSm} src="/icons/connector-line-sm.svg" alt="Connector Line Small" />

              <div className={styles.helpPillShadow}>
                <span className={styles.helpText}>Job Offer</span>
              </div>
            </div>
          </div>

          <div className={styles.helpJobOwnerRow}>
            <div className={styles.helpAvatar}>
              <img className={styles.helpAvatarImg} src="/icons/userV2.svg" alt="Placeholder profile photo" />
            </div>
            <span className={styles.helpText}>Job Owner: <strong>Angel Aquino</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
