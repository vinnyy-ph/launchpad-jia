import React, { useEffect, useState } from "react";
import styles from "@/lib/components/MailgunComponents/email.module.scss";
import Button from "@/lib/components/ui/button/Button";
import Field from "@/lib/components/ui/field/Field";
import DatePicker from "@/lib/components/MailgunComponents/components/DatePicker";
import { errorToast, successToast } from "@/lib/Utils";
import { apiClient } from "@/lib/utils/apiClient";
import {
  getFormattedDateFull,
  getTomorrowDate,
  getNextMonday,
  parsePHDate,
  parsePHTime,
  buildSendDate,
  MONTHS,
} from "@/lib/utils/emailCandidate";

export type ScheduleEmailPayload = {
  to: string;
  cc?: string | null;
  bcc?: string | null;
  subject: string;
  body: string;
  sender: string;
  orgID: string;
  careerId?: string | null;
  threadId?: string | null;
  accountId?: string | null;
};

type ScheduleSendModalProps = {
  isOpen: boolean;
  onClose: () => void;
  getEmailPayload?: () => ScheduleEmailPayload | null;
  onScheduled?: () => void;
};

const ScheduleSendModal = ({
  isOpen,
  onClose,
  getEmailPayload,
  onScheduled,
}: ScheduleSendModalProps) => {
  const [showPickDateTime, setShowPickDateTime] = useState(false);
  const [formdata, setFormdata] = useState<Record<string, string>>({});
  const [pickedDate, setPickedDate] = useState<Date | undefined>(new Date());
  const onFieldChange = ({ id, value }: { id: string; value: string }) => {
    setFormdata((prev) => ({ ...prev, [id]: value }));
    // Sync date field changes to calendar
    if (id === "date") {
      const parsed = parsePHDate(value);
      if (parsed) {
        // Create UTC date and subtract 8 hours to convert back to local browser time
        const utcDate = new Date(
          Date.UTC(parsed.year, parsed.monthIndex, parsed.day, 0, 0, 0),
        );
        const localDate = new Date(utcDate.getTime() - 8 * 60 * 60 * 1000);
        setPickedDate(localDate);
      }
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setPickedDate(date);
    if (date) {
      // Add 8 hours to convert to Philippine time
      const phDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
      const year = phDate.getUTCFullYear();
      const monthIdx = phDate.getUTCMonth();
      const day = phDate.getUTCDate();
      const dateStr = `${MONTHS[monthIdx]} ${day}, ${year}`;
      setFormdata((prev) => ({ ...prev, date: dateStr }));
    }
  };

  // Date: Jan 20, 2026 ; Time: 3:27 PM (allow regular, NBSP, or narrow NBSP before AM/PM)
  const datePattern =
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(0?[1-9]|[12]\d|3[01]),\s\d{4}$/;
  const timePattern = /^(0?[1-9]|1[0-2]):([0-5]\d)[\u00A0\u202F\s]?(AM|PM)$/;

  // Prefill with current PH time/date when opening the picker
  useEffect(() => {
    if (!showPickDateTime) return;
    const nowUtc = Date.now();
    const phMs = nowUtc + 8 * 60 * 60 * 1000; // UTC+8
    const d = new Date(phMs);
    const year = d.getUTCFullYear();
    const monthIdx = d.getUTCMonth();
    const day = d.getUTCDate();
    const hour24 = d.getUTCHours();
    const minute = d.getUTCMinutes();
    const period = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;
    const mm = String(minute).padStart(2, "0");
    const dateStr = `${MONTHS[monthIdx]} ${day}, ${year}`;
    const timeStr = `${hour12}:${mm} ${period}`;
    setFormdata((prev) => ({
      date: prev.date ?? dateStr,
      time: prev.time ?? timeStr,
      ...prev,
    }));
  }, [showPickDateTime]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const scheduleSend = async (sendDate: Date) => {
    const payload =
      typeof getEmailPayload === "function"
        ? (getEmailPayload() ?? null)
        : null;
    if (!payload) {
      errorToast("No email content to schedule. Compose or reply first.", 3000);
      return false;
    }
    try {
      setIsSubmitting(true);
      await apiClient.post("/api/mailgun-module/schedule-send", {
        ...payload,
        sendDate: sendDate.toISOString(),
      });
      successToast("Email scheduled successfully", 2000);
      onScheduled?.();
      onClose();
      return true;
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data
              ?.error
          : null;
      errorToast(msg || "Failed to schedule email", 3000);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validate date & time inputs
  const validateDateTime = () => {
    const msgs: string[] = [];
    const dStr = (formdata["date"] || "").trim();
    const tStr = (formdata["time"] || "").trim();

    const isDateOk = !!dStr && datePattern.test(dStr);
    const isTimeOk = !!tStr && timePattern.test(tStr);
    if (!isDateOk) msgs.push("Invalid date. Use Jan 20, 2026");
    if (!isTimeOk) msgs.push("Invalid time. Use 3:27 PM");

    if (isDateOk && isTimeOk) {
      const dParts = parsePHDate(dStr);
      const tParts = parsePHTime(tStr);
      if (!dParts || !tParts) {
        msgs.push("Invalid date/time values");
      } else {
        const scheduledUtcMs = Date.UTC(
          dParts.year,
          dParts.monthIndex,
          dParts.day,
          tParts.hour24 - 8,
          tParts.minute,
        );
        const nowUtcMs = Date.now();
        if (scheduledUtcMs < nowUtcMs) {
          msgs.push(
            "Schedule must be in the future (Philippine Standard Time)",
          );
        }
      }
    }

    if (msgs.length) {
      errorToast(msgs.join("\n"), 3000);
      return false;
    }
    return true;
  };

  if (!isOpen) return null;

  const tomorrowDate = getTomorrowDate();
  const nextMondayDate = getNextMonday();

  const timeOptions = [
    {
      label: "Tomorrow morning",
      time: "8:00 AM",
      date: tomorrowDate,
    },
    {
      label: "Tomorrow afternoon",
      time: "1:00 PM",
      date: tomorrowDate,
    },
    {
      label: "Monday morning",
      time: "8:00 AM",
      date: nextMondayDate,
    },
  ];

  return (
    <div className={styles.emailModalOverlay} onClick={onClose}>
      {/* Schedule Send Modal */}
      {!showPickDateTime && (
        <div
          className={`${styles.emailModalContainer} ${styles.career}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={styles.modalHeader}>
            <div className={styles.icon}>
              <img src="/iconsV3/scheduled.svg" />
            </div>
            <div className={styles.modalTitleWrapper}>
              <span className={styles.modalTitle}>Schedule send</span>
              <span className={styles.modalSubtitle}>
                Philippine Standard Time
              </span>
            </div>
            <img
              src="/iconsV3/x.svg"
              alt="close"
              onClick={onClose}
              style={{ alignSelf: "flex-start", cursor: "pointer" }}
            />
          </div>

          {/* Content */}
          <div className={styles.modalContent} style={{ gap: 4 }}>
            {timeOptions.map((option, index) => (
              <button
                type="button"
                className={`${styles.scheduleOptionButton} ${index === 0 ? styles.default : ""}`}
                key={index}
                disabled={isSubmitting}
                onClick={async () => {
                  const sendDate = buildSendDate(option.date, option.time);
                  if (sendDate && sendDate.getTime() > Date.now()) {
                    await scheduleSend(sendDate);
                  } else {
                    errorToast("Selected time must be in the future", 3000);
                  }
                }}
              >
                <span className={styles.label}>{option.label}</span>
                <div className={styles.dateTimeBadge}>
                  {option.date}, {option.time}
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className={styles.modalFooter}>
            <Button
              label="Pick custom date & time"
              icon="/icons/calendar.svg"
              variant="secondary"
              style={{ flex: 1 }}
              onClick={() => setShowPickDateTime(true)}
            />
          </div>
        </div>
      )}

      {/* Pick Date & Time Modal */}
      {showPickDateTime && (
        <div
          className={`${styles.emailModalContainer} ${styles.date}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={styles.modalHeader}>
            <div className={styles.icon}>
              <img src="/iconsV2/calendar.svg" />
            </div>
            <div className={styles.modalTitleWrapper}>
              <span className={styles.modalTitle}>Pick date & time</span>
              <span className={styles.modalSubtitle}>
                Philippine Standard Time
              </span>
            </div>
            <img
              src="/iconsV3/x.svg"
              alt="close"
              onClick={onClose}
              style={{ alignSelf: "flex-start", cursor: "pointer" }}
            />
          </div>

          {/* Content */}
          <div
            className={styles.modalContent}
            style={{ flexDirection: "row", gap: 16, height: 412 }}
          >
            <div className={styles.calendarWrapper}>
              <DatePicker selected={pickedDate} onSelect={handleDateSelect} />
            </div>
            <div className={styles.dateTimeFormGroup}>
              <Field
                label="Date"
                formdata={formdata}
                placeholder=""
                onChange={onFieldChange}
              />
              <Field
                label="Time"
                formdata={formdata}
                placeholder=""
                onChange={onFieldChange}
              />
            </div>
          </div>

          {/* Footer */}
          <div className={styles.modalFooter}>
            <Button label="Cancel" variant="secondary" onClick={onClose} />
            <Button
              label="Schedule Send"
              disabled={isSubmitting}
              onClick={async () => {
                if (!validateDateTime()) return;
                const dStr = (formdata["date"] || "").trim();
                const tStr = (formdata["time"] || "").trim();
                const sendDate = buildSendDate(dStr, tStr);
                if (sendDate) await scheduleSend(sendDate);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleSendModal;
