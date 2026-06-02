import React from "react";
import { Label } from "@/lib/components/GuestPortalComponents/label";
import type { CandidateCard } from "../ApplicationTimeline/kanban/types";

type Props = {
  candidate: CandidateCard;
  jobTitle: string;
  stageLabel?: string;
  onBack: () => void;
};

export default function Header({ candidate, jobTitle, stageLabel, onBack }: Props) {
  const initials = React.useMemo(() => {
    if (!candidate.name) return "";
    return candidate.name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [candidate.name]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          marginLeft: 10,
          border: "none",
          background: "transparent",
          color: "#344054",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 500,
          width: "fit-content",
          padding: 0,
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ flexShrink: 0 }}
        >
          <path
            d="M15.8334 10H4.16675M4.16675 10L10.0001 15.8333M4.16675 10L10.0001 4.16667"
            stroke="currentColor"
            strokeWidth="1.67"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Back
      </button>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        {candidate.avatar ? (
          <img
            src={candidate.avatar}
            alt={candidate.name}
            style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#EAECF0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 600,
              color: "#344054",
            }}
          >
            {initials}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24, fontWeight: 600, color: "#101828" }}>{candidate.name}</span>
            {stageLabel && (
              <Label
                bgColor="#FFFAEB"
                textColor="#B54708"
                strokeColor="#FEDF89"
                style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: "#F79009",
                  }}
                />
                {stageLabel}
              </Label>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "#667085" }}>for</span>
            <a
              href="#"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#175CD3",
                textDecoration: "underline",
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              {jobTitle}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ flexShrink: 0 }}
              >
                <path
                  d="M3.5 3H9M9 3V8.5M9 3L3 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
