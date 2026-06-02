import React from "react";
import Container from "../../../../Container";
import type { PreScreeningQuestion, PreScreeningAnswer } from "./useCVScreeningData";

type Props = {
  preScreeningQuestions: PreScreeningQuestion[] | null;
};

/**
 * Extract display text from a selected answer
 * Handles both string answers and object answers with various structures
 */
function getAnswerDisplayText(
  answer: PreScreeningAnswer | string,
  question: PreScreeningQuestion
): string {
  // If it's already a string, return it
  if (typeof answer === "string") {
    return answer;
  }

  // For object answers
  if (typeof answer === "object" && answer !== null) {
    // If the answer has a direct value, use it
    if (answer.value !== undefined && answer.value !== null) {
      // For range questions, format with type label
      if (answer.type && question.questionFormat === "Range") {
        return `${answer.type}: ${answer.value}`;
      }
      return String(answer.value);
    }

    // If the answer has text, use it
    if (answer.text) {
      return answer.text;
    }

    // Try to find matching answer text from available options
    if (answer.id && question.answers) {
      const matchingOption = question.answers.find((opt) => opt.id === answer.id);
      if (matchingOption?.text) {
        return matchingOption.text;
      }
    }
  }

  return "";
}

/**
 * Format all selected answers for display
 */
function formatAnswers(question: PreScreeningQuestion): string {
  const answers = question.selectedAnswers;
  
  if (!answers || answers.length === 0) {
    return "N/A";
  }

  // For range questions, format as "Min - Max"
  if (question.questionFormat === "Range") {
    const minAnswer = answers.find(
      (a) => typeof a === "object" && a?.type === "Minimum"
    ) as PreScreeningAnswer | undefined;
    const maxAnswer = answers.find(
      (a) => typeof a === "object" && a?.type === "Maximum"
    ) as PreScreeningAnswer | undefined;

    if (minAnswer?.value !== undefined && maxAnswer?.value !== undefined) {
      return `${minAnswer.value} - ${maxAnswer.value}`;
    }
  }

  // For other question types, extract and join answer texts
  const answerTexts = answers
    .map((a) => getAnswerDisplayText(a, question))
    .filter((text) => text.length > 0);

  return answerTexts.length > 0 ? answerTexts.join(", ") : "N/A";
}

export default function PreScreeningQA({ preScreeningQuestions }: Props) {
  const hasQuestions = preScreeningQuestions && preScreeningQuestions.length > 0;

  return (
    <Container
      title={
        <span style={{ fontSize: 16, fontWeight: 600, color: "#101828" }}>
          Pre-screening Question Answers
        </span>
      }
    >
      {hasQuestions ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {preScreeningQuestions.map((q, index) => (
            <React.Fragment key={q.id || index}>
              {index > 0 && <div style={{ height: 1, background: "#EAECF0" }} />}
              <div>
                {q.questionType && (
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#475467", marginBottom: 4 }}>
                    {q.questionType}
                  </div>
                )}
                <div style={{ fontSize: 14, color: "#475467", marginBottom: 4 }}>{q.question}</div>
                <div style={{ fontSize: 14, color: "#475467" }}>
                  Answer:{" "}
                  <span style={{ fontWeight: 600, color: "#344054" }}>
                    {formatAnswers(q)}
                  </span>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 14, color: "#667085", fontStyle: "italic" }}>
          No pre-screening answers.
        </div>
      )}
    </Container>
  );
}
