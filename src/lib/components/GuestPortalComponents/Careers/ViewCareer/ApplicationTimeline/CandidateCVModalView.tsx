"use client";

import React from "react";
import Markdown from "react-markdown";
import { DownloadCVButton } from "../CandidateCVUtils";

type CandidateCVMini = {
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
};

type Props = {
  candidate: CandidateCVMini;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
  cvData: any[];
};

export default function CandidateCVModalView({ candidate, onClose, isLoading, error, cvData }: Props) {
  const getContent = React.useCallback(
    (name: string) => {
      const section = cvData?.find((section: any) => section?.name === name);
      return section?.content?.split(`**${name}**`)[1]?.trim() || section?.content?.trim();
    },
    [cvData]
  );

  return (
    <div className="modal-background fade-in-bottom">
      <div className="modal-container">
        <div
          className="modal-content"
          style={{
            overflowY: "auto",
            maxHeight: "80vh",
            maxWidth: "80vw",
            background: "#fff",
            border: `1.5px solid #E9EAEB`,
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(30,32,60,0.18)",
          }}
        >
          <div className="modal-header">
            <h3 className="modal-title">Candidate CV</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <DownloadCVButton
                candidateEmail={candidate?.email || ""}
                candidateName={candidate?.name || undefined}
                digitalCV={cvData}
                variant="link"
              />
              <button style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => onClose()}>
                <i className="la la-times"></i>
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="modal-body">
              <div className="text-center">
                <div className="skeleton-bar" style={{ width: "100%", height: "50px" }}></div>

                <div className="mb-3" style={{ marginTop: 16 }}>
                  <div className="skeleton-bar" style={{ width: "100%", height: "20px" }}></div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", flexDirection: "row", gap: 16 }}>
                  <div
                    style={{
                      width: "60%",
                      display: "flex",
                      flexDirection: "column",
                      borderRight: "1px solid #E9EAEB",
                      paddingRight: "16px",
                    }}
                  >
                    {[...Array(4)].map((_, index) => (
                      <div key={index} style={{ marginBottom: 16 }}>
                        <div className="skeleton-bar" style={{ width: "30%", height: "20px", marginBottom: 8 }}></div>
                        <div className="skeleton-bar" style={{ width: "100%", height: "20px" }}></div>
                      </div>
                    ))}
                  </div>
                  <div style={{ width: "40%", display: "flex", flexDirection: "column" }}>
                    {[...Array(4)].map((_, index) => (
                      <div key={index} style={{ marginBottom: 16 }}>
                        <div className="skeleton-bar" style={{ width: "30%", height: "20px", marginBottom: 8 }}></div>
                        <div className="skeleton-bar" style={{ width: "100%", height: "20px" }}></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="modal-body">
              <div className="text-center">
                <h3>Failed to load CV</h3>
                <div style={{ color: "#667085" }}>{error}</div>
              </div>
            </div>
          ) : Array.isArray(cvData) && cvData.length > 0 ? (
            <div className="modal-body">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                  borderRadius: 8,
                  border: "1px solid #E9EAEB",
                  padding: "16px 24px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <img
                    alt={candidate?.name || "Candidate"}
                    src={candidate?.avatar || ""}
                    style={{ width: 48, height: 48, borderRadius: "50%", background: "#E0E0E0" }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{candidate?.name || "—"}</div>
                    <div style={{ fontSize: 12, color: "#787486" }}>{candidate?.email || "—"}</div>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <h3>Introduction</h3>
                {getContent("Introduction") || "No introduction provided in CV"}
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", flexDirection: "row", gap: 16 }}>
                <div
                  style={{
                    width: "60%",
                    display: "flex",
                    flexDirection: "column",
                    borderRight: "1px solid #E9EAEB",
                    paddingRight: "16px",
                  }}
                >
                  <div>
                    <h3>Current Position</h3>
                    <Markdown>{getContent("Current Position") || "No current position provided in CV"}</Markdown>
                  </div>
                  <div style={{ width: "100%", height: "1px", background: "#E9EAEB", margin: "16px 0" }}></div>
                  <div>
                    <h3>Experience</h3>
                    <Markdown>{getContent("Experience") || "No experience provided in CV"}</Markdown>
                  </div>
                  <div style={{ width: "100%", height: "1px", background: "#E9EAEB", margin: "16px 0" }}></div>
                  <div>
                    <h3>Education</h3>
                    <Markdown>{getContent("Education") || "No education provided in CV"}</Markdown>
                  </div>
                  <div style={{ width: "100%", height: "1px", background: "#E9EAEB", margin: "16px 0" }}></div>
                  <div>
                    <h3>Skills</h3>
                    <Markdown>{getContent("Skills") || "No skills provided in CV"}</Markdown>
                  </div>
                </div>

                <div style={{ width: "40%", display: "flex", flexDirection: "column" }}>
                  <div>
                    <h3>Contact Information</h3>
                    <Markdown>{getContent("Contact Info") || "No contact information provided in CV"}</Markdown>
                  </div>
                  <div style={{ width: "100%", height: "1px", background: "#E9EAEB", margin: "16px 0" }}></div>
                  <div>
                    <h3>Certifications</h3>
                    <Markdown>{getContent("Certifications") || "No certifications provided in CV"}</Markdown>
                  </div>
                  <div style={{ width: "100%", height: "1px", background: "#E9EAEB", margin: "16px 0" }}></div>
                  <div>
                    <h3>Projects</h3>
                    <Markdown>{getContent("Projects") || "No projects provided in CV"}</Markdown>
                  </div>
                  <div style={{ width: "100%", height: "1px", background: "#E9EAEB", margin: "16px 0" }}></div>
                  <div>
                    <h3>Awards</h3>
                    <Markdown>{getContent("Awards") || "No awards provided in CV"}</Markdown>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="modal-body">
              <div className="text-center">
                <h3>Applicant has no uploaded CV</h3>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
