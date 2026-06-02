"use client";

import { useEffect, useMemo, useState } from "react";
import { GoalCard } from "./GoalCard";
import styles from "@/app/(talent-vault)/styles/modules/profile-setup.module.scss";
import SkillTagInput from "@/lib/components/CandidateComponents/SkillTagInput";
import { api } from "@/lib/utils/apiClient";
import { extractTvError } from "@/app/(talent-vault)/lib/tvErrorMap";
import gpWomanMg from "@/app/(talent-vault)/assets/gp-woman-mg.png";
import gpStability from "@/app/(talent-vault)/assets/career-goals/gp-stability.jpg";
import gpRealWorldExp from "@/app/(talent-vault)/assets/career-goals/gp-realworld-exp.jpg";
import gpMentorship from "@/app/(talent-vault)/assets/career-goals/gp-mentorship.jpg";
import gpConfCred from "@/app/(talent-vault)/assets/career-goals/gp-conf-cred.jpg";
import gpCompanyCulture from "@/app/(talent-vault)/assets/career-goals/gp-company-culture.jpg";
import gpFairPay from "@/app/(talent-vault)/assets/career-goals/gp-fair-pay.jpg";
import gpBuildResume from "@/app/(talent-vault)/assets/career-goals/gp-build-resume.jpg";
import gpWorkLifeBal from "@/app/(talent-vault)/assets/career-goals/gp-worklife-bal.jpg";

type ObjectId = string;

type CareerGoal = {
  id: ObjectId;
  title: string;
  description: string;
  illustration?: string;
};


export type StartDatePreference = "Immediate" | "Flexible";

export type GoalsSelection = {
  selectedSubprogramId: ObjectId | null;
  selectedSubprogramSnapshot?: { title: string; roleType: string } | null;
  startDatePreference: StartDatePreference | null;
  fieldOfInterests: string[];
  careerGoalIds: ObjectId[];
  careerGoalsSnapshot: Array<{ title: string; description: string }>;
};

type GoalValidationErrors = {
  selectedSubprogramId?: string;
  startDatePreference?: string;
  careerGoals?: string;
};


const startDateOptions = [
  { value: "Immediate" as const, label: "Immediately (actively looking for work)" },
  { value: "Flexible" as const, label: "Flexible (casually looking)" },
];

type SubprogramOption = {
  _id: string;
  title: string;
  roleType: string;
};

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  return Array.from(
    new Set(
      input
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

const careerGoals: CareerGoal[] = [
  {
    id: "stability-and-security",
    illustration: gpStability.src,
    title: "Stability and Security",
    description:
      "I want to join an established company that provides steady and stable income. ",
  },
  {
    id: "gain-real-world-experience",
    illustration: gpRealWorldExp.src,
    title: "Gain Real-World Experience",
    description: "I want to apply my knowledge and skills in a practical setting.",
  },
  {
    id: "mentorship-and-training",
    illustration: gpMentorship.src,
    title: "Mentorship and Training",
    description:
      "I want to learn from experienced professionals and receive proper training.",
  },
  {
    id: "build-confidence-and-credibility",
    illustration: gpConfCred.src,
    title: "Build Confidence and Credibility",
    description:
      "I want to overcome my impostor syndrome and prove my capabilities in my chosen carer.",
  },
  {
    id: "positive-company-culture",
    illustration: gpCompanyCulture.src,
    title: "Positive Company Culture",
    description:
      "I want to be in an environment with approachable managers and helpful teammates.",
  },
  {
    id: "career-discovery-and-direction",
    illustration: gpWomanMg.src,
    title: "Career Discover and Direction",
    description:
      "I want to explore what I’m actually good at, so I don’t mind exploring other industries and job functions.",
  },
  {
    id: "earn-fair-pay",
    illustration: gpFairPay.src,
    title: "Earn Fair Pay",
    description:
      "I value transparent salary ranges, even as an entry level. (Looking for growth in pay over time).",
  },
  {
    id: "build-my-resume",
    illustration: gpBuildResume.src,
    title: "Build My Resume",
    description:
      "I want roles are credible and meaningful in my career path, with achievements I can showcase.",
  },
  {
    id: "work-life-balance",
    illustration: gpWorkLifeBal.src,
    title: "Work-Life Balance",
    description:
      "I am all about working in a flexible setting, with human schedules, and respectful work culture.",
  },
];

function createGoalsSelection(
  initialSelection?: Partial<GoalsSelection> | null
): GoalsSelection {
  const selectedSubprogramId = initialSelection?.selectedSubprogramId || null;
  const selectedSubprogramSnapshot = initialSelection?.selectedSubprogramSnapshot || null;

  const startDatePreference =
    initialSelection?.startDatePreference === "Immediate" ||
    initialSelection?.startDatePreference === "Flexible"
      ? initialSelection.startDatePreference
      : null;
  const fieldOfInterests = normalizeStringList(initialSelection?.fieldOfInterests);

  const careerGoalIds = Array.isArray(initialSelection?.careerGoalIds)
    ? initialSelection.careerGoalIds.map((goalId) => String(goalId).trim()).filter(Boolean)
    : [];

  const careerGoalsSnapshot = careerGoalIds
    .map((goalId) => careerGoals.find((goal) => goal.id === goalId))
    .filter((goal): goal is CareerGoal => Boolean(goal))
    .map((goal) => ({
      title: goal.title,
      description: goal.description,
    }));

  return {
    selectedSubprogramId,
    selectedSubprogramSnapshot,
    startDatePreference,
    fieldOfInterests,
    careerGoalIds,
    careerGoalsSnapshot,
  };
}

interface GoalSettingStepProps {
  initialSelection?: Partial<GoalsSelection> | null;
  initialFieldOfInterests?: string[] | null;
  onBack?(): void;
  onContinue?(selection: GoalsSelection): Promise<void> | void;
  isSaving?: boolean;
}

export function GoalSettingStep({
  initialSelection,
  initialFieldOfInterests,
  onBack,
  onContinue,
  isSaving = false,
}: GoalSettingStepProps) {
  const [subprograms, setSubprograms] = useState<SubprogramOption[]>([]);
  const [subprogramsLoading, setSubprogramsLoading] = useState(true);
  const [subprogramsError, setSubprogramsError] = useState<string | null>(null);

  const [goalsSelection, setGoalsSelection] = useState<GoalsSelection>(() => {
    const baseSelection = createGoalsSelection(initialSelection);
    if (baseSelection.fieldOfInterests.length > 0) {
      return baseSelection;
    }

    return {
      ...baseSelection,
      fieldOfInterests: normalizeStringList(initialFieldOfInterests),
    };
  });
  const [validationErrors, setValidationErrors] = useState<GoalValidationErrors>({});
  const [showValidationAlert, setShowValidationAlert] = useState(false);

  const fetchSubprograms = async () => {
    try {
      setSubprogramsLoading(true);
      setSubprogramsError(null);
      const response = await api.get("/api/talent-vault/subprograms/candidate");
      setSubprograms(response.data.subprograms || []);
    } catch (error: any) {
      console.error("Failed to fetch subprograms:", error);
      const { message } = extractTvError(error);
      setSubprogramsError(message || "Failed to load subprogram options. Please try again.");
    } finally {
      setSubprogramsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubprograms();
  }, []);

  useEffect(() => {
    const baseSelection = createGoalsSelection(initialSelection);
    const fallbackInterestIds = normalizeStringList(initialFieldOfInterests);

    setGoalsSelection({
      ...baseSelection,
      fieldOfInterests:
        baseSelection.fieldOfInterests.length > 0
          ? baseSelection.fieldOfInterests
          : fallbackInterestIds,
    });
    setValidationErrors({});
    setShowValidationAlert(false);
  }, [initialSelection, initialFieldOfInterests]);

  const canContinue = useMemo(() => !isSaving && !subprogramsLoading && !!goalsSelection.selectedSubprogramId, [isSaving, subprogramsLoading, goalsSelection.selectedSubprogramId]);

  const handleSubprogramChange = (subprogramId: string) => {
    setShowValidationAlert(false);
    setValidationErrors((previousErrors) => ({
      ...previousErrors,
      selectedSubprogramId: undefined,
    }));

    const subprogram = subprograms.find((sp) => sp._id === subprogramId);

    setGoalsSelection((previousSelection) => ({
      ...previousSelection,
      selectedSubprogramId: subprogramId,
      selectedSubprogramSnapshot: subprogram
        ? { title: subprogram.title, roleType: subprogram.roleType }
        : null,
    }));
  };

  const toggleCareerGoal = (goal: CareerGoal) => {
    setShowValidationAlert(false);
    setValidationErrors((previousErrors) => ({
      ...previousErrors,
      careerGoals: undefined,
    }));

    setGoalsSelection((previousSelection) => {
      const isSelected = previousSelection.careerGoalIds.includes(goal.id);

      if (isSelected) {
        const nextIds = previousSelection.careerGoalIds.filter(
          (careerGoalId) => careerGoalId !== goal.id
        );

        return {
          ...previousSelection,
          careerGoalIds: nextIds,
          careerGoalsSnapshot: nextIds
            .map((nextId) => careerGoals.find((careerGoal) => careerGoal.id === nextId))
            .filter((careerGoal): careerGoal is CareerGoal => Boolean(careerGoal))
            .map((careerGoal) => ({
              title: careerGoal.title,
              description: careerGoal.description,
            })),
        };
      }

      if (previousSelection.careerGoalIds.length >= 3) {
        return previousSelection;
      }

      const nextIds = [...previousSelection.careerGoalIds, goal.id];
      return {
        ...previousSelection,
        careerGoalIds: nextIds,
        careerGoalsSnapshot: nextIds
          .map((nextId) => careerGoals.find((careerGoal) => careerGoal.id === nextId))
          .filter((careerGoal): careerGoal is CareerGoal => Boolean(careerGoal))
          .map((careerGoal) => ({
            title: careerGoal.title,
            description: careerGoal.description,
          })),
      };
    });
  };

  const handleStartDateChange = (startDatePreference: StartDatePreference) => {
    setShowValidationAlert(false);
    setValidationErrors((previousErrors) => ({
      ...previousErrors,
      startDatePreference: undefined,
    }));

    setGoalsSelection((previousSelection) => ({
      ...previousSelection,
      startDatePreference,
    }));
  };

  const handleFieldOfInterestsChange = (nextInterestIds: string[]) => {
    setGoalsSelection((previousSelection) => ({
      ...previousSelection,
      fieldOfInterests: normalizeStringList(nextInterestIds),
    }));
  };

  const handleContinueClick = async () => {
    const nextValidationErrors: GoalValidationErrors = {};

    if (!goalsSelection.selectedSubprogramId) {
      nextValidationErrors.selectedSubprogramId = "Select a work goal option.";
    }

    if (!goalsSelection.startDatePreference) {
      nextValidationErrors.startDatePreference =
        "Select your start date preference.";
    }

    if (goalsSelection.careerGoalIds.length === 0) {
      nextValidationErrors.careerGoals = "Select at least one career goal.";
    }

    const hasErrors = Object.keys(nextValidationErrors).length > 0;
    setValidationErrors(nextValidationErrors);
    setShowValidationAlert(hasErrors);

    if (hasErrors) {
      return;
    }

    await onContinue?.(goalsSelection);
  };

  return (
    <div className={styles.cvDetailsContainer}>
      <div className={styles.gradient}>
        <div className={`${styles.cvDetailsCard} ${styles.workGoals}`}>
          <span className={styles.sectionTitle}>Work Goals</span>
          <div className={styles.detailsContainer}>
            <div className={styles.workGoalsForm}>
              <div className={styles.workGoalSection}>
                <div className={styles.workGoalPrompt}>What are you looking for?</div>
                {subprogramsLoading ? (
                  <div className={styles.workGoalOptionsCard}>
                    <span>Loading options...</span>
                  </div>
                ) : subprogramsError ? (
                  <div className={styles.workGoalOptionsCard}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-start" }}>
                      <span className={styles.goalFieldError}>{subprogramsError}</span>
                      <button
                        type="button"
                        onClick={fetchSubprograms}
                        style={{
                          padding: "6px 12px",
                          fontSize: "14px",
                          cursor: "pointer",
                          backgroundColor: "#4169e1",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                ) : subprograms.length === 0 ? (
                  <div className={styles.workGoalOptionsCard}>
                    <span>No programs are currently available.</span>
                  </div>
                ) : (
                  <div className={styles.workGoalOptionsCard}>
                    {subprograms.map((option) => {
                      const id = `subprogram-${option._id}`;
                      return (
                        <label key={option._id} htmlFor={id} className={styles.workGoalOptionRow}>
                          <input
                            id={id}
                            className={styles.workGoalRadio}
                            type="radio"
                            name="work-goal-subprogram"
                            checked={goalsSelection.selectedSubprogramId === option._id}
                            onChange={() => handleSubprogramChange(option._id)}
                          />
                          <span>{option.title}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {validationErrors.selectedSubprogramId && (
                  <span className={styles.goalFieldError}>{validationErrors.selectedSubprogramId}</span>
                )}
              </div>

              <div className={styles.workGoalSection}>
                <div className={styles.workGoalPrompt}>Start Date</div>
                <div className={styles.workGoalOptionsCard}>
                  {startDateOptions.map((option) => {
                    const id = `start-date-${option.value.toLowerCase()}`;
                    return (
                      <label key={option.value} htmlFor={id} className={styles.workGoalOptionRow}>
                        <input
                          id={id}
                          className={styles.workGoalRadio}
                          type="radio"
                          name="work-goal-start-date"
                          checked={goalsSelection.startDatePreference === option.value}
                          onChange={() => handleStartDateChange(option.value)}
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
                {validationErrors.startDatePreference && (
                  <span className={styles.goalFieldError}>
                    {validationErrors.startDatePreference}
                  </span>
                )}
              </div>

              <div className={styles.workGoalSection}>
                <div className={styles.workGoalPrompt}>Field of Interests</div>

                <div className={styles.workGoalOptionsCard}>
                  <SkillTagInput
                    skills={goalsSelection.fieldOfInterests}
                    onSkillsChange={handleFieldOfInterestsChange}
                    compact
                    placeholder="Enter field of interest (ex. design)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.gradient}>
        <div className={`${styles.cvDetailsCard} ${styles.goalSetting}`}>
          <span className={styles.sectionTitle}>Career Goals</span>
          <div className={styles.detailsContainer}>
            <p>
              Select up to <strong>3</strong> that best resonated with you.
            </p>

            <div className={styles.goalCards}>
              {careerGoals.map((goal) => {
                const isSelected = goalsSelection.careerGoalIds.includes(goal.id);
                const isDisabled =
                  !isSelected && goalsSelection.careerGoalIds.length >= 3;

                return (
                  <GoalCard
                    key={goal.id}
                    title={goal.title}
                    description={goal.description}
                    imgSrc={goal.illustration || gpWomanMg.src}
                    selected={isSelected}
                    disabled={isDisabled}
                    onClick={() => toggleCareerGoal(goal)}
                  />
                );
              })}
            </div>
            {validationErrors.careerGoals && (
              <span className={styles.goalFieldError}>{validationErrors.careerGoals}</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.goalStepFooter}>
        {showValidationAlert && (
          <span className={`${styles.goalStepValidationAlert} ${styles.stepFooterAlert}`}>
            <img src="/iconsV2/alert-circle.svg" alt="Alert" />
            <span className={styles.goalStepValidationText}>
              Required fields must be completed
            </span>
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
              <img
                src="/iconsV3/arrowCircle.svg"
                alt=""
                className={styles.stepBackIcon}
              />
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={handleContinueClick}
            disabled={!canContinue}
            style={{
              opacity: canContinue ? 1 : 0.7,
              cursor: canContinue ? "pointer" : "not-allowed",
            }}
          >
            {isSaving ? "Saving..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
