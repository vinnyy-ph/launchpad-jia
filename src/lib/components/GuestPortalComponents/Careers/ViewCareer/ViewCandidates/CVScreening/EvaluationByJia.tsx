"use client";

import React from "react";
import { Label } from "@/lib/components/GuestPortalComponents/label";
import Container from "../../../../Container";
import { RegenerateButton } from "../../CandidateCVUtils";

type Props = {
  cvStatus: string | null;
  cvScreeningReason: string | null;
  onRegenerate: () => Promise<void>;
  isRegenerating: boolean;
  hasCV: boolean;
};

/**
 * Get fit label styling based on status
 */
function getFitLabelStyle(status: string | null): {
  bgColor: string;
  strokeColor: string;
  textColor: string;
} {
  if (!status) {
    return { bgColor: "#F2F4F7", strokeColor: "#EAECF0", textColor: "#344054" };
  }

  const lower = status.toLowerCase();
  if (lower.includes("strong")) {
    return { bgColor: "#ECFDF3", strokeColor: "#ABEFC6", textColor: "#067647" };
  }
  if (lower.includes("good")) {
    return { bgColor: "#EFF8FF", strokeColor: "#B2DDFF", textColor: "#175CD3" };
  }
  if (lower.includes("maybe")) {
    return { bgColor: "#FFFAEB", strokeColor: "#FEDF89", textColor: "#B54708" };
  }
  if (lower.includes("bad")) {
    return { bgColor: "#FEF3F2", strokeColor: "#FECDCA", textColor: "#B42318" };
  }
  return { bgColor: "#F2F4F7", strokeColor: "#EAECF0", textColor: "#344054" };
}

/**
 * Parse HTML content to extract strong and weak points
 */
function parseEvaluationContent(htmlContent: string | null): {
  strongPoints: string[];
  weakPoints: string[];
  rawContent: string | null;
} {
  if (!htmlContent) {
    return { strongPoints: [], weakPoints: [], rawContent: null };
  }

  // Check if content has structured strong/weak points
  const hasStrongSection = /strong\s*points?/i.test(htmlContent);
  const hasWeakSection = /weak\s*points?/i.test(htmlContent);

  if (!hasStrongSection && !hasWeakSection) {
    // Return raw content if not structured
    return { strongPoints: [], weakPoints: [], rawContent: htmlContent };
  }

  const strongPoints: string[] = [];
  const weakPoints: string[] = [];

  // Extract strong points
  const strongMatch = htmlContent.match(/strong\s*points?[:\s]*([\s\S]*?)(?=weak\s*points?|$)/i);
  if (strongMatch && strongMatch[1]) {
    const points = strongMatch[1]
      .split(/<li>|<br\s*\/?>|\n|•|-/)
      .map((p) => p.replace(/<[^>]*>/g, "").trim())
      .filter((p) => p.length > 5);
    strongPoints.push(...points);
  }

  // Extract weak points
  const weakMatch = htmlContent.match(/weak\s*points?[:\s]*([\s\S]*?)$/i);
  if (weakMatch && weakMatch[1]) {
    const points = weakMatch[1]
      .split(/<li>|<br\s*\/?>|\n|•|-/)
      .map((p) => p.replace(/<[^>]*>/g, "").trim())
      .filter((p) => p.length > 5);
    weakPoints.push(...points);
  }

  return { strongPoints, weakPoints, rawContent: null };
}

export default function EvaluationByJia({
  cvStatus,
  cvScreeningReason,
  onRegenerate,
  isRegenerating,
  hasCV,
}: Props) {
  const fitStyle = getFitLabelStyle(cvStatus);
  const { strongPoints, weakPoints, rawContent } = parseEvaluationContent(cvScreeningReason);
  const hasStructuredContent = strongPoints.length > 0 || weakPoints.length > 0;

  return (
    <Container
      icon={
        <img
          src="/jia-dashboard-logo.png"
          alt="Jia Logo"
          style={{
            width: 32,
            height: 32,
            objectFit: "contain",
            borderRadius: "50%",
          }}
        />
      }
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: "#101828" }}>
              Evaluation by Jia
            </span>
            {cvStatus && (
              <Label
                bgColor={fitStyle.bgColor}
                strokeColor={fitStyle.strokeColor}
                textColor={fitStyle.textColor}
                style={{ fontSize: 12, fontWeight: 550 }}
              >
                {cvStatus}
              </Label>
            )}
          </div>
          <RegenerateButton
            onClick={onRegenerate}
            isLoading={isRegenerating}
            disabled={!hasCV}
          />
        </div>
      }
    >
      {isRegenerating ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px", gap: 8 }}>
          <i className="la la-circle-notch spin" style={{ fontSize: 24, color: "#414651" }}></i>
          <span style={{ color: "#6B7280" }}>Regenerating CV Analysis...</span>
        </div>
      ) : hasStructuredContent ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {strongPoints.length > 0 && (
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: "#101828", margin: "0 0 8px 0" }}>
                Strong Points:
              </h4>
              <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                {strongPoints.map((point, index) => (
                  <li key={index} style={{ fontSize: 14, lineHeight: "20px", color: "#475467" }}>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {weakPoints.length > 0 && (
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: "#101828", margin: "0 0 8px 0" }}>
                Weak Points:
              </h4>
              <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                {weakPoints.map((point, index) => (
                  <li key={index} style={{ fontSize: 14, lineHeight: "20px", color: "#475467" }}>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : rawContent ? (
        <div
          style={{ fontSize: 14, lineHeight: "20px", color: "#475467" }}
          dangerouslySetInnerHTML={{ __html: rawContent }}
        />
      ) : (
        <div style={{ fontSize: 14, color: "#667085", fontStyle: "italic" }}>
          {hasCV
            ? "No evaluation available. Click Regenerate to analyze the CV."
            : "No CV uploaded for this candidate."}
        </div>
      )}
    </Container>
  );
}
