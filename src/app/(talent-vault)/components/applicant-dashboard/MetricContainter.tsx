"use client";

import { HelpCircle } from "@untitledui/icons";
import Metric from "@/lib/components/AnalyticsComponents/Metric";
import styles from "@/app/(talent-vault)/styles/modules/metric-container.module.scss";

interface MetricContainerProps {
  title: string;
  count?: number | null;
  subtitle?: string;
  description?: string;
}

export const METRIC_INFO_TOOLTIP_ID = "applicant-metric-info-tooltip";

function normalizeMetricCount(count?: number | null) {
  if (typeof count !== "number" || Number.isNaN(count) || count < 0) {
    return 0;
  }

  return Math.floor(count);
}

export function MetricContainer({
  title,
  count = 0,
  subtitle = "All Time",
  description,
}: MetricContainerProps) {
  const normalizedCount = normalizeMetricCount(count);

  return (
    <div className={styles.metricContainer}>
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <div className={styles.headerTitleRow}>
            <img className={styles.chartIcon} src="/chart-icon.png" alt="Chart icon" />
            <h3>{title}</h3>
            {description ? (
              <button
                type="button"
                data-tooltip-id={METRIC_INFO_TOOLTIP_ID}
                data-tooltip-html={description}
                className={styles.tooltipTrigger}
                aria-label={`${title} information`}
              >
                <HelpCircle size={18} color="#A4A7AE" />
              </button>
            ) : null}
          </div>
          <span className={styles.subtitle}>{subtitle}</span>
        </div>
      </div>
      <div className={styles.content}>
        <Metric data={[{ metricValue: normalizedCount }]} />
      </div>
    </div>
  );
}
