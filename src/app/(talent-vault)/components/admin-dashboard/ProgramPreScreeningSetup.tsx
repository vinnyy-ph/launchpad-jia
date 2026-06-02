"use client";

import React, { useEffect, useMemo, useState } from "react";
import PreScreeningQuestionCard from "@/lib/components/CareerComponents/CareerSteps/PreScreeningQuestionCard";
import { Button } from "@/lib/components/ui";
import { guid } from "@/lib/Utils";
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
const clonePreScreeningQuestion = (
  question: PreScreeningQuestion
): PreScreeningQuestion => ({
  ...question,
  id: String(question.id),
  answers: Array.isArray(question.answers)
    ? question.answers.map((answer) => ({ ...answer }))
    : [],
});
const CURRENCY_OPTIONS = [
  { name: "PHP", symbol: "₱" },
  { name: "USD", symbol: "$" },
  { name: "EUR", symbol: "€" },
  { name: "JPY", symbol: "¥" },
  { name: "CNY", symbol: "¥" },
];
const TV_SUGGESTED_QUESTIONS: PreScreeningQuestion[] = [
  {
    id: "work-setup",
    questionType: "Work Setup",
    question: "Are you open to a hybrid work setup?",
    questionFormat: "Dropdown",
    answers: [
      { id: "hybrid-1-2", value: "At most 1-2x a week", type: "Dropdown" },
      { id: "hybrid-3-4", value: "At most 3-4x a week", type: "Dropdown" },
      {
        id: "fully-onsite",
        value: "Open to fully onsite work",
        type: "Dropdown",
      },
      {
        id: "fully-remote",
        value: "Only open to fully remote work",
        type: "Dropdown",
      },
    ],
  },
  {
    id: "graduation-date",
    questionType: "Graduation Date",
    question: "When are you expected to graduate?",
    questionFormat: "Date",
    answers: [],
  },
  {
    id: "expected-monthly-salary",
    questionType: "Asking Salary",
    question: "How much is your expected monthly salary?",
    questionFormat: "Range",
    answers: [
      { id: "1", value: "", type: "Minimum" },
      { id: "2", value: "", type: "Maximum" },
    ],
  },
];

const TV_BUILT_IN_QUESTION_IDS = new Set(
  TV_SUGGESTED_QUESTIONS.map((question) => String(question.id))
);
interface ProgramPreScreeningSetupProps {
  preScreeningQuestions: PreScreeningQuestion[];
  setPreScreeningQuestions: React.Dispatch<
    React.SetStateAction<PreScreeningQuestion[]>
  >;
}

export default function ProgramPreScreeningSetup({
  preScreeningQuestions,
  setPreScreeningQuestions,
}: ProgramPreScreeningSetupProps) {
  const [editingQuestionIds, setEditingQuestionIds] = useState<string[]>([]);
  const [currency] = useState("PHP");
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
      TV_SUGGESTED_QUESTIONS.map((question) => {
        const normalizedQuestion = clonePreScreeningQuestion(question);
        return {
          ...normalizedQuestion,
          added: preScreeningQuestions.some(
            (existingQuestion) =>
              String(existingQuestion.id) === String(normalizedQuestion.id)
          ),
        };
      }),
    [preScreeningQuestions]
  );

  const availableSuggestedQuestions = useMemo<SuggestedQuestion[]>(
    () => suggestedQuestions.filter((question) => !question.added),
    [suggestedQuestions]
  );

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
        <div className="layered-card-outer">
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
                <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>
                  1. Pre-Screening Questions
                </span>
                <span style={{ fontSize: 16, color: "#717680", fontWeight: 700 }}>
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
                  {preScreeningQuestions.length || 0}
                </div>
              </div>
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
              ></Button>
            </div>
            <div className="layered-card-content">
              {preScreeningQuestions.length > 0 ? (
                preScreeningQuestions.map((question, index) => {
                  const questionID = String(question.id);
                  const isEditingQuestion = editingQuestionIds.includes(questionID);
                  return (
                    <div
                      key={`${questionID}-${index}`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        const target = event.currentTarget;
                        const bounding = target.getBoundingClientRect();
                        const offset = bounding.y + bounding.height / 2;

                        if (event.clientY - offset > 0) {
                          target.style.borderBottom = "3px solid #6941C6";
                          target.style.borderTop = "none";
                        } else {
                          target.style.borderTop = "3px solid #6941C6";
                          target.style.borderBottom = "none";
                        }
                      }}
                      onDragLeave={(event) => {
                        event.currentTarget.style.borderTop = "none";
                        event.currentTarget.style.borderBottom = "none";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.currentTarget.style.borderTop = "none";
                        event.currentTarget.style.borderBottom = "none";

                        const questionString = event.dataTransfer.getData("question");
                        if (!questionString) {
                          return;
                        }

                        try {
                          const draggedQuestion: PreScreeningQuestion =
                            JSON.parse(questionString);
                          let nextQuestions = [...preScreeningQuestions];
                          nextQuestions = nextQuestions.filter(
                            (existingQuestion) =>
                              String(existingQuestion.id) !== String(draggedQuestion.id)
                          );
                          nextQuestions.splice(index, 0, draggedQuestion);
                          setPreScreeningQuestions(nextQuestions);
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
                                preScreeningQuestions.map((existingQuestion) =>
                                  String(existingQuestion.id) ===
                                  String(updatedQuestion.id)
                                    ? updatedQuestion
                                    : existingQuestion
                                )
                              );
                            }}
                            onDelete={(id) => {
                              setPreScreeningQuestions(
                                preScreeningQuestions.filter(
                                  (existingQuestion) =>
                                    String(existingQuestion.id) !== String(id)
                                )
                              );
                              disableQuestionEditing(id);
                            }}
                            onSaveEdit={(id) => {
                              disableQuestionEditing(id);
                            }}
                            currency={currency}
                            currencyOptions={CURRENCY_OPTIONS}
                            startInEditMode={true}
                            showEditSaveAction={true}
                            showAutoFilteringControls={false}
                            allowDateQuestionFormat={true}
                          />
                        </div>
                      ) : (
                        <div
                          draggable={true}
                          onDragStart={(event) => {
                            event.dataTransfer.setData(
                              "question",
                              JSON.stringify(question)
                            );
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
                            {TV_BUILT_IN_QUESTION_IDS.has(String(question.id)) ? (
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
                  <span style={{ fontSize: 16, color: "#414651", fontWeight: 500 }}>
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
                      ></Button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

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
            <p
              style={{
                fontSize: 14,
                lineHeight: "1.6",
                margin: 0,
              }}
            >
              <span style={{ fontWeight: 700, color: "#181D27" }}>
                Add pre-screening questions
              </span>
              <span style={{ color: "#717680" }}>
                {" "}
                to collect key details such as notice period, work setup, or salary
                expectations to guide your review and candidate discussions.
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
