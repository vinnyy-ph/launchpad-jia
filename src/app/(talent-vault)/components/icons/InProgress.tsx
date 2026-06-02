"use client";

export type InProgressIconStatus = "pending" | "next" | "in_progress" | "done";

export interface InProgressIconProps {
  status: InProgressIconStatus;
}

export function InProgressIcon({ status }: InProgressIconProps) {
  if (status === "done") {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="19" height="19" rx="9.5" fill="#181D27" />
        <rect x="0.5" y="0.5" width="19" height="19" rx="9.5" stroke="#181D27" />
        <path d="M14.6668 6.5L8.25016 12.9167L5.3335 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  const opacity = status === "pending" ? "0.5" : "1";

  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g opacity={opacity}>
        <rect x="0.5" y="0.5" width="18.5" height="18.5" rx="9.25" fill="white" />
        <rect x="0.5" y="0.5" width="18.5" height="18.5" rx="9.25" stroke="#6A6A6A" strokeWidth="1.5" />
      </g>
      <g opacity={opacity}>
        <rect x="8" y="8" width="4" height="4" rx="2" fill="#6A6A6A" />
        <rect x="8" y="8" width="4" height="4" rx="2" stroke="#6A6A6A" />
      </g>
    </svg>
  );
}