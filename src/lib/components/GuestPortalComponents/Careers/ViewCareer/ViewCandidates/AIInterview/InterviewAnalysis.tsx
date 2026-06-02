"use client";

import React from "react";
import Container from "../../../../Container";
import { Label } from "@/lib/components/GuestPortalComponents/label";
import CircularProgress from "@/lib/components/CandidateComponents/CircularProgress";
import type { InterviewAnalysis as InterviewAnalysisType } from "./useAIInterviewData";

type Props = {
  analysis: InterviewAnalysisType | null;
};

const breakdownColorScheme = ["#9FCAED", "#CEB6DA", "#EBACC9", "#FCCEC0"];

/**
 * Get fit label styling based on assessment status
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
  if (lower.includes("bad") || lower.includes("not")) {
    return { bgColor: "#FEF3F2", strokeColor: "#FECDCA", textColor: "#B42318" };
  }
  return { bgColor: "#F2F4F7", strokeColor: "#EAECF0", textColor: "#344054" };
}

export default function InterviewAnalysis({ analysis }: Props) {
  const hasData = analysis !== null;
  const fitStyle = getFitLabelStyle(analysis?.final_assessment || null);

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
            className="la la-chart-area"
            style={{ color: "#FFFFFF", fontSize: 20 }}
          />
        </div>
      }
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#101828" }}>
            Interview Analysis
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
          <span style={{ fontSize: 14 }}>No analysis available</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Score and Assessment */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 32,
            }}
          >
            {analysis.overall_score !== undefined && (
              <CircularProgress
                percentage={analysis.overall_score}
                size={140}
                strokeWidth={12}
                showLabel={true}
                label="Overall Score"
                fontSize={20}
                labelFontSize={10}
              />
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                flex: 1,
              }}
            >
              {analysis.final_assessment && (
                <Label
                  bgColor={fitStyle.bgColor}
                  strokeColor={fitStyle.strokeColor}
                  textColor={fitStyle.textColor}
                  style={{ fontSize: 14, fontWeight: 600, width: "fit-content" }}
                >
                  {analysis.final_assessment}
                </Label>
              )}
              {analysis.assessment_reason && (
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: "20px",
                    color: "#475467",
                    margin: 0,
                  }}
                >
                  {analysis.assessment_reason}
                </p>
              )}
            </div>
          </div>

          {/* Applicant Qualities Breakdown */}
          {analysis.breakdown && analysis.breakdown.length > 0 && (
            <div>
              <h4
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#101828",
                  margin: "0 0 16px 0",
                }}
              >
                Applicant Qualities
              </h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  borderRadius: 8,
                  border: "1px solid #E9EAEB",
                  padding: "16px 24px",
                  background: "#FAFAFA",
                }}
              >
                {analysis.breakdown.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: "25%" }}>
                        <i
                          className="la la-asterisk"
                          style={{
                            fontSize: 14,
                            color: breakdownColorScheme[idx % breakdownColorScheme.length],
                          }}
                        />
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#344054" }}>
                          {item.key}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          borderRadius: 4,
                          background: "#E9EAEB",
                          marginLeft: 16,
                          marginRight: 16,
                        }}
                      >
                        <div
                          style={{
                            width: `${item.data}%`,
                            height: "100%",
                            borderRadius: 4,
                            background: breakdownColorScheme[idx % breakdownColorScheme.length],
                            transition: "width 0.3s ease-in-out",
                          }}
                        />
                      </div>

                      <span style={{ fontSize: 14, fontWeight: 600, color: "#344054", minWidth: 40, textAlign: "right" }}>
                        {item.data}%
                      </span>
                    </div>

                    {item.rationale && (
                      <p
                        style={{
                          fontSize: 13,
                          lineHeight: "18px",
                          color: "#667085",
                          margin: 0,
                          paddingLeft: 22,
                        }}
                      >
                        {item.rationale}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Container>
  );
}









