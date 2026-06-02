"use client";

import React from "react";
import Container from "../../../../Container";
import Markdown from "react-markdown";
import { DownloadCVButton } from "../../CandidateCVUtils";
import type { CVSection } from "./useCVScreeningData";

type Props = {
  digitalCV: CVSection[] | null;
  cvUploadedAt: string | null;
  cvFileInfo: any | null;
  candidateEmail: string;
  candidateName: string | null;
  fillHeight?: boolean;
};

const getContent = (cvData: CVSection[] | null, sectionName: string): string => {
  if (!cvData || !Array.isArray(cvData)) return "";
  const section = cvData.find((s) => s.name === sectionName);
  return section?.content || "";
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
};

export default function CandidateCV({
  digitalCV,
  cvUploadedAt,
  cvFileInfo,
  candidateEmail,
  candidateName,
  fillHeight = false,
}: Props) {
  const hasCV = digitalCV && digitalCV.length > 0;
  const uploadDateStr = formatDate(cvUploadedAt);

  if (!hasCV) {
    return (
      <Container
        title={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: "#101828" }}>
              Candidate CV
            </span>
            <DownloadCVButton
              candidateEmail={candidateEmail}
              candidateName={candidateName || undefined}
              digitalCV={[]}
              disabled={true}
            />
          </div>
        }
        fillHeight={fillHeight}
      >
        <div style={{ fontSize: 14, color: "#667085", fontStyle: "italic" }}>
          No CV uploaded for this candidate.
        </div>
      </Container>
    );
  }

  const experience = getContent(digitalCV, "Experience");
  const education = getContent(digitalCV, "Education");
  const certifications = getContent(digitalCV, "Certifications");
  const projects = getContent(digitalCV, "Projects");
  const awards = getContent(digitalCV, "Awards");

  return (
    <Container
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: "#101828" }}>
            Candidate CV{" "}
            {uploadDateStr && (
              <span style={{ color: "#98A2B3", fontWeight: 400 }}>(Uploaded: {uploadDateStr})</span>
            )}
          </span>
          <DownloadCVButton
            candidateEmail={candidateEmail}
            candidateName={candidateName || undefined}
            digitalCV={digitalCV}
          />
        </div>
      }
      fillHeight={fillHeight}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24, ...(fillHeight && { flex: 1 }) }}>
        {/* Experience */}
        <div>
          <h4 style={{ fontSize: 16, fontWeight: 600, color: "#101828", margin: "0 0 12px 0" }}>Experience</h4>
          {experience ? (
            <div style={{ fontSize: 14, lineHeight: "20px", color: "#475467" }}>
              <Markdown>{experience}</Markdown>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: "#667085", fontStyle: "italic" }}>No experience provided in CV.</div>
          )}
        </div>

        <div style={{ height: 1, background: "#EAECF0" }} />

        {/* Education */}
        <div>
          <h4 style={{ fontSize: 16, fontWeight: 600, color: "#101828", margin: "0 0 12px 0" }}>Education</h4>
          {education ? (
            <div style={{ fontSize: 14, lineHeight: "20px", color: "#475467" }}>
              <Markdown>{education}</Markdown>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: "#667085", fontStyle: "italic" }}>No education provided in CV.</div>
          )}
        </div>

        <div style={{ height: 1, background: "#EAECF0" }} />

        {/* Certifications */}
        <div>
          <h4 style={{ fontSize: 16, fontWeight: 600, color: "#101828", margin: "0 0 12px 0" }}>Certifications</h4>
          {certifications ? (
            <div style={{ fontSize: 14, lineHeight: "20px", color: "#475467" }}>
              <Markdown>{certifications}</Markdown>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: "#667085", fontStyle: "italic" }}>No certifications provided in CV.</div>
          )}
        </div>

        <div style={{ height: 1, background: "#EAECF0" }} />

        {/* Projects */}
        <div>
          <h4 style={{ fontSize: 16, fontWeight: 600, color: "#101828", margin: "0 0 12px 0" }}>Projects</h4>
          {projects ? (
            <div style={{ fontSize: 14, lineHeight: "20px", color: "#475467" }}>
              <Markdown>{projects}</Markdown>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: "#667085", fontStyle: "italic" }}>No projects provided in CV.</div>
          )}
        </div>

        <div style={{ height: 1, background: "#EAECF0" }} />

        {/* Awards */}
        <div>
          <h4 style={{ fontSize: 16, fontWeight: 600, color: "#101828", margin: "0 0 12px 0" }}>Awards</h4>
          {awards ? (
            <div style={{ fontSize: 14, lineHeight: "20px", color: "#475467" }}>
              <Markdown>{awards}</Markdown>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: "#667085", fontStyle: "italic" }}>No awards provided in CV.</div>
          )}
        </div>
      </div>
    </Container>
  );
}
