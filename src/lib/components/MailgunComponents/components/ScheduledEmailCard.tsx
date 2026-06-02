"use client";

import styles from "@/lib/components/MailgunComponents/email.module.scss";
import type { ScheduledEmailItem } from "@/lib/hooks/useScheduledEmails";

function formatSendDate(sendDate: string): string {
  try {
    const d = new Date(sendDate);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (isToday) {
      return d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return sendDate;
  }
}

export default function ScheduledEmailCard({
  item,
  isActive,
  onSelect,
}: {
  item: ScheduledEmailItem;
  isActive?: boolean;
  onSelect?: (id: string) => void;
}) {
  const toDisplay = typeof item.to === "string" ? item.to : String(item.to ?? "");

  return (
    <div
      className={`${styles.previewCard} ${isActive ? styles.active : ""}`}
      tabIndex={0}
      role="button"
      onMouseDown={(e) => (e.currentTarget as HTMLDivElement).focus()}
      onClick={() => onSelect && onSelect(item._id)}
    >
      <div
        className={styles.previewContent}
        style={{ marginLeft: 0 }}
      >
        <div className={styles.previewText}>
          <div className={styles.previewHeader}>
            <div className={styles.senderGroup}>
              <span className={styles.senderName}>{toDisplay}</span>
            </div>
            <span className={styles.timestamp}>
              {formatSendDate(item.sendDate)}
            </span>
          </div>
          <div className={styles.previewSubject}>{item.subject || "(no subject)"}</div>
        </div>
      </div>
    </div>
  );
}
