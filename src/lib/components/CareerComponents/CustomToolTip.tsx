"use client"
import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

export default function CustomToolTip({ children, tooltipText, position = "bottom-right" }: { children: React.ReactNode, tooltipText: string, position?: "bottom-right" | "bottom-left" | "top-right" | "top-left" }) {
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const show = useCallback(() => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Account for CSS zoom on <html> (e.g. zoom: 0.9)
      const zoom = parseFloat(getComputedStyle(document.documentElement).zoom || "1");

      const styles: React.CSSProperties = {};
      if (position.startsWith("bottom")) {
        styles.top = rect.bottom / zoom + 4;
      } else {
        styles.bottom = window.innerHeight / zoom - rect.top / zoom + 4;
      }
      if (position.endsWith("right")) {
        styles.left = rect.left / zoom + rect.width / zoom / 2;
      } else {
        styles.right = window.innerWidth / zoom - rect.right / zoom;
      }

      setTooltipStyle(styles);
    }, [position]);

    const hide = useCallback(() => setTooltipStyle(null), []);

    return (
      <div
      ref={wrapperRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      >
        {children}
        {tooltipStyle && createPortal(
          <div
            style={{
              position: "fixed",
              ...tooltipStyle,
              marginBottom: 8,
              backgroundColor: "#111827",
              color: "#FFFFFF",
              fontSize: 12,
              fontWeight: 700,
              padding: "8px 12px",
              borderRadius: 8,
              maxWidth: 280,
              width: "max-content",
              boxSizing: "border-box",
              whiteSpace: "normal",
              lineHeight: 1.4,
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.35)",
              zIndex: 9999,
              pointerEvents: "none",
            }}
          >
            {tooltipText}
          </div>,
          document.body
        )}
      </div>
    )
}