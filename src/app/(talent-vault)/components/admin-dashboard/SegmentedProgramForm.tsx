"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/components/ui";
import { api } from "@/lib/utils/apiClient";
import { candidateActionToast, errorToast } from "@/lib/Utils";
import FullScreenLoadingAnimation from "@/lib/components/CareerComponents/FullScreenLoadingAnimation";
import { ArrowRight, CheckCircleBroken } from "@untitledui/icons";
import SubProgramActionModal from "./SubProgramActionModal";
import ProgramDetailsSetup, {
  type ProgramDetailsSetupHandle,
} from "./ProgramDetailsSetup";
import ProgramPreScreeningSetup from "./ProgramPreScreeningSetup";
import ProgramInterviewSetup, {
  DEFAULT_PROGRAM_INTERVIEW_QUESTIONS,
  type ProgramInterviewSetupForm,
  type ProgramInterviewSetupHandle,
} from "./ProgramInterviewSetup";
import ReviewProgram from "./ReviewProgram";

type StepValidationResult =
  | { isValid: true }
  | { isValid: false; message: string };

const VALIDATION_OK: StepValidationResult = { isValid: true };
const MIN_REQUIRED_INTERVIEW_QUESTIONS = 5;

const SUPPORTED_PRE_SCREENING_FORMATS = new Set([
  "Short Answer",
  "Long Answer",
  "Dropdown",
  "Checkboxes",
  "Date",
  "Range",
]);

function countInterviewQuestions(questionGroups: any[]) {
  if (!Array.isArray(questionGroups)) {
    return 0;
  }

  return questionGroups.reduce((count, group) => {
    const groupQuestions = Array.isArray(group?.questions) ? group.questions : [];
    return count + groupQuestions.length;
  }, 0);
}

function validateProgramDetailsStep(programTitle: string, roleType: string): StepValidationResult {
  if (!programTitle.trim()) {
    return { isValid: false, message: "Program title is required." };
  }

  if (!roleType.trim()) {
    return { isValid: false, message: "Role type is required." };
  }

  return VALIDATION_OK;
}

function validatePreScreeningStep(preScreeningQuestions: any[]): StepValidationResult {
  if (!Array.isArray(preScreeningQuestions)) {
    return { isValid: false, message: "Pre-screening questions must be an array." };
  }

  for (let questionIndex = 0; questionIndex < preScreeningQuestions.length; questionIndex += 1) {
    const question = preScreeningQuestions[questionIndex];
    const questionLabel = `Pre-screening question #${questionIndex + 1}`;

    if (!question || typeof question !== "object") {
      return { isValid: false, message: `${questionLabel} is invalid.` };
    }

    const id = String(question.id || "").trim();
    const questionType = String(question.questionType || "").trim();
    const questionText = String(question.question || "").trim();
    const questionFormat = String(question.questionFormat || "").trim();

    if (!id) {
      return { isValid: false, message: `${questionLabel} is missing an id.` };
    }

    if (!questionType) {
      return { isValid: false, message: `${questionLabel} is missing question type.` };
    }

    if (!questionText) {
      return { isValid: false, message: `${questionLabel} cannot be empty.` };
    }

    if (!SUPPORTED_PRE_SCREENING_FORMATS.has(questionFormat)) {
      return {
        isValid: false,
        message: `${questionLabel} has unsupported format '${questionFormat}'.`,
      };
    }

    const answers = Array.isArray(question.answers) ? question.answers : [];

    if (questionFormat === "Dropdown" || questionFormat === "Checkboxes") {
      if (answers.length < 1) {
        return {
          isValid: false,
          message: `${questionType} must include at least one answer option.`,
        };
      }

      const hasEmptyAnswer = answers.some(
        (answer) => !String(answer?.value ?? "").trim()
      );

      if (hasEmptyAnswer) {
        return {
          isValid: false,
          message: `${questionType} contains an empty answer option.`,
        };
      }
    }

    if (questionFormat === "Range") {
      const hasMinimum = answers.some(
        (answer) => String(answer?.type || "").trim() === "Minimum"
      );
      const hasMaximum = answers.some(
        (answer) => String(answer?.type || "").trim() === "Maximum"
      );

      if (!hasMinimum || !hasMaximum) {
        return {
          isValid: false,
          message: `${questionType} must include both minimum and maximum answers.`,
        };
      }
    }
  }

  return VALIDATION_OK;
}

function validateInterviewStep(
  interviewForm: ProgramInterviewSetupForm,
  walkthroughLanguage: "english" | "tagalog",
  enforceMinimumQuestions: boolean
): StepValidationResult {
  if (!Array.isArray(interviewForm.questions)) {
    return { isValid: false, message: "Interview questions must be an array." };
  }

  const totalQuestions = countInterviewQuestions(interviewForm.questions);
  if (enforceMinimumQuestions && totalQuestions < MIN_REQUIRED_INTERVIEW_QUESTIONS) {
    return {
      isValid: false,
      message: "AI interview must contain at least 5 questions.",
    };
  }

  for (let groupIndex = 0; groupIndex < interviewForm.questions.length; groupIndex += 1) {
    const group = interviewForm.questions[groupIndex];
    const category = String(group?.category || "").trim();

    if (!category) {
      return {
        isValid: false,
        message: `Interview question group #${groupIndex + 1} is missing category.`,
      };
    }

    if (!Array.isArray(group?.questions)) {
      return {
        isValid: false,
        message: `Interview question group '${category}' must include a questions array.`,
      };
    }

    for (
      let questionIndex = 0;
      questionIndex < group.questions.length;
      questionIndex += 1
    ) {
      const question = String(group.questions[questionIndex]?.question || "").trim();
      if (!question) {
        return {
          isValid: false,
          message: `Interview question #${questionIndex + 1} in '${category}' cannot be empty.`,
        };
      }
    }
  }

  if (!String(interviewForm.aiInterviewLanguage || "").trim()) {
    return { isValid: false, message: "AI interview language is required." };
  }

  if (walkthroughLanguage !== "english" && walkthroughLanguage !== "tagalog") {
    return {
      isValid: false,
      message: "Walkthrough language must be either English or Tagalog.",
    };
  }

  return VALIDATION_OK;
}

function getValidationMessage(
  validationResult: StepValidationResult,
  fallbackMessage: string
) {
  if ("message" in validationResult) {
    return validationResult.message;
  }

  return fallbackMessage;
}

function cloneNestedArrayItems<T extends Record<string, any>>(items: T[]) {
  return items.map((item) => ({
    ...item,
    answers: Array.isArray(item.answers)
      ? item.answers.map((answer: Record<string, any>) => ({ ...answer }))
      : item.answers,
    questions: Array.isArray(item.questions)
      ? item.questions.map((question: Record<string, any>) => ({ ...question }))
      : item.questions,
  }));
}

export interface SegmentedProgramFormInitialData {
  title?: string;
  roleType?: string;
  status?: "active" | "inactive";
  secretPrompt?: string | null;
  preScreeningQuestions?: any[];
  interview?: {
    questions?: any[];
    aiInterviewLanguage?: string;
    voice?: string | null;
    requireVideo?: boolean;
    walkthroughLanguage?: string;
    interviewSecretPrompt?: string | null;
  };
}

interface SegmentedProgramFormProps {
  mode?: "create" | "edit";
  subprogramId?: string;
  initialData?: SegmentedProgramFormInitialData | null;
  initialStep?: number;
}

export default function SegmentedProgramForm({
  mode = "create",
  subprogramId,
  initialData,
  initialStep,
}: SegmentedProgramFormProps) {
  const router = useRouter();
  const isEditMode = mode === "edit";
  const enforceMinimumInterviewQuestions = !isEditMode || initialData?.status !== "inactive";
  // Clamp initialStep to safe bounds [0, 3] for 4-step stepper
  const safeInitialStep = Math.min(Math.max(initialStep ?? 0, 0), 3);
  const [currentStep, setCurrentStep] = useState(safeInitialStep);
  const [accomplishedStep, setAccomplishedStep] = useState(safeInitialStep);
  const [showExitModal, setShowExitModal] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [showStepValidationIndicator, setShowStepValidationIndicator] =
    useState(false);
  const [programTitle, setProgramTitle] = useState(initialData?.title || "");
  const [roleType, setRoleType] = useState(initialData?.roleType || "");
  const [secretPrompt, setSecretPrompt] = useState(initialData?.secretPrompt || "");
  const [preScreeningQuestions, setPreScreeningQuestions] = useState<any[]>(
    Array.isArray(initialData?.preScreeningQuestions)
      ? cloneNestedArrayItems(initialData.preScreeningQuestions)
      : []
  );
  const [interviewForm, setInterviewForm] = useState<ProgramInterviewSetupForm>(() => {
    const interview = initialData?.interview || {};

    return {
      aiInterviewLanguage: interview.aiInterviewLanguage || "English",
      voice: interview.voice || "",
      requireVideo:
        typeof interview.requireVideo === "boolean" ? interview.requireVideo : true,
      walkthroughLanguage:
        String(interview.walkthroughLanguage || "english").toLowerCase() === "tagalog"
          ? "tagalog"
          : "english",
      interviewSecretPrompt: interview.interviewSecretPrompt || "",
      questions: Array.isArray(interview.questions)
        ? cloneNestedArrayItems(interview.questions)
        : DEFAULT_PROGRAM_INTERVIEW_QUESTIONS.map((questionGroup) => ({
            ...questionGroup,
            questions: [],
          })),
    };
  });

  const interviewGenerationDescription = useMemo(() => {
    const normalizedRoleType = roleType.trim() || "general";
    const baseDescription = `
      This is a talent vault program titled: ${normalizedRoleType}.
      - Generate questions based on program title.
      - If the program title didn't specify specialized field, provide a general-type of questions. Don't assume the field.
      - Assume that user is first-time applying for the program.
      - The target users who will answer the questions are students or just starting out with their career
      - Don't treat the program as a job role.
    `;
    const normalizedSecretPrompt = secretPrompt.trim();

    if (!normalizedSecretPrompt) {
      return baseDescription;
    }

    return `${baseDescription}\n\nAdditional interviewer guidance: ${normalizedSecretPrompt}`;
  }, [roleType, secretPrompt]);

  const resolvedWalkthroughLanguage = useMemo<"english" | "tagalog">(() => {
    if (interviewForm.walkthroughLanguage === "tagalog") {
      return "tagalog";
    }

    return "english";
  }, [interviewForm.walkthroughLanguage]);

  const programDetailsStepRef = useRef<ProgramDetailsSetupHandle>(null);
  const programInterviewStepRef = useRef<ProgramInterviewSetupHandle>(null);

  const [programSteps, setProgramSteps] = useState([
    { name: "Program Details & Team Access", completed: false },
    { name: "Pre-screening", completed: false },
    { name: "AI Interview Setup", completed: false },
    { name: "Review Program", completed: false },
  ]);

  const currentStepName = programSteps[currentStep]?.name || "";

  const focusInvalidStep = (stepIndex: number, errorMessage: string) => {
    setShowStepValidationIndicator(true);
    setCurrentStep(stepIndex);
    errorToast(errorMessage, 2200);

    if (stepIndex === 0 || stepIndex === 2) {
      setTimeout(() => {
        if (stepIndex === 0) {
          programDetailsStepRef.current?.validateStep();
        }

        if (stepIndex === 2) {
          programInterviewStepRef.current?.validateStep();
        }
      }, 0);
    }
  };

  const validateCurrentStep = (): StepValidationResult => {
    if (currentStepName === "Program Details & Team Access") {
      const detailsValidation = validateProgramDetailsStep(programTitle, roleType);
      const detailsRefValidation = programDetailsStepRef.current?.validateStep();

      if (detailsRefValidation === false) {
        if (!detailsValidation.isValid) {
          return detailsValidation;
        }

        return {
          isValid: false,
          message: "Fix required fields in Program Details.",
        };
      }

      if (!detailsValidation.isValid) {
        return detailsValidation;
      }

      return VALIDATION_OK;
    }

    if (currentStepName === "Pre-screening") {
      return validatePreScreeningStep(preScreeningQuestions);
    }

    if (currentStepName === "AI Interview Setup") {
      const interviewValidation = validateInterviewStep(
        interviewForm,
        resolvedWalkthroughLanguage,
        enforceMinimumInterviewQuestions
      );
      const interviewRefValidation = programInterviewStepRef.current?.validateStep();

      if (interviewRefValidation === false) {
        if (!interviewValidation.isValid) {
          return interviewValidation;
        }

        return {
          isValid: false,
          message: "Fix required fields in AI Interview Setup.",
        };
      }

      if (!interviewValidation.isValid) {
        return interviewValidation;
      }

      return VALIDATION_OK;
    }

    return VALIDATION_OK;
  };

  const handleContinue = () => {
    const stepValidation = validateCurrentStep();

    if (!stepValidation.isValid) {
      setShowStepValidationIndicator(true);
      errorToast(getValidationMessage(stepValidation, "Fix required fields."), 2200);
      return;
    }

    setShowStepValidationIndicator(false);

    const nextStep = currentStep + 1;

    // Mark all steps up to and including current step as completed
    const updatedSteps = programSteps.map((step, index) => ({
      ...step,
      completed: index <= currentStep,
    }));
    setProgramSteps(updatedSteps);

    // Advance to next step
    if (currentStep < programSteps.length - 1) {
      setAccomplishedStep(nextStep);
      setCurrentStep(nextStep);
    }
  };

  const handleExitAction = (action: string) => {
    if (action === "exit") {
      router.push("/admin-portal/talent-vault?tab=programs");
    }
    setShowExitModal("");
  };

  const handlePublish = async () => {
    const detailsValidation = validateProgramDetailsStep(programTitle, roleType);
    if (!detailsValidation.isValid) {
      focusInvalidStep(
        0,
        getValidationMessage(detailsValidation, "Fix required fields in Program Details.")
      );
      return;
    }

    const preScreeningValidation = validatePreScreeningStep(preScreeningQuestions);
    if (!preScreeningValidation.isValid) {
      focusInvalidStep(
        1,
        getValidationMessage(
          preScreeningValidation,
          "Fix required fields in Pre-screening."
        )
      );
      return;
    }

    const interviewValidation = validateInterviewStep(
      interviewForm,
      resolvedWalkthroughLanguage,
      enforceMinimumInterviewQuestions
    );
    if (!interviewValidation.isValid) {
      focusInvalidStep(
        2,
        getValidationMessage(
          interviewValidation,
          "Fix required fields in AI Interview Setup."
        )
      );
      return;
    }

    setShowStepValidationIndicator(false);

    if (isPublishing) {
      return;
    }

    if (isEditMode && !subprogramId) {
      errorToast("Unable to save program changes.", 2000);
      return;
    }

    const programPayload = {
      title: programTitle,
      roleType,
      secretPrompt,
      preScreeningQuestions,
      interview: {
        questions: interviewForm.questions,
        aiInterviewLanguage: interviewForm.aiInterviewLanguage || "English",
        voice: interviewForm.voice || null,
        requireVideo: Boolean(interviewForm.requireVideo),
        walkthroughLanguage: resolvedWalkthroughLanguage,
        interviewSecretPrompt: interviewForm.interviewSecretPrompt || null,
      },
    };

    const createProgramPayload = {
      ...programPayload,
      status: "active",
      activityStatus: "Active",
    };

    try {
      setIsPublishing(true);
      const response = isEditMode
        ? await api.put(`/api/talent-vault/subprograms/${subprogramId}`, programPayload)
        : await api.post("/api/talent-vault/subprograms", createProgramPayload);

      if (response.status !== 200 && response.status !== 201) {
        throw new Error(
          isEditMode ? "Failed to update program" : "Failed to publish program"
        );
      }

      candidateActionToast(
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", marginLeft: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
            {isEditMode ? "Program updated" : "Program published"}
          </span>
        </div>,
        1300,
        <i className="la la-check-circle" style={{ color: "#039855", fontSize: 32 }}></i>
      );

      router.push("/admin-portal/talent-vault?tab=programs");
    } catch (error: any) {
      console.error(isEditMode ? "Error updating program:" : "Error publishing program:", error);
      const errorMessage =
        error?.response?.data?.error ||
        (isEditMode
          ? "Failed to update program. Please try again."
          : "Failed to publish program. Please try again.");
      errorToast(errorMessage, 2000);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div style={{ width: "100%" }}>
      {/* Top section with larger max-width */}
      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "1800px", padding: "0 20px" }}>
          <div
            style={{
              marginBottom: "35px",
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
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
              <h1
                style={{ fontSize: "24px", fontWeight: 550, color: "#111827" }}
              >
                {isEditMode ? "Edit program" : "Add new program"}
              </h1>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: "10px",
              }}
            >
              {showStepValidationIndicator && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <i
                    className="la la-exclamation-triangle"
                    style={{ color: "#EF4444", fontSize: 18 }}
                  ></i>
                  <span
                    style={{
                      color: "#B42318",
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    Fix required fields
                  </span>
                </div>
              )}
              <Button
                variant="secondary"
                label="Exit"
                disabled={isPublishing}
                onClick={() => setShowExitModal("exit")}
              />
              {currentStep < programSteps.length - 1 ? (
                <Button
                  variant="primary"
                  label="Continue"
                  iconJsx={<ArrowRight size={20} color="#fff" />}
                  iconPosition="right"
                  disabled={isPublishing}
                  onClick={handleContinue}
                />
              ) : (
                <Button
                  variant="primary"
                  label={
                    isPublishing
                      ? isEditMode
                        ? "Saving..."
                        : "Publishing..."
                      : isEditMode
                        ? "Save Changes"
                        : "Publish"
                  }
                  iconJsx={<CheckCircleBroken size={20} color="#fff" />}
                  iconPosition="left"
                  disabled={isPublishing}
                  onClick={handlePublish}
                />
              )}
            </div>
          </div>
          {/* Segmented Bar */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            {programSteps.map((step, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 8,
                  position: "relative",
                  flex: index === programSteps.length - 1 ? "0 0 auto" : "1 1 0",
                  maxWidth: index === programSteps.length - 1 ? "150px" : "none",
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
                  {step.completed ? (
                    <div
                      style={{
                        border: "1px solid #000000",
                        backgroundColor: "#000000",
                        borderRadius: "50%",
                        padding: "4px",
                        height: "24px",
                        width: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <i
                        className="la la-check"
                        style={{ color: "#FFFFFF", fontSize: 20 }}
                      ></i>
                    </div>
                  ) : (
                    <div
                      style={{
                        border: `1px solid ${
                          accomplishedStep === index ? "#000000" : "#D5D7DA"
                        }`,
                        borderRadius: "50%",
                        padding: "4px",
                        height: "24px",
                        width: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          backgroundColor:
                            accomplishedStep === index ? "#000000" : "#D5D7DA",
                          borderRadius: "50%",
                        }}
                      />
                    </div>
                  )}
                  {index !== programSteps.length - 1 && (
                    <div
                      style={{
                        width: "calc(100% - 48px)",
                        height: "5px",
                        background: "#E9EAEB",
                        backgroundColor: "#E9EAEB",
                        position: "absolute",
                        top: "12px",
                        left: "36px",
                        right: "12px",
                        transform: "translateY(-50%)",
                      }}
                    >
                      {currentStep >= index && (
                        <div
                          style={{
                            width: currentStep > index ? "100%" : "0%",
                            height: "5px",
                            background:
                              currentStep > index
                                ? "linear-gradient(90deg, #9fcaed 0%, #ceb6da 33%, #ebacc9 66%, #fccec0 100%)"
                                : "#E9EAEB",
                            backgroundColor:
                              currentStep > index ? "transparent" : "#E9EAEB",
                            position: "absolute",
                            top: "50%",
                            transform: "translateY(-50%)",
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    cursor:
                      step.completed || index === accomplishedStep
                        ? "pointer"
                        : "not-allowed",
                  }}
                  onClick={() => {
                    if (step.completed || index === accomplishedStep) {
                      setShowStepValidationIndicator(false);
                      setCurrentStep(index);
                    }
                  }}
                >
                  <span
                    style={{
                      fontSize: 16,
                      color:
                        step.completed || index === accomplishedStep
                          ? "#181D27"
                          : "#717680",
                      fontWeight: 700,
                    }}
                  >
                    {step.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Divider aligned with top section */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          marginTop: "32px",
          marginBottom: "24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "1800px", padding: "0 20px" }}>
          <div
            style={{
              width: "100%",
              height: "1px",
              backgroundColor: "#E9EAEB",
            }}
          ></div>
        </div>
      </div>

      {/* Content section with smaller max-width */}
      <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: "100%",
            maxWidth: "1400px",
            padding: "0 20px",
          }}
        >
          {currentStepName === "Program Details & Team Access" && (
            <ProgramDetailsSetup
              ref={programDetailsStepRef}
              programTitle={programTitle}
              roleType={roleType}
              secretPrompt={secretPrompt}
              onProgramTitleChange={setProgramTitle}
              onRoleTypeChange={setRoleType}
              onSecretPromptChange={setSecretPrompt}
              onFieldUpdate={() => setShowStepValidationIndicator(false)}
            />
          )}
          {currentStepName === "Pre-screening" && (
            <ProgramPreScreeningSetup
              preScreeningQuestions={preScreeningQuestions}
              setPreScreeningQuestions={(value) => {
                setPreScreeningQuestions(value);
                setShowStepValidationIndicator(false);
              }}
            />
          )}
          {currentStepName === "AI Interview Setup" && (
            <ProgramInterviewSetup
              ref={programInterviewStepRef}
              form={interviewForm}
              setForm={setInterviewForm}
              generationJobTitle={programTitle.trim()}
              generationDescription={interviewGenerationDescription}
              resolvedWalkthroughLanguage={resolvedWalkthroughLanguage}
              enforceMinimumInterviewQuestions={enforceMinimumInterviewQuestions}
              onFieldUpdate={() => setShowStepValidationIndicator(false)}
            />
          )}
          {currentStepName === "Review Program" && (
            <ReviewProgram
              programTitle={programTitle}
              roleType={roleType}
              secretPrompt={secretPrompt}
              preScreeningQuestions={preScreeningQuestions}
              interviewForm={interviewForm}
              resolvedWalkthroughLanguage={resolvedWalkthroughLanguage}
              setCurrentStep={(stepIndex) => {
                setShowStepValidationIndicator(false);
                setCurrentStep(stepIndex);
              }}
            />
          )}
        </div>
      </div>

      <SubProgramActionModal action={showExitModal} onAction={handleExitAction} />
      {isPublishing && (
        <FullScreenLoadingAnimation
          title={isEditMode ? "Saving program changes..." : "Publishing program..."}
          subtext={
            isEditMode
              ? "Please wait while we save your program changes"
              : "Please wait while we save your program"
          }
        />
      )}
    </div>
  );
}
