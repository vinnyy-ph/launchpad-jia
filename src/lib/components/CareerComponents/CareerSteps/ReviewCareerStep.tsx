"use client";

import React, { useState } from "react";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import PricingPlanBadge from "@/lib/components/AdminComponents/PricingPlans/PricingPlanBadge";
import { isStageEnabled, getEnabledStages } from "@/lib/Utils";
import {
  END_TO_END_LABEL,
  LINKED_CAREER_LABEL,
  PARENT_POST_LABEL,
  CHILD_POST_LABEL,
} from "@/lib/utils/careerPostType";

interface ReviewCareerStepProps {
  careerForm: any;
  jobPipeline: any[];
  setCurrentStep: (stepIndex: number) => void;
  preScreeningQuestions: any[];
  teamMembers: any[];
}

export default function ReviewCareerStep({
  careerForm,
  jobPipeline,
  setCurrentStep,
  preScreeningQuestions,
  teamMembers,
}: ReviewCareerStepProps) {
  const [activeOrg] = useLocalStorage("activeOrg", null);
  const [expandedSections, setExpandedSections] = useState<{
    [key: string]: boolean;
  }>({
    careerDetails: true,
    cvReview: true,
    aiInterview: true,
    pipelineStages: true,
  });
  const [showJobPostTypeTooltip, setShowJobPostTypeTooltip] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section],
    });
  };

  const isCVScreeningEnabled = () => {
    const cvStage = jobPipeline.find((s) => s.id === "1");
    return cvStage?.enabled !== false;
  };

  const isAIInterviewEnabled = () => {
    const aiStage = jobPipeline.find((s) => s.id === "2");
    return aiStage?.enabled !== false;
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      {/* Career Details & Team Access */}
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
            onClick={() => toggleSection("careerDetails")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <i
                className={`la la-angle-${
                  expandedSections.careerDetails ? "up" : "down"
                }`}
                style={{ fontSize: 18, color: "#717680" }}
              />
              <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>
                Career Details & Team Access
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

          {expandedSections.careerDetails && (
            <div className="layered-card-content">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "12px 32px",
                }}
              >
                {/* Career Posting Type / Category Type row - only when linkedCareersEnabled */}
                {activeOrg?.linkedCareersEnabled && (
                  <>
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
                        Career Posting Type
                      </span>
                      <span style={{ fontSize: 15, color: "#717680" }}>
                        {careerForm.careerPostType === "standalone"
                          ? END_TO_END_LABEL
                          : careerForm.careerPostType === "candidate_pool" || careerForm.careerPostType === "receiving_pool"
                          ? LINKED_CAREER_LABEL
                          : "Not set"}
                      </span>
                    </div>
                    {(careerForm.careerPostType === "candidate_pool" || careerForm.careerPostType === "receiving_pool") && (
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
                          Category Type
                        </span>
                        <span style={{ fontSize: 15, color: "#717680" }}>
                          {careerForm.careerPostType === "candidate_pool"
                            ? PARENT_POST_LABEL
                            : CHILD_POST_LABEL}
                        </span>
                      </div>
                    )}
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        height: "1px",
                        backgroundColor: "#E9EAEB",
                      }}
                    />
                  </>
                )}

                {/* Job Title */}
                <div style={{ gridColumn: activeOrg?.linkedCareersEnabled && careerForm.childTitle ? "span 1" : "1 / -1" }}>
                  <span
                    style={{
                      fontSize: 14,
                      color: "#414651",
                      fontWeight: 700,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Job Title
                  </span>
                  <span style={{ fontSize: 15, color: "#717680" }}>
                    {activeOrg?.linkedCareersEnabled && careerForm.childTitle && careerForm.parentCareerTitle
                      ? careerForm.parentCareerTitle
                      : careerForm.jobTitle}
                  </span>
                </div>

                {/* Child Title - only when linked careers enabled and assigned */}
                {activeOrg?.linkedCareersEnabled && careerForm.childTitle && (
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
                      Child Title
                    </span>
                    <span style={{ fontSize: 15, color: "#717680" }}>
                      {careerForm.childTitle}
                    </span>
                  </div>
                )}

                {/* Divider after Job Title */}
                <div
                  style={{
                    gridColumn: "1 / -1",
                    height: "1px",
                    backgroundColor: "#E9EAEB",
                  }}
                />

                {/* Employment Type */}
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
                    Employment Type
                  </span>
                  <span style={{ fontSize: 15, color: "#717680" }}>
                    {careerForm.employmentType}
                  </span>
                </div>

                {/* Work Arrangement */}
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
                    Work Arrangement
                  </span>
                  <span style={{ fontSize: 15, color: "#717680" }}>
                    {careerForm.workSetup}
                  </span>
                </div>

                {/* Job Post Type */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      position: "relative",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        color: "#414651",
                        fontWeight: 700,
                      }}
                    >
                      Job Post Type
                    </span>
                    <span
                      onMouseEnter={() => setShowJobPostTypeTooltip(true)}
                      onMouseLeave={() => setShowJobPostTypeTooltip(false)}
                      onFocus={() => setShowJobPostTypeTooltip(true)}
                      onBlur={() => setShowJobPostTypeTooltip(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        border: "1px solid #D5D7DA",
                        cursor: "pointer",
                        fontSize: 11,
                        color: "#717680",
                        fontWeight: 600,
                      }}
                      tabIndex={0}
                      aria-label="Job post type info"
                    >
                      ?
                    </span>
                    {showJobPostTypeTooltip && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: "100%",
                          left: 0,
                          marginBottom: 8,
                          backgroundColor: "#111827",
                          color: "#FFFFFF",
                          fontSize: 11,
                          fontWeight: 500,
                          padding: "8px 12px",
                          borderRadius: 8,
                          maxWidth: 260,
                          whiteSpace: "normal",
                          lineHeight: 1.4,
                          boxShadow: "0 4px 12px rgba(15, 23, 42, 0.35)",
                          zIndex: 9999,
                        }}
                      >
                        Availability of job post types depends on your organization’s
                        current plan.
                      </div>
                    )}
                  </div>
                  {careerForm.jobPostType ? (
                    <div style={{ marginTop: 2 }}>
                      <PricingPlanBadge schema={careerForm.jobPostType} />
                    </div>
                  ) : (
                    <span style={{ fontSize: 15, color: "#717680" }}>
                      Not set
                    </span>
                  )}
                </div>

                {/* Divider after Employment Type row */}
                <div
                  style={{
                    gridColumn: "1 / -1",
                    height: "1px",
                    backgroundColor: "#E9EAEB",
                  }}
                />

                {/* Country */}
                {/* <div style={{ gridColumn: "1 / -1" }}>
                  <span
                    style={{
                      fontSize: 14,
                      color: "#414651",
                      fontWeight: 700,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Country
                  </span>
                  <span style={{ fontSize: 15, color: "#717680" }}>
                    {careerForm.country}
                  </span>
                </div> */}

                {/* Location */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <span
                    style={{
                      fontSize: 14,
                      color: "#414651",
                      fontWeight: 700,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Location
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, color: "#717680" }}>
                      {careerForm.locationAddress || "Not set"}
                    </span>
                    {activeOrg?.organizationAddress?.find(
                      (addr: any) =>
                        addr.location === careerForm.locationAddress &&
                        addr.isMarkedHQ
                    ) && (
                      <span
                        style={{
                          backgroundColor: "#FCE7F3",
                          color: "#BE185D",
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        HQ
                      </span>
                    )}
                  </div>
                </div>

                {/* Enable Global Hiring */}
                {activeOrg?.globalHiringEnabled !== false && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#414651",
                        fontWeight: 700,
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      Enable Global Hiring?
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, color: "#717680" }}>
                        {careerForm.globalHiringEnabled ? "Yes" : "No"}
                      </span>
                      {careerForm.globalHiringEnabled && (
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
                )}

                {/* Divider after Location row */}
                <div
                  style={{
                    gridColumn: "1 / -1",
                    height: "1px",
                    backgroundColor: "#E9EAEB",
                  }}
                />

                {/* Minimum Salary */}
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
                    Minimum Salary
                  </span>
                  <span style={{ fontSize: 15, color: "#717680" }}>
                    {careerForm.salaryNegotiable
                      ? "Negotiable"
                      : `${careerForm.currency} ${careerForm.minimumSalary}`}
                  </span>
                </div>

                {/* Maximum Salary */}
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
                    Maximum Salary
                  </span>
                  <span style={{ fontSize: 15, color: "#717680" }}>
                    {careerForm.salaryNegotiable
                      ? "Negotiable"
                      : `${careerForm.currency} ${careerForm.maximumSalary}`}
                  </span>
                </div>

                {/* Salary Unit */}
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
                    Salary Unit
                  </span>
                  <span style={{ fontSize: 15, color: "#717680" }}>
                    {careerForm.salaryUnit || "Monthly"}
                  </span>
                </div>

                {/* Divider after Salary row */}
                <div
                  style={{
                    gridColumn: "1 / -1",
                    height: "1px",
                    backgroundColor: "#E9EAEB",
                  }}
                />

                {/* Show salary to applicants */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <span
                    style={{
                      fontSize: 14,
                      color: "#414651",
                      fontWeight: 700,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Show salary to applicants
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, color: "#717680" }}>
                      {careerForm.showSalaryToApplicants ? "Yes" : "No"}
                    </span>
                    {careerForm.showSalaryToApplicants && (
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
              </div>

              <div
                style={{
                  width: "100%",
                  height: "1px",
                  backgroundColor: "#E9EAEB",
                  margin: "12px 0",
                }}
              />

              <span style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}>
                Job Description
              </span>
              <div
                style={{
                  fontSize: 15,
                  color: "#717680",
                  lineHeight: 1.6,
                  marginTop: 8,
                }}
                dangerouslySetInnerHTML={{ __html: careerForm.description }}
              />

              <div
                style={{
                  width: "100%",
                  height: "1px",
                  backgroundColor: "#E9EAEB",
                  margin: "12px 0",
                }}
              />

              {activeOrg?.projectsEnabled && (
                <>
                  <span style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}>
                    Linked Project
                  </span>
                  <span style={{ fontSize: 15, color: "rgb(113, 118, 128)", lineHeight: 1.6, marginTop: 8 }}>
                    {careerForm.project || "No linked project"}
                  </span>

                  <div
                    style={{
                      width: "100%",
                      height: "1px",
                      backgroundColor: "#E9EAEB",
                      margin: "12px 0",
                    }}
                  />
                </>
              )}

              <span style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}>
                Team Access
              </span>
              {teamMembers && teamMembers.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    marginTop: 8,
                  }}
                >
                  {teamMembers
                    .filter(
                      (member: any, index: number, self: any[]) =>
                        index ===
                        self.findIndex((m) => m.email === member.email)
                    )
                    .map((member: any, index: number) => (
                      <div
                        key={index}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          {member.image ? (
                            <img
                              src={member.image}
                              alt={member.name}
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                backgroundColor: "#E9EAEB",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 16,
                                fontWeight: 600,
                                color: "#414651",
                              }}
                            >
                              {member.name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: "#414651",
                              }}
                            >
                              {member.name}
                              {member.role === "Job Owner" && (
                                <span
                                  style={{ color: "#717680", fontWeight: 400 }}
                                >
                                  {" "}
                                  (You)
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 14, color: "#717680" }}>
                              {member.email}
                            </div>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 14,
                            color: "#717680",
                            fontWeight: 400,
                          }}
                        >
                          {member.role}
                        </span>
                      </div>
                    ))}
                </div>
              ) : (
                <span style={{ fontSize: 14, color: "#717680", marginTop: 8 }}>
                  No team members added
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CV Review & Pre-Screening Questions */}
      {isCVScreeningEnabled() && (
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
            onClick={() => toggleSection("cvReview")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <i
                className={`la la-angle-${
                  expandedSections.cvReview ? "up" : "down"
                }`}
                style={{ fontSize: 18, color: "#717680" }}
              />
              <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>
                CV Review & Pre-Screening Questions
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

          {expandedSections.cvReview && (
            <div className="layered-card-content">
              <span style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}>
                CV Screening
              </span>
              <span style={{ fontSize: 15, color: "#717680", fontWeight: 400 }}>
                Automatically endorse candidates who are{" "}
                <span
                  style={{
                    backgroundColor: "#E0F2FE",
                    color: "#0369A1",
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontWeight: 600,
                    fontSize: 14,
                    border: "1px solid #7DD3FC",
                  }}
                >
                  {careerForm.screeningSetting?.replace(" and above", "")}
                </span>
              </span>

              {careerForm.cvSecretPrompt && (
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
                      CV Secret Prompt
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
                    {careerForm.cvSecretPrompt
                      .split("\n")
                      .map(
                        (line: string, index: number) =>
                          line.trim() && <li key={index}>{line.trim()}</li>
                      )}
                  </ul>
                </>
              )}

              {preScreeningQuestions && preScreeningQuestions.length > 0 && (
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
                  <ol
                    style={{
                      margin: 0,
                      paddingLeft: 20,
                      color: "#717680",
                      fontSize: 15,
                    }}
                  >
                    {preScreeningQuestions.map(
                      (question: any, index: number) => (
                        <li key={index} style={{ marginBottom: 8 }}>
                          {question.question}
                          {question.answers && question.answers.length > 0 && (
                            <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                              {question.answers.map(
                                (answer: any, ansIndex: number) => (
                                  <li key={ansIndex}>{answer.value}</li>
                                )
                              )}
                            </ul>
                          )}
                        </li>
                      )
                    )}
                  </ol>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* AI Interview Setup */}
      {isAIInterviewEnabled() && (
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
                setCurrentStep(3);
              }}
            >
              <i className="la la-pencil" style={{ fontSize: 16 }} />
            </button>
          </div>

          {expandedSections.aiInterview && (
            <div className="layered-card-content">
              <span style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}>
                AI Interview Screening
              </span>
              <span style={{ fontSize: 15, color: "#717680", fontWeight: 400 }}>
                Automatically endorse candidates who are{" "}
                <span
                  style={{
                    backgroundColor: "#E0F2FE",
                    color: "#0369A1",
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontWeight: 600,
                    fontSize: 14,
                    border: "1px solid #7DD3FC",
                  }}
                >
                  {careerForm.screeningSetting?.replace(" and above", "")}
                </span>
              </span>

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
                <span
                  style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}
                >
                  Require Video on Interview
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{ fontSize: 15, color: "#717680", fontWeight: 400 }}
                  >
                    {careerForm.requireVideo ? "Yes" : "No"}
                  </span>
                  {careerForm.requireVideo && (
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
                <span
                  style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}
                >
                  AI Interview Language
                </span>
                <span
                  style={{ fontSize: 15, color: "#717680", fontWeight: 400 }}
                >
                  {careerForm.aiInterviewLanguage || "English"}
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
                <span
                  style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}
                >
                  AI Interview Video Walkthrough
                </span>
                <span
                  style={{ fontSize: 15, color: "#717680", fontWeight: 400 }}
                >
                  {(careerForm.walkthroughLanguage ??
                    activeOrg?.walkthroughLanguage ??
                    "english") === "tagalog"
                    ? "Tagalog"
                    : "English (Default)"}
                </span>
              </div>

              {careerForm.interviewSecretPrompt && (
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
                    {careerForm.interviewSecretPrompt
                      .split("\n")
                      .map(
                        (line: string, index: number) =>
                          line.trim() && <li key={index}>{line.trim()}</li>
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
                <span
                  style={{ fontSize: 14, fontWeight: 700, color: "#414651" }}
                >
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
                  {careerForm.questions.reduce(
                    (acc: number, group: any) => acc + group.questions.length,
                    0
                  )}
                </span>
              </div>
              {careerForm.questions?.map(
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
                          )
                        )}
                      </ol>
                    </div>
                  )
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Pipeline Stages */}
      <div className="layered-card-outer" style={{ marginBottom: "32px" }}>
        <div className="layered-card-middle">
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
            }}
            onClick={() => toggleSection("pipelineStages")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <i
                className={`la la-angle-${
                  expandedSections.pipelineStages ? "up" : "down"
                }`}
                style={{ fontSize: 18, color: "#717680" }}
              />
              <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>
                Pipeline Stages
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
                {getEnabledStages(jobPipeline || []).length}
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

          {expandedSections.pipelineStages && (
            <div className="layered-card-content">
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  overflowX: "auto",
                  paddingBottom: 8,
                }}
              >
                {getEnabledStages(jobPipeline || []).map((stage: any, index: number) => (
                  <div
                    key={index}
                    style={{
                      backgroundColor: "#F8F9FC",
                      border: "1px solid #E9EAEB",
                      borderRadius: 8,
                      padding: 16,
                      minWidth: 240,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      <i
                        className={stage.icon}
                        style={{ fontSize: 20, color: "#414651" }}
                      />
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#414651",
                        }}
                      >
                        {stage.alias || stage.name}
                      </span>
                    </div>
                    {stage.substages && stage.substages.length > 0 && (
                      <>
                        <span
                          style={{
                            fontSize: 12,
                            color: "#717680",
                            display: "block",
                            marginBottom: 8,
                          }}
                        >
                          Substages
                        </span>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          {stage.substages.map(
                            (substage: any, subIndex: number) => (
                              <div
                                key={subIndex}
                                style={{
                                  fontSize: 14,
                                  color: "#414651",
                                  padding: "12px",
                                  backgroundColor: "#FFFFFF",
                                  borderRadius: 6,
                                  border: "1px solid #E9EAEB",
                                }}
                              >
                                {substage.name}
                              </div>
                            )
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
