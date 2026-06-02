"use client";

import styles from "@/lib/styles/candidate-profile.module.scss";
import moment from "moment";
import { useMemo } from "react";
import { redactNameFromContent, type NameVisibility } from "../candidateProfileUtils";

export type Message = {
  idx?: number;
  time: number;
  type: "user" | "jia";
  content: string;
};

type Props = {
  applicantName: string;
  message: Message;
  prevMsg: Message;
  fullName?: string;
  nameVisibility?: NameVisibility;
};

function getMessageDuration(prevMsg: Message, currMsg: Message) {
  const duration = moment.duration(
    moment(currMsg.time).diff(moment(prevMsg.time))
  );

  const seconds = duration.asSeconds();
  const minutes = Math.floor(seconds / 60);

  return seconds >= 60
    ? `${minutes}m ${(
        seconds -
        minutes * 60
      ).toFixed(1)}s`
    : `${seconds.toFixed(1)}s`;
}

export function TranscriptMessage({
  applicantName,
  message,
  prevMsg,
  fullName,
  nameVisibility,
}: Props) {
  // Memoize redacted content to avoid recalculating on every render
  const displayContent = useMemo(() => {
    if (!fullName || !nameVisibility) {
      return message.content;
    }
    return redactNameFromContent(message.content, fullName, nameVisibility);
  }, [message.content, fullName, nameVisibility]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }} key={message.time}>
      <div className={styles.transcriptHeader}>
        <span style={{ color: "#181D27" }}>{message.type === "user" ? applicantName : "Jia"}</span>

        <span>
          <span>{moment(message.time).format("hh:mm A")}</span>{" "}
          <span style={{ color: "#E9EAEB" }}>|</span>{" "}
          <i className="la la-stopwatch" style={{ color: "#A4A7AE" }} />{" "}
          <span>{message.idx === 0 ? "0.0s" : getMessageDuration(prevMsg, message)}</span>
        </span>
      </div>

      <div
        className={styles.transcriptMessage}
        style={{
          backgroundColor: message.type === "user" ? "#F8F9FC" : "#EFF8FF",
          border: `1px solid ${message.type === "user" ? "#EAECF5" : "#D1E9FF"}`,
        }}
      >
        {displayContent}
      </div>
    </div>
  )
}
