"use client";

import React, { useState } from "react";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import { TALENT_VAULT_ROLE_TYPES } from "./roleTypePresentation";

const REQUIRED_FIELD_MESSAGE = "This is a required field.";
const roleTypeOptions = TALENT_VAULT_ROLE_TYPES.map((roleType) => ({ name: roleType }));

export interface ProgramDetailsSetupHandle {
  validateStep: () => boolean;
}

interface ProgramDetailsSetupProps {
  programTitle: string;
  roleType: string;
  secretPrompt: string;
  onProgramTitleChange: (value: string) => void;
  onRoleTypeChange: (value: string) => void;
  onSecretPromptChange: (value: string) => void;
  onFieldUpdate?: () => void;
}

const ProgramDetailsSetup = React.forwardRef<
  ProgramDetailsSetupHandle,
  ProgramDetailsSetupProps
>(function ProgramDetailsSetup(
  {
    programTitle,
    roleType,
    secretPrompt,
    onProgramTitleChange,
    onRoleTypeChange,
    onSecretPromptChange,
    onFieldUpdate,
  },
  ref,
) {
  const [validationErrors, setValidationErrors] = useState({
    programTitle: false,
    roleType: false,
  });

  React.useImperativeHandle(ref, () => ({
    validateStep: () => {
      const nextValidationErrors = {
        programTitle: !programTitle.trim(),
        roleType: !roleType.trim(),
      };

      setValidationErrors(nextValidationErrors);

      return !nextValidationErrors.programTitle && !nextValidationErrors.roleType;
    },
  }));

  return (
    <div
      style={{ display: "flex", flexDirection: "row", gap: 16, width: "100%" }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "70%",
        }}
      >
        {/* Main program details section */}
        <div className="layered-card-outer">
          <div className="layered-card-middle">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>
                1. Program Information
              </span>
            </div>
            <div className="layered-card-content">
              <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>
                Basic Information
              </span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 8,
                  width: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "50%",
                  }}
                >
                  <span style={{ marginBottom: 8 }}>Program Title</span>
                    <input
                      value={programTitle}
                      style={{
                        width: "100%",
                      height: "48px",
                      padding: "0.375rem 0.75rem",
                        fontSize: "1rem",
                        lineHeight: "1.5",
                        backgroundColor: "#FFFFFF",
                        border: validationErrors.programTitle
                          ? "1px solid #EF4444"
                          : "1px solid #E9EAEB",
                        borderRadius: "8px",
                      }}
                      placeholder="Enter program title"
                      onChange={(e) => {
                        const nextProgramTitle = e.target.value || "";
                        onProgramTitleChange(nextProgramTitle);

                        onFieldUpdate?.();

                        if (validationErrors.programTitle) {
                          setValidationErrors((previousErrors) => ({
                            ...previousErrors,
                            programTitle: false,
                          }));
                        }
                      }}
                    ></input>
                    {validationErrors.programTitle && (
                      <span
                        style={{
                          marginTop: 4,
                          color: "#EF4444",
                          fontSize: 12,
                          fontWeight: 400,
                        }}
                      >
                        {REQUIRED_FIELD_MESSAGE}
                      </span>
                    )}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "50%",
                  }}
                >
                  <span style={{ marginBottom: 8 }}>Role Type</span>
                  <CustomDropdown
                    onSelectSetting={(rt) => {
                      onRoleTypeChange(rt);
                      onFieldUpdate?.();

                      if (validationErrors.roleType) {
                        setValidationErrors((previousErrors) => ({
                          ...previousErrors,
                          roleType: false,
                        }));
                      }
                    }}
                    screeningSetting={roleType}
                    settingList={roleTypeOptions}
                    placeholder="Choose role type"
                    error={
                      validationErrors.roleType ? REQUIRED_FIELD_MESSAGE : undefined
                    }
                  />
                </div>
              </div>

              {/* Divider */}
              <div
                style={{
                  width: "100%",
                  height: "1px",
                  backgroundColor: "#E9EAEB",
                  marginTop: 16,
                  marginBottom: 16,
                }}
              />

              {/* Secret candidate guidance section */}
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
                  {/* Large pink star */}
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
                  {/* Small blue star */}
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
                  {/* Small purple star */}
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
                  style={{ fontSize: 14, color: "#181D27", fontWeight: 700 }}
                >
                  Secret Candidate Info Prompt{" "}
                  <span style={{ color: "#717680", fontWeight: 400 }}>
                    (optional)
                  </span>
                </span>
                <div
                  style={{
                    position: "relative",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                  className="tooltip-container"
                >
                  <i
                    className="la la-question-circle"
                    style={{
                      fontSize: 18,
                      color: "#9CA3AF",
                      cursor: "help",
                    }}
                  ></i>
                  <div
                    className="tooltip-content"
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 8px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      backgroundColor: "#1F2937",
                      color: "#FFFFFF",
                      padding: "12px 16px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      lineHeight: "1.5",
                      whiteSpace: "normal",
                      width: "420px",
                      maxWidth: "90vw",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                      zIndex: 1000,
                      opacity: 0,
                      visibility: "hidden",
                      transition: "opacity 0.2s, visibility 0.2s",
                      pointerEvents: "none",
                    }}
                  >
                    These prompts remain hidden from candidates and the public
                    job portal. Additionally, only Admins and the Job Owner can
                    view the secret prompt.
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 0,
                        height: 0,
                        borderLeft: "6px solid transparent",
                        borderRight: "6px solid transparent",
                        borderTop: "6px solid #1F2937",
                      }}
                    />
                  </div>
                </div>
              </div>
              <span style={{ fontSize: 14, color: "#717680", fontWeight: 400 }}>
                Secret Prompts give you extra control over Jia's evaluation
                style, complementing her accurate assessment of requirements
                from the job description.
              </span>
              <textarea
                value={secretPrompt}
                onChange={(e) => onSecretPromptChange(e.target.value)}
                placeholder="Enter a secret prompt (e.g. Use this prompts for candidates with interest in design)"
                style={{
                  width: "100%",
                  minHeight: "120px",
                  padding: "12px",
                  fontSize: "14px",
                  lineHeight: "1.5",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E9EAEB",
                  borderRadius: "8px",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tips Sidebar */}
      <div
        className="layered-card-outer"
        style={{
          width: "30%",
          position: "sticky",
          top: "16px",
          alignSelf: "flex-start",
        }}
      >
        <div className="layered-card-middle">
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <i
              className="la la-lightbulb-o"
              style={{
                fontSize: 28,
                background:
                  "linear-gradient(135deg, #E9A5C9 0%, #C8B5DA 50%, #9FCAED 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            ></i>
            <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>
              Tips
            </span>
          </div>
          <div className="layered-card-content">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: "1.6",
                  margin: 0,
                }}
              >
                <span style={{ fontWeight: 700, color: "#181D27" }}>
                  Use clear, standard program titles
                </span>
                <span style={{ color: "#717680" }}>
                  {" "}for better organization (e.g. "Internship" or "Full-time Designer").
                </span>
              </p>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: "1.6",
                  margin: 0,
                }}
              >
                <span style={{ fontWeight: 700, color: "#181D27" }}>
                  Avoid abbreviations
                </span>
                <span style={{ color: "#717680" }}>
                  {" "}or internal role codes to prevent confusion (e.g. Use "Design Internship" instead of "UX int" or "Dev int").
                </span>
              </p>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: "1.6",
                  margin: 0,
                }}
              >
                <span style={{ fontWeight: 700, color: "#181D27" }}>
                  Keep it concise{" "}
                </span>
                <span style={{ color: "#717680" }}>
                  — Program titles should be no more than a few words (2–4 max.) avoiding full or marketing terms.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ProgramDetailsSetup.displayName = "ProgramDetailsSetup";

export default ProgramDetailsSetup;
