"use client";

import { useState } from "react";
import RoleTypeBadge from "./RoleTypeBadge";
import type { ProgramInterviewSetupForm } from "./ProgramInterviewSetup";

interface ReviewProgramProps {
  programTitle: string;
  roleType: string;
  secretPrompt: string;
  preScreeningQuestions: any[];
  interviewForm: ProgramInterviewSetupForm;
  resolvedWalkthroughLanguage: "english" | "tagalog";
  setCurrentStep: (stepIndex: number) => void;
  fullWidth?: boolean;
}

export default function ReviewProgram({
  programTitle,
  roleType,
  secretPrompt,
  preScreeningQuestions,
  interviewForm,
  resolvedWalkthroughLanguage,
  setCurrentStep,
  fullWidth,
}: ReviewProgramProps) {
  const [expandedSections, setExpandedSections] = useState({
    programDetails: true,
    preScreening: true,
    aiInterview: true,
  });

  const toggleSection = (section: "programDetails" | "preScreening" | "aiInterview") => {
    setExpandedSections((previous) => ({
      ...previous,
      [section]: !previous[section],
    }));
  };

  const totalInterviewQuestions = interviewForm.questions.reduce(
    (accumulator: number, group: any) =>
      accumulator + (group.questions?.length || 0),
    0,
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        ...(fullWidth ? {} : { maxWidth: "900px", margin: "0 auto" }),
      }}
    >
      <div className="layered-card-outer">
        <div className="layered-card-middle">
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
            onClick={() => toggleSection("programDetails")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <i
                className={`la la-angle-${
                  expandedSections.programDetails ? "up" : "down"
                }`}
                style={{ fontSize: 18, color: "#717680" }}
              />
              <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>
                Program Details
              </span>
            </div>
            <button
              style={{
                width: 32,
                height: 32,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background: "#FFFFFF",
                border: "1px solid #E9EAEB",
                borderRadius: "50%",
                cursor: "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentStep(0);
              }}
            >
              <i className="la la-pencil" style={{ fontSize: 16 }} />
            </button>
          </div>

          {expandedSections.programDetails && (
            <div className="layered-card-content">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px 32px",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 14,
                      color: "#414651",
                      fontWeight: 700,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Program Title
                  </span>
                  <span style={{ fontSize: 15, color: "#717680" }}>
                    {programTitle || "Not set"}
                  </span>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: 14,
                      color: "#414651",
                      fontWeight: 700,
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Role Type
                  </span>
                  {roleType ? (
                    <RoleTypeBadge roleType={roleType} />
                  ) : (
                    <span style={{ fontSize: 15, color: "#717680" }}>
                      Not set
                    </span>
                  )}
                </div>
              </div>

              {secretPrompt && (
                <>
                  <div
                    style={{
                      width: "100%",
                      height: "1px",
                      backgroundColor: "#E9EAEB",
                      margin: "12px 0",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: "24px",
                        height: "24px",
                        flexShrink: 0,
                      }}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{
                          position: "absolute",
                          left: "0",
                          top: "2px",
                        }}
                      >
                        <path
                          d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
                          fill="#E9A5C9"
                          opacity="0.8"
                        />
                      </svg>
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{
                          position: "absolute",
                          right: "-2px",
                          top: "-2px",
                        }}
                      >
                        <path
                          d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
                          fill="#9FCAED"
                          opacity="0.7"
                        />
                      </svg>
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{
                          position: "absolute",
                          left: "2px",
                          bottom: "-2px",
                        }}
                      >
                        <path
                          d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
                          fill="#C8B5DA"
                          opacity="0.6"
                        />
                      </svg>
                    </div>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#414651",
                        fontWeight: 700,
                      }}
                    >
                      Secret Candidate Info Prompt
                    </span>
                  </div>
                  <ul
                    style={{
                      margin: "8px 0",
                      paddingLeft: 20,
                      color: "#717680",
                      fontSize: 15,
                    }}
                  >
                    {secretPrompt
                      .split("\n")
                      .map(
                        (line: string, index: number) =>
                          line.trim() && <li key={index}>{line.trim()}</li>,
                      )}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="layered-card-outer">
        <div className="layered-card-middle">
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
            onClick={() => toggleSection("preScreening")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <i
                className={`la la-angle-${
                  expandedSections.preScreening ? "up" : "down"
                }`}
                style={{ fontSize: 18, color: "#717680" }}
              />
              <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>
                Pre-screening Questions
              </span>
            </div>
            <button
              style={{
                width: 32,
                height: 32,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background: "#FFFFFF",
                border: "1px solid #E9EAEB",
                borderRadius: "50%",
                cursor: "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentStep(1);
              }}
            >
              <i className="la la-pencil" style={{ fontSize: 16 }} />
            </button>
          </div>

          {expandedSections.preScreening && (
            <div className="layered-card-content">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#414651",
                  }}
                >
                  Pre-Screening Questions
                </span>
                <span
                  style={{
                    backgroundColor: "#F8F9FC",
                    color: "#363F72",
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 700,
                    border: "1px solid #D5D9EB",
                  }}
                >
                  {preScreeningQuestions.length}
                </span>
              </div>
              {preScreeningQuestions.length > 0 ? (
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: 20,
                    color: "#717680",
                    fontSize: 15,
                  }}
                >
                  {preScreeningQuestions.map((question: any, index: number) => (
                    <li key={index} style={{ marginBottom: 8 }}>
                      {question.question}
                      {question.answers && question.answers.length > 0 && (
                        <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                          {question.answers.map((answer: any, ansIndex: number) => (
                            <li key={ansIndex}>{answer.value}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <span style={{ fontSize: 15, color: "#717680" }}>
                  No pre-screening questions added.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="layered-card-outer">
        <div className="layered-card-middle">
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
            onClick={() => toggleSection("aiInterview")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <i
                className={`la la-angle-${
                  expandedSections.aiInterview ? "up" : "down"
                }`}
                style={{ fontSize: 18, color: "#717680" }}
              />
              <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>
                AI Interview Setup
              </span>
            </div>
            <button
              style={{
                width: 32,
                height: 32,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background: "#FFFFFF",
                border: "1px solid #E9EAEB",
                borderRadius: "50%",
                cursor: "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentStep(2);
              }}
            >
              <i className="la la-pencil" style={{ fontSize: 16 }} />
            </button>
          </div>

          {expandedSections.aiInterview && (
            <div className="layered-card-content">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}>
                  Require Video on Interview
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 15,
                      color: "#717680",
                      fontWeight: 400,
                    }}
                  >
                    {interviewForm.requireVideo ? "Yes" : "No"}
                  </span>
                  {interviewForm.requireVideo && (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        backgroundColor: "#ECFDF5",
                        border: "1px solid #A7F3D0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <i
                        className="la la-check"
                        style={{
                          color: "#10B981",
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  width: "100%",
                  height: "1px",
                  backgroundColor: "#E9EAEB",
                  margin: "12px 0",
                }}
              />

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}>
                  AI Interview Language
                </span>
                <span style={{ fontSize: 15, color: "#717680", fontWeight: 400 }}>
                  {interviewForm.aiInterviewLanguage || "English"}
                </span>
              </div>

              <div
                style={{
                  width: "100%",
                  height: "1px",
                  backgroundColor: "#E9EAEB",
                  margin: "12px 0",
                }}
              />

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}>
                  AI Interview Video Walkthrough
                </span>
                <span style={{ fontSize: 15, color: "#717680", fontWeight: 400 }}>
                  {resolvedWalkthroughLanguage === "tagalog"
                    ? "Tagalog"
                    : "English (Default)"}
                </span>
              </div>

              {interviewForm.interviewSecretPrompt && (
                <>
                  <div
                    style={{
                      width: "100%",
                      height: "1px",
                      backgroundColor: "#E9EAEB",
                      margin: "12px 0",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: "24px",
                        height: "24px",
                        flexShrink: 0,
                      }}
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{
                          position: "absolute",
                          left: "0",
                          top: "2px",
                        }}
                      >
                        <path
                          d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
                          fill="#E9A5C9"
                          opacity="0.8"
                        />
                      </svg>
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{
                          position: "absolute",
                          right: "-2px",
                          top: "-2px",
                        }}
                      >
                        <path
                          d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
                          fill="#9FCAED"
                          opacity="0.7"
                        />
                      </svg>
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 24 24"
                        fill="none"
                        style={{
                          position: "absolute",
                          left: "2px",
                          bottom: "-2px",
                        }}
                      >
                        <path
                          d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
                          fill="#C8B5DA"
                          opacity="0.6"
                        />
                      </svg>
                    </div>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#414651",
                        fontWeight: 700,
                      }}
                    >
                      AI Interview Secret Prompt
                    </span>
                  </div>
                  <ul
                    style={{
                      margin: "8px 0",
                      paddingLeft: 20,
                      color: "#717680",
                      fontSize: 15,
                    }}
                  >
                    {interviewForm.interviewSecretPrompt
                      .split("\n")
                      .map(
                        (line: string, index: number) =>
                          line.trim() && <li key={index}>{line.trim()}</li>,
                      )}
                  </ul>
                </>
              )}

              <div
                style={{
                  width: "100%",
                  height: "1px",
                  backgroundColor: "#E9EAEB",
                  margin: "12px 0",
                }}
              />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: "#414651" }}>
                  Interview Questions
                </span>
                <span
                  style={{
                    backgroundColor: "#F8F9FC",
                    color: "#363F72",
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 700,
                    border: "1px solid #D5D9EB",
                  }}
                >
                  {totalInterviewQuestions}
                </span>
              </div>

              {interviewForm.questions.map(
                (questionGroup: any, groupIndex: number) =>
                  questionGroup.questions.length > 0 && (
                    <div key={groupIndex} style={{ marginBottom: 12 }}>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#717680",
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        {questionGroup.category}
                      </span>
                      <ol
                        style={{
                          margin: 0,
                          paddingLeft: 40,
                          color: "#717680",
                          fontSize: 15,
                        }}
                      >
                        {questionGroup.questions.map(
                          (question: any, qIndex: number) => (
                            <li key={qIndex} style={{ marginBottom: 4 }}>
                              {question.question}
                            </li>
                          ),
                        )}
                      </ol>
                    </div>
                  ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
