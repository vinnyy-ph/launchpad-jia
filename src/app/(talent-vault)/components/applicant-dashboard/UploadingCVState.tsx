"use client";

import styles from "@/app/(talent-vault)/styles/modules/profile-setup.module.scss";

interface UploadingCVStateProps {
  fileName: string;
}

export function UploadingCVState({ fileName }: UploadingCVStateProps) {
  return (
    <div className={styles.cvDetailsContainer}>
      <div className={styles.gradient}>
        <div className={styles.cvDetailsCard}>
          <span className={styles.sectionTitle}>
            <img alt="" src="/iconsV3/account.svg" />
            Submit CV
          </span>
          <div className={styles.detailsContainer}>
            <span className={styles.fileTitle}>
              <img alt="" src="/iconsV3/checkV4.svg" />
              {fileName}
            </span>
            <div className={styles.loadingContainer}>
              <img alt="" src="/gifsV2/loading.gif" />
              <div className={styles.textContainer}>
                <span className={styles.title}>
                  Extracting information from your CV...
                </span>
                <span className={styles.description}>
                  Jia is building your profile...
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
