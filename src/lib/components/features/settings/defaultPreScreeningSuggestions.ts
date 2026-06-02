export type PreScreeningQuestionFormat =
  | "Short Answer"
  | "Long Answer"
  | "Dropdown"
  | "Checkboxes"
  | "Range";

export type PreScreeningRule =
  | "Above maximum only"
  | "Below minimum only"
  | "Outside the range";

export type PreScreeningAnswer = {
  id: string | number;
  value: string | number;
  type: string;
  dropCandidate?: boolean;
};

export type PreScreeningSuggestion = {
  id: string;
  questionType: string;
  question: string;
  questionFormat: PreScreeningQuestionFormat;
  isAutoFiltering?: boolean;
  screeningRule?: PreScreeningRule;
  answers: PreScreeningAnswer[];
};

export const PRE_SCREENING_CURRENCY_OPTIONS = [
  { name: "PHP", symbol: "₱" },
  { name: "USD", symbol: "$" },
  { name: "EUR", symbol: "€" },
  { name: "JPY", symbol: "¥" },
  { name: "CNY", symbol: "¥" },
];

export const DEFAULT_PRE_SCREENING_CURRENCY = "PHP";

export const DEFAULT_PRE_SCREENING_SUGGESTIONS: PreScreeningSuggestion[] = [
  {
    id: "1",
    questionType: "Notice Period",
    question: "How long is your notice period?",
    questionFormat: "Dropdown",
    isAutoFiltering: false,
    answers: [
      { id: "1", value: "Immediately", type: "Dropdown" },
      { id: "2", value: "< 30 days", type: "Dropdown" },
      { id: "3", value: "> 30 days", type: "Dropdown" },
    ],
  },
  {
    id: "2",
    questionType: "Work Setup",
    question: "How often are you willing to report to the office each week?",
    questionFormat: "Dropdown",
    isAutoFiltering: false,
    answers: [
      { id: "1", value: "At most 1-2x a week", type: "Dropdown" },
      { id: "2", value: "At most 3-4x a week", type: "Dropdown" },
      { id: "3", value: "Open to fully onsite work", type: "Dropdown" },
      { id: "4", value: "Only open to fully remote work", type: "Dropdown" },
    ],
  },
  {
    id: "3",
    questionType: "Asking Salary",
    question: "How much is your expected monthly salary?",
    questionFormat: "Range",
    isAutoFiltering: false,
    answers: [
      { id: "1", value: 40000, type: "Minimum" },
      { id: "2", value: 60000, type: "Maximum" },
    ],
  },
];

export const BUILT_IN_PRE_SCREENING_QUESTION_IDS = new Set(
  DEFAULT_PRE_SCREENING_SUGGESTIONS.map((question) => String(question.id))
);

export const clonePreScreeningSuggestions = (
  suggestions: PreScreeningSuggestion[]
) => JSON.parse(JSON.stringify(suggestions)) as PreScreeningSuggestion[];
