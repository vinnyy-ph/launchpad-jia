"use client";

import React from "react";
import CareerFit from "@/lib/components/CareerComponents/CareerFit";
import { Tooltip } from "react-tooltip";
import { DownloadCVButton, RegenerateButton } from "../../../CandidateCVUtils";

type EvaluationByJiaSectionProps = {
  interviewData: any;
  cvData: any;
  candidateEmail: string;
  candidateName?: string;
  onRegenerate: () => void;
  regenerateLoading?: boolean;
};

export function EvaluationByJiaSection({
  interviewData,
  cvData,
  candidateEmail,
  candidateName,
  onRegenerate,
  regenerateLoading = false,
}: EvaluationByJiaSectionProps) {
  const cvStatus = interviewData?.cvStatus;
  const cvScreeningReason = interviewData?.cvScreeningReason;
  const jobTitle = interviewData?.jobTitle;
  const currentStep = interviewData?.currentStep;
  const digitalCV = Array.isArray(cvData?.digitalCV) ? cvData.digitalCV : [];
  const hasCV = digitalCV.length > 0;

  return (
    <div className="layered-card-outer">
      <div className="layered-card-middle">
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src="/jia-dashboard-logo.png" alt="Logo" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: "50%" }} />
            </div>
            <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>Evaluation by JIA</span>
          </div>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8 }}>
            <RegenerateButton
              onClick={onRegenerate}
              isLoading={regenerateLoading}
              disabled={!hasCV}
            />
            <DownloadCVButton
              candidateEmail={candidateEmail}
              candidateName={candidateName}
              digitalCV={digitalCV}
              disabled={!hasCV}
            />
          </div>
        </div>
        <div className="layered-card-content">
          {regenerateLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px", gap: 8 }}>
              <i className="la la-circle-notch spin" style={{ fontSize: 24, color: "#414651" }}></i>
              <span style={{ color: "#6B7280" }}>Regenerating CV Analysis...</span>
            </div>
          ) : cvStatus || cvScreeningReason ? (
            <div>
              <div style={{ display: "flex", flexDirection: "row", justifyContent: "flex-start", gap: 4, alignItems: "center" }}>
                {cvStatus && (
                  <>
                    <CareerFit fit={cvStatus} assessment={cvScreeningReason} candidateDetails={interviewData} evaluatorName={"Jia"} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>for</span>
                  </>
                )}
                <span style={{ fontSize: 12, fontWeight: 700, color: "#181D27" }}>
                  {jobTitle || "This Position"}
                </span>
                {currentStep === "Applied" && (
                  <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px", color: "#414651", border: "1px solid #E9EAEB", backgroundColor: "#F5F5F5", borderRadius: "60px", padding: "2px 10px", fontSize: "12px" }}>
                    <i className="la la-exclamation-triangle" style={{ fontSize: "12px", color: "#414651" }}></i>
                    <span>No CV Uploaded</span>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 16, color: "#414651", fontWeight: 500 }}>
                <p dangerouslySetInnerHTML={{ __html: cvScreeningReason || "No CV Analysis available" }}></p>
              </div>
            </div>
          ) : (
            <div className="text-center" style={{ padding: "20px" }}>
              <p style={{ color: "#6B7280" }}>No evaluation notes available.</p>
            </div>
          )}
        </div>
      </div>
      <Tooltip className="career-fit-tooltip fade-in" id="career-fit-tooltip" clickable={true}/>
    </div>
  );
}
