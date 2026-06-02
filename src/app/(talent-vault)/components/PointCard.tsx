"use client";

import { useMemo } from "react";

type PointCardProps = {
  bgColor?: string;
  photoSrc: string;
  title: string;
  description: string;
  theme?: "light" | "dark";
};
export function PointCard({ bgColor = "#E5EAFE", photoSrc, title, description, theme = "light" }: PointCardProps) {
  const tilt = useMemo(() => {
    const hash = Array.from(title).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const direction = hash % 2 === 0 ? 1 : -1;
    const magnitude = 1.5 + (hash % 20) / 10;
    return Number((direction * magnitude).toFixed(2));
  }, [title]);

  return (
    <div
      className="tv-section--card tv-point-card"
      style={{
        backgroundColor: bgColor, "--tilt": `${tilt}deg`,
        color: theme === "dark" ? "white" : "black",
      } as React.CSSProperties}
    >
      <div className="tv-section--card photo">
        <img src={photoSrc} alt={title} loading="lazy" decoding="async" />
      </div>
      <div className="tv-section--card content">
        <h3 className="tv-section--card title">{title}</h3>
        <p className="tv-section--card desc" style={{ color: theme === "dark" ? "white" : "black" }}>{description}</p>
      </div>
    </div>
  )
}
