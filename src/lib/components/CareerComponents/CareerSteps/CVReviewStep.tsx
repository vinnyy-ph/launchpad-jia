"use client";

import React, { useEffect, useMemo, useState } from "react";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import { guid } from "@/lib/Utils";
import PreScreeningQuestionCard from "./PreScreeningQuestionCard";
import { Button } from "../../ui";
import { BUILT_IN_PRE_SCREENING_QUESTION_IDS } from "@/lib/components/features/settings/defaultPreScreeningSuggestions";

interface PreScreeningAnswer {
  id: string | number;
  value: string | number;
  type: string;
  dropCandidate?: boolean;
}

interface PreScreeningQuestion {
  id: string | number;
  questionType: string;
  question: string;
  questionFormat: string;
  isAutoFiltering?: boolean;
  screeningRule?: string;
  answers: PreScreeningAnswer[];
}

type SuggestedQuestion = PreScreeningQuestion & { added: boolean };

type SettingsScopeOption = {
  value: string;
  label: string;
};

const clonePreScreeningQuestion = (
  question: PreScreeningQuestion
): PreScreeningQuestion => ({
  ...question,
  id: String(question.id),
  answers: Array.isArray(question.answers)
    ? question.answers.map((answer) => ({ ...answer }))
    : [],
});

const screeningSettingList = [
  {
    name: "Good Fit and above",
    icon: "la la-check",
  },
  {
    name: "Only Strong Fit",
    icon: "la la-check-double",
  },
  {
    name: "No Automatic Promotion",
    icon: "la la-times",
  },
];

interface CVReviewStepProps {
  careerForm: any;
  setCareerForm: (careerForm: any) => void;
  preScreeningQuestions: PreScreeningQuestion[];
  setPreScreeningQuestions: any;
  handleSaveAndContinue: () => void;
  currencyOptions: { name: string; symbol: string }[];
  defaultSuggestedQuestions: PreScreeningQuestion[];
  preScreeningSettingsScopeOptions: SettingsScopeOption[];
  selectedPreScreeningSettingsScope: string;
  selectedPreScreeningSettingsScopeLabel: string;
  onSelectPreScreeningSettingsScope: (scopeValue: string) => void;
  isApplyingPreScreeningSettingsScope: boolean;
}

export default function CVReviewStep({
  careerForm,
  setCareerForm,
  preScreeningQuestions,
  setPreScreeningQuestions,
  handleSaveAndContinue,
  currencyOptions,
  defaultSuggestedQuestions,
  preScreeningSettingsScopeOptions,
  selectedPreScreeningSettingsScope,
  selectedPreScreeningSettingsScopeLabel,
  onSelectPreScreeningSettingsScope,
  isApplyingPreScreeningSettingsScope,
}: CVReviewStepProps) {
  const [isPreScreeningSettingsScopeDropdownOpen, setIsPreScreeningSettingsScopeDropdownOpen] =
    useState(false);
  const [editingQuestionIds, setEditingQuestionIds] = useState<string[]>([]);

  useEffect(() => {
    setEditingQuestionIds((previousEditingQuestionIds) =>
      previousEditingQuestionIds.filter((editingId) =>
        preScreeningQuestions.some((question) => String(question.id) === editingId)
      )
    );
  }, [preScreeningQuestions]);

  const enableQuestionEditing = (questionID: string | number) => {
    const normalizedQuestionID = String(questionID);
    setEditingQuestionIds((previousEditingQuestionIds) => {
      if (previousEditingQuestionIds.includes(normalizedQuestionID)) {
        return previousEditingQuestionIds;
      }

      return [...previousEditingQuestionIds, normalizedQuestionID];
    });
  };

  const disableQuestionEditing = (questionID: string | number) => {
    const normalizedQuestionID = String(questionID);
    setEditingQuestionIds((previousEditingQuestionIds) =>
      previousEditingQuestionIds.filter((editingId) => editingId !== normalizedQuestionID)
    );
  };

  const suggestedQuestions = useMemo<SuggestedQuestion[]>(
    () =>
      defaultSuggestedQuestions.map((question) => {
        const normalizedQuestion = clonePreScreeningQuestion(question);
        return {
          ...normalizedQuestion,
          added: preScreeningQuestions.some(
            (existingQuestion) =>
              String(existingQuestion.id) === String(normalizedQuestion.id)
          ),
        };
      }),
    [defaultSuggestedQuestions, preScreeningQuestions]
  );

  const availableSuggestedQuestions = useMemo<SuggestedQuestion[]>(
    () => suggestedQuestions.filter((question) => !question.added),
    [suggestedQuestions]
  );
  const shouldShowPreScreeningSettingsScopeDropdown =
    preScreeningSettingsScopeOptions.length > 1;

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
        {/* CV Review Settings Section */}
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
                1. CV Review Settings
              </span>
            </div>
            <div className="layered-card-content">
              <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>
                CV Screening
              </span>
              <span style={{ fontSize: 14, color: "#717680", fontWeight: 400 }}>
                Jia automatically endorses candidates who meet the chosen
                criteria.
              </span>
              <div style={{ maxWidth: "320px" }}>
                <CustomDropdown
                  onSelectSetting={(setting) => {
                    setCareerForm({
                      ...careerForm,
                      screeningSetting: setting,
                    });
                  }}
                  screeningSetting={careerForm.screeningSetting}
                  settingList={screeningSettingList}
                />
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
                  CV Secret Prompt{" "}
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
                value={careerForm.cvSecretPrompt}
                onChange={(e) => {
                  setCareerForm({
                    ...careerForm,
                    cvSecretPrompt: e.target.value,
                  });
                }}
                placeholder="Enter a secret prompt (e.g. Give higher fit scores to candidates who participate in hackathons or competitions.)"
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

        {/* Pre-Screening Questions Section */}
        <div className="layered-card-outer" style={{ marginBottom: "32px" }}>
          <div className="layered-card-middle">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}
                >
                  2. Pre-Screening Questions
                </span>
                <span
                  style={{ fontSize: 16, color: "#717680", fontWeight: 700 }}
                >
                  (Optional)
                </span>
                <div
                  style={{
                    borderRadius: "20px",
                    border: "1px solid #D5D9EB",
                    backgroundColor: "#F8F9FC",
                    color: "#363F72",
                    fontSize: "12px",
                    padding: "0 10px",
                  }}
                >
                  {preScreeningQuestions?.length || 0}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {shouldShowPreScreeningSettingsScopeDropdown && (
                  <div className="dropdown">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (isApplyingPreScreeningSettingsScope) {
                          return;
                        }

                        setIsPreScreeningSettingsScopeDropdownOpen(
                          !isPreScreeningSettingsScopeDropdownOpen
                        );
                      }}
                      label={
                        isApplyingPreScreeningSettingsScope
                          ? "Applying settings..."
                          : selectedPreScreeningSettingsScopeLabel
                      }
                      icon="/iconsV2/chevron.svg"
                      iconPosition="right"
                    >
                    </Button>
                    {isPreScreeningSettingsScopeDropdownOpen && (
                      <div
                        className={`dropdown-menu w-100 mt-1 org-dropdown-anim${
                          isPreScreeningSettingsScopeDropdownOpen ? " show" : ""
                        }`}
                        style={{
                          minWidth: "260px",
                          maxHeight: "280px",
                          overflowY: "auto",
                        }}
                      >
                        {preScreeningSettingsScopeOptions.map((option) => (
                          <div
                            key={option.value}
                            className="dropdown-item"
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                            onClick={() => {
                              setIsPreScreeningSettingsScopeDropdownOpen(false);
                              onSelectPreScreeningSettingsScope(option.value);
                            }}
                          >
                            <span>{option.label}</span>
                            {selectedPreScreeningSettingsScope === option.value && (
                              <i
                                className="la la-check"
                                style={{ fontSize: 16, color: "#181D27" }}
                              ></i>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <Button
                  variant="primary"
                  onClick={() => {
                    const nextQuestionID = guid();
                    setPreScreeningQuestions([
                      ...preScreeningQuestions,
                      {
                        id: nextQuestionID,
                        questionType: "Custom Question",
                        question: "",
                        questionFormat: "Dropdown",
                        answers: [{ id: guid(), value: "", type: "Dropdown" }],
                      },
                    ]);
                    enableQuestionEditing(nextQuestionID);
                  }}
                  label="Add custom"
                  icon="/icons/plus.svg"
                >
                </Button>
              </div>
            </div>

            <div className="layered-card-content">
              {preScreeningQuestions.length > 0 ? (
                preScreeningQuestions.map((question, index) => {
                  const questionID = String(question.id);
                  const isEditingQuestion = editingQuestionIds.includes(questionID);

                  return (
                    <div
                      key={`${questionID}-${index}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        const target = e.currentTarget;

                        const bounding = target.getBoundingClientRect();
                        const offset = bounding.y + bounding.height / 2;

                        if (e.clientY - offset > 0) {
                          target.style.borderBottom = "3px solid #6941C6";
                          target.style.borderTop = "none";
                        } else {
                          target.style.borderTop = "3px solid #6941C6";
                          target.style.borderBottom = "none";
                        }
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.style.borderTop = "none";
                        e.currentTarget.style.borderBottom = "none";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderTop = "none";
                        e.currentTarget.style.borderBottom = "none";

                        const questionString = e.dataTransfer.getData("question");
                        if (!questionString) {
                          return;
                        }

                        try {
                          const draggedQuestion = JSON.parse(questionString);
                          let newQuestions = [...preScreeningQuestions];
                          newQuestions = newQuestions.filter(
                            (q) => String(q.id) !== String(draggedQuestion.id)
                          );
                          newQuestions.splice(index, 0, draggedQuestion);
                          setPreScreeningQuestions(newQuestions);
                        } catch {
                          return;
                        }
                      }}
                    >
                      {isEditingQuestion ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            gap: 8,
                            width: "100%",
                            alignItems: "center",
                          }}
                        >
                          <i
                            className="la la-grip-vertical"
                            style={{ color: "#181D27", fontSize: 20 }}
                          />
                          <PreScreeningQuestionCard
                            question={question}
                            setQuestion={(updatedQuestion) => {
                              setPreScreeningQuestions(
                                preScreeningQuestions.map((q) =>
                                  String(q.id) === String(updatedQuestion.id)
                                    ? updatedQuestion
                                    : q
                                )
                              );
                            }}
                            onDelete={(id) => {
                              setPreScreeningQuestions(
                                preScreeningQuestions.filter(
                                  (q) => String(q.id) !== String(id)
                                )
                              );
                              disableQuestionEditing(id);
                            }}
                            onSaveEdit={(id) => {
                              disableQuestionEditing(id);
                            }}
                            currency={careerForm.currency}
                            currencyOptions={currencyOptions}
                            startInEditMode={true}
                            showEditSaveAction={true}
                            showAutoFilteringControls={true}
                          />
                        </div>
                      ) : (
                        <div
                          draggable={true}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("question", JSON.stringify(question));
                          }}
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            justifyContent: "space-between",
                            width: "100%",
                            marginBottom: 16,
                            cursor: "grab",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                              width: "90%",
                            }}
                          >
                            {BUILT_IN_PRE_SCREENING_QUESTION_IDS.has(String(question.id)) ? (
                              <>
                                <span
                                  style={{
                                    fontSize: 14,
                                    color: "#414651",
                                    fontWeight: 500,
                                  }}
                                >
                                  {question.questionType}
                                </span>
                                <span
                                  style={{
                                    fontSize: 14,
                                    color: "#717680",
                                    fontWeight: 500,
                                  }}
                                >
                                  {question.question}
                                </span>
                              </>
                            ) : (
                              <>
                                <span
                                  style={{
                                    fontSize: 14,
                                    color: "#414651",
                                    fontWeight: 500,
                                  }}
                                >
                                  {question.question}
                                </span>
                                <span
                                  style={{
                                    fontSize: 14,
                                    color: "#717680",
                                    fontWeight: 500,
                                  }}
                                >
                                  Question Type: {question.questionFormat}
                                </span>
                              </>
                            )}
                          </div>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              enableQuestionEditing(questionID);
                            }}
                            label="Edit"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 8,
                    width: "100%",
                  }}
                >
                  <span
                    style={{ fontSize: 16, color: "#414651", fontWeight: 500 }}
                  >
                    No pre-screening questions added yet.
                  </span>
                </div>
              )}

              {availableSuggestedQuestions.length > 0 && (
                <>
                  <div
                    style={{
                      width: "100%",
                      height: "1px",
                      backgroundColor: "#E9EAEB",
                      margin: "16px 0",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 16,
                      color: "#717680",
                      fontWeight: 500,
                      marginBottom: 16,
                    }}
                  >
                    Suggested Pre-screening Questions:
                  </span>
                  {availableSuggestedQuestions.map((question) => (
                    <div
                      key={String(question.id)}
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        width: "100%",
                        marginBottom: 16,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          width: "90%",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            color: "#414651",
                            fontWeight: 500,
                          }}
                        >
                          {question.questionType}
                        </span>
                        <span
                          style={{
                            fontSize: 14,
                            color: "#717680",
                            fontWeight: 500,
                          }}
                        >
                          {question.question}
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const { added: _added, ...questionToAdd } = question;
                          setPreScreeningQuestions([
                            ...preScreeningQuestions,
                            clonePreScreeningQuestion(questionToAdd),
                          ]);
                        }}
                        label="Add"
                      >
                      </Button>
                    </div>
                  ))}
                </>
              )}
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
                  color: "#414651",
                  fontWeight: 400,
                  lineHeight: "1.6",
                  margin: 0,
                }}
              >
                <span style={{ fontWeight: 700, color: "#181D27" }}>
                  Add a Secret Prompt
                </span>{" "}
                <span style={{ color: "#717680" }}>
                  to fine-tune how Jia scores and evaluates submitted CVs.
                </span>
              </p>
              <p
                style={{
                  fontSize: 14,
                  color: "#414651",
                  fontWeight: 400,
                  lineHeight: "1.6",
                  margin: 0,
                }}
              >
                <span style={{ fontWeight: 700, color: "#181D27" }}>
                  Add Pre-Screening questions
                </span>{" "}
                <span style={{ color: "#717680" }}>
                  to collect key details such as notice period, work setup, or
                  salary expectations to guide your review and candidate
                  discussions.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
