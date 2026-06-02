"use client";

import React from "react";
import AvatarImage from "@/lib/components/AvatarImage/AvatarImage";
import { timeAgo } from "@/lib/utils/emailCandidate";
import { formatExactDate } from "@/app/(talent-vault)/lib/helpers";
import styles from "@/app/(talent-vault)/styles/modules/subprograms.module.scss";

export type CandidateState = "completed" | "draft" | "expired";
export type CandidateStatus = "active" | "inactive";

export type CandidateRowData = {
  _id: string;
  name: string;
  email: string;
  image: string;
  status: CandidateStatus;
  state: CandidateState;
  updatedAt: string;
  createdAt: string;
  completedAt: string | null;
};

const ACTIVITY_BADGE_STYLES = {
  active: {
    label: "Active",
    backgroundColor: "#ECFDF3",
    color: "#067647",
    border: "1px solid #ABEFC6",
  },
  inactive: {
    label: "Inactive",
    backgroundColor: "#F2F4F7",
    color: "#344054",
    border: "1px solid #E4E7EC",
  },
} as const;

function CandidateActivityBadge({ status }: { status: CandidateStatus }) {
  const style = status === "active" ? ACTIVITY_BADGE_STYLES.active : ACTIVITY_BADGE_STYLES.inactive;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "2px 8px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: 500,
        lineHeight: "18px",
        backgroundColor: style.backgroundColor,
        color: style.color,
        border: style.border,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: style.color,
          flexShrink: 0,
        }}
      />
      {style.label}
    </span>
  );
}

type SubProgramCandidateProps = {
  candidate: CandidateRowData;
};

export default function SubProgramCandidate({ candidate }: SubProgramCandidateProps) {
  return (
    <tr className={styles.candidateRow}>
      <th scope="row" style={{ whiteSpace: "initial" }}>
        <div className={styles.candidateInfo}>
          <AvatarImage
            src={candidate.image}
            alt={candidate.name}
            className={styles.candidateAvatar}
          />
          <div className={styles.candidateDetails}>
            <span className={styles.candidateName}>{candidate.name}</span>
            <span className={styles.candidateEmail}>{candidate.email}</span>
          </div>
        </div>
      </th>
      <td>
        <CandidateActivityBadge status={candidate.status} />
      </td>
      <td className={styles.dateCell}>
        <span title={formatExactDate(candidate.updatedAt)} className={styles.dateValue}>
          {timeAgo(new Date(candidate.updatedAt))}
        </span>
      </td>
      <td className={styles.dateCell}>
        <span title={formatExactDate(candidate.createdAt)} className={styles.dateValue}>
          {timeAgo(new Date(candidate.createdAt))}
        </span>
      </td>
    </tr>
  );
}
