"use client";

import React from "react";

type TabKey = "timeline" | "applicants" | "description";

type Props = {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  applicantsCount?: number;
};

const TimelineIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 12.5H5V14.1667H10V12.5Z" fill="currentColor" />
    <path d="M15 5.83333H10V7.5H15V5.83333Z" fill="currentColor" />
    <path d="M12.5 9.16667H7.5V10.8333H12.5V9.16667Z" fill="currentColor" />
    <path
      d="M15.8333 2.5H4.16667C3.25 2.5 2.5 3.25 2.5 4.16667V15.8333C2.5 16.75 3.25 17.5 4.16667 17.5H15.8333C16.75 17.5 17.5 16.75 17.5 15.8333V4.16667C17.5 3.25 16.75 2.5 15.8333 2.5ZM15.8333 15.8333H4.16667V4.16667H15.8333V15.8333Z"
      fill="currentColor"
    />
  </svg>
);

const DescriptionIcon = () => (
  <svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 3.33333V1.66667H6.66667V3.33333H10ZM1.66667 5V14.1667H15V5H1.66667ZM15 3.33333C15.925 3.33333 16.6667 4.075 16.6667 5V14.1667C16.6667 15.0917 15.925 15.8333 15 15.8333H1.66667C0.741667 15.8333 0 15.0917 0 14.1667L0.00833333 5C0.00833333 4.075 0.741667 3.33333 1.66667 3.33333H5V1.66667C5 0.741667 5.74167 0 6.66667 0H10C10.925 0 11.6667 0.741667 11.6667 1.66667V3.33333H15Z"
      fill="currentColor"
    />
  </svg>
);

const ApplicantsIcon = () => (
  <svg width="20" height="17" viewBox="0 0 20 17" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M14.1663 16V14.3333C14.1663 13.4493 13.8152 12.6014 13.19 11.9763C12.5649 11.3512 11.7171 11 10.833 11H4.16634C3.28229 11 2.43444 11.3512 1.80932 11.9763C1.1842 12.6014 0.833008 13.4493 0.833008 14.3333V16M19.1663 16V14.3333C19.1658 13.5948 18.92 12.8773 18.4675 12.2936C18.015 11.7099 17.3814 11.293 16.6663 11.1083M13.333 1.10833C14.05 1.29192 14.6855 1.70892 15.1394 2.29359C15.5932 2.87827 15.8395 3.59736 15.8395 4.3375C15.8395 5.07764 15.5932 5.79673 15.1394 6.38141C14.6855 6.96608 14.05 7.38308 13.333 7.56667M10.833 4.33333C10.833 6.17428 9.34062 7.66667 7.49967 7.66667C5.65873 7.66667 4.16634 6.17428 4.16634 4.33333C4.16634 2.49238 5.65873 1 7.49967 1C9.34062 1 10.833 2.49238 10.833 4.33333Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function Tab({
  label,
  active,
  onClick,
  count,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: "12px",
        color: active ? "#101828" : "#667085",
        fontWeight: 500,
        fontSize: 14,
        transitionProperty: "color",
        transitionDuration: "150ms",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 24,
            height: 22,
            padding: "0 6px",
            borderRadius: 999,
            background: "#F8F9FC",
            border: "1px solid #D5D9EB",
            color: "#363F72",
            fontSize: 12,
            fontWeight: 550,
            lineHeight: 1,
          }}
        >
          {count}
        </span>
      )}
      {active && (
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "-1px",
            height: "2px",
            borderRadius: "9999px",
            backgroundImage:
              "linear-gradient(270deg, #9fcaed -0.44%, #ceb6da 32.7%, #ebacc9 65.85%, #fccec0 100%)",
          }}
        />
      )}
    </button>
  );
}

export default function ViewCareerTabs({ active, onChange, applicantsCount }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, borderBottom: "1px solid #EAECF0" }}>
      <Tab
        label="Application timeline"
        active={active === "timeline"}
        onClick={() => onChange("timeline")}
        icon={<TimelineIcon />}
      />
      <Tab
        label="All Applicants"
        active={active === "applicants"}
        onClick={() => onChange("applicants")}
        icon={<ApplicantsIcon />}
      />
      <Tab
        label="Career Description"
        active={active === "description"}
        onClick={() => onChange("description")}
        icon={<DescriptionIcon />}
      />
    </div>
  );
}

