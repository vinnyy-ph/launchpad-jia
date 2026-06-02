"use client";

import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from "react";
import InterviewQuestionGeneratorV2 from "@/lib/components/CareerComponents/InterviewQuestionGeneratorV2";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import VoiceSelector from "@/lib/components/CareerComponents/VoiceSelector";
import WalkthroughLanguageSelector from "@/lib/components/CareerComponents/WalkthroughLanguageSelector";

// Hardcoded supported languages for AI interview
const languageOptions = [
  { name: "English" },
  { name: "Tagalog" },
  { name: "Taglish" },
  { name: "Spanish" },
  { name: "Polish" },
  { name: "Urdu" },
  { name: "Mandarin" },
  { name: "Arabic" },
  { name: "Singaporean Mandarin" },
  { name: "Malay" },
];

// Default interview questions structure with 5 categories
export const DEFAULT_PROGRAM_INTERVIEW_QUESTIONS = [
  {
    id: 1,
    category: "CV Validation / Experience",
    questionCountToAsk: null,
    questions: [],
  },
  {
    id: 2,
    category: "Technical",
    questionCountToAsk: null,
    questions: [],
  },
  {
    id: 3,
    category: "Behavioral",
    questionCountToAsk: null,
    questions: [],
  },
  {
    id: 4,
    category: "Analytical",
    questionCountToAsk: null,
    questions: [],
  },
  {
    id: 5,
    category: "Others",
    questionCountToAsk: null,
    questions: [],
  },
];

const MIN_REQUIRED_INTERVIEW_QUESTIONS = 5;

export interface ProgramInterviewSetupHandle {
  validateStep: () => boolean;
}

interface ProgramInterviewSetupProps {
  form: ProgramInterviewSetupForm;
  setForm: React.Dispatch<React.SetStateAction<ProgramInterviewSetupForm>>;
  generationJobTitle: string;
  generationDescription: string;
  resolvedWalkthroughLanguage: "english" | "tagalog";
  enforceMinimumInterviewQuestions?: boolean;
  onFieldUpdate?: () => void;
}

export interface ProgramInterviewSetupForm {
  aiInterviewLanguage: string;
  voice: string;
  requireVideo: boolean;
  walkthroughLanguage: string;
  interviewSecretPrompt: string;
  questions: any[];
}

const ProgramInterviewSetup = forwardRef<
  ProgramInterviewSetupHandle,
  ProgramInterviewSetupProps
>(function ProgramInterviewSetup(
  {
    form,
    setForm,
    generationJobTitle,
    generationDescription,
    resolvedWalkthroughLanguage,
    enforceMinimumInterviewQuestions = true,
    onFieldUpdate,
  },
  ref
) {
  const [validationErrors, setValidationErrors] = useState<{
    [key: string]: boolean;
  }>({});

  const totalInterviewQuestions = useCallback(
    () =>
      form.questions.reduce(
        (accumulator, questionGroup) => accumulator + questionGroup.questions.length,
        0
      ),
    [form.questions]
  );

  const validateStep = useCallback(() => {
    const hasMinimumQuestions =
      totalInterviewQuestions() >= MIN_REQUIRED_INTERVIEW_QUESTIONS;
    const isValid = enforceMinimumInterviewQuestions ? hasMinimumQuestions : true;

    setValidationErrors((previousErrors) => ({
      ...previousErrors,
      interviewQuestions: enforceMinimumInterviewQuestions
        ? !hasMinimumQuestions
        : false,
    }));

    return isValid;
  }, [enforceMinimumInterviewQuestions, totalInterviewQuestions]);

  useImperativeHandle(
    ref,
    () => ({
      validateStep,
    }),
    [validateStep]
  );

  return (
    <div
      style={{ display: "flex", flexDirection: "row", gap: 16, width: "100%" }}
    >
      {/* Main Content - 70% */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "70%",
        }}
      >
        {/* AI Interview Settings Section */}
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
                1. AI Interview Settings
              </span>
            </div>
            <div className="layered-card-content">
              <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>
                AI Interview Language
              </span>
              <span style={{ fontSize: 14, color: "#717680", fontWeight: 400 }}>
                Set the language used for AI interview questions. English is the
                default.
              </span>
              <div style={{ maxWidth: "320px", marginTop: "8px" }}>
                <CustomDropdown
                  onSelectSetting={(setting) => {
                    setForm((previousForm) => ({
                      ...previousForm,
                      aiInterviewLanguage: setting,
                    }));
                  }}
                  screeningSetting={form.aiInterviewLanguage || "English"}
                  settingList={languageOptions}
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

              <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>
                AI Interview Voice
              </span>
              <span style={{ fontSize: 14, color: "#717680", fontWeight: 400 }}>
                Select the voice Jia will use for this specific career.
              </span>
              <div style={{ maxWidth: "320px" }}>
                <VoiceSelector
                  selectedVoice={form.voice}
                  onSelectVoice={(voiceId) => {
                    setForm((previousForm) => ({
                      ...previousForm,
                      voice: voiceId,
                    }));
                  }}
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

              <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>
                Require Video on Interview
              </span>
              <span style={{ fontSize: 14, color: "#717680", fontWeight: 400 }}>
                Require candidates to keep their camera on. Recordings will
                appear on their analysis page.
              </span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
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
                  <i
                    className="la la-video"
                    style={{ color: "#414651", fontSize: 20 }}
                  ></i>
                  <span style={{ fontSize: 14, color: "#414651" }}>
                    Require Video Interview
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={form.requireVideo}
                      onChange={() =>
                        setForm((previousForm) => ({
                          ...previousForm,
                          requireVideo: !previousForm.requireVideo,
                        }))
                      }
                    />
                    <span className="slider round"></span>
                  </label>
                  <span style={{ fontSize: 14, color: "#414651" }}>
                    {form.requireVideo ? "Yes" : "No"}
                  </span>
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

              <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>
                AI Interview Video Walkthrough
              </span>
              <span style={{ fontSize: 14, color: "#717680", fontWeight: 400 }}>
                Select the default language of the pre-interview video
                walkthrough. This can still be changed by the candidate in the
                job portal.
              </span>

              {/* Language Selector */}
              <WalkthroughLanguageSelector
                value={resolvedWalkthroughLanguage}
                onChange={(value) =>
                  setForm((previousForm) => ({
                    ...previousForm,
                    walkthroughLanguage: value,
                  }))
                }
              />

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
                  AI Interview Secret Prompt{" "}
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
                value={form.interviewSecretPrompt || ""}
                onChange={(e) => {
                  setForm((previousForm) => ({
                    ...previousForm,
                    interviewSecretPrompt: e.target.value,
                  }));
                }}
                placeholder="Enter a secret prompt (e.g. Treat candidates who speak in Taglish, English, or Tagalog equally. Focus on clarity, coherence, and confidence rather than language preference or accent.)"
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

        <InterviewQuestionGeneratorV2
          questions={form.questions}
          setQuestions={(questions) => {
            setForm((previousForm) => ({ ...previousForm, questions }));

            if (validationErrors.interviewQuestions) {
              setValidationErrors((previousErrors) => ({
                ...previousErrors,
                interviewQuestions: false,
              }));
            }

            onFieldUpdate?.();
          }}
          jobTitle={generationJobTitle}
          description={generationDescription}
          aiInterviewLanguage={form.aiInterviewLanguage}
          validationErrors={validationErrors}
          setValidationErrors={setValidationErrors}
        />
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
                  to fine-tune how Jia scores and evaluates the interview
                  responses.
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
                  Use "Generate Questions"
                </span>{" "}
                <span style={{ color: "#717680" }}>
                  to quickly create tailored interview questions, then refine or
                  mix them with your own for balanced results.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ProgramInterviewSetup.displayName = "ProgramInterviewSetup";

export default ProgramInterviewSetup;
