import Image from "next/image";
import styles from "@/app/(talent-vault)/styles/modules/applicant-dashboard.module.scss";

export function InvitesSection() {
  return (
    <div className={styles.emptyTabState}>
      <Image
        src="/talent-vault/gp-colleague-sitting.png"
        alt="Profile complete"
        width={272}
        height={200}
      />
      <p className={styles.emptyTabHeading}>Profile Complete</p>
      <p className={styles.emptyTabMessage}>
        Your invites will appear here. Sit back while we connect your profile to
        potential employers.
      </p>
    </div>
  );
}
