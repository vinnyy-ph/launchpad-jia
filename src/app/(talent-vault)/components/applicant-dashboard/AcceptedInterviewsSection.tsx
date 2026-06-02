import Image from "next/image";
import styles from "@/app/(talent-vault)/styles/modules/applicant-dashboard.module.scss";

export function AcceptedInterviewsSection() {
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
        Once you accept an invite, your upcoming interviews will show up here.
        You&apos;re all set!
      </p>
    </div>
  );
}
