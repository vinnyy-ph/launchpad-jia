"use client";

import styles from "@/lib/styles/candidate-profile.module.scss";

export type QualityBreakdown = {
  key: string; // name of quality
  data: number; // percentage
  rationale: string;
};

type Props = {
  icon: string | React.ReactNode; // for string: line-awesome icon classname
  breakdown: QualityBreakdown;
  progressBarColor: string;
};

export function QualitiesBreakdownItem({
  icon,
  breakdown,
  progressBarColor
}: Props) {
  return (
    <div style={{ display: "flex", gap: "12px" }}>
      {typeof icon === "string" ? (
        <i className={`la ${icon} ${styles.breakdownItemIcon}`} />
      ) : icon}

      <div style={{ width: "100%" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ minWidth: "30%", fontSize: "16px", fontWeight: "bold", color: "#414651" }}>
            {breakdown.key}
          </span>

          <div  style={{ width: "100%", height: 8, borderRadius: 4, background: "#E9EAEB", marginRight: "16px" }}>
            <div
              style={{
                width: `${breakdown.data}%`,
                height: "100%",
                borderRadius: 4,
                background: progressBarColor,
              }}
            />
          </div>
          <span>{breakdown.data}%</span>
        </div>

        <div className={styles.evalNotes} style={{ marginTop: "8px" }}>
          <p>{breakdown.rationale}</p>
        </div>
      </div>
    </div>
  )
}
