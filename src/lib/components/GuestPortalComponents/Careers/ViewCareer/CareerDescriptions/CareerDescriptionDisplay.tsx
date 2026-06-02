"use client";

import React, { useState } from "react";

// Types for career data
export interface TeamMember {
  name: string;
  email: string;
  role: string;
  image?: string;
  profilePicture?: string;
}

export interface PreScreeningQuestion {
  question: string;
  answers?: { value: string }[];
}

export interface InterviewQuestion {
  question: string;
}

export interface QuestionGroup {
  category: string;
  questions: InterviewQuestion[];
}

export interface Substage {
  id: string;
  name: string;
  currentStep?: string;
  status?: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  alias?: string;
  icon?: string;
  substages: Substage[];
}

export interface CareerDescriptionData {
  _id?: string;
  jobTitle?: string;
  description?: string;
  employmentType?: string;
  workSetup?: string;
  country?: string;
  province?: string;
  location?: string;
  minimumSalary?: string | number;
  maximumSalary?: string | number;
  salaryNegotiable?: boolean;
  screeningSetting?: string;
  cvSecretPrompt?: string;
  interviewSecretPrompt?: string;
  requireVideo?: boolean;
  walkthroughLanguage?: "english" | "tagalog";
  preScreeningQuestions?: PreScreeningQuestion[];
  questions?: QuestionGroup[];
  pipelineStages?: PipelineStage[];
  teamMembers?: TeamMember[];
  createdBy?: {
    name: string;
    email: string;
    image?: string;
  };
}

interface CareerDescriptionDisplayProps {
  data: CareerDescriptionData;
}

function displayText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : "—";
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && value && "name" in (value as any)) {
    const name = (value as any).name;
    return displayText(name);
  }
  return "—";
}

// Sparkle icon component
function SparkleIcon() {
  return (
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
  );
}

// Section card wrapper
function SectionCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E9EAEB",
        borderRadius: 16,
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Collapsible section header
function SectionHeader({
  title,
  expanded,
  onToggle,
  count,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  count?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
      }}
      onClick={onToggle}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <i
          className={`la la-angle-${expanded ? "up" : "down"}`}
          style={{ fontSize: 18, color: "#717680" }}
        />
        <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>
          {title}
        </span>
        {count !== undefined && (
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
            {count}
          </span>
        )}
      </div>
    </div>
  );
}

// Divider component
function Divider() {
  return (
    <div
      style={{
        width: "100%",
        height: "1px",
        backgroundColor: "#E9EAEB",
        margin: "12px 0",
      }}
    />
  );
}

// Fit badge component
function FitBadge({ value }: { value: string }) {
  return (
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
      {value}
    </span>
  );
}

export default function CareerDescriptionDisplay({
  data,
}: CareerDescriptionDisplayProps) {
  const [expandedSections, setExpandedSections] = useState({
    careerDetails: true,
    cvReview: true,
    aiInterview: true,
    pipelineStages: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const pipelineStages = Array.isArray(data.pipelineStages) 
    ? data.pipelineStages.filter((stage: any) => stage?.enabled !== false) 
    : [];

  const totalQuestions =
    data.questions?.reduce(
      (acc, group) => acc + (group.questions?.length || 0),
      0
    ) || 0;

  return (
    <div style={{ display: "flex", gap: 24 }}>
      {/* Left Column */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minWidth: 0,
        }}
      >
        {/* Career Details */}
        <SectionCard>
          <SectionHeader
            title="Career Details"
            expanded={expandedSections.careerDetails}
            onToggle={() => toggleSection("careerDetails")}
          />

          {expandedSections.careerDetails && (
            <div style={{ marginTop: 16 }}>
              {/* Job Title - Full Width */}
              <div style={{ marginBottom: 4 }}>
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
                  {displayText(data.jobTitle)}
                </span>
              </div>

              <Divider />

              {/* Row: Employment Type | Work Arrangement | Country */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 32,
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
                    Employment Type
                  </span>
                  <span style={{ fontSize: 15, color: "#717680" }}>
                    {displayText(data.employmentType)}
                  </span>
                </div>
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
                    {displayText(data.workSetup)}
                  </span>
                </div>
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
                    Country
                  </span>
                  <span style={{ fontSize: 15, color: "#717680" }}>
                    {displayText(data.country)}
                  </span>
                </div>
              </div>

              <Divider />

              {/* Row: State/Province | City */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 32,
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
                    State / Province
                  </span>
                  <span style={{ fontSize: 15, color: "#717680" }}>
                    {displayText(data.province)}
                  </span>
                </div>
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
                    City
                  </span>
                  <span style={{ fontSize: 15, color: "#717680" }}>
                    {displayText(data.location)}
                  </span>
                </div>
                <div></div>
              </div>

              {/* Row: Minimum Salary | Maximum Salary */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 32,
                  marginTop: 12,
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
                    Minimum Salary
                  </span>
                  <span style={{ fontSize: 15, color: "#717680" }}>
                    {data.salaryNegotiable === true
                      ? "Negotiable"
                      : data.minimumSalary !== undefined && data.minimumSalary !== null && String(data.minimumSalary).trim() !== ""
                      ? `₱${data.minimumSalary}`
                      : "—"}
                  </span>
                </div>
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
                    {data.salaryNegotiable === true
                      ? "Negotiable"
                      : data.maximumSalary !== undefined && data.maximumSalary !== null && String(data.maximumSalary).trim() !== ""
                      ? `₱${data.maximumSalary}`
                      : "—"}
                  </span>
                </div>
                <div></div>
              </div>

              <Divider />

              <span style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}>
                Job Description
              </span>
              {data.description ? (
                <div
                  style={{
                    fontSize: 15,
                    color: "#717680",
                    lineHeight: 1.6,
                    marginTop: 8,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: data.description,
                  }}
                />
              ) : (
                <div
                  style={{
                    fontSize: 15,
                    color: "#717680",
                    lineHeight: 1.6,
                    marginTop: 8,
                  }}
                >
                  —
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* CV Review & Pre-Screening Questions */}
        <SectionCard>
          <SectionHeader
            title="CV Review & Pre-Screening Questions"
            expanded={expandedSections.cvReview}
            onToggle={() => toggleSection("cvReview")}
          />

          {expandedSections.cvReview && (
            <div style={{ marginTop: 16 }}>
              <span style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}>
                CV Screening
              </span>
              <div style={{ marginTop: 4 }}>
                <span
                  style={{ fontSize: 15, color: "#717680", fontWeight: 400 }}
                >
                  Automatically endorse candidates who are{" "}
                  <FitBadge
                    value={
                      displayText(data.screeningSetting?.replace(" and above", ""))
                    }
                  />
                </span>
              </div>

              {data.cvSecretPrompt && (
                <>
                  <Divider />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <SparkleIcon />
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
                    {data.cvSecretPrompt
                      .split("\n")
                      .map(
                        (line, index) =>
                          line.trim() && <li key={index}>{line.trim()}</li>
                      )}
                  </ul>
                </>
              )}

              {data.preScreeningQuestions &&
                data.preScreeningQuestions.length > 0 && (
                  <>
                    <Divider />
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
                        {data.preScreeningQuestions.length}
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
                      {data.preScreeningQuestions.map((question, index) => (
                        <li key={index} style={{ marginBottom: 8 }}>
                          {question.question}
                          {question.answers && question.answers.length > 0 && (
                            <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                              {question.answers.map((answer, ansIndex) => (
                                <li key={ansIndex}>{answer.value}</li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ol>
                  </>
                )}
            </div>
          )}
        </SectionCard>

        {/* AI Interview Setup */}
        <SectionCard>
          <SectionHeader
            title="AI Interview Setup"
            expanded={expandedSections.aiInterview}
            onToggle={() => toggleSection("aiInterview")}
          />

          {expandedSections.aiInterview && (
            <div style={{ marginTop: 16 }}>
              <span style={{ fontSize: 14, color: "#414651", fontWeight: 700 }}>
                AI Interview Screening
              </span>
              <div style={{ marginTop: 4 }}>
                <span
                  style={{ fontSize: 15, color: "#717680", fontWeight: 400 }}
                >
                  Automatically endorse candidates who are{" "}
                  <FitBadge
                    value={
                      displayText(data.screeningSetting?.replace(" and above", ""))
                    }
                  />
                </span>
              </div>

              <Divider />

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
                    style={{
                      fontSize: 15,
                      color: "#717680",
                      fontWeight: 400,
                    }}
                  >
                    {data.requireVideo === true ? "Yes" : data.requireVideo === false ? "No" : "—"}
                  </span>
                  {data.requireVideo === true && (
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
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <Divider />

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
                  style={{
                    fontSize: 15,
                    color: "#717680",
                    fontWeight: 400,
                  }}
                >
                  {(data.walkthroughLanguage ?? "english") === "tagalog"
                    ? "Tagalog"
                    : "English (Default)"}
                </span>
              </div>

              {data.interviewSecretPrompt && (
                <>
                  <Divider />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <SparkleIcon />
                    <span
                      style={{
                        fontSize: 14,
                        color: "#414651",
                        fontWeight: 700,
                      }}
                    >
                      Interview Secret Prompt
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
                    {data.interviewSecretPrompt
                      .split("\n")
                      .map(
                        (line, index) =>
                          line.trim() && <li key={index}>{line.trim()}</li>
                      )}
                  </ul>
                </>
              )}

              {data.questions && totalQuestions > 0 && (
                <>
                  <Divider />
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
                      {totalQuestions}
                    </span>
                  </div>
                  {data.questions.map(
                    (group, groupIndex) =>
                      group.questions &&
                      group.questions.length > 0 && (
                        <div key={groupIndex} style={{ marginBottom: 12 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: "#414651",
                              marginBottom: 4,
                            }}
                          >
                            {group.category}
                          </div>
                          <ol
                            style={{
                              margin: 0,
                              paddingLeft: 20,
                              color: "#717680",
                              fontSize: 15,
                            }}
                          >
                            {group.questions.map((q, qIndex) => (
                              <li key={qIndex} style={{ marginBottom: 4 }}>
                                {q.question}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )
                  )}
                </>
              )}
            </div>
          )}
        </SectionCard>

        {/* Pipeline Stages */}
        <SectionCard>
          <SectionHeader
            title="Pipeline Stages"
            expanded={expandedSections.pipelineStages}
            onToggle={() => toggleSection("pipelineStages")}
            count={pipelineStages.length}
          />

          {expandedSections.pipelineStages && (
            <div style={{ marginTop: 16 }}>
              {pipelineStages.length === 0 ? (
                <div style={{ color: "#717680", fontSize: 15 }}>
                  —
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    overflowX: "auto",
                    paddingBottom: 8,
                  }}
                >
                  {pipelineStages.map((stage, index) => (
                    <div
                      key={stage.id || index}
                      style={{
                        background: "#F9FAFB",
                        border: "1px solid #E9EAEB",
                        borderRadius: 12,
                        padding: 20,
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        minWidth: 280,
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {stage.icon ? (
                          <i className={stage.icon} style={{ fontSize: 20, color: "#414651" }} />
                        ) : null}
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "#181D27",
                          }}
                        >
                          {displayText(stage.alias || stage.name)}
                        </span>
                      </div>
                      {stage.substages && stage.substages.length > 0 && (
                        <>
                          <span
                            style={{
                              fontSize: 13,
                              color: "#717680",
                              fontWeight: 500,
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
                            {stage.substages.map((substage, subIndex) => (
                              <div
                                key={substage.id || subIndex}
                                style={{
                                  background: "#FFFFFF",
                                  border: "1px solid #E9EAEB",
                                  borderRadius: 8,
                                  padding: "10px 12px",
                                  fontSize: 14,
                                  color: "#414651",
                                }}
                              >
                                {displayText(substage.name)}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Right Column */}
      <div
        style={{
          width: 360,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          flexShrink: 0,
        }}
      >
        {/* Team Access */}
        <SectionCard>
          <span
            style={{
              fontSize: 16,
              color: "#414651",
              fontWeight: 700,
              display: "block",
              marginBottom: 16,
            }}
          >
            Team Access
          </span>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.teamMembers && data.teamMembers.length > 0 ? (
              data.teamMembers
                .filter(
                  (member, index, self) =>
                    index === self.findIndex((m) => m.email === member.email)
                )
                .map((member, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    {member.image || member.profilePicture ? (
                      <img
                        src={member.image || member.profilePicture}
                        alt={member.name}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 38,
                          height: 38,
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
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: "#181D27",
                          marginBottom: 2,
                        }}
                      >
                        {member.name}
                      </div>
                      <div style={{ fontSize: 14, color: "#717680" }}>
                        {member.email}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: "#717680",
                        fontWeight: 400,
                      }}
                    >
                      {member.role}
                    </div>
                  </div>
                ))
            ) : data.createdBy ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img
                  src={data.createdBy.image || "/user-profile.png"}
                  alt={data.createdBy.name}
                  style={{ width: 38, height: 38, borderRadius: "50%" }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#181D27",
                      marginBottom: 2,
                    }}
                  >
                    {data.createdBy.name}
                  </div>
                  <div style={{ fontSize: 14, color: "#717680" }}>
                    {data.createdBy.email}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "#717680",
                    fontWeight: 400,
                  }}
                >
                  Job Owner
                </div>
              </div>
            ) : (
              <span style={{ fontSize: 14, color: "#717680" }}>
                No team members added
              </span>
            )}
          </div>
        </SectionCard>

        {/* Career Link */}
        {data._id && (
          <SectionCard>
            <span
              style={{
                fontSize: 16,
                color: "#414651",
                fontWeight: 700,
                display: "block",
                marginBottom: 12,
              }}
            >
              Career Link
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  flex: 1,
                  background: "#F9FAFB",
                  border: "1px solid #E9EAEB",
                  borderRadius: 8,
                  padding: "12px 16px",
                  fontSize: 14,
                  color: "#717680",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {typeof window !== "undefined"
                  ? `${window.location.origin}/job-openings/${data._id}`
                  : `/job-openings/${data._id}`}
              </div>
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={() => {
                  const link =
                    typeof window !== "undefined"
                      ? `${window.location.origin}/job-openings/${data._id}`
                      : "";
                  if (link) {
                    navigator.clipboard.writeText(link);
                  }
                }}
              >
                <i
                  className="la la-copy"
                  style={{ fontSize: 24, color: "#717680" }}
                />
              </button>
            </div>
          </SectionCard>
        )}

        {/* Direct Interview Link */}
        {data._id && (
          <SectionCard>
            <span
              style={{
                fontSize: 16,
                color: "#414651",
                fontWeight: 700,
                display: "block",
                marginBottom: 12,
              }}
            >
              Direct Interview Link
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  flex: 1,
                  background: "#F9FAFB",
                  border: "1px solid #E9EAEB",
                  borderRadius: 8,
                  padding: "12px 16px",
                  fontSize: 14,
                  color: "#717680",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {typeof window !== "undefined"
                  ? `${window.location.origin}/direct-interview/${data._id}`
                  : `/direct-interview/${data._id}`}
              </div>
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={() => {
                  const link =
                    typeof window !== "undefined"
                      ? `${window.location.origin}/direct-interview/${data._id}`
                      : "";
                  if (link) {
                    navigator.clipboard.writeText(link);
                  }
                }}
              >
                <i
                  className="la la-copy"
                  style={{ fontSize: 24, color: "#717680" }}
                />
              </button>
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#98A2B3",
                marginTop: 8,
                textAlign: "center",
              }}
            >
              Share the link to an applicant for a direct interview.
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
