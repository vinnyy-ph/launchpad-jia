"use client";

import React from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { CandidateCVDocument } from "@/lib/components/CandidateComponents/CandidateCVDocument";

type DownloadCVButtonProps = {
  candidateEmail: string;
  candidateName?: string;
  digitalCV: any[];
  disabled?: boolean;
  variant?: "button" | "link";
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Reusable button component for downloading candidate CV as PDF
 */
export function DownloadCVButton({
  candidateEmail,
  candidateName,
  digitalCV,
  disabled = false,
  variant = "button",
  className,
  style,
}: DownloadCVButtonProps) {
  const hasCV = Array.isArray(digitalCV) && digitalCV.length > 0;
  const isDisabled = disabled || !hasCV;
  const fileName = `${candidateName || candidateEmail || "candidate"}-CV.pdf`;

  const candidate = {
    email: candidateEmail,
    name: candidateName,
  };

  if (variant === "link") {
    return hasCV && candidateEmail ? (
      <PDFDownloadLink
        key={new Date().toISOString()}
        document={
          <CandidateCVDocument
            candidate={candidate}
            cvData={digitalCV}
            includeCVAnalysis={false}
          />
        }
        fileName={fileName}
        style={{ color: "#414651", ...style }}
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        {({ loading }) => (loading ? "Preparing document..." : "Download CV")}
      </PDFDownloadLink>
    ) : null;
  }

  return (
    <button
      disabled={isDisabled}
      className={className}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "#FFFFFF",
        borderRadius: "60px",
        padding: "5px 10px",
        cursor: isDisabled ? "not-allowed" : "pointer",
        border: "1px solid #E9EAEB",
        opacity: isDisabled ? 0.5 : 1,
        ...style,
      }}
    >
      <PDFDownloadLink
        key={new Date().toISOString()}
        document={
          <CandidateCVDocument
            candidate={candidate}
            cvData={digitalCV}
            includeCVAnalysis={false}
          />
        }
        fileName={fileName}
      >
        {({ loading }) =>
          loading ? (
            "Preparing document..."
          ) : (
            <>
              <i
                className="la la-cloud-download-alt"
                style={{ color: "#414651", fontSize: 16, marginRight: 4 }}
              ></i>
              <span style={{ color: hasCV ? "#414651" : "#1010104d" }}>
                Download CV
              </span>
            </>
          )
        }
      </PDFDownloadLink>
    </button>
  );
}

