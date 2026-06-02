"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import PreScreeningQuestionCard from "@/lib/components/CareerComponents/CareerSteps/PreScreeningQuestionCard";
import { Button } from "@/lib/components/ui";
import { guid } from "@/lib/Utils";
import {
  BUILT_IN_PRE_SCREENING_QUESTION_IDS,
  DEFAULT_PRE_SCREENING_SUGGESTIONS,
  DEFAULT_PRE_SCREENING_CURRENCY,
  PRE_SCREENING_CURRENCY_OPTIONS,
  PreScreeningSuggestion,
  clonePreScreeningSuggestions,
} from "./defaultPreScreeningSuggestions";

type SuggestedQuestion = PreScreeningSuggestion & { added: boolean };

type PreScreeningSettingsPanelProps = {
  questions: PreScreeningSuggestion[];
  setQuestions: Dispatch<SetStateAction<PreScreeningSuggestion[]>>;
  resetSignal?: number;
};

export default function PreScreeningSettingsPanel({
  questions,
  setQuestions,
  resetSignal = 0,
}: PreScreeningSettingsPanelProps) {
  const [currency, setCurrency] = useState(DEFAULT_PRE_SCREENING_CURRENCY);
  const [editingQuestionIds, setEditingQuestionIds] = useState<string[]>([]);

  const suggestedQuestions = useMemo<SuggestedQuestion[]>(
    () =>
      clonePreScreeningSuggestions(DEFAULT_PRE_SCREENING_SUGGESTIONS).map((question) => ({
        ...question,
        added: questions.some(
          (existingQuestion) =>
            String(existingQuestion.id) === String(question.id)
        ),
      })),
    [questions]
  );

  const availableSuggestedQuestions = useMemo<SuggestedQuestion[]>(
    () => suggestedQuestions.filter((question) => !question.added),
    [suggestedQuestions]
  );

  useEffect(() => {
    setEditingQuestionIds([]);
    setCurrency(DEFAULT_PRE_SCREENING_CURRENCY);
  }, [resetSignal]);

  const enableQuestionEditing = (questionId: string) => {
    if (editingQuestionIds.includes(questionId)) {
      return;
    }
    setEditingQuestionIds((previousEditingQuestionIds) => [
      ...previousEditingQuestionIds,
      questionId,
    ]);
  };

  const disableQuestionEditing = (questionId: string) => {
    setEditingQuestionIds((previousEditingQuestionIds) =>
      previousEditingQuestionIds.filter((id) => id !== questionId)
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "row", gap: 16, width: "100%" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "70%",
        }}
      >
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
                  Pre-Screening Questions
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
                  {questions?.length || 0}
                </div>
              </div>

              <Button
                variant="primary"
                onClick={() => {
                  const nextId = guid();
                  setQuestions((previousQuestions) => [
                    {
                      id: nextId,
                      questionType: "Custom Question",
                      question: "",
                      questionFormat: "Dropdown",
                      isAutoFiltering: false,
                      answers: [{ id: guid(), value: "", type: "Dropdown" }],
                    },
                    ...previousQuestions,
                  ]);
                  setEditingQuestionIds((previousEditingQuestionIds) => [
                    nextId,
                    ...previousEditingQuestionIds,
                  ]);
                }}
                label="Add custom"
                icon="/icons/plus.svg"
              />
            </div>

            <div className="layered-card-content">
              {questions.length > 0 ? (
                questions.map((question, index) => (
                  <div key={question.id ?? index}>
                    {editingQuestionIds.includes(question.id) ? (
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
                          key={`${question.id}-editing`}
                          question={question}
                          setQuestion={(updatedQuestion) => {
                            setQuestions((previousQuestions) =>
                              previousQuestions.map((q) =>
                                q.id === updatedQuestion.id ? updatedQuestion : q
                              )
                            );
                          }}
                          onDelete={(id) => {
                            setQuestions((previousQuestions) =>
                              previousQuestions.filter((q) => q.id !== id)
                            );
                            disableQuestionEditing(id);
                          }}
                          onSaveEdit={(id) => {
                            disableQuestionEditing(id);
                          }}
                          currency={currency}
                          currencyOptions={PRE_SCREENING_CURRENCY_OPTIONS}
                          startInEditMode={true}
                          showEditSaveAction={true}
                          showAutoFilteringControls={true}
                        />
                      </div>
                    ) : (
                      <div
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
                            enableQuestionEditing(question.id);
                          }}
                          label="Edit"
                        />
                      </div>
                    )}
                  </div>
                ))
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
                          setQuestions((previousQuestions) => [
                            ...previousQuestions,
                            clonePreScreeningSuggestions([
                              questionToAdd as PreScreeningSuggestion,
                            ])[0],
                          ]);
                        }}
                        label="Add"
                      />
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
