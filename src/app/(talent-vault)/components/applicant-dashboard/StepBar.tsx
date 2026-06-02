"use client";

import { InProgressIcon } from "../icons/InProgress";
import { InProgressIconStatus } from "../icons/InProgress";
import styles from "@/app/(talent-vault)/styles/modules/step-bar.module.scss";

interface StepBarProps {
  title: string;
  step: number;
  status?: InProgressIconStatus;
  lastStep?: boolean;
}

export function StepBar({ title, step, status = "pending", lastStep = false }: StepBarProps) {
  return (
    <div className={styles.stepBarWrapper}>
      <div className={styles.stepBar}>
        <InProgressIcon status={status} />
        {!lastStep && (
          <span
            className={styles.progressBar}
            data-status={status}
          ></span>
        )}
      </div>

      <div className={styles.stepInfo} data-status={status}>
        <p>STEP {step}</p>
        <h2>{title}</h2>
      </div>
    </div>
  );
}