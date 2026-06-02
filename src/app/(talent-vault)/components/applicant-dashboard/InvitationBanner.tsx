"use client";

import styles from "@/app/(talent-vault)/styles/modules/applicant-dashboard.module.scss";
import SectionCard from "@/lib/components/CandidateProfileComponents/SectionCard";
import Button from "@/app/(talent-vault)/components/base/Button";
import gpWomanMg from "@/app/(talent-vault)/assets/gp-woman-mg.png";

export function InvitationBanner() {
  return (
    <SectionCard title="Join the Talent Vault" collapsible={true}>
      <div className={styles.inviteBanner}>
        <img src={gpWomanMg.src} alt="Woman with magnifying glass" />
        <div>
          <div className={styles.inviteContent}>
            <h2>Let the jobs find you with Jia Talent Vault</h2>
            <p>
              Set up your profile so we can start matching you to potential{" "}
              jobs handpicked just for you.
            </p>
          </div>

          <div className={styles.cta}>
            <Button variant="secondary" href="https://talentvault.hellojia.ai" target="_blank">
              Learn More
            </Button>
            <Button variant="primary" href="/dashboard/talent-vault/setup">
              Setup
            </Button>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
