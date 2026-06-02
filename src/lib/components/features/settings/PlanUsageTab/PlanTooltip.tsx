"use client";

import React, { useState, ReactNode } from "react";

interface PlanTooltipProps {
  message: React.ReactNode;
  width?: number;
  children: ReactNode;
  position?: "top" | "bottom";
  align?: "left" | "center" | "right";
  fontSize?: string | number;
}

export function PlanTooltip({
  message,
  width = 300,
  children,
  position = "top",
  align = "center",
  fontSize = "12px"
}: PlanTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const isTop = position === "top";

  // Calculate positioning based on alignment
  const getPositionStyles = () => {
    const baseStyles: React.CSSProperties = {
      position: "absolute",
      ...(isTop ? { bottom: "calc(100% + 10px)" } : { top: "calc(100% + 10px)" }),
    };

    if (align === "left") {
      return {
        ...baseStyles,
        left: 0,
      };
    } else if (align === "right") {
      return {
        ...baseStyles,
        right: 0,
      };
    } else {
      // center
      return {
        ...baseStyles,
        left: "50%",
        transform: "translateX(-50%)",
      };
    }
  };

  // Calculate arrow positioning based on alignment
  const getArrowStyles = () => {
    const baseStyles: React.CSSProperties = {
      position: "absolute",
      ...(isTop ? { top: "100%" } : { bottom: "100%" }),
      width: 0,
      height: 0,
      borderLeft: "6px solid transparent",
      borderRight: "6px solid transparent",
      ...(isTop
        ? { borderTop: "6px solid #101828" }
        : { borderBottom: "6px solid #101828" }
      ),
    };

    if (align === "left") {
      return {
        ...baseStyles,
        left: "20px",
      };
    } else if (align === "right") {
      return {
        ...baseStyles,
        right: "20px",
      };
    } else {
      // center
      return {
        ...baseStyles,
        left: "50%",
        transform: "translateX(-50%)",
      };
    }
  };

  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          style={{
            ...getPositionStyles(),
            backgroundColor: "#101828",
            color: "#FFFFFF",
            padding: "8px 12px",
            borderRadius: "8px",
            fontSize: typeof fontSize === 'number' ? `${fontSize}px` : fontSize,
            fontWeight: 400,
            whiteSpace: "normal",
            width: `${width}px`,
            boxShadow: "0 8px 16px rgba(15, 23, 42, 0.35)",
            zIndex: 1000,
            lineHeight: "1.5",
          }}
        >
          {message}
          <div style={getArrowStyles()} />
        </div>
      )}
    </span>
  );
}

