import styles from "./postingtypes-help-modal.module.scss";

export default function LinkedCareerHelp() {
  return (
    <div>
      <div>
        <h3>Linked Career</h3>
        <p>
          A linked job post that separates the early and later stages into separate job posts.{" "}
          This allows you to pool candidates for a broad requirement into a parent post, then distribute{" "}
          them to child posts for more specific requirements.
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
              <div className={styles.helpText}>Linked Career (Parent)</div>
            </div>
            <div className={styles.helpColumnGap12}>
              <div className={styles.helpPillShadow}>
                <span className={styles.helpText}>CV Screening</span>
              </div>

              <img className={styles.helpConnectorLineSm} src="/icons/connector-line-sm.svg" alt="Connector Line Small" />

              <div className={styles.helpPillShadow}>
                <span className={styles.helpText}>AI Interview</span>
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

        <img className={styles.helpConnectorLine} src="/icons/connector-fork.svg" alt="Connector Fork" />

        <div className={styles.helpCardsRow}>
          <div className={styles.helpGrayCard}>
            <div className={styles.helpGrayCardTop}>
              <div className={styles.helpTextCenter}>
                <div className={styles.helpCardTitle}>Software Engineer</div>
                <div className={styles.helpText}>Client A (Child)</div>
              </div>
              <div className={styles.helpColumnGap12}>
                <div className={styles.helpPillShadow}>
                  <span className={styles.helpText}>Client Practical Exam</span>
                </div>

                <img className={styles.helpConnectorLineSm} src="/icons/connector-line-sm.svg" alt="Connector Line Small" />

                <div className={styles.helpPillShadow}>
                  <span className={styles.helpText}>Client Technical Exam</span>
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
              <span className={styles.helpText}>Job Owner: <strong>Sabine Dy</strong></span>
            </div>
          </div>

          <div className={styles.helpGrayCard}>
            <div className={styles.helpGrayCardTop}>
              <div className={styles.helpTextCenter}>
                <div className={styles.helpCardTitle}>Software Engineer</div>
                <div className={styles.helpText}>Client B (Child)</div>
              </div>
              <div className={styles.helpColumnGap12}>
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
              <span className={styles.helpText}>Job Owner: <strong>Shiela de Jesus</strong></span>
            </div>
          </div>

          <div className={styles.helpGrayCard}>
            <div className={styles.helpGrayCardTop}>
              <div className={styles.helpTextCenter}>
                <div className={styles.helpCardTitle}>Software Engineer</div>
                <div className={styles.helpText}>Client C (Child)</div>
              </div>
              <div className={styles.helpColumnGap12}>
                <div className={styles.helpPillShadow}>
                  <span className={styles.helpText}>HR Interview</span>
                </div>

                <img className={styles.helpConnectorLineSm} src="/icons/connector-line-sm.svg" alt="Connector Line Small" />

                <div className={styles.helpPillShadow}>
                  <span className={styles.helpText}>Client Interview</span>
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
              <span className={styles.helpText}>Job Owner: <strong>Brent Smith</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
