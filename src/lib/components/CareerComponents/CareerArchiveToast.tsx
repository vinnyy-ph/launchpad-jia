"use client";

import React from "react";

export type CareerArchiveToastVariant = "archive-drop" | "archive-nodrop" | "restore";

interface CareerArchiveToastProps {
  variant: CareerArchiveToastVariant;
  careerTitle: string;
  onUndo?: () => void;
}

const ICON_SIZE = 20;

const variantConfig: Record<
  CareerArchiveToastVariant,
  {
    circleBg: string;
    icon: React.ReactNode;
    title: (careerTitle: string) => string;
    supporting: string;
    showUndo: boolean;
  }
> = {
  "archive-drop": {
    circleBg: "#eff1f5",
    icon: (
      <img
        src="/careers/archived.svg"
        alt="Archived"
        width={ICON_SIZE}
        height={ICON_SIZE}
      />
    ),
    title: (t) => `‘${t}’ archived and candidates dropped`,
    supporting: "All non-hired candidates have been dropped.",
    showUndo: true,
  },
  "archive-nodrop": {
    circleBg: "#dcfae6",
    icon: (
      <img
        src="/careers/archived.svg"
        alt="Archived"
        width={ICON_SIZE}
        height={ICON_SIZE}
      />
    ),
    title: (t) => `‘${t}’ archived`,
    supporting: "Candidates remain in their current stages.",
    showUndo: true,
  },
  restore: {
    circleBg: "#dcfae6",
    icon: (
      <i
        className="la la-redo-alt"
        style={{ fontSize: ICON_SIZE, color: "#079455", lineHeight: 1 }}
      />
    ),
    title: (t) => `‘${t}’ restored`,
    supporting: "This career has been restored.",
    showUndo: false,
  },
};

export default function CareerArchiveToast({
  variant,
  careerTitle,
  onUndo,
}: CareerArchiveToastProps) {
  const config = variantConfig[variant];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        width: "100%",
      }}
    >
      {/* Featured icon — 40px circle on the left */}
      <div
        style={{
          width: 40,
          height: 40,
          minWidth: 40,
          borderRadius: "50%",
          backgroundColor: config.circleBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {config.icon}
      </div>

      {/* Text column */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {/* Title */}
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#414651",
            lineHeight: 1.4,
          }}
        >
          {config.title(careerTitle)}
        </span>

        {/* Supporting text */}
        <span
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: "#717680",
            lineHeight: 1.4,
          }}
        >
          {config.supporting}
        </span>

        {/* Undo button */}
        {config.showUndo && onUndo && (
          <button
            onClick={onUndo}
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#444ce7",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              alignSelf: "flex-start",
              marginTop: 4,
            }}
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
