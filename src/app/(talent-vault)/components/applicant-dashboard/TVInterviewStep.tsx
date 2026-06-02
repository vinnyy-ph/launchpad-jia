"use client";

import styles from "@/app/(talent-vault)/styles/modules/profile-setup.module.scss";
import gpGirlStar from "@/app/(talent-vault)/assets/gp-girl-star.jpg";
import { BulbSparkle } from "../icons/BulbSparkle";
import { HelpBanner } from "../HelpBanner";

type TVInterviewStepProps = {
  onBack?: () => void;
  onViewNextStep?: () => void;
  isPreparing?: boolean;
};

export function TVInterviewStep({
  onBack,
  onViewNextStep,
  isPreparing = false,
}: TVInterviewStepProps) {
  return (
    <div className={styles.cvDetailsContainer}>
      <div className={styles.gradient}>
        <div className={styles.cvDetailsCard}>
          <span className={styles.sectionTitle}>
            <img src="/icons/sparkle-black.svg" alt="Sparkles icon" />
            AI Interview
          </span>

          <div className={styles.detailsContainer}>
            <div className={styles.interviewContent}>
              <img src={gpGirlStar.src} alt="Girl holding a star" />

              <div className={styles.interviewHeadline}>
                <h3>Almost there! Are you ready for your AI Interview?</h3>
                <p>
                  Thanks for submitting all your documents. Here comes the fun part,{" "}
                  your Pre-Screening AI Interview.
                </p>
              </div>

              <div className={styles.interviewTips}>
                <span className={styles.interviewTipsIcon}><BulbSparkle size={13} /></span>
                <div>
                  <strong>Jia's quick tips for your interview</strong>

                  <ul className={styles.interviewTipsList}>
                    <li><strong>Speak clearly</strong>. Jia can understand English, Filipino, and even Taglish.</li>
                    <li><strong>Stay relevant.</strong> Mention relevant experience related to the job requirements</li>
                    <li><strong>Showcase your strengths.</strong> We want to hear your achievements!</li>
                  </ul>
                </div>
              </div>

              <HelpBanner
                title="What happens next?"
                message="After finishing your AI Interview, you'll get feedback from us within a few days."
              />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.preScreeningStepFooter}>
        <div className={styles.stepFooterActions}>
          {onBack ? (
            <button
              type="button"
              className={styles.stepBackCircleBtn}
              onClick={onBack}
              aria-label="Go to previous step"
            >
              <img src="/iconsV3/arrowCircle.svg" alt="" className={styles.stepBackIcon} />
            </button>
          ) : <span />}
          <button
            type="button"
            onClick={onViewNextStep}
            disabled={isPreparing}
            style={{
              opacity: isPreparing ? 0.7 : 1,
              cursor: isPreparing ? "not-allowed" : "pointer",
            }}
          >
            {isPreparing ? "Preparing..." : "Proceed to Interview"}
          </button>
        </div>
      </div>
    </div>
  )
}
