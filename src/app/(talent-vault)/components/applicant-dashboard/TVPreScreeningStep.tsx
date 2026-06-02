"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/app/(talent-vault)/styles/modules/profile-setup.module.scss";
import {
  OTHERS_OPTION_VALUE,
  SetupDropdown,
  type SetupDropdownOption,
} from "../SetupDropdown";
import { CalendarPicker } from "../CalendarPicker";
import CurrencyDropdown from "@/lib/components/CareerComponents/CurrencyDropdown";
import { BulbSparkle } from "../icons/BulbSparkle";

type QuestionFormat =
  | "Short Answer"
  | "Long Answer"
  | "Dropdown"
  | "Checkboxes"
  | "Date"
  | "Range";

export type PreScreeningAnswerOption = {
  id: string | number;
  value: string | number | null;
  type: string;
};

export type PreScreeningAnsweredQuestion = {
  id: string;
  questionType: string;
  question: string;
  questionFormat: QuestionFormat;
  selectedAnswers: PreScreeningAnswerOption[];
  currencyCode?: string;
};

export type PreScreeningQuestionDefinition = {
  id: string;
  questionType: string;
  question: string;
  questionFormat: QuestionFormat;
  answers?: PreScreeningAnswerOption[];
  placeholder?: string;
  enableOthersOption?: boolean;
  enableSearch?: boolean;
  rangeLabels?: {
    minimum: string;
    maximum: string;
  };
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_CURRENCY_CODE = "PHP";

const CURRENCY_OPTIONS = [
  { name: "PHP", symbol: "₱" },
  { name: "USD", symbol: "$" },
  { name: "EUR", symbol: "€" },
  { name: "JPY", symbol: "¥" },
  { name: "CNY", symbol: "¥" },
];


function formatDateToYyyyMmDd(value: Date | null): string | null {
  if (!value || Number.isNaN(value.getTime())) return null;

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseYyyyMmDdToDate(value: string | number | null): Date | null {
  if (typeof value !== "string" || !DATE_ONLY_REGEX.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);

  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return null;
  }

  return parsedDate;
}

function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_OPTIONS.find((option) => option.name === currencyCode)?.symbol || "₱";
}

function createInitialPreScreeningAnswers(questions: PreScreeningQuestionDefinition[]): PreScreeningAnsweredQuestion[] {
  return questions.map((questionDefinition) => ({
    id: questionDefinition.id,
    questionType: questionDefinition.questionType,
    question: questionDefinition.question,
    questionFormat: questionDefinition.questionFormat,
    selectedAnswers: [],
    ...(questionDefinition.questionFormat === "Range"
      ? { currencyCode: DEFAULT_CURRENCY_CODE }
      : {}),
  }));
}

function createInitialPreScreeningAnswersWithSavedValues(
  questions: PreScreeningQuestionDefinition[],
  savedAnswers?: PreScreeningAnsweredQuestion[] | null
): PreScreeningAnsweredQuestion[] {
  const defaultAnswers = createInitialPreScreeningAnswers(questions);
  if (!Array.isArray(savedAnswers) || savedAnswers.length === 0) {
    return defaultAnswers;
  }

  const savedAnswerMap = new Map(
    savedAnswers
      .filter((savedAnswer) => savedAnswer && typeof savedAnswer === "object")
      .map((savedAnswer) => [savedAnswer.id, savedAnswer])
  );

  return defaultAnswers.map((defaultAnswer) => {
    const savedAnswer = savedAnswerMap.get(defaultAnswer.id);
    if (!savedAnswer) {
      return defaultAnswer;
    }

    return {
      ...defaultAnswer,
      selectedAnswers: Array.isArray(savedAnswer.selectedAnswers)
        ? savedAnswer.selectedAnswers
            .filter((selectedAnswer) => selectedAnswer && typeof selectedAnswer === "object")
            .map((selectedAnswer) => ({
              id: selectedAnswer.id,
              value: selectedAnswer.value,
              type: String(selectedAnswer.type || "").trim(),
            }))
        : [],
      currencyCode:
        typeof savedAnswer.currencyCode === "string" && savedAnswer.currencyCode.trim().length > 0
          ? savedAnswer.currencyCode.trim().toUpperCase()
          : defaultAnswer.currencyCode,
    };
  });
}

interface TVPreScreeningStepProps {
  initialPreScreening?: PreScreeningAnsweredQuestion[] | null;
  preScreeningQuestions?: PreScreeningQuestionDefinition[];
  questionsReady?: boolean;
  onBack?(): void;
  onContinue?(preScreening: PreScreeningAnsweredQuestion[]): Promise<void> | void;
  isSaving?: boolean;
}

function hasNonEmptyAnswerValue(value: string | number | null): boolean {
  if (typeof value === "number") {
    return !Number.isNaN(value);
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return false;
}

export function TVPreScreeningStep({
  initialPreScreening,
  preScreeningQuestions = [],
  questionsReady = false,
  onBack,
  onContinue,
  isSaving = false,
}: TVPreScreeningStepProps) {
  const [preScreening, setPreScreening] = useState<PreScreeningAnsweredQuestion[]>(
    createInitialPreScreeningAnswersWithSavedValues(preScreeningQuestions, initialPreScreening),
  );
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showValidationAlert, setShowValidationAlert] = useState(false);

  useEffect(() => {
    setPreScreening(createInitialPreScreeningAnswersWithSavedValues(preScreeningQuestions, initialPreScreening));
    setValidationErrors({});
    setShowValidationAlert(false);
  }, [initialPreScreening, preScreeningQuestions]);

  useEffect(() => {
    if (questionsReady && preScreeningQuestions.length === 0) {
      onContinue?.([]);
    }
  }, [questionsReady, preScreeningQuestions, onContinue]);

  const preScreeningByQuestionId = useMemo(
    () => new Map(preScreening.map((answeredQuestion) => [answeredQuestion.id, answeredQuestion])),
    [preScreening],
  );

  const updateQuestionAnswer = (
    questionId: string,
    updater: (currentQuestion: PreScreeningAnsweredQuestion) => PreScreeningAnsweredQuestion,
  ) => {
    setShowValidationAlert(false);
    setValidationErrors((previousErrors) => {
      if (!previousErrors[questionId]) {
        return previousErrors;
      }

      const nextErrors = { ...previousErrors };
      delete nextErrors[questionId];
      return nextErrors;
    });

    setPreScreening((previousAnswers) =>
      previousAnswers.map((currentQuestion) =>
        currentQuestion.id === questionId ? updater(currentQuestion) : currentQuestion,
      ),
    );
  };

  const setSingleSelectedAnswer = (
    questionId: string,
    nextAnswer: PreScreeningAnswerOption | null,
  ) => {
    updateQuestionAnswer(questionId, (currentQuestion) => ({
      ...currentQuestion,
      selectedAnswers: nextAnswer ? [nextAnswer] : [],
    }));
  };

  const toggleCheckboxAnswer = (
    questionId: string,
    answerOption: PreScreeningAnswerOption,
  ) => {
    updateQuestionAnswer(questionId, (currentQuestion) => {
      const isSelected = currentQuestion.selectedAnswers.some(
        (selectedAnswer) => String(selectedAnswer.id) === String(answerOption.id),
      );

      return {
        ...currentQuestion,
        selectedAnswers: isSelected
          ? currentQuestion.selectedAnswers.filter(
              (selectedAnswer) => String(selectedAnswer.id) !== String(answerOption.id),
            )
          : [...currentQuestion.selectedAnswers, answerOption],
      };
    });
  };

  const setRangeAnswer = (
    questionDefinition: PreScreeningQuestionDefinition,
    answerType: "Minimum" | "Maximum",
    rawValue: string,
  ) => {
    const numericValue = rawValue.trim() === "" ? null : Number(rawValue);

    updateQuestionAnswer(questionDefinition.id, (currentQuestion) => {
      const remainingAnswers = currentQuestion.selectedAnswers.filter(
        (selectedAnswer) => selectedAnswer.type !== answerType,
      );

      if (numericValue === null || Number.isNaN(numericValue)) {
        return {
          ...currentQuestion,
          selectedAnswers: remainingAnswers,
        };
      }

      const fallbackId = `${questionDefinition.id}-${answerType.toLowerCase()}`;
      const answerId =
        questionDefinition.answers?.find((answerOption) => answerOption.type === answerType)?.id ||
        fallbackId;
      const answerOrder = questionDefinition.answers?.map((answerOption) => answerOption.type) || ["Minimum", "Maximum"];

      return {
        ...currentQuestion,
        selectedAnswers: [
          ...remainingAnswers,
          {
            id: answerId,
            value: numericValue,
            type: answerType,
          },
        ].sort(
          (leftAnswer, rightAnswer) =>
            answerOrder.indexOf(leftAnswer.type) - answerOrder.indexOf(rightAnswer.type),
        ),
      };
    });
  };

  const setRangeCurrency = (questionId: string, currencyCode: string) => {
    updateQuestionAnswer(questionId, (currentQuestion) => ({
      ...currentQuestion,
      currencyCode,
    }));
  };

  const setDropdownOthersAnswer = (
    questionId: string,
    othersValue: string,
  ) => {
    updateQuestionAnswer(questionId, (currentQuestion) => ({
      ...currentQuestion,
      selectedAnswers: [
        {
          id: OTHERS_OPTION_VALUE,
          value: othersValue,
          type: "Dropdown",
        },
      ],
    }));
  };

  const renderQuestionInput = (
    questionDefinition: PreScreeningQuestionDefinition,
    answeredQuestion: PreScreeningAnsweredQuestion,
  ) => {
    if (questionDefinition.questionFormat === "Dropdown") {
      const dropdownOptions: SetupDropdownOption[] = (questionDefinition.answers || []).map(
        (answerOption) => ({
          value: String(answerOption.id),
          label: String(answerOption.value || ""),
        }),
      );
      const selectedDropdownAnswer = answeredQuestion.selectedAnswers[0] || null;
      const selectedDropdownValue = selectedDropdownAnswer
        ? String(selectedDropdownAnswer.id)
        : null;
      const selectedOthersValue =
        selectedDropdownValue === OTHERS_OPTION_VALUE &&
        typeof selectedDropdownAnswer?.value === "string"
          ? selectedDropdownAnswer.value
          : undefined;

      return (
        <SetupDropdown
          options={dropdownOptions}
          value={selectedDropdownValue}
          onChange={(selectedOptionId) => {
            if (selectedOptionId === OTHERS_OPTION_VALUE) {
              const nextOthersValue =
                selectedDropdownValue === OTHERS_OPTION_VALUE &&
                typeof selectedDropdownAnswer?.value === "string"
                  ? selectedDropdownAnswer.value
                  : "";

              setDropdownOthersAnswer(questionDefinition.id, nextOthersValue);
              return;
            }

            const selectedAnswer = questionDefinition.answers?.find(
              (answerOption) => String(answerOption.id) === selectedOptionId,
            );

            setSingleSelectedAnswer(questionDefinition.id, selectedAnswer || null);
          }}
          othersValue={selectedOthersValue}
          onOthersChange={(nextOthersValue) =>
            setDropdownOthersAnswer(questionDefinition.id, nextOthersValue)
          }
          placeholder={questionDefinition.placeholder || "Select an answer"}
          enableOthersOption={questionDefinition.enableOthersOption ?? true}
          enableSearch={questionDefinition.enableSearch ?? true}
        />
      );
    }

    if (questionDefinition.questionFormat === "Date") {
      const selectedDate = parseYyyyMmDdToDate(answeredQuestion.selectedAnswers[0]?.value ?? null);

      return (
        <CalendarPicker
          mode="full-date"
          value={selectedDate}
          onChange={(nextDate) => {
            const formattedDate = formatDateToYyyyMmDd(nextDate);

            setSingleSelectedAnswer(
              questionDefinition.id,
              formattedDate
                ? {
                    id: "1",
                    value: formattedDate,
                    type: "Date",
                  }
                : null,
            );
          }}
          placeholder={questionDefinition.placeholder || "Select date"}
        />
      );
    }

    if (questionDefinition.questionFormat === "Range") {
      const minimumAnswer = answeredQuestion.selectedAnswers.find(
        (selectedAnswer) => selectedAnswer.type === "Minimum",
      );
      const maximumAnswer = answeredQuestion.selectedAnswers.find(
        (selectedAnswer) => selectedAnswer.type === "Maximum",
      );
      const currencyCode = answeredQuestion.currencyCode || DEFAULT_CURRENCY_CODE;
      const selectedCurrencySymbol = getCurrencySymbol(currencyCode);
      const rangeLabels = questionDefinition.rangeLabels || {
        minimum: "Minimum",
        maximum: "Maximum",
      };

      return (
        <div className={styles.salaryRangeContainer}>
          <div className={styles.salaryField}>
            <span className={styles.salaryFieldLabel}>{rangeLabels.minimum}</span>
            <div className={styles.salaryInputWrapper}>
              <span className={styles.salarySymbol}>{selectedCurrencySymbol}</span>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={minimumAnswer?.value === null || minimumAnswer?.value === undefined ? "" : String(minimumAnswer.value)}
                onChange={(event) =>
                  setRangeAnswer(questionDefinition, "Minimum", event.target.value)
                }
                className={styles.salaryInput}
              />
              <div className={styles.salaryCurrencyDropdown}>
                <CurrencyDropdown
                  currency={currencyCode}
                  onCurrencyChange={(nextCurrencyCode) =>
                    setRangeCurrency(questionDefinition.id, nextCurrencyCode)
                  }
                  currencyOptions={CURRENCY_OPTIONS}
                  minimal={true}
                />
              </div>
            </div>
          </div>

          <div className={styles.salaryField}>
            <span className={styles.salaryFieldLabel}>{rangeLabels.maximum}</span>
            <div className={styles.salaryInputWrapper}>
              <span className={styles.salarySymbol}>{selectedCurrencySymbol}</span>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={maximumAnswer?.value === null || maximumAnswer?.value === undefined ? "" : String(maximumAnswer.value)}
                onChange={(event) =>
                  setRangeAnswer(questionDefinition, "Maximum", event.target.value)
                }
                className={styles.salaryInput}
              />
              <div className={styles.salaryCurrencyDropdown}>
                <CurrencyDropdown
                  currency={currencyCode}
                  onCurrencyChange={(nextCurrencyCode) =>
                    setRangeCurrency(questionDefinition.id, nextCurrencyCode)
                  }
                  currencyOptions={CURRENCY_OPTIONS}
                  minimal={true}
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (questionDefinition.questionFormat === "Checkboxes") {
      return (
        <div className={styles.preScreeningChoiceList}>
          {(questionDefinition.answers || []).map((answerOption) => {
            const isSelected = answeredQuestion.selectedAnswers.some(
              (selectedAnswer) => String(selectedAnswer.id) === String(answerOption.id),
            );

            return (
              <label key={String(answerOption.id)} className={styles.preScreeningChoiceRow}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleCheckboxAnswer(questionDefinition.id, answerOption)}
                  className={styles.preScreeningChoiceCheckbox}
                />
                <span>{String(answerOption.value || "")}</span>
              </label>
            );
          })}
        </div>
      );
    }

    if (questionDefinition.questionFormat === "Long Answer") {
      const selectedValue =
        typeof answeredQuestion.selectedAnswers[0]?.value === "string"
          ? answeredQuestion.selectedAnswers[0].value
          : "";

      return (
        <textarea
          value={selectedValue}
          onChange={(event) =>
            setSingleSelectedAnswer(questionDefinition.id, {
              id: "1",
              value: event.target.value,
              type: "Long Answer",
            })
          }
          className={styles.preScreeningTextarea}
          placeholder={questionDefinition.placeholder || "Type your answer"}
        />
      );
    }

    const selectedValue =
      typeof answeredQuestion.selectedAnswers[0]?.value === "string"
        ? answeredQuestion.selectedAnswers[0].value
        : "";

    return (
      <input
        type="text"
        value={selectedValue}
        onChange={(event) =>
          setSingleSelectedAnswer(questionDefinition.id, {
            id: "1",
            value: event.target.value,
            type: "Short Answer",
          })
        }
        className={styles.preScreeningTextInput}
        placeholder={questionDefinition.placeholder || "Type your answer"}
      />
    );
  };

  const getQuestionValidationError = (
    questionDefinition: PreScreeningQuestionDefinition,
    answeredQuestion: PreScreeningAnsweredQuestion,
  ): string | null => {
    const selectedAnswers = answeredQuestion.selectedAnswers;

    if (
      questionDefinition.questionFormat === "Short Answer" ||
      questionDefinition.questionFormat === "Long Answer" ||
      questionDefinition.questionFormat === "Dropdown"
    ) {
      const hasValidAnswer = selectedAnswers.some((selectedAnswer) =>
        hasNonEmptyAnswerValue(selectedAnswer.value),
      );

      return hasValidAnswer ? null : "This question is required.";
    }

    if (questionDefinition.questionFormat === "Checkboxes") {
      const hasValidAnswers =
        selectedAnswers.length > 0 &&
        selectedAnswers.every((selectedAnswer) => hasNonEmptyAnswerValue(selectedAnswer.value));

      return hasValidAnswers ? null : "Select at least one option.";
    }

    if (questionDefinition.questionFormat === "Date") {
      if (selectedAnswers.length !== 1) {
        return "Please select a date.";
      }

      const selectedDateAnswer = selectedAnswers[0];
      const parsedDate = parseYyyyMmDdToDate(selectedDateAnswer.value);

      if (selectedDateAnswer.type !== "Date" || !parsedDate) {
        return "Please select a valid date.";
      }

      return null;
    }

    if (questionDefinition.questionFormat === "Range") {
      const minimumAnswers = selectedAnswers.filter(
        (selectedAnswer) => selectedAnswer.type === "Minimum",
      );
      const maximumAnswers = selectedAnswers.filter(
        (selectedAnswer) => selectedAnswer.type === "Maximum",
      );

      if (
        selectedAnswers.length !== 2 ||
        minimumAnswers.length !== 1 ||
        maximumAnswers.length !== 1
      ) {
        return "Please provide both minimum and maximum salary.";
      }

      const minimumValue = Number(minimumAnswers[0].value);
      const maximumValue = Number(maximumAnswers[0].value);

      if (Number.isNaN(minimumValue) || Number.isNaN(maximumValue)) {
        return "Salary values must be valid numbers.";
      }

      if (maximumValue <= minimumValue) {
        return "Maximum salary must be greater than minimum salary.";
      }

      if (!answeredQuestion.currencyCode) {
        return "Please select a currency.";
      }

      return null;
    }

    return null;
  };

  const validatePreScreening = () => {
    const nextValidationErrors: Record<string, string> = {};

    preScreeningQuestions.forEach((questionDefinition) => {
      const answeredQuestion = preScreeningByQuestionId.get(questionDefinition.id);

      if (!answeredQuestion) {
        nextValidationErrors[questionDefinition.id] = "This question is required.";
        return;
      }

      const validationError = getQuestionValidationError(questionDefinition, answeredQuestion);

      if (validationError) {
        nextValidationErrors[questionDefinition.id] = validationError;
      }
    });

    return nextValidationErrors;
  };

  const handleContinueClick = async () => {
    const nextValidationErrors = validatePreScreening();
    const hasValidationErrors = Object.keys(nextValidationErrors).length > 0;

    setValidationErrors(nextValidationErrors);
    setShowValidationAlert(hasValidationErrors);

    if (hasValidationErrors) {
      return;
    }

    await onContinue?.(preScreening);
  };

  return (
    <div className={styles.cvDetailsContainer}>
      <div className={styles.gradient}>
        <div className={styles.cvDetailsCard}>
          <span className={styles.sectionTitle}>
            <BulbSparkle />
            Pre-screening questions
          </span>
          <div className={styles.detailsContainer}>
            <span className={styles.preScreeningDescription}>
              Just a few short questions to help your recruiters assess you faster. Takes less than a minute.
            </span>

            <div className={styles.preScreeningQuestionsContainer}>
              {preScreeningQuestions.map((questionDefinition) => {
                const answeredQuestion = preScreeningByQuestionId.get(questionDefinition.id);

                if (!answeredQuestion) {
                  return null;
                }

                return (
                  <div key={questionDefinition.id} className={styles.gradient}>
                    <div className={styles.cvDetailsCard}>
                      <span className={styles.sectionTitle}>
                        {questionDefinition.question}
                      </span>
                      <div className={styles.detailsContainer}>
                        {renderQuestionInput(questionDefinition, answeredQuestion)}
                        {validationErrors[questionDefinition.id] && (
                          <span className={styles.preScreeningFieldError}>
                            {validationErrors[questionDefinition.id]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.preScreeningStepFooter}>
        {showValidationAlert && (
          <span className={`${styles.preScreeningValidationAlert} ${styles.stepFooterAlert}`}>
            <img src="/iconsV2/alert-circle.svg" alt="Alert" />
            <span className={styles.preScreeningValidationText}>Required fields must be completed</span>
          </span>
        )}

        <div className={styles.stepFooterActions}>
          {onBack ? (
            <button
              type="button"
              className={styles.stepBackCircleBtn}
              onClick={onBack}
              aria-label="Go to previous step"
            >
              <img src="/iconsV3/arrowCircle.svg" alt="" className={styles.stepBackIcon} />
            </button>
          ) : <span />}
          <button
            type="button"
            onClick={handleContinueClick}
            disabled={isSaving}
            style={{
              opacity: isSaving ? 0.7 : 1,
              cursor: isSaving ? "not-allowed" : "pointer",
            }}
          >
            {isSaving ? "Saving..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  )
}
