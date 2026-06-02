"use client";

import styles from "@/lib/styles/shareable-assessment.module.scss";
import { ViewableStages } from "./ShareModalV2";
import { Dispatch, SetStateAction } from "react";
import GradientCheckbox from "@/lib/components/GradientCheckbox/GradientCheckbox";

type Props = {
  stageId: string;
  stageName: string;
  viewableStages: ViewableStages;
  setViewableStages: Dispatch<SetStateAction<ViewableStages>>;
};

export default function StageCheckbox({ stageId, stageName, viewableStages, setViewableStages }: Props) {
  const isDisabled = viewableStages[stageId].disabled;
  return (
    <div className={styles.checkboxField}>
      <GradientCheckbox
        checked={viewableStages[stageId].viewable}
        disabled={isDisabled}
        onChange={() => setViewableStages({
          ...viewableStages,
          [stageId]: {
            ...viewableStages[stageId],
            viewable: !viewableStages[stageId].viewable,
          }
        })}
      />
      <span className={styles.fieldLabel} style={{ color: isDisabled ? '#a4a7ae' : undefined }}>{stageName}</span>
    </div>
  );
}

