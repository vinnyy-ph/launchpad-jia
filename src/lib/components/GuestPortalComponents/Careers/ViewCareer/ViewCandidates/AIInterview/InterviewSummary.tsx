"use client";

import React from "react";
import Markdown from "react-markdown";
import Container from "../../../../Container";

type Props = {
  summary: string | null;
};

export default function InterviewSummary({ summary }: Props) {
  const hasData = summary !== null && summary.length > 0;

  return (
    <Container
      icon={
        <div
          style={{
            width: 32,
            height: 32,
            backgroundColor: "#181D27",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i
            className="la la-file-alt"
            style={{ color: "#FFFFFF", fontSize: 20 }}
          />
        </div>
      }
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#101828" }}>
            Interview Summary
          </span>
          <button
            disabled={!hasData}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: "#FFFFFF",
              borderRadius: 60,
              padding: "5px 12px",
              cursor: hasData ? "pointer" : "not-allowed",
              border: "1px solid #E9EAEB",
              opacity: hasData ? 1 : 0.5,
              fontSize: 14,
              color: "#414651",
            }}
          >
            <i className="la la-sync-alt" style={{ fontSize: 16 }} />
            <span>Regenerate</span>
          </button>
        </div>
      }
    >
      {!hasData ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 24px",
            color: "#667085",
          }}
        >
          <span style={{ fontSize: 14 }}>No summary available</span>
        </div>
      ) : (
        <div
          style={{
            fontSize: 14,
            lineHeight: "22px",
            color: "#475467",
          }}
          className="markdown-content"
        >
          <Markdown>{summary}</Markdown>
        </div>
      )}
    </Container>
  );
}









