"use client";

import { useState } from "react";

type FallbackMode = "dicebear" | "initials" | "none";

/**
 * Extract initials from a name or alt text (up to 2 characters).
 */
function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function AvatarImage({
  src,
  className,
  alt = "Avatar",
  title,
  style,
  fallback = "dicebear",
}: {
  src?: string;
  className?: string;
  alt?: string;
  title?: string;
  style?: React.CSSProperties;
  /** Fallback when src is missing or fails to load:
   *  - "dicebear" (default): use Dicebear avatar
   *  - "initials": show initials circle
   *  - "none": render nothing / transparent placeholder
   */
  fallback?: FallbackMode;
}) {
  const [imgError, setImgError] = useState(false);

  const hasSrc = !!src;
  const showImage = hasSrc && !imgError;

  // Dicebear fallback URL (stable seed to avoid hydration mismatch)
  const dicebearUrl = `https://api.dicebear.com/9.x/glass/svg?seed=default`;

  // If we should show image
  if (showImage) {
    return (
      <img
        src={src}
        alt={alt}
        title={title}
        className={`avatar rounded-circle ${className || ""}`}
        onError={() => setImgError(true)}
        style={{
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  // Fallback rendering
  if (fallback === "dicebear") {
    return (
      <img
        src={dicebearUrl}
        alt={alt}
        title={title}
        className={`avatar rounded-circle ${className || ""}`}
        onError={(e: any) => {
          // Secondary fallback with unique seed on error
          if (!e.target.src.includes("seed=error")) {
            e.target.src = `https://api.dicebear.com/9.x/glass/svg?seed=error`;
          }
        }}
        style={{
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  if (fallback === "initials") {
    const initials = getInitials(alt || title || "");
    return (
      <div
        title={title || alt}
        className={`avatar rounded-circle ${className || ""}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#E5E7EB",
          color: "#374151",
          fontWeight: 600,
          fontSize: 14,
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: "50%",
          ...style,
        }}
      >
        {initials}
      </div>
    );
  }

  // fallback === "none"
  return (
    <div
      className={`avatar rounded-circle ${className || ""}`}
      style={{
        width: 40,
        height: 40,
        flexShrink: 0,
        backgroundColor: "transparent",
        ...style,
      }}
    />
  );
}
