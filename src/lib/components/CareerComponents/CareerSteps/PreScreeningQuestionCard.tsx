"use client";

import React, { useEffect, useState } from "react";
import CustomDropdown from "../CustomDropdown";
import { guid } from "@/lib/Utils";
import { Button } from "../../ui";
import GradientCheckbox from "@/lib/components/GradientCheckbox/GradientCheckbox";
import { assetConstants } from "@/lib/utils/constantsV2";

interface PreScreeningQuestionCardProps {
  question: any;
  setQuestion: (updatedQuestion: any) => void;
  onDelete: (id: string) => void;
  onSaveEdit?: (id: string) => void;
  currency?: string;
  currencyOptions?: { name: string; symbol: string }[];
  startInEditMode?: boolean;
  showEditSaveAction?: boolean;
  showAutoFilteringControls?: boolean;
  allowDateQuestionFormat?: boolean;
}

export default function PreScreeningQuestionCard({
  question,
  setQuestion,
  onDelete,
  onSaveEdit,
  currency = "PHP",
  currencyOptions = [
    { name: "PHP", symbol: "₱" },
    { name: "USD", symbol: "$" },
    { name: "EUR", symbol: "€" },
    { name: "JPY", symbol: "¥" },
    { name: "CNY", symbol: "¥" },
  ],
  startInEditMode = true,
  showEditSaveAction = false,
  showAutoFilteringControls = true,
  allowDateQuestionFormat = false,
}: PreScreeningQuestionCardProps) {
  const currencySymbol =
    currencyOptions.find((c) => c.name === currency)?.symbol || "₱";
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setIsEditing(startInEditMode);
    if (startInEditMode) {
      setValidationError("");
    }
  }, [startInEditMode]);
  const questionFormats = [
    {
      name: "Short Answer",
      icon: "la la-align-left",
    },
    {
      name: "Long Answer",
      icon: "la la-align-justify",
    },
    {
      name: "Dropdown",
      icon: "la la-chevron-circle-down",
    },
    {
      name: "Checkboxes",
      icon: "la la-check-square",
    },
    ...(allowDateQuestionFormat
      ? [
          {
            name: "Date Picker",
            icon: "la la-calendar",
          },
        ]
      : []),
    {
      name: "Range",
      icon: "la la-sort-numeric-asc",
    },
  ];

  const getStoredQuestionFormat = (selectedQuestionFormat: string) => {
    if (selectedQuestionFormat === "Date Picker") {
      return "Date";
    }

    return selectedQuestionFormat;
  };

  const selectedQuestionFormat =
    allowDateQuestionFormat && question.questionFormat === "Date"
      ? "Date Picker"
      : question.questionFormat;

  const screeningRuleOptions = [
    { name: "Above maximum only" },
    { name: "Below minimum only" },
    { name: "Outside the range" },
  ];

  const clearAutoFilteringConfig = (nextQuestion: any) => {
    return {
      ...nextQuestion,
      isAutoFiltering: false,
      screeningRule: undefined,
      answers: (nextQuestion.answers || []).map(({ dropCandidate, ...answer }: any) => answer),
    };
  };

  const handleQuestionFormatChange = (setting: string) => {
    const nextQuestionFormat = getStoredQuestionFormat(setting);
    let defaultAnswers = [];

    if (["Dropdown", "Checkboxes"].includes(nextQuestionFormat)) {
      defaultAnswers = [{ id: "1", value: "", type: nextQuestionFormat }];
    }

    if (nextQuestionFormat === "Range") {
      defaultAnswers = [
        { id: "1", value: 0, type: "Minimum" },
        { id: "2", value: 0, type: "Maximum" },
      ];
    }

    if (nextQuestionFormat === "Short Answer" || nextQuestionFormat === "Long Answer") {
      defaultAnswers = [{ id: "1", value: "", type: nextQuestionFormat }];
    }

    const nextQuestion = {
      ...question,
      questionFormat: nextQuestionFormat,
      answers: defaultAnswers,
    };

    setValidationError("");

    if (!showAutoFilteringControls) {
      setQuestion(nextQuestion);
      return;
    }

    setQuestion(clearAutoFilteringConfig(nextQuestion));
  };

  const handleToggleAutoFiltering = () => {
    if (!showAutoFilteringControls) {
      return;
    }

    setValidationError("");

    const nextEnabled = !question.isAutoFiltering;

    if (!nextEnabled) {
      setQuestion(clearAutoFilteringConfig(question));
      return;
    }

    if (question.questionFormat === "Range") {
      setQuestion({
        ...question,
        isAutoFiltering: true,
        screeningRule: question.screeningRule || "Above maximum only",
        answers: (question.answers || []).map(({ dropCandidate, ...answer }: any) => answer),
      });
      return;
    }

    setQuestion({
      ...question,
      isAutoFiltering: true,
      screeningRule: undefined,
    });
  };

  const handleQuestionChange = (value: string) => {
    setQuestion({ ...question, question: value });
    setValidationError("");
  };

  const isQuestionEmpty = !String(question?.question || "").trim();

  const validateBeforeSave = (): string | null => {
    if (isQuestionEmpty) {
      return "Question is required.";
    }

    if (["Dropdown", "Checkboxes"].includes(question.questionFormat)) {
      if (!Array.isArray(question.answers) || question.answers.length < 1) {
        return "At least one option is required.";
      }

      const hasEmptyOption = question.answers.some((option: any) => {
        return !String(option?.value ?? "").trim();
      });

      if (hasEmptyOption) {
        return "Option text cannot be empty.";
      }
    }

    if (question.questionFormat === "Range") {
      const minimumRaw = question.answers?.find((answer: any) => answer.type === "Minimum")?.value;
      const maximumRaw = question.answers?.find((answer: any) => answer.type === "Maximum")?.value;

      const isMinimumMissing =
        minimumRaw === "" ||
        minimumRaw === null ||
        minimumRaw === undefined;
      const isMaximumMissing =
        maximumRaw === "" ||
        maximumRaw === null ||
        maximumRaw === undefined;

      if (isMinimumMissing || isMaximumMissing) {
        return "Minimum and maximum values are required.";
      }

      const minimumValue = Number(
        minimumRaw
      );
      const maximumValue = Number(
        maximumRaw
      );

      if (!Number.isFinite(minimumValue) || !Number.isFinite(maximumValue)) {
        return "Minimum and maximum values are required.";
      }

      if (minimumValue < 0 || maximumValue < 0) {
        return "Minimum and maximum must be at least 0.";
      }

      if (minimumValue > maximumValue) {
        return "Maximum must be greater than or equal to minimum.";
      }
    }

    return null;
  };

  return (
    <>
      <style>{`
        .option-row .drag-handle {
          width: 0;
          width: 0;
          margin-right: 0;
          opacity: 0;
          overflow: hidden;
          transition: width 0.2s, opacity 0.2s, margin-right 0.2s;
          flex-shrink: 0;
        }
        .option-row:hover .drag-handle {
          width: 20px;
          margin-right: 8px;
          opacity: 1;
        }
        .option-row .option-input-container {
          flex: 1;
          transition: all 0.2s;
        }
        /* Custom styles for the switch component */
        .switch {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
        }
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: .4s;
          border-radius: 34px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 2px;
          bottom: 2px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }
        input:checked + .slider {
          background-color: #7F56D9; /* Using the primary purple color */
        }
        input:focus + .slider {
          box-shadow: 0 0 1px #7F56D9;
        }
        input:checked + .slider:before {
          transform: translateX(16px);
        }
      `}</style>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          backgroundColor: "#F8F9FC",
          borderRadius: "12px",
          border: "1px solid #E9EAEB",
          width: "100%",
        }}
      >
        <div
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            gap: 8,
          }}
        >
          {isEditing ? (
            <>
              <input
                type="text"
                placeholder="Write your question..."
                style={{
                  width: "100%",
                  height: "48px",
                  padding: "0.375rem 0.75rem",
                  fontSize: "1rem",
                  lineHeight: "1.5",
                  backgroundColor: "transparent",
                  border: "none",
                  outline: "none",
                  borderRadius: "8px",
                  transition: "all 0.2s",
                }}
                onFocus={(e) => {
                  e.target.style.backgroundColor = "#FFFFFF";
                  e.target.style.border = "1px solid #E9EAEB";
                }}
                onBlur={(e) => {
                  e.target.style.backgroundColor = "transparent";
                  e.target.style.border = "none";
                }}
                value={question.question}
                onChange={(e) => {
                  handleQuestionChange(e.target.value);
                }}
              />
              <div style={{ minWidth: "260px", maxWidth: "260px" }}>
                <CustomDropdown
                  onSelectSetting={handleQuestionFormatChange}
                  screeningSetting={selectedQuestionFormat}
                  settingList={questionFormats}
                  placeholder="Select Question Format"
                />
              </div>
            </>
          ) : (
            <>
              <span>{question.question}</span>
              <Button
                variant="primary"
                style={{ backgroundColor: "#FFFFFF", color: "#181D27" }}
                onClick={() => setIsEditing(!isEditing)}
                label="Edit"
                icon="/iconsV3/pen.svg"
              >
              </Button>
            </>
          )}
        </div>
        

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            backgroundColor: "#FFFFFF",
            padding: "16px",
            borderBottomLeftRadius: "12px",
            borderBottomRightRadius: "12px",
            width: "100%",
          }}
        >
          {isEditing ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                width: "100%",
              }}
            >
              {/* Question Format options */}
              {question.questionFormat === "Short Answer" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "100%",
                  }}
                >
                  <input
                    type="text"
                    className="form-control"
                    value={
                      question.answers.find(
                        (a: any) => a.type === "Short Answer"
                      )?.value
                    }
                    onChange={(e) => {
                      setQuestion({
                        ...question,
                        answers: question.answers.map((a: any) => {
                          if (a.type === "Short Answer") {
                            return { ...a, value: e.target.value };
                          }
                          return a;
                        }),
                      });
                    }}
                  />
                </div>
              )}
              {question.questionFormat === "Long Answer" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "100%",
                  }}
                >
                  <textarea
                    className="form-control"
                    style={{ height: "100px" }}
                    value={
                      question.answers.find(
                        (a: any) => a.type === "Long Answer"
                      )?.value
                    }
                    onChange={(e) => {
                      setQuestion({
                        ...question,
                        answers: question.answers.map((a: any) => {
                          if (a.type === "Long Answer") {
                            return { ...a, value: e.target.value };
                          }
                          return a;
                        }),
                      });
                    }}
                  />
                </div>
              )}
              {question.questionFormat === "Date" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "100%",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 14, color: "#667085" }}>
                    Candidates will answer with a date picker.
                  </span>
                  <input
                    type="date"
                    disabled
                    style={{
                      width: "100%",
                      height: "48px",
                      border: "2px solid #E9EAEB",
                      borderRadius: "8px",
                      padding: "0 12px",
                      backgroundColor: "#F8F9FC",
                      color: "#98A2B3",
                    }}
                  />
                </div>
              )}
              {(question.questionFormat === "Dropdown" ||
                question.questionFormat === "Checkboxes") && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "100%",
                    gap: 8,
                  }}
                >
                  {showAutoFilteringControls && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        padding: "4px 0 8px 0",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#344054" }}>
                          Enable auto-filtering for this question
                        </span>
                        <span style={{ fontSize: 13, color: "#667085" }}>
                          Select which answers should automatically disqualify a candidate.
                        </span>
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={question.isAutoFiltering || false}
                          onChange={handleToggleAutoFiltering}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>
                  )}

                  {question.answers.map((option: any, index: number) => (
                    <div
                      draggable={true}
                      onDragOver={(e) => {
                        e.preventDefault();
                        const target = e.currentTarget;
                        target.style.borderBottom = "3px solid #6941C6";
                        target.style.borderTop = "none";
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.style.borderTop = "none";
                        e.currentTarget.style.borderBottom = "none";
                      }}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData("questionId", question.id);
                        e.dataTransfer.setData(
                          "option",
                          JSON.stringify(option)
                        );
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderTop = "none";
                        e.currentTarget.style.borderBottom = "none";

                        const questionId = e.dataTransfer.getData("questionId");
                        const optionString = e.dataTransfer.getData("option");
                        if (!questionId || !optionString) {
                          return;
                        }
                        // Only allow dropping on the same question
                        if (questionId === question.id) {
                          try {
                            const option = JSON.parse(optionString);
                            let newAnswers = [...question.answers];
                            newAnswers = newAnswers.filter(
                              (a) => a.id !== option.id
                            );
                            newAnswers.splice(index, 0, option);
                            setQuestion({ ...question, answers: newAnswers });
                          } catch (error) {
                            return;
                          }
                        }
                      }}
                      key={index}
                      className="option-row"
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        width: "100%",
                        cursor: "grab",
                      }}
                    >
                      <i
                        className="la la-grip-vertical drag-handle"
                        style={{ color: "#181D27", fontSize: 20 }}
                      />
                      <div
                        className="option-input-container"
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          gap: 8,
                          alignItems: "center",
                          border: "2px solid #E9EAEB",
                          padding: "0px 0px 0px 16px",
                          borderRadius: "8px",
                          height: "48px",
                          overflow: "hidden",
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <span>{index + 1}.</span>
                        <div
                          style={{
                            width: "1px",
                            height: "100%",
                            backgroundColor: "#E9EAEB",
                          }}
                        />
                        <input
                          type="text"
                          style={{
                            flex: 1,
                            minWidth: 0,
                            height: "100%",
                            border: "none",
                            paddingRight: "16px",
                            outline: "none",
                          }}
                          placeholder={`Option ${index + 1}`}
                          value={option.value}
                          onChange={(e) => {
                            setValidationError("");
                            setQuestion({
                              ...question,
                              answers: question.answers.map(
                                (o: any, i: number) => ({
                                  ...o,
                                  value: i === index ? e.target.value : o.value,
                                })
                              ),
                            });
                          }}
                        />

                        {showAutoFilteringControls && question.isAutoFiltering && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              height: "100%",
                              padding: "0 16px",
                              whiteSpace: "nowrap",
                              backgroundColor: "#FFFFFF",
                              transform: "translateY(1px)",
                            }}
                          >
                            <GradientCheckbox
                              checked={option.dropCandidate || false}
                              onChange={(checked) => {
                                setQuestion({
                                  ...question,
                                  answers: question.answers.map((currentOption: any, optionIndex: number) => {
                                    if (optionIndex !== index) {
                                      return currentOption;
                                    }

                                    return {
                                      ...currentOption,
                                      dropCandidate: checked,
                                    };
                                  }),
                                });
                              }}
                              label="Drop candidate"
                            />
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "10px",
                          border: "1px solid #E9EAEB",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          backgroundColor: "#FFFFFF",
                          marginLeft: "16px",
                          flexShrink: 0,
                        }}
                        onClick={() => {
                          if (question.answers.length <= 1) {
                            setValidationError("At least one option is required.");
                            return;
                          }

                          setValidationError("");
                          setQuestion({
                            ...question,
                            answers: question.answers.filter(
                              (_, i) => i !== index
                            ),
                          });
                        }}
                      >
                        <img
                          src={assetConstants.trashV2}
                          alt="Delete option"
                          width={14}
                          height={15}
                          style={{ display: "block" }}
                        />
                      </div>
                    </div>
                  ))}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: "#FFFFFF",
                      width: "fit-content",
                      border: "none",
                      margin: "16px",
                      cursor: "pointer",
                      color: "#535862",
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                    onClick={() => {
                      setValidationError("");
                      setQuestion({
                        ...question,
                        answers: [
                          ...question.answers,
                          {
                            id: guid(),
                            value: "",
                            type: question.questionFormat,
                          },
                        ],
                      });
                    }}
                  >
                    <i className="la la-plus" style={{ fontSize: 20 }} /> Add
                    option
                  </div>
                </div>
              )}
              {question.questionFormat === "Range" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "100%",
                    gap: 16,
                  }}
                >
                  {showAutoFilteringControls && (
                    <>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: "#344054" }}>
                            Enable auto-filtering for this question
                          </span>
                          <span style={{ fontSize: 13, color: "#667085" }}>
                            Automatically disqualify candidates based on a range rule.
                          </span>
                        </div>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={question.isAutoFiltering || false}
                            onChange={handleToggleAutoFiltering}
                          />
                          <span className="slider round"></span>
                        </label>
                      </div>

                      {question.isAutoFiltering && (
                        <div
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 16,
                          }}
                        >
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: "#344054" }}>
                              Screening Rule
                            </span>
                            <span style={{ fontSize: 13, color: "#667085" }}>
                              Choose which candidates are automatically dropped.
                            </span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <CustomDropdown
                              onSelectSetting={(setting) => {
                                setQuestion({
                                  ...question,
                                  screeningRule: setting,
                                });
                              }}
                              screeningSetting={question.screeningRule || "Above maximum only"}
                              settingList={screeningRuleOptions}
                              placeholder="Select screening rule"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 8,
                        width: "50%",
                      }}
                    >
                      <span>Minimum Salary</span>
                      <div style={{ position: "relative", width: "100%" }}>
                        <span
                          style={{
                            position: "absolute",
                            left: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#6c757d",
                            fontSize: "16px",
                            pointerEvents: "none",
                          }}
                        >
                          {currencySymbol}
                        </span>
                        <input
                          type="number"
                          style={{
                            width: "100%",
                            height: "48px",
                            paddingLeft: "28px",
                            paddingRight: "60px",
                            fontSize: "1rem",
                            lineHeight: "1.5",
                            backgroundColor: "#FFFFFF",
                            border: "2px solid #E9EAEB",
                            borderRadius: "8px",
                          }}
                          placeholder="0"
                          min={0}
                          value={
                            question.answers.find(
                              (a: any) => a.type === "Minimum"
                            )?.value ?? ""
                          }
                          onChange={(e) => {
                            setValidationError("");
                            setQuestion({
                              ...question,
                              answers: question.answers.map((a: any) => {
                                if (a.type === "Minimum") {
                                  const nextValue = e.target.value;
                                  return {
                                    ...a,
                                    value: nextValue === "" ? "" : Number(nextValue),
                                  };
                                }
                                return a;
                              }),
                            });
                          }}
                        />
                        <span
                          style={{
                            position: "absolute",
                            right: "30px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#6c757d",
                            fontSize: "16px",
                            pointerEvents: "none",
                          }}
                        >
                          {currency}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 8,
                        width: "50%",
                      }}
                    >
                      <span>Maximum Salary</span>
                      <div style={{ position: "relative", width: "100%" }}>
                        <span
                          style={{
                            position: "absolute",
                            left: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#6c757d",
                            fontSize: "16px",
                            pointerEvents: "none",
                          }}
                        >
                          {currencySymbol}
                        </span>
                        <input
                          type="number"
                          style={{
                            width: "100%",
                            height: "48px",
                            paddingLeft: "28px",
                            paddingRight: "60px",
                            fontSize: "1rem",
                            lineHeight: "1.5",
                            backgroundColor: "#FFFFFF",
                            border: "2px solid #E9EAEB",
                            borderRadius: "8px",
                          }}
                          placeholder="0"
                          min={0}
                          value={
                            question.answers.find(
                              (a: any) => a.type === "Maximum"
                            )?.value ?? ""
                          }
                          onChange={(e) => {
                            setValidationError("");
                            setQuestion({
                              ...question,
                              answers: question.answers.map((a: any) => {
                                if (a.type === "Maximum") {
                                  const nextValue = e.target.value;
                                  return {
                                    ...a,
                                    value: nextValue === "" ? "" : Number(nextValue),
                                  };
                                }
                                return a;
                              }),
                            });
                          }}
                        ></input>
                        <span
                          style={{
                            position: "absolute",
                            right: "30px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#6c757d",
                            fontSize: "16px",
                            pointerEvents: "none",
                          }}
                        >
                          {currency}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {!!validationError && (
                <span
                  style={{
                    fontSize: 13,
                    color: "#D92D20",
                    fontWeight: 500,
                    marginTop: 8,
                  }}
                >
                  {validationError}
                </span>
              )}
              <div
                style={{
                  width: "100%",
                  height: "1px",
                  backgroundColor: "#E9EAEB",
                  margin: "16px 0",
                }}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  alignSelf: "flex-end",
                }}
              >
                {showEditSaveAction && (
                  <Button
                    onClick={() => {
                      const nextValidationError = validateBeforeSave();
                      if (nextValidationError) {
                        setValidationError(nextValidationError);
                        return;
                      }

                      setValidationError("");

                      if (onSaveEdit) {
                        onSaveEdit(String(question.id));
                        return;
                      }

                      setIsEditing(false);
                    }}
                    label="Save"
                    variant="secondary"
                  />
                )}
                <Button
                  onClick={() => {
                    onDelete(question.id);
                  }}
                  label="Delete Question"
                  icon="/icons/trash-2.svg"
                  variant="tertiary-outline"
                >
                </Button>
              </div>
            </div>
          ) : (
            <span>Edit to customize</span>
          )}
        </div>
        <div></div>
      </div>
    </>
  );
}
