"use client";

import React from "react";

interface TooltipProps {
  title: string;
  content: string;
  isRichText?: boolean;
}

export default function Tooltip({ title, content, isRichText = false }: TooltipProps) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#fff",
        boxShadow:
          "0px 4px 6px -2px rgba(16, 24, 40, 0.03), 0px 12px 16px -4px rgba(16, 24, 40, 0.08)",
        borderRadius: 8,
        padding: "12px",
        width: 240,
        zIndex: 50,
        textAlign: "left",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          color: "rgba(65, 70, 81, 1)",
          fontSize: 12,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      {isRichText ? (
        <>
          <style dangerouslySetInnerHTML={{
            __html: `
              .tooltip-rich-text ul {
                margin: 0;
                padding-left: 16px;
                list-style-type: disc;
              }
              .tooltip-rich-text li {
                color: rgba(113, 118, 128, 1);
                font-size: 12px;
                line-height: 18px;
                margin-bottom: 4px;
                font-weight: 400;
              }
              .tooltip-rich-text li:last-child {
                margin-bottom: 0;
              }
            `
          }} />
          <div
            className="tooltip-rich-text"
            style={{
              color: "rgba(113, 118, 128, 1)",
              fontSize: 12,
              lineHeight: "18px",
              fontWeight: 400,
            }}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </>
      ) : (
        <div
          style={{
            color: "rgba(113, 118, 128, 1)",
            fontSize: 12,
            lineHeight: "18px",
            fontWeight: 400,
          }}
        >
          "{content}"
        </div>
      )}
      {/* Arrow */}
      <div
        style={{
          position: "absolute",
          top: "100%",
          left: "50%",
          marginLeft: -6,
          marginTop: -1,
          width: 0,
          height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: "6px solid #fff",
          boxShadow:
            "0px 4px 6px -2px rgba(16, 24, 40, 0.03), 0px 12px 16px -4px rgba(16, 24, 40, 0.08)",
        }}
      />
    </div>
  );
}
