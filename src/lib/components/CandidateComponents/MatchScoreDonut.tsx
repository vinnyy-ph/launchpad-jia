"use client";

import React from "react";

type Props = { score: number; size?: number };

/** SVG ring showing the overall match score. Gradient approximates the Figma donut. */
export default function MatchScoreDonut({ score, size = 120 }: Props) {
  const clamped = Math.max(0, Math.min(100, score));
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id="matchScoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7F56D9" />
            <stop offset="50%" stopColor="#F670C7" />
            <stop offset="100%" stopColor="#FDB022" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F2F4F7" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#matchScoreGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 12, color: "#717680" }}>Match Score</span>
        <span style={{ fontSize: 24, fontWeight: 700, color: "#181D27" }}>{clamped}%</span>
      </div>
    </div>
  );
}
