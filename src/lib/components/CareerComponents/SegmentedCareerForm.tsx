"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "@/lib/context/AppContext";
import CustomDropdown from "@/lib/components/CareerComponents/CustomDropdown";
import ProjectDropdown from "./ProjectDropdown";
import CurrencyDropdown from "@/lib/components/CareerComponents/CurrencyDropdown";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import philippineCitiesAndProvinces from "../../../../public/philippines-locations.json";
import RichTextEditor from "./RichTextEditor";
import StructuredDescriptionFields, { EMPTY_STRUCTURED_DESCRIPTION } from "./StructuredDescriptionFields";
import { deriveLegacyDescription, normalizeStructuredDescription } from "@/lib/utils/cvFitnessV2";
import InterviewQuestionGeneratorV2 from "./InterviewQuestionGeneratorV2";
import PipelineStageBuilder from "./PipelineStageBuilder";
import { candidateActionToast, errorToast, guid, normalizePipeline } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient"; // Auto-adds Bearer token
import FullScreenLoadingAnimation from "./FullScreenLoadingAnimation";
import CareerActionModal from "./CareerActionModal";
import { useRecruiterContext } from "../../context/RecruiterContext";
import { DEFAULT_JOB_PIPELINE } from "../../utils/constants";
import { useRouter } from "next/navigation";
import CVReviewStep from "./CareerSteps/CVReviewStep";
import AIInterviewStep from "./CareerSteps/AIInterviewStep";
import PipelineStagesStep from "./CareerSteps/PipelineStagesStep";
import ReviewCareerStep from "./CareerSteps/ReviewCareerStep";
import { Tooltip } from "react-tooltip";
import { Button } from "../ui";
import ManualAddressForm from "./ManualAddressForm";
import JobPostTypeSelect from "./JobPostTypeSelect";
import JobPostTypeBadge from "./JobPostTypeBadge";
import CareerPostingType from "./CareerPostingType";
import PricingPlanBadge from "@/lib/components/AdminComponents/PricingPlans/PricingPlanBadge";
import {
  HIRING_MANAGER_ROLE,
  normalizeCareerTeamRole,
} from "@/lib/utils/careerTeamRole";
import { buildPipelineForType } from "@/lib/utils/careerPostType";
import dynamic from "next/dynamic";
import { decodeHtmlEntities } from "@/lib/utils/sanitizeInput";
import {
  DEFAULT_PRE_SCREENING_SUGGESTIONS,
  PreScreeningSuggestion,
  clonePreScreeningSuggestions,
} from "@/lib/components/features/settings/defaultPreScreeningSuggestions";
import { ArrowRight, CheckCircleBroken } from "@untitledui/icons";
import { DUPLICATE_CHILD_TITLE_ERROR } from "@/lib/utils/careerValidation";

const LocationPicker = dynamic(
  () => import("@/lib/components/LocationPicker/LocationPicker"),
  { ssr: false }
);

const clonePipeline = (pipeline: any[]) => normalizePipeline(JSON.parse(JSON.stringify(pipeline || [])));
const cloneDefaultJobPipeline = () => clonePipeline(DEFAULT_JOB_PIPELINE);
const arePipelinesEqual = (left: any[], right: any[]) => {
  return JSON.stringify(left || []) === JSON.stringify(right || []);
};
const cloneDefaultPreScreeningSuggestions = () =>
  clonePreScreeningSuggestions(DEFAULT_PRE_SCREENING_SUGGESTIONS);
const ORG_SETTINGS_SCOPE_VALUE = "org";
const PROJECT_SETTINGS_SCOPE_PREFIX = "project:";

type SettingsScopeOption = {
  value: string;
  label: string;
  projectID?: string;
};

const resolveStoredPreScreeningSuggestions = (suggestions: unknown) => {
  if (!Array.isArray(suggestions)) {
    return [] as PreScreeningSuggestion[];
  }

  return clonePreScreeningSuggestions(suggestions as PreScreeningSuggestion[]);
};

const arePreScreeningSuggestionsEqual = (left: any[], right: any[]) => {
  return JSON.stringify(left || []) === JSON.stringify(right || []);
};

const fetchCareerSettingsDefaults = async ({
  orgID,
  projectID,
}: {
  orgID: string;
  projectID?: string;
}) => {
  let response: any = null;

  try {
    response = await api.get("/api/career-settings/default-pipeline", {
      params: {
        orgID,
        ...(projectID ? { projectID } : {}),
      },
    });
  } catch {
    if (projectID) {
      try {
        response = await api.get("/api/career-settings/default-pipeline", {
          params: { orgID },
        });
      } catch {
        return null;
      }
    }
  }

  return response?.data || null;
};

type JobPostType = "premium" | "credit-based" | null;

// Default interview questions structure with 5 categories
const DEFAULT_INTERVIEW_QUESTIONS = [
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

/**
 * Merges career questions with the default structure.
 * Ensures all 5 categories exist even if career.questions is empty or incomplete.
 */
function getQuestionsWithDefaults(careerQuestions: any[] | undefined | null): any[] {
  // If no career questions or empty array, return default structure
  if (!careerQuestions || !Array.isArray(careerQuestions) || careerQuestions.length === 0) {
    return DEFAULT_INTERVIEW_QUESTIONS.map(q => ({ ...q, questions: [] }));
  }

  // Check if career questions have the expected structure (categories with inner questions arrays)
  const hasValidStructure = careerQuestions.every(
    (q) => q && typeof q === 'object' && 'category' in q && Array.isArray(q.questions)
  );

  if (!hasValidStructure) {
    // If structure is invalid, return default
    return DEFAULT_INTERVIEW_QUESTIONS.map(q => ({ ...q, questions: [] }));
  }

  // Merge with defaults - ensure all 5 default categories exist
  return DEFAULT_INTERVIEW_QUESTIONS.map((defaultCategory) => {
    const existingCategory = careerQuestions.find(
      (q) => q.category === defaultCategory.category
    );
    if (existingCategory) {
      return {
        ...defaultCategory,
        ...existingCategory,
        // Ensure questions array exists
        questions: Array.isArray(existingCategory.questions) ? existingCategory.questions : [],
      };
    }
    return { ...defaultCategory, questions: [] };
  });
}

const decodeIfString = (value: any) =>
  typeof value === "string" ? decodeHtmlEntities(value) : value;

// Interface
interface PreScreeningQuestion {
  id: string;
  questionType: string;
  question: string;
  questionFormat: string;
  isAutoFiltering?: boolean;
  answers: { id: number; value: string; type: string; dropCandidate?: boolean }[];
  screeningRule?: string;
}

const workSetupOptions = [
  {
    name: "Fully Remote",
  },
  {
    name: "Onsite",
  },
  {
    name: "Hybrid",
  },
];

const employmentTypeOptions = [
  {
    name: "Full-Time",
  },
  {
    name: "Part-Time",
  },
  {
    name: "Project-based",
  },
];

const currencyOptions = [
  {
    name: "PHP",
    symbol: "₱",
  },
  {
    name: "AUD",
    symbol: "A$",
  },
  {
    name: "SGD",
    symbol: "S$",
  },
  {
    name: "GBP",
    symbol: "£",
  },
  {
    name: "USD",
    symbol: "$",
  },
];

const salaryUnitOptions = [
  { name: "Annual" },
  { name: "Monthly" },
  { name: "Hourly" },
];

const COUNTRY_SALARY_UNIT_MAP: { [key: string]: string } = {
  "Philippines": "Monthly",
  "Singapore": "Monthly",
  "Australia": "Annual",
  "United Kingdom": "Annual",
  "United States": "Annual",
  "United States of America": "Annual",
};

const COUNTRY_CURRENCY_MAP: { [key: string]: string } = {
  "Philippines": "PHP",
  "Australia": "AUD",
  "Singapore": "SGD",
  "United Kingdom": "GBP",
  "United States": "USD",
  "United States of America": "USD",
};

const COUNTRY_LANGUAGE_MAP: { [key: string]: string } = {
  "Philippines": "Tagalog",
  "Australia": "English (Australian)",
  "Singapore": "English",
  "United Kingdom": "English (UK)",
  "United States": "English (US)",
  "United States of America": "English (US)",
};

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

export default function SegmentedCareerForm({
  career,
  formType,
  initialStep,
  sectionId,
  preselectedProject,
}: {
  career?: any;
  formType: "add" | "edit";
  initialStep?: number;
  sectionId?: string;
  preselectedProject?: { id: string; name: string };
}) {
  const { user, orgID } = useAppContext();
  const [activeOrg] = useLocalStorage("activeOrg", null);
  const { hasUnsavedChanges, setHasUnsavedChanges, modalType, setModalType } =
    useRecruiterContext();

  const clampStep = (step: number | undefined | null): number => {
    if (step === undefined || step === null || isNaN(step)) return 0;
    return Math.max(0, Math.min(4, step));
  };

  const [currentStep, setCurrentStep] = useState(clampStep(initialStep));
  const [isSavingCareer, setIsSavingCareer] = useState(false);
  const [accomplishedStep, setAccomplishedStep] = useState(0);
  const [originalCareerData, setOriginalCareerData] = useState<any>(null);
  const [careerSteps, setCareerSteps] = useState([
    {
      name: "Career Details & Team Access",
      completed: false,
    },
    {
      name: "Pipeline Stages",
      completed: false,
    },
    {
      name: "CV Review & Pre-screening",
      completed: false,
    },
    {
      name: "AI Interview Setup",
      completed: false,
    },
    {
      name: "Review Career",
      completed: false,
    },
  ]);
  const [provinceList, setProvinceList] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [copiedFromCareerId, setCopiedFromCareerId] = useState<string | null>(null);
  const [careerForm, setCareerForm] = useState({
    _id: "",
    id: guid(),
    jobTitle: "",
    headcount: "",
    project: preselectedProject?.name || "",
    projectId: preselectedProject?.id || "",
    description: "",
    structuredDescription: EMPTY_STRUCTURED_DESCRIPTION,
    employmentType: "",
    workSetup: "",
    country: "Philippines",
    province: "",
    city: "",
    locationAddress: "",
    locationCountryCode: "",
    salaryNegotiable: true,
    currency: "PHP",
    salaryUnit: "Monthly",
    minimumSalary: "",
    maximumSalary: "",
    showSalaryToApplicants: false,
    globalHiringEnabled: false,
    screeningSetting: "Good Fit and above",
    cvSecretPrompt: "",
    interviewSecretPrompt: "",
    aiInterviewLanguage: "English",
    requireVideo: true,
    directInterviewLinkEnabled: true,
    questions: DEFAULT_INTERVIEW_QUESTIONS.map(q => ({ ...q, questions: [] })),
    preScreeningQuestions: [],
    requisitionId: "",
    parentCareerID: null as string | null,
    parentCareerTitle: "",
    jobPostType: null as JobPostType,
    careerPostType: null as "standalone" | "candidate_pool" | "receiving_pool" | null,
    voice: null as string | null,
    walkthroughLanguage: "english" as "english" | "tagalog",
    activityStatus: "Active",
    childTitle: "",
  });
  const linkedPreScreeningProjectID = careerForm.projectId?.trim() || "";
  const linkedPreScreeningSettingsScope = linkedPreScreeningProjectID
    ? `${PROJECT_SETTINGS_SCOPE_PREFIX}${linkedPreScreeningProjectID}`
    : ORG_SETTINGS_SCOPE_VALUE;

  // Job Post Type state
  const [availableJobPostTypes, setAvailableJobPostTypes] = useState<("premium" | "credit-based")[]>([]);
  const [jobPipeline, setJobPipeline] = useState<any[]>(cloneDefaultJobPipeline);
  const [standaloneDefaultPipeline, setStandaloneDefaultPipeline] = useState<any[]>(cloneDefaultJobPipeline);
  const defaultPreScreeningSuggestions = useMemo<PreScreeningSuggestion[]>(
    () => cloneDefaultPreScreeningSuggestions(),
    []
  );

  const [selectedPreScreeningSettingsScope, setSelectedPreScreeningSettingsScope] =
    useState(linkedPreScreeningSettingsScope);
  const [isApplyingPreScreeningSettingsScope, setIsApplyingPreScreeningSettingsScope] =
    useState(false);
  const hasInitializedPipelineScopeRef = useRef(false);
  const hasInitializedPreScreeningScopeRef = useRef(false);
  const pipelineScopeRequestRef = useRef(0);
  const latestJobPipelineRef = useRef<any[]>(cloneDefaultJobPipeline());
  const latestStandaloneDefaultPipelineRef = useRef<any[]>(cloneDefaultJobPipeline());
  const latestPreScreeningQuestionsRef = useRef<PreScreeningSuggestion[]>([]);
  const latestScopedDefaultPreScreeningRef = useRef<PreScreeningSuggestion[]>([]);
  const pipelineInitializedForType = useRef<string | null>(null);
  const savingCareerRef = useRef(false);
  const defaultsAppliedRef = useRef(false);
  const walkthroughDefaultFromOrgRef = useRef(false);
  const [showSaveModal, setShowSaveModal] = useState("");
  const [showJobPostLimitModal, setShowJobPostLimitModal] = useState(false);
  const [jobPostLimitInfo, setJobPostLimitInfo] = useState<
    | {
      maxActiveJobPosts?: number;
      planName?: string;
      schema?: string;
      schemaLabel?: string;
      jobPostType?: string;
      noPlan?: boolean;
    }
    | null
  >(null);
  const initialLoadRef = useRef(true);
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false);
  const router = useRouter();
  const DEFAULT_STEP_NAME = "Career Details & Team Access";
  const jobPostTypeTooltipId = useMemo(
    () => `job-post-type-tooltip-${guid()}`,
    []
  );
  const clampStepIndex = (
    index?: number | null,
    maxIndex: number = careerSteps.length - 1
  ) => {
    if (typeof index !== "number" || Number.isNaN(index)) {
      return 0;
    }
    return Math.min(Math.max(index, 0), Math.max(maxIndex, 0));
  };
  const safeCurrentStepIndex = clampStepIndex(currentStep);
  const safeAccomplishedStepIndex = clampStepIndex(accomplishedStep);
  const currentStepName =
    careerSteps[safeCurrentStepIndex]?.name ?? DEFAULT_STEP_NAME;
  const accomplishedStepName =
    careerSteps[safeAccomplishedStepIndex]?.name ?? DEFAULT_STEP_NAME;
  const preScreeningSettingsScopeOptions = useMemo<SettingsScopeOption[]>(() => {
    const options: SettingsScopeOption[] = [
      { value: ORG_SETTINGS_SCOPE_VALUE, label: "Use Org Settings" },
    ];

    if (linkedPreScreeningProjectID) {
      options.push({
        value: `${PROJECT_SETTINGS_SCOPE_PREFIX}${linkedPreScreeningProjectID}`,
        label: careerForm?.project?.trim() || "Linked Project",
        projectID: linkedPreScreeningProjectID,
      });
    }

    return options;
  }, [linkedPreScreeningProjectID, careerForm?.project]);

  const selectedPreScreeningSettingsScopeLabel = useMemo(() => {
    const selectedOption = preScreeningSettingsScopeOptions.find(
      (option) => option.value === selectedPreScreeningSettingsScope
    );
    return selectedOption?.label || "Use Org Settings";
  }, [preScreeningSettingsScopeOptions, selectedPreScreeningSettingsScope]);

  // Helper functions for dynamic step skipping based on pipeline stage enabled status
  const isCVScreeningEnabled = () => {
    const cvStage = jobPipeline.find((s) => s.id === "1");
    return cvStage?.enabled !== false;
  };

  const isAIInterviewEnabled = () => {
    const aiStage = jobPipeline.find((s) => s.id === "2");
    return aiStage?.enabled !== false;
  };

  const isStepEnabled = (stepName: string) => {
    if (stepName === "CV Review & Pre-screening") return isCVScreeningEnabled();
    if (stepName === "AI Interview Setup") return isAIInterviewEnabled();
    return true;
  };

  const getNextEnabledStep = (fromStep: number) => {
    let next = fromStep + 1;
    while (
      next < careerSteps.length &&
      !isStepEnabled(careerSteps[next].name)
    ) {
      next++;
    }
    return Math.min(next, careerSteps.length - 1);
  };

  useEffect(() => {
    if (currentStep !== 1) {
      return;
    }

    if (formType === "edit") {
      return;
    }

    const effectivePostType = activeOrg?.linkedCareersEnabled
      ? careerForm.careerPostType
      : "standalone";

    if (!effectivePostType) {
      return;
    }

    if (pipelineInitializedForType.current === effectivePostType) {
      return;
    }

    setJobPipeline(buildPipelineForType(effectivePostType));
    pipelineInitializedForType.current = effectivePostType;
  }, [currentStep]);

  // Team Access state
  const [orgMembers, setOrgMembers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState("Job Owner");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [validationErrors, setValidationErrors] = useState<{
    [key: string]: boolean;
  }>({});
  const [childTitleValidationMessage, setChildTitleValidationMessage] =
    useState<string | null>(null);
  const [isValidatingChildTitle, setIsValidatingChildTitle] = useState(false);

  // Add current user as Job Owner by default for new careers
  useEffect(() => {
    if (!career && user) {
      // Only add if user is not already in the team
      const userExists = teamMembers.some(
        (member) => member.email === user.email
      );
      if (!userExists) {
        setTeamMembers([
          {
            name: user.name,
            email: user.email,
            image: user.image,
            role: "Job Owner",
          },
        ]);
      }
    }
  }, [user, career]);

  useEffect(() => {
    setChildTitleValidationMessage(null);
  }, [
    careerForm.childTitle,
    careerForm.parentCareerID,
    careerForm.careerPostType,
  ]);

  useEffect(() => {
    latestJobPipelineRef.current = jobPipeline;
  }, [jobPipeline]);

  useEffect(() => {
    latestStandaloneDefaultPipelineRef.current = standaloneDefaultPipeline;
  }, [standaloneDefaultPipeline]);

  useEffect(() => {
    latestPreScreeningQuestionsRef.current = clonePreScreeningSuggestions(
      (careerForm.preScreeningQuestions || []) as PreScreeningSuggestion[]
    );
  }, [careerForm.preScreeningQuestions]);

  useEffect(() => {
    setSelectedPreScreeningSettingsScope(linkedPreScreeningSettingsScope);
  }, [linkedPreScreeningSettingsScope]);



  // Load org/project scoped default pipeline for add flow only
  useEffect(() => {
    let isMounted = true;
    const projectID = careerForm.projectId?.trim();

    const loadDefaultPipeline = async () => {
      if (formType !== "add" || career) {
        return;
      }

      if (!orgID) {
        return;
      }

      const requestId = pipelineScopeRequestRef.current + 1;
      pipelineScopeRequestRef.current = requestId;

      const settingsDefaults = await fetchCareerSettingsDefaults({
        orgID,
        projectID: projectID || undefined,
      });

      if (!isMounted || requestId !== pipelineScopeRequestRef.current) {
        return;
      }

      const fetchedPipeline = settingsDefaults?.defaultPipelineStages;
      const resolvedPipeline = Array.isArray(fetchedPipeline)
        ? clonePipeline(fetchedPipeline)
        : cloneDefaultJobPipeline();

      const storedPreScreeningSuggestions = resolveStoredPreScreeningSuggestions(
        settingsDefaults?.defaultPreScreeningSuggestions
      );

      const shouldApplyResolvedPreScreening =
        !hasInitializedPreScreeningScopeRef.current ||
        arePreScreeningSuggestionsEqual(
          latestPreScreeningQuestionsRef.current,
          latestScopedDefaultPreScreeningRef.current
        );

      const nextScopedPreScreeningDefaults = clonePreScreeningSuggestions(
        storedPreScreeningSuggestions
      );

      if (shouldApplyResolvedPreScreening) {
        setCareerForm((previousCareerForm) => ({
          ...previousCareerForm,
          preScreeningQuestions: clonePreScreeningSuggestions(
            nextScopedPreScreeningDefaults
          ),
        }));

        latestPreScreeningQuestionsRef.current = clonePreScreeningSuggestions(
          nextScopedPreScreeningDefaults
        );
      }

      latestScopedDefaultPreScreeningRef.current = clonePreScreeningSuggestions(
        nextScopedPreScreeningDefaults
      );
      hasInitializedPreScreeningScopeRef.current = true;

      const shouldApplyResolvedPipeline =
        !hasInitializedPipelineScopeRef.current ||
        arePipelinesEqual(
          latestJobPipelineRef.current,
          latestStandaloneDefaultPipelineRef.current
        );

      setStandaloneDefaultPipeline(resolvedPipeline);
      latestStandaloneDefaultPipelineRef.current = clonePipeline(resolvedPipeline);

      if (shouldApplyResolvedPipeline) {
        const nextPipeline = clonePipeline(resolvedPipeline);
        setJobPipeline(nextPipeline);
        latestJobPipelineRef.current = clonePipeline(nextPipeline);
      }

      hasInitializedPipelineScopeRef.current = true;
    };

    loadDefaultPipeline();

    return () => {
      isMounted = false;
    };
  }, [formType, career, orgID, careerForm.projectId, activeOrg?.walkthroughLanguage]);

  useEffect(() => {
    if (career) {
      const loadedStepIndex = clampStepIndex(career?.accomplishedStep?.index);
      const formData = {
        _id: career._id,
        id: career.id,
        jobTitle: activeOrg?.linkedCareersEnabled && career?.careerPostType === "receiving_pool" && career?.parentCareer?.jobTitle
          ? decodeIfString(career.parentCareer.jobTitle)
          : decodeIfString(career.jobTitle),
        headcount: career?.headcount || "",
        project: career?.project || "",
        projectId: career?.projectId || "",
        description: career.description,
        // Back-compat migration path: a legacy career only has `description`, so seed it
        // as the Overview. On save, `deriveLegacyDescription` rebuilds `description` from
        // the structured sections, upgrading the career to the V2 shape additively.
        structuredDescription: career.structuredDescription || {
          ...EMPTY_STRUCTURED_DESCRIPTION,
          overview: career.description || "",
        },
        employmentType: career.employmentType,
        workSetup: career.workSetup,
        country: career?.country || "",
        province: career?.province || "",
        city: career?.city || career?.location || "",
        locationAddress: career?.locationAddress || career?.location || "",
        locationCountryCode: career?.locationCountryCode || "",
        salaryNegotiable: career?.salaryNegotiable || true,
        currency: career?.currency || "PHP",
        salaryUnit: career?.salaryUnit || "Monthly",
        minimumSalary: career?.minimumSalary || "",
        maximumSalary: career?.maximumSalary || "",
        showSalaryToApplicants: career?.showSalaryToApplicants || false,
        globalHiringEnabled: career?.globalHiringEnabled || false,
        screeningSetting: career?.screeningSetting || "Good Fit and above",
        cvSecretPrompt: career?.cvSecretPrompt || "",
        interviewSecretPrompt: career?.interviewSecretPrompt || "",

        aiInterviewLanguage: career?.aiInterviewLanguage || "English",
        requireVideo: career?.requireVideo || true,
        directInterviewLinkEnabled:
          career?.directInterviewLinkEnabled !== undefined
            ? career.directInterviewLinkEnabled
            : true,
        questions: getQuestionsWithDefaults(career?.questions),
        preScreeningQuestions:
          (career?.preScreeningQuestions || careerForm.preScreeningQuestions).map((q: any) => ({
            ...q,
            question: decodeIfString(q.question),
            answers: (q.answers || []).map((a: any) => ({
              ...a,
              value: decodeIfString(a.value),
            })),
          })),
        requisitionId: career?.requisitionId || "",
        parentCareerID: career?.parentCareerID || null,
        parentCareerTitle: decodeIfString(career?.parentCareer?.jobTitle) || "",
        jobPostType: career?.jobPostType || null,
        careerPostType: career?.careerPostType || null,
        voice: career?.voice || null,
        walkthroughLanguage: ((): "english" | "tagalog" => {
          if (career?.walkthroughLanguage === "tagalog" || career?.walkthroughLanguage === "english") {
            return career.walkthroughLanguage;
          }
          return activeOrg?.walkthroughLanguage === "tagalog" ? "tagalog" : "english";
        })(),
        activityStatus: career?.activityStatus || "Active",
        childTitle: career?.childTitle || (career?.careerPostType === "receiving_pool" ? career?.jobTitle : ""),
      };
      setCareerForm(formData);

      const pipeline = normalizePipeline(career?.pipelineStages || DEFAULT_JOB_PIPELINE);
      setJobPipeline(pipeline);

      // Remove duplicates when loading career data
      const members = (career?.teamMembers || []).map((member: any) => ({
        ...member,
        role: normalizeCareerTeamRole(member?.role) || member?.role,
      }));
      const uniqueMembers = members.filter(
        (member, index, self) =>
          index === self.findIndex((m) => m.email === member.email)
      );
      setTeamMembers(uniqueMembers);

      // Store original data for comparison
      setOriginalCareerData({
        careerForm: formData,
        jobPipeline: pipeline,
        teamMembers: uniqueMembers,
      });

      // Determine current user's role from the loaded team members
      if (user?.email) {
        const currentMember = uniqueMembers.find(
          (member: any) => member.email === user.email
        );
        if (currentMember?.role) {
          setCurrentUserRole(
            normalizeCareerTeamRole(currentMember.role) || currentMember.role
          );
        } else {
          // If user is not in team members, default to Hiring Manager (most restrictive)
          setCurrentUserRole(HIRING_MANAGER_ROLE);
        }
      }

      // Only set currentStep from career data if initialStep is not provided
      // Use name-based lookup for backward compatibility with reordered steps
      const findStepIndexByName = (name: string) => {
        return careerSteps.findIndex((step) => step.name === name);
      };
      const careerStep = career?.accomplishedStep?.name
        ? Math.max(0, findStepIndexByName(career.accomplishedStep.name))
        : clampStep(career?.accomplishedStep?.index);
      if (initialStep === undefined) {
        setCurrentStep(careerStep);
      }
      setAccomplishedStep(careerStep);
      setCareerSteps((prev) =>
        prev.map((step, index) => {
          if (careerStep > index) {
            return { ...step, completed: true };
          }
          return step;
        })
      );
    }
  }, [career, user?.email]);

  const applyPreScreeningSuggestionsFromScope = async (
    option: SettingsScopeOption
  ) => {
    if (!orgID) {
      errorToast("Org ID is required", 1500);
      return false;
    }

    setIsApplyingPreScreeningSettingsScope(true);
    try {
      const settingsDefaults = await fetchCareerSettingsDefaults({
        orgID,
        projectID: option.projectID,
      });

      const storedPreScreeningSuggestions = resolveStoredPreScreeningSuggestions(
        settingsDefaults?.defaultPreScreeningSuggestions
      );

      if (formType === "add") {
        const shouldApplyResolvedPreScreening =
          !hasInitializedPreScreeningScopeRef.current ||
          arePreScreeningSuggestionsEqual(
            latestPreScreeningQuestionsRef.current,
            latestScopedDefaultPreScreeningRef.current
          );

        const nextScopedPreScreeningDefaults = clonePreScreeningSuggestions(
          storedPreScreeningSuggestions
        );

        if (shouldApplyResolvedPreScreening) {
          setCareerForm((previousCareerForm) => ({
            ...previousCareerForm,
            preScreeningQuestions: clonePreScreeningSuggestions(
              nextScopedPreScreeningDefaults
            ),
          }));

          latestPreScreeningQuestionsRef.current = clonePreScreeningSuggestions(
            nextScopedPreScreeningDefaults
          );
        }

        latestScopedDefaultPreScreeningRef.current = clonePreScreeningSuggestions(
          nextScopedPreScreeningDefaults
        );
        hasInitializedPreScreeningScopeRef.current = true;
      }

      return true;
    } finally {
      setIsApplyingPreScreeningSettingsScope(false);
    }
  };

  const handleSelectPreScreeningSettingsScope = async (scopeValue: string) => {
    const selectedOption = preScreeningSettingsScopeOptions.find(
      (option) => option.value === scopeValue
    );

    if (!selectedOption || isApplyingPreScreeningSettingsScope) {
      return;
    }

    const didApply = await applyPreScreeningSuggestionsFromScope(selectedOption);

    if (didApply) {
      setSelectedPreScreeningSettingsScope(selectedOption.value);
    }
  };

  // Set default location from Org HQ for new careers
  useEffect(() => {
    if (formType === "add" && !career && activeOrg?.organizationAddress && !defaultsAppliedRef.current) {
        const hq = activeOrg.organizationAddress.find((addr: any) => addr.isMarkedHQ) || activeOrg.organizationAddress[0];
        if (hq && !careerForm.locationAddress) {
            const hqCountry = hq.country || "Philippines";
            
            // Prioritize Org defaults, fallback to Country defaults, then global defaults
            const defaultCurrency = activeOrg.defaultCurrency || COUNTRY_CURRENCY_MAP[hqCountry] || "PHP";
            const defaultSalaryUnit = activeOrg.defaultSalaryUnit || COUNTRY_SALARY_UNIT_MAP[hqCountry] || "Monthly";

            setCareerForm(prev => ({ 
              ...prev, 
              locationAddress: hq.location, 
              country: hqCountry, 
              salaryUnit: defaultSalaryUnit,
              currency: defaultCurrency
            }));
            defaultsAppliedRef.current = true;
        }
    }
  }, [activeOrg, formType, career]);

  // Default walkthrough language from org when creating a new career
  useEffect(() => {
    if (formType === "edit") {
      walkthroughDefaultFromOrgRef.current = false;
      return;
    }
    if (formType === "add" && activeOrg && !walkthroughDefaultFromOrgRef.current) {
      const orgLang = activeOrg.walkthroughLanguage === "tagalog" ? "tagalog" : "english";
      setCareerForm((prev) => ({ ...prev, walkthroughLanguage: orgLang }));
      walkthroughDefaultFromOrgRef.current = true;
    }
  }, [formType, activeOrg?.walkthroughLanguage, activeOrg?._id]);

  // Mark initial data as loaded after career data is set
  useEffect(() => {
    if (career && careerForm._id) {
      setIsInitialDataLoaded(true);
    }
  }, [career, careerForm._id]);

  // Fetch available job post types from org's plans
  useEffect(() => {
    const fetchAvailableJobPostTypes = async () => {
      try {
        const response = await api.get("/api/pricing-plan/get-job-post-usage", {
          params: { orgID },
        });
        const types = response.data?.availableTypes || [];
        setAvailableJobPostTypes(types);

        // Auto-select if only one type available and no type is set
        // Only auto-select for new careers (formType === "add"), not when editing
        if (types.length === 1 && !careerForm.jobPostType && formType === "add") {
          setCareerForm((prev) => ({ ...prev, jobPostType: types[0] }));
        }
      } catch (error) {
        console.error("Error fetching job post types:", error);
      }
    };
    if (orgID) {
      fetchAvailableJobPostTypes();
    }
  }, [orgID]);

  // Scroll to section when sectionId is provided
  useEffect(() => {
    if (sectionId && currentStep === (initialStep || 0)) {
      // Wait for the DOM to render
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 500);
    }
  }, [sectionId, currentStep, initialStep]);

  useEffect(() => {
    // For existing careers, only track changes after initial data is loaded
    // For new careers, track changes after first render
    const shouldTrackChanges = career
      ? isInitialDataLoaded
      : !initialLoadRef.current;

    if (shouldTrackChanges && !hasUnsavedChanges && careerForm) {
      setHasUnsavedChanges(true);
    }

    initialLoadRef.current = false;
  }, [careerForm]);

  useEffect(() => {
    const parseProvinces = () => {
      const provinceList = philippineCitiesAndProvinces.provinces.sort((a, b) => a.name.localeCompare(b.name));
      setProvinceList(provinceList);
      const defaultProvince = provinceList[0];
      const cities = philippineCitiesAndProvinces.cities.filter(
        (city) => city.province === defaultProvince.key
      ).sort((a, b) => a.name.localeCompare(b.name));
      setCityList(cities);
    };
    parseProvinces();
  }, []);

  useEffect(() => {
    if (modalType) {
      setShowSaveModal(modalType);
      setModalType(null);
    }
  }, [modalType]);

  // Fetch organization members
  const fetchOrgMembers = async () => {
    if (!orgID) return;

    setLoadingMembers(true);
    try {
      const response = await api.post("/api/get-org-members", { orgID });
      if (response.status === 200) {
        const members = response.data.members.filter(
          (member) => member.email !== user?.email
        );
        setOrgMembers(members);
      }
    } catch (error) {
      const err = error as any;
      console.error("Error fetching organization members:", err);
      console.error("Error details:", err?.response?.data);
      errorToast("Failed to load team members", 1300);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchOrgMembers();
  }, [orgID, user?.email]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Don't close if clicking inside the dropdown
      if (
        showMemberDropdown &&
        !target.closest('[data-dropdown="member-dropdown"]')
      ) {
        setShowMemberDropdown(false);
      }
      // Close role dropdown when clicking outside
      if (
        showRoleDropdown &&
        !target.closest('[data-dropdown="role-dropdown"]')
      ) {
        setShowRoleDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMemberDropdown, showRoleDropdown]);

  // Warn user about unsaved changes when refreshing or closing browser
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ""; // Required for modern browsers
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const validateCurrentStep = () => {
    const errors: { [key: string]: boolean } = {};

    if (currentStepName === "Career Details & Team Access") {
      if (!careerForm.jobPostType) errors.jobPostType = true;
      if (activeOrg?.linkedCareersEnabled && !careerForm.careerPostType) errors.careerPostType = true;
      if (!careerForm.jobTitle.trim()) errors.jobTitle = true;
      if (
        activeOrg?.linkedCareersEnabled &&
        careerForm.careerPostType === "receiving_pool" &&
        !careerForm.childTitle.trim()
      )
        errors.childTitle = true;
      if (
        !careerForm.headcount ||
        (typeof careerForm.headcount === "string" &&
          !careerForm.headcount.trim())
      )
        errors.headcount = true;
      if (!careerForm.employmentType) errors.employmentType = true;
      if (!careerForm.workSetup) errors.workSetup = true;
      if (!careerForm.locationAddress) errors.locationAddress = true;
      if (
        !careerForm.minimumSalary ||
        (typeof careerForm.minimumSalary === "string" &&
          !careerForm.minimumSalary.trim())
      )
        errors.minimumSalary = true;
      if (
        !careerForm.maximumSalary ||
        (typeof careerForm.maximumSalary === "string" &&
          !careerForm.maximumSalary.trim())
      )
        errors.maximumSalary = true;
      // Also validate Job Description in Career Details & Team Access step
      // Overview itself is required when the structured form is in use (?? keeps an empty
      // Overview from falling through to the derived legacy description) — matches the
      // "Overview is required." inline copy. Legacy description check only if no structured form.
      const textContent = ((careerForm.structuredDescription?.overview ?? careerForm.description) || "").replace(/<[^>]*>/g, "").trim();
      if (!textContent) errors.description = true;
      // Validate that there is at least one Job Owner
      const hasJobOwner = teamMembers.some(
        (member: any) => member.role === "Job Owner"
      );
      if (!hasJobOwner) errors.teamAccess = true;
      if (
        activeOrg?.linkedCareersEnabled &&
        careerForm.careerPostType === "receiving_pool" &&
        !careerForm.parentCareerID
      ) {
        errors.sourcePool = true;
      }
    }

    if (currentStepName === "CV Review & Pre-screening") {
      // Remove HTML tags and check if there's actual content
      // Overview itself is required when the structured form is in use (?? keeps an empty
      // Overview from falling through to the derived legacy description) — matches the
      // "Overview is required." inline copy. Legacy description check only if no structured form.
      const textContent = ((careerForm.structuredDescription?.overview ?? careerForm.description) || "").replace(/<[^>]*>/g, "").trim();
      if (!textContent) errors.description = true;
    }

    if (currentStepName === "AI Interview Setup") {
      const totalQuestions = careerForm.questions.reduce(
        (acc, group) => acc + group.questions.length,
        0
      );
      if (totalQuestions < 5) {
        errors.interviewQuestions = true;
      }
    }

    if (careerSteps[currentStep].name === "CV Review & Pre-screening") {
      if (
        !careerForm.preScreeningQuestions.every((q) => {
          let validAnswers = true;
          if (q.questionFormat === "Range") {
            validAnswers = q.answers.every((a) => !isNaN(Number(a.value)));
          }

          if (
            q.questionFormat === "Checkboxes" ||
            q.questionFormat === "Dropdown"
          ) {
            validAnswers = q.answers.every((a) => a.value.trim() !== "");
          }
          return q.question && q.questionFormat && validAnswers;
        })
      ) {
        errors.preScreeningQuestions = true;
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isFormValid = () => {
    if (currentStepName === "Career Details & Team Access") {
      let validWorkLocation = !!careerForm.country && !!careerForm.province && !!careerForm.city;
      if (careerForm.workSetup === "Fully Remote") {
        validWorkLocation = true;
      }
      return (
        careerForm.jobPostType &&
        careerForm.jobTitle &&
        careerForm.employmentType &&
        careerForm.workSetup &&
        careerForm.locationAddress
      );
    }

    if (currentStepName === "CV Review & Pre-screening") {
      return careerForm.description;
    }

    if (currentStepName === "AI Interview Setup") {
      const totalQuestions = careerForm.questions.reduce(
        (acc, group) => acc + group.questions.length,
        0
      );
      return totalQuestions >= 5;
    }

    if (careerSteps[currentStep].name === "Pipeline Stages") {
      if (activeOrg?.linkedCareersEnabled) {
        if (!careerForm.careerPostType) return false;
        if (careerForm.careerPostType === "receiving_pool" && !careerForm.parentCareerID) {
          return false;
        }
      }
      return true;
    }

    if (careerSteps[currentStep].name === "CV Review & Pre-screening") {
      return careerForm.preScreeningQuestions.every((q) => {
        let validAnswers = true;
        if (q.questionFormat === "Range") {
          validAnswers = q.answers.every((a) => !isNaN(Number(a.value)));
        }

        if (
          q.questionFormat === "Checkboxes" ||
          q.questionFormat === "Dropdown"
        ) {
          validAnswers = q.answers.every((a) => a.value.trim() !== "");
        }
        return q.question && q.questionFormat && validAnswers;
      });
    }
    return true;
  };

  const hasFormProgress = () => {
    if (currentStepName === "Career Details & Team Access") {
      return (
        careerForm.jobTitle ||
        careerForm.employmentType ||
        careerForm.workSetup ||
        careerForm.locationAddress ||
        careerForm.minimumSalary ||
        careerForm.maximumSalary
      );
    }

    if (careerSteps[currentStep].name === "CV Review & Pre-screening") {
      return careerForm.preScreeningQuestions?.length > 0;
    }

    if (careerSteps[currentStep].name === "CV Review & Pre-screening") {
      return careerForm.description;
    }

    if (currentStepName === "AI Interview Setup") {
      const totalQuestions = careerForm.questions.reduce(
        (acc, group) => acc + group.questions.length,
        0
      );
      return totalQuestions > 0;
    }

    if (careerSteps[currentStep].name === "Pipeline Stages") {
      return jobPipeline.length > 0 || careerForm.careerPostType;
    }

    return false;
  };

  const confirmSaveCareer = (status: string) => {
    // For publishing (active status), validate that careerPostType is set
    // This catches old careers that were created before this field existed
    if (status === "active" && activeOrg?.linkedCareersEnabled) {
      const errors: { [key: string]: boolean } = {};

      if (!careerForm.careerPostType) {
        errors.careerPostType = true;
      }

      if (careerForm.careerPostType === "receiving_pool" && !careerForm.parentCareerID) {
        errors.sourcePool = true;
      }

      if (Object.keys(errors).length > 0) {
        goToCareerDetailsStep();
        setValidationErrors(errors);
        return;
      }
    }
    setShowSaveModal(status);
    return;
  };

  function goToCareerDetailsStep() {
    const careerDetailsStepIndex = careerSteps.findIndex(
      (step) => step.name === "Career Details & Team Access"
    );

    if (careerDetailsStepIndex !== -1) {
      setCurrentStep(careerDetailsStepIndex);
    }
  }

  const validateUniqueChildTitle = async () => {
    if (
      careerForm.careerPostType !== "receiving_pool" ||
      !careerForm.parentCareerID ||
      !careerForm.childTitle
    ) {
      return true;
    }

    try {
      const response = await api.post("/api/career-data", {
        id: careerForm.parentCareerID,
        orgID,
        includeChildCareers: true,
      });

      const siblingCareers = Array.isArray(response.data?.childCareers)
        ? response.data.childCareers
        : [];
      const hasDuplicateSibling = siblingCareers.some(
        (child: { id?: string; childTitle?: string | null }) =>
          child.id !== careerForm.id &&
          child.childTitle === careerForm.childTitle
      );

      if (hasDuplicateSibling) {
        setChildTitleValidationMessage(DUPLICATE_CHILD_TITLE_ERROR);
        setValidationErrors((prev) => ({
          ...prev,
          childTitle: true,
        }));
        return false;
      }
    } catch (error) {
      console.error("Failed to validate child title uniqueness:", error);
    }

    return true;
  };

  const saveCareer = async (status: string) => {
    setShowSaveModal("");
    setModalType(null);
    if (!status) {
      return;
    }

    if (!savingCareerRef.current) {
      setIsSavingCareer(true);
      savingCareerRef.current = true;
      let userInfoSlice = {
        image: user.image,
        name: user.name,
        email: user.email,
      };
      const career = {
        id: careerForm.id,
        jobTitle: careerForm.careerPostType === "receiving_pool" && careerForm.childTitle?.trim()
          ? `(${careerForm.childTitle.trim()}) ${careerForm.jobTitle.trim()}`
          : careerForm.jobTitle,
        childTitle: careerForm.careerPostType === "receiving_pool"
          ? (careerForm.childTitle || null)
          : null,
        headcount: isNaN(Number(careerForm.headcount))
          ? null
          : Number(careerForm.headcount),
        description: careerForm.description,
        // Blank qualification rows are UI scaffolding (phantom row / extra Adds) — drop them from the stored doc.
        structuredDescription: careerForm.structuredDescription
          ? normalizeStructuredDescription(careerForm.structuredDescription)
          : null,
        workSetup: careerForm.workSetup,
        questions: careerForm.questions,
        preScreeningQuestions: careerForm.preScreeningQuestions,
        pipelineStages: jobPipeline,
        lastEditedBy: userInfoSlice,
        createdBy: userInfoSlice,
        screeningSetting: careerForm.screeningSetting,
        cvSecretPrompt: careerForm.cvSecretPrompt,
        interviewSecretPrompt: careerForm.interviewSecretPrompt,
        orgID,
        requireVideo: careerForm.requireVideo,
        directInterviewLinkEnabled: careerForm.directInterviewLinkEnabled,
        salaryNegotiable: careerForm.salaryNegotiable,
        salaryUnit: careerForm.salaryUnit,
        salaryCurrency: careerForm.currency,
        showSalaryToApplicants: careerForm.showSalaryToApplicants,
        globalHiringEnabled: careerForm.globalHiringEnabled,
        aiInterviewLanguage: careerForm.aiInterviewLanguage,
        minimumSalary: isNaN(Number(careerForm.minimumSalary))
          ? null
          : Number(careerForm.minimumSalary),
        maximumSalary: isNaN(Number(careerForm.maximumSalary))
          ? null
          : Number(careerForm.maximumSalary),
        country: careerForm.country,
        province: careerForm.province,
        city: careerForm.city,
        locationCountryCode: careerForm.locationCountryCode,
        // Backwards compatibility
        location: careerForm.locationAddress || careerForm.city,
        status,
        requisitionId: careerForm.requisitionId || undefined,
        employmentType: careerForm.employmentType,
        teamMembers: teamMembers,
        accomplishedStep: {
          index: clampStepIndex(accomplishedStep),
          name: accomplishedStepName,
        },
        parentCareerID: careerForm.parentCareerID || null,
        jobPostType: careerForm.jobPostType,
        careerPostType: activeOrg?.linkedCareersEnabled ? (careerForm.careerPostType || null) : "standalone",
        voice: careerForm.voice || null,
        walkthroughLanguage: careerForm.walkthroughLanguage ?? "english",
        // Default status when creating a new career
        activityStatus: formType === "add" ? "Active" : careerForm.activityStatus,
      };

      try {
        const response = await api.post("/api/upsert-career", career);
        if (response.status !== 200) {
          throw new Error("Failed to add career");
        }

        const careerId =
          formType === "add"
            ? response.data.career.insertedId?.toString()
            : (response.data.career?._id?.toString() || careerForm._id);

        // Link career to project if a project is selected
        if (careerForm.projectId && careerId) {
          try {
            await api.post("/api/projects/add-careers", {
              projectId: careerForm.projectId,
              careerIds: [careerId],
              orgID,
            });
          } catch (projectError) {
            errorToast("Failed to link career to project", 2500);
          }
        }

        // Copy email automations if a pipeline was copied
        if (copiedFromCareerId && careerId) {
          try {
            await api.post("/api/emails/automation/copy", {
              sourceCareerId: copiedFromCareerId,
              targetCareerId: careerId,
              orgID,
            });
            // Clear it so it doesn't run again on subsequent saves
            setCopiedFromCareerId(null);
          } catch (copyError) {
            console.error("Failed to copy email automations:", copyError);
            errorToast("Pipeline copied, but failed to copy email automations", 2500);
          }
        }

        if (status === "active" && careerForm.requisitionId) {
          try {
            await api.patch(
              `/api/requisitions/${careerForm.requisitionId}/status`,
              {
                status: "Active",
                metadata: {
                  triggeredBy: "career_publish",
                  careerId,
                },
              }
            );
          } catch (requisitionError) {
            console.error("Failed to update requisition status:", requisitionError);
            errorToast(
              "Career published, but failed to update requisition status",
              2500
            );
          }
        }

        // Reset unsaved changes flag after successful save
        setHasUnsavedChanges(false);
        if (safeCurrentStepIndex === careerSteps.length - 1 || status === "inactive") {
          triggerCareerCreatedEvent();
          candidateActionToast(
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginLeft: 8,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                {formType === "edit"
                  ? "Career updated successfully"
                  : `Career added ${status === "active" ? "and published" : ""
                  }`}
              </span>
            </div>,
            1300,
            <i
              className="la la-check-circle"
              style={{ color: "#039855", fontSize: 32 }}
            ></i>
          );
          setTimeout(() => {
            if (formType === "edit") {
              router.push(
                `/recruiter-dashboard/careers/manage/${careerId}?orgID=${orgID}`
              );
            } else {
              router.push(`/recruiter-dashboard/careers?orgID=${orgID}`);
            }
          }, 1300);
        }
      } catch (error) {
        const apiResponseData = (error as any)?.response?.data;
        const apiError = apiResponseData?.error;
        const isJobPostLimitError =
          typeof apiError === "string" &&
          apiError.toLowerCase().includes("maximum number of") &&
          apiError.toLowerCase().includes("job");
        const isNoPlanError =
          typeof apiError === "string" &&
          apiError.toLowerCase().includes("does not have an active plan");

        if (apiError === DUPLICATE_CHILD_TITLE_ERROR) {
          goToCareerDetailsStep();
          setChildTitleValidationMessage(DUPLICATE_CHILD_TITLE_ERROR);
          setValidationErrors((prev) => ({
            ...prev,
            childTitle: true,
          }));
        } else if (isJobPostLimitError || isNoPlanError) {
          if (apiResponseData?.jobPostLimitInfo) {
            setJobPostLimitInfo(apiResponseData.jobPostLimitInfo);
          } else {
            // Set noPlan flag if it's a no-plan error
            setJobPostLimitInfo({ noPlan: isNoPlanError || apiResponseData?.noPlan });
          }
          setShowJobPostLimitModal(true);
        } else if (apiError) {
          errorToast(apiError, 1300);
        } else {
          errorToast("Failed to add career", 1300);
        }
      } finally {
        savingCareerRef.current = false;
        setIsSavingCareer(false);
      }
    }
  };

  const triggerCareerCreatedEvent = () => {
    try {
      if (
        typeof window !== "undefined" &&
        typeof (window as any)?.gtag === "function"
      ) {
        (window as any)?.gtag?.("event", "career_created");
      }
    } catch (error) {
      console.error("Error triggering career created event", error);
    }
  };

  // Team member functions
  const roleOptions = [
    {
      name: "Job Owner",
      description:
        "Leads the hiring process for assigned jobs. Has access with all career settings.",
    },
    {
      name: "Contributor",
      description:
        "Helps evaluate candidates and assist with hiring tasks. Can move candidates through the pipeline, but cannot change any career settings.",
    },
    {
      name: HIRING_MANAGER_ROLE,
      description:
        "Reviews candidates and provides feedback. Can only view candidate profiles and comment.",
    },
    {
      name: "Guest",
      description:
        "View-only access to career details and candidate information. Can access the guest portal but cannot make any changes or provide feedback.",
    },
  ];

  const addTeamMember = (member: any) => {
    if (!teamMembers.find((tm) => tm.email === member.email)) {
      setTeamMembers([...teamMembers, { ...member, role: "Contributor", isViewed: false }]);
      setShowMemberDropdown(false);
    }
  };

  const removeTeamMember = (email: string) => {
    const updatedMembers = teamMembers.filter((tm) => tm.email !== email);
    setTeamMembers(updatedMembers);
    // Check if there's still a Job Owner after removal
    const hasJobOwner = updatedMembers.some(
      (member: any) => member.role === "Job Owner"
    );
    if (!hasJobOwner) {
      setValidationErrors({
        ...validationErrors,
        teamAccess: true,
      });
    }
  };

  const updateMemberRole = (email: string, role: string) => {
    const normalizedRole = normalizeCareerTeamRole(role) || role;
    setTeamMembers(
      teamMembers.map((tm) =>
        tm.email === email ? { ...tm, role: normalizedRole } : tm
      )
    );
    // Clear team access validation error if a Job Owner is assigned
    if (normalizedRole === "Job Owner" && validationErrors.teamAccess) {
      setValidationErrors({
        ...validationErrors,
        teamAccess: false,
      });
    }
  };

  const hasChanges = () => {
    // For new careers (formType === "add"), always allow saving
    if (formType === "add" || !originalCareerData) {
      return true;
    }

    // Deep comparison of form data
    const formChanged =
      JSON.stringify(careerForm) !==
      JSON.stringify(originalCareerData.careerForm);
    const pipelineChanged =
      JSON.stringify(jobPipeline) !==
      JSON.stringify(originalCareerData.jobPipeline);
    const teamChanged =
      JSON.stringify(teamMembers) !==
      JSON.stringify(originalCareerData.teamMembers);

    return formChanged || pipelineChanged || teamChanged;
  };

  const handleSaveAndContinue = async () => {
    if (!validateCurrentStep()) {
      return; // Don't proceed if validation fails
    }

    setIsValidatingChildTitle(true);
    try {
      if (!(await validateUniqueChildTitle())) {
        return;
      }
    } finally {
      setIsValidatingChildTitle(false);
    }

    const nextStep = getNextEnabledStep(currentStep);
    setCareerSteps((prev) =>
      prev.map((step, index) => {
        if (index <= currentStep) {
          return { ...step, completed: true };
        }
        return step;
      })
    );
    setAccomplishedStep(nextStep);
    setCurrentStep(nextStep);
  };

  const headerCareerTitle =
    activeOrg?.linkedCareersEnabled && careerForm.careerPostType === "receiving_pool"
      ? careerForm.childTitle?.trim()
        ? `(${careerForm.childTitle.trim()}) ${careerForm.parentCareerTitle || careerForm.jobTitle}`
        : careerForm.parentCareerTitle || careerForm.jobTitle
      : careerForm.jobTitle;

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
              {careerForm.jobTitle && (
                <h1
                  style={{
                    fontSize: "24px",
                    fontWeight: 550,
                    color: "#717680",
                  }}
                >
                  [Draft]
                </h1>
              )}
              <h1
                style={{ fontSize: "24px", fontWeight: 550, color: "#111827" }}
              >
                {headerCareerTitle ? headerCareerTitle : "Add new career"}
              </h1>
              {careerForm.jobPostType && (
                <PricingPlanBadge schema={careerForm.jobPostType} />
              )}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <Button
                variant="secondary"
                label={formType === "edit" ? "Cancel" : "Exit"}
                onClick={() => confirmSaveCareer("inactive")}
              />
              {currentStep < careerSteps.length - 1 ? (
                <Button
                  variant="primary"
                  label={
                    isValidatingChildTitle
                      ? "Loading..."
                      : formType === "edit"
                        ? "Save Changes"
                        : "Continue"
                  }
                  disabled={isSavingCareer || isValidatingChildTitle}
                  iconJsx={formType !== "edit" && <ArrowRight size={20} color="#fff" />}
                  iconPosition="right"
                  onClick={handleSaveAndContinue}
                />
              ) : (
                <Button
                  variant="primary"
                  label={formType === "edit" ? "Save Changes" : "Publish"}
                  disabled={isSavingCareer || !isCVScreeningEnabled()}
                  iconJsx={formType !== "edit" && <CheckCircleBroken size={20} color="#fff" />}
                  iconPosition="left"
                  onClick={() => confirmSaveCareer("active")}
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
            {careerSteps.map((step, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 8,
                  position: "relative",
                  flex: index === careerSteps.length - 1 ? "0 0 auto" : "1 1 0",
                  maxWidth: index === careerSteps.length - 1 ? "150px" : "none",
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
                  {Object.keys(validationErrors).length > 0 &&
                    currentStep === index ? (
                    <i
                      className="la la-exclamation-triangle"
                      style={{
                        color: "#EF4444",
                        fontSize: 24,
                      }}
                    ></i>
                  ) : step.completed ? (
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
                        border: `1px solid ${accomplishedStep === index ? "#000000" : "#D5D7DA"
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
                  {index !== careerSteps.length - 1 && (
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
                            width:
                              currentStep > index
                                ? "100%"
                                : hasFormProgress()
                                  ? "50%"
                                  : "0%",
                            height: "5px",
                            background:
                              currentStep > index || hasFormProgress()
                                ? "linear-gradient(90deg, #9fcaed 0%, #ceb6da 33%, #ebacc9 66%, #fccec0 100%)"
                                : "#E9EAEB",
                            backgroundColor:
                              currentStep > index || hasFormProgress()
                                ? "transparent"
                                : "#E9EAEB",
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
                      (step.completed || index === accomplishedStep) &&
                        isStepEnabled(step.name)
                        ? "pointer"
                        : "not-allowed",
                    opacity: isStepEnabled(step.name) ? 1 : 0.5,
                  }}
                  onClick={() => {
                    if (
                      (step.completed || index === accomplishedStep) &&
                      isStepEnabled(step.name)
                    ) {
                      setCurrentStep(index);
                    }
                  }}
                >
                  <span
                    style={{
                      fontSize: 16,
                      color:
                        (step.completed || index === accomplishedStep) &&
                          isStepEnabled(step.name)
                          ? "#181D27"
                          : "#717680",
                      fontWeight: 700,
                    }}
                  >
                    {step.name}
                    {!isStepEnabled(step.name) && " (Skipped)"}
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
            maxWidth: currentStepName === "Pipeline Stages" ? "1800px" : "1400px",
            padding: "0 20px",
          }}
        >
          {currentStepName === "Career Details & Team Access" && (
            <BasicInformationForm
              careerForm={careerForm}
              setCareerForm={setCareerForm}
              provinceList={provinceList}
              cityList={cityList}
              setCityList={setCityList}
              user={user}
              orgMembers={orgMembers}
              teamMembers={teamMembers}
              showMemberDropdown={showMemberDropdown}
              setShowMemberDropdown={setShowMemberDropdown}
              loadingMembers={loadingMembers}
              addTeamMember={addTeamMember}
              removeTeamMember={removeTeamMember}
              updateMemberRole={updateMemberRole}
              showRoleDropdown={showRoleDropdown}
              setShowRoleDropdown={setShowRoleDropdown}
              roleOptions={roleOptions}
              currentUserRole={currentUserRole}
              setCurrentUserRole={setCurrentUserRole}
              memberSearchQuery={memberSearchQuery}
              setMemberSearchQuery={setMemberSearchQuery}
              validationErrors={validationErrors}
              childTitleValidationMessage={childTitleValidationMessage}
              setValidationErrors={setValidationErrors}
              formType={formType}
              availableJobPostTypes={availableJobPostTypes}
              jobPostTypeTooltipId={jobPostTypeTooltipId}
            />
          )}
          {currentStepName === "CV Review & Pre-screening" && (
            <CVReviewStep
              careerForm={careerForm}
              setCareerForm={setCareerForm}
              preScreeningQuestions={careerForm.preScreeningQuestions}
              setPreScreeningQuestions={(preScreeningQuestions) =>
                setCareerForm({
                  ...careerForm,
                  preScreeningQuestions: preScreeningQuestions,
                })
              }
              handleSaveAndContinue={handleSaveAndContinue}
              currencyOptions={currencyOptions}
              defaultSuggestedQuestions={defaultPreScreeningSuggestions}
              preScreeningSettingsScopeOptions={preScreeningSettingsScopeOptions}
              selectedPreScreeningSettingsScope={selectedPreScreeningSettingsScope}
              selectedPreScreeningSettingsScopeLabel={
                selectedPreScreeningSettingsScopeLabel
              }
              onSelectPreScreeningSettingsScope={
                handleSelectPreScreeningSettingsScope
              }
              isApplyingPreScreeningSettingsScope={
                isApplyingPreScreeningSettingsScope
              }
            />
          )}
          {currentStepName === "AI Interview Setup" && (
            <AIInterviewStep
              careerForm={careerForm}
              setCareerForm={setCareerForm}
              validationErrors={validationErrors}
              setValidationErrors={setValidationErrors}
            />
          )}
          {currentStepName === "Pipeline Stages" && (
            <PipelineStagesStep
              careerForm={careerForm}
              setCareerForm={setCareerForm}
              jobPipeline={jobPipeline}
              setJobPipeline={setJobPipeline}
              standaloneDefaultPipeline={standaloneDefaultPipeline}
              formType={formType}
              onPipelineCopied={setCopiedFromCareerId}
            />
          )}
          {currentStepName === "Review Career" && (
            <ReviewCareerStep
              careerForm={careerForm}
              jobPipeline={jobPipeline}
              setCurrentStep={(stepIndex) => setCurrentStep(stepIndex)}
              preScreeningQuestions={careerForm.preScreeningQuestions}
              teamMembers={teamMembers}
            />
          )}
        </div>
      </div>

      {showSaveModal && (
        <CareerActionModal
          action={showSaveModal}
          onAction={(action) => saveCareer(action)}
          onValidate={validateCurrentStep}
          formType={formType}
        />
      )}
      {showJobPostLimitModal && (
        <div className="modal-background fade-in-bottom" style={{ zIndex: 9999 }}>
          <div className="modal-container">
            <div
              className="modal-content"
              style={{
                width: "fit-content",
                maxWidth: 460,
                background: "#FFFFFF",
                border: "1.5px solid #E9EAEB",
                borderRadius: 24,
                boxShadow: "0 16px 40px rgba(15, 23, 42, 0.2)",
                padding: "36px 40px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: 20,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    backgroundColor: "#FEF3F2",
                    border: "1px solid #FEE4E2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i
                    className="la la-exclamation-triangle"
                    style={{ color: "#B42318", fontSize: 28 }}
                  />
                </div>
                <div>
                  <h2
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: "#111827",
                      margin: 0,
                      marginBottom: 8,
                    }}
                  >
                    {jobPostLimitInfo?.noPlan
                      ? "No Active Plan"
                      : "Active Job Post Limit Reached"}
                  </h2>
                  <p
                    style={{
                      fontSize: 15,
                      lineHeight: 1.7,
                      color: "#4B5563",
                      margin: 0,
                      marginBottom: 4,
                    }}
                  >
                    {jobPostLimitInfo?.noPlan ? (
                      <>
                        This organization does not have an active{" "}
                        {jobPostLimitInfo.jobPostType === "credit-based"
                          ? "Credit-based"
                          : "Premium"}{" "}
                        plan. Please contact your administrator to assign a plan
                        before publishing job posts.
                      </>
                    ) : jobPostLimitInfo?.maxActiveJobPosts && jobPostLimitInfo?.planName ? (
                      <>
                        You've hit your active job post limit (
                        {jobPostLimitInfo.maxActiveJobPosts}) for this{" "}
                        {jobPostLimitInfo.planName} plan (
                        {jobPostLimitInfo.schemaLabel ||
                          (jobPostLimitInfo.jobPostType === "credit-based"
                            ? "Credit-based"
                            : "Premium")}
                        ).
                      </>
                    ) : (
                      <>You've hit your active job post limit for this plan.</>
                    )}
                  </p>
                  {!jobPostLimitInfo?.noPlan && (
                    <p
                      style={{
                        fontSize: 15,
                        lineHeight: 1.7,
                        color: "#4B5563",
                        margin: 0,
                      }}
                    >
                      Don't worry—you can save this role as unpublished and come
                      back to publish it once a slot is available.
                    </p>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 16,
                    width: "100%",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowJobPostLimitModal(false)}
                    style={{
                      flex: 1,
                      padding: "12px 18px",
                      borderRadius: 999,
                      border: "1px solid #D5D7DA",
                      backgroundColor: "#FFFFFF",
                      color: "#111827",
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Go back
                  </button>
                  {!jobPostLimitInfo?.noPlan && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowJobPostLimitModal(false);
                        saveCareer("inactive");
                      }}
                      style={{
                        flex: 1,
                        padding: "12px 18px",
                        borderRadius: 999,
                        border: "none",
                        backgroundColor: "#111827",
                        color: "#FFFFFF",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Save as unpublished
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {isSavingCareer && (
        <FullScreenLoadingAnimation
          title={"Saving career..."}
          subtext={`Please wait while we are saving the career`}
        />
      )}
    </div>
  );
}

function BasicInformationForm({
  careerForm,
  setCareerForm,
  provinceList,
  cityList,
  setCityList,
  user,
  orgMembers,
  teamMembers,
  showMemberDropdown,
  setShowMemberDropdown,
  loadingMembers,
  addTeamMember,
  removeTeamMember,
  updateMemberRole,
  showRoleDropdown,
  setShowRoleDropdown,
  roleOptions,
  currentUserRole,
  setCurrentUserRole,
  memberSearchQuery,
  setMemberSearchQuery,
  validationErrors,
  childTitleValidationMessage,
  setValidationErrors,
  formType,
  availableJobPostTypes,
  jobPostTypeTooltipId,
}: {
  careerForm: any;
  setCareerForm: (careerForm: any) => void;
  provinceList: any;
  cityList: any;
  setCityList: (cityList: any) => void;
  user: any;
  orgMembers: any[];
  teamMembers: any[];
  showMemberDropdown: boolean;
  setShowMemberDropdown: (show: boolean) => void;
  loadingMembers: boolean;
  addTeamMember: (member: any) => void;
  removeTeamMember: (email: string) => void;
  updateMemberRole: (email: string, role: string) => void;
  showRoleDropdown: string | null;
  setShowRoleDropdown: (email: string | null) => void;
  roleOptions: Array<{ name: string; description: string }>;
  currentUserRole: string;
  setCurrentUserRole: (role: string) => void;
  memberSearchQuery: string;
  setMemberSearchQuery: (query: string) => void;
  validationErrors: { [key: string]: boolean };
  childTitleValidationMessage: string | null;
  setValidationErrors: (errors: { [key: string]: boolean }) => void;
  formType: "add" | "edit";
  availableJobPostTypes: ("premium" | "credit-based")[];
  jobPostTypeTooltipId: string;
}) {
  const [activeOrg] = useLocalStorage("activeOrg", null);
  const [isMounted, setIsMounted] = useState(false);
  const [showJobPostTypeTooltip, setShowJobPostTypeTooltip] = useState(false);
  const [showChildTitleTooltip, setShowChildTitleTooltip] = useState(false);
  const [showSalaryTooltip, setShowSalaryTooltip] = useState(false);
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [showManualLocationTooltip, setShowManualLocationTooltip] = useState(false);
  const [showOrgLocationTooltip, setShowOrgLocationTooltip] = useState(false);

  useEffect(() => {
    if (activeOrg?.organizationAddress && careerForm.locationAddress) {
      const isOrgLocation = activeOrg.organizationAddress.some(
        (addr: any) => addr.location === careerForm.locationAddress
      );
      if (!isOrgLocation) {
        setShowManualLocation(true);
      }
    }
  }, [activeOrg, careerForm.locationAddress]);

  // Set mounted flag to prevent hydration errors with client-side only data (localStorage)
  useEffect(() => {
    setIsMounted(true);
  }, []);

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
        {activeOrg?.linkedCareersEnabled && (
          <CareerPostingType
            careerForm={careerForm}
            formType={formType}
            careerId={careerForm.id}
            setCareerForm={setCareerForm}
            validationErrors={validationErrors}
            setValidationErrors={setValidationErrors}
            onParentSelected={(parentId, parentTitle) => {
              setCareerForm((prev: any) => ({
                ...prev,
                ...(parentTitle != null ? { jobTitle: parentTitle } : {}),
                parentCareerID: parentId,
                parentCareerTitle: parentTitle || "",
              }));
            }}
          />
        )}

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
                {activeOrg?.linkedCareersEnabled ? "2" : "1"}. Career Information
              </span>
            </div>
            <div className="layered-card-content">
              {/* Job Post Type Section - inside Career Information */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  width: "100%",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 14, color: "#414651", fontWeight: 500 }}>
                    Job Post Type
                  </span>
                  <span
                    onMouseEnter={() => setShowJobPostTypeTooltip(true)}
                    onMouseLeave={() => setShowJobPostTypeTooltip(false)}
                    onFocus={() => setShowJobPostTypeTooltip(true)}
                    onBlur={() => setShowJobPostTypeTooltip(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: "1px solid #D5D7DA",
                      cursor: "pointer",
                      fontSize: 11,
                      color: "#717680",
                      fontWeight: 600,
                    }}
                  >
                    ?
                  </span>
                  {showJobPostTypeTooltip && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "100%",
                        left: 0,
                        marginBottom: 8,
                        backgroundColor: "#111827",
                        color: "#FFFFFF",
                        fontSize: 11,
                        fontWeight: 500,
                        padding: "8px 12px",
                        borderRadius: 8,
                        maxWidth: 260,
                        whiteSpace: "normal",
                        lineHeight: 1.4,
                        boxShadow: "0 4px 12px rgba(15, 23, 42, 0.35)",
                        zIndex: 9999,
                      }}
                    >
                      Availability of job post types depends on your organization’s current plan.
                    </div>
                  )}
                </div>
                <div style={{ maxWidth: "100%" }}>
                  <JobPostTypeSelect
                    value={careerForm.jobPostType}
                    onChange={(type) => {
                      setCareerForm({ ...careerForm, jobPostType: type });
                      if (validationErrors.jobPostType) {
                        setValidationErrors({
                          ...validationErrors,
                          jobPostType: false,
                        });
                      }
                    }}
                    availableTypes={availableJobPostTypes}
                    disabled={false}
                    error={
                      validationErrors.jobPostType
                        ? "This is a required field."
                        : undefined
                    }
                  />
                </div>
              </div>

              <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>
                Basic Information
              </span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 8,
                  width: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "50%",
                  }}
                >
                  <span style={{ marginBottom: 8 }}>Job Title</span>
                  <input
                    value={careerForm.jobTitle}
                    readOnly={careerForm.careerPostType === "receiving_pool"}
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0.375rem 0.75rem",
                      fontSize: "1rem",
                      lineHeight: "1.5",
                      backgroundColor: careerForm.careerPostType === "receiving_pool" ? "#F5F5F5" : "#FFFFFF",
                      border: `1px solid ${validationErrors.jobTitle ? "#EF4444" : "#E9EAEB"
                        }`,
                      borderRadius: "8px",
                      color: careerForm.careerPostType === "receiving_pool" ? "#717680" : undefined,
                      cursor: careerForm.careerPostType === "receiving_pool" ? "not-allowed" : undefined,
                    }}
                    placeholder={careerForm.careerPostType === "receiving_pool" ? "Auto-filled from parent post" : "Enter job title"}
                    onChange={(e) => {
                      if (careerForm.careerPostType === "receiving_pool") return;
                      setCareerForm({
                        ...careerForm,
                        jobTitle: e.target.value || "",
                      });
                      if (validationErrors.jobTitle) {
                        setValidationErrors({
                          ...validationErrors,
                          jobTitle: false,
                        });
                      }
                    }}
                  ></input>
                  <div style={{ minHeight: "18px", marginTop: 4 }}>
                    {validationErrors.jobTitle && (
                      <span
                        style={{
                          fontSize: 12,
                          color: "#EF4444",
                          fontWeight: 400,
                        }}
                      >
                        This is a required field.
                      </span>
                    )}
                  </div>
                </div>

                {careerForm.careerPostType === "receiving_pool" ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      width: "50%",
                    }}
                  >
                    <div
                      style={{
                        position: "relative",
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span>Child Title</span>
                      <span
                        onMouseEnter={() => setShowChildTitleTooltip(true)}
                        onMouseLeave={() => setShowChildTitleTooltip(false)}
                        onFocus={() => setShowChildTitleTooltip(true)}
                        onBlur={() => setShowChildTitleTooltip(false)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: "1px solid #D5D7DA",
                          cursor: "pointer",
                          fontSize: 11,
                          color: "#717680",
                          fontWeight: 600,
                        }}
                      >
                        ?
                      </span>
                      {showChildTitleTooltip && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: "100%",
                            left: 0,
                            marginBottom: 8,
                            backgroundColor: "#111827",
                            color: "#FFFFFF",
                            fontSize: 11,
                            fontWeight: 500,
                            padding: "8px 12px",
                            borderRadius: 8,
                            width: 280,
                            whiteSpace: "normal",
                            lineHeight: 1.4,
                            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.35)",
                            zIndex: 9999,
                          }}
                        >
                          A unique label for this child post, used to identify it within the parent pool or career posting.
                        </div>
                      )}
                    </div>
                    <input
                      value={careerForm.childTitle}
                      style={{
                        width: "100%",
                        height: "48px",
                        padding: "0.375rem 0.75rem",
                        fontSize: "1rem",
                        lineHeight: "1.5",
                        backgroundColor: "#FFFFFF",
                        border: `1px solid ${validationErrors.childTitle ? "#EF4444" : "#E9EAEB"
                          }`,
                        borderRadius: "8px",
                      }}
                      placeholder="Enter child title"
                      onChange={(e) => {
                        setCareerForm({
                          ...careerForm,
                          childTitle: e.target.value || "",
                        });
                        if (validationErrors.childTitle) {
                          setValidationErrors({
                            ...validationErrors,
                            childTitle: false,
                          });
                        }
                      }}
                    ></input>
                    <div style={{ minHeight: "18px", marginTop: 4 }}>
                      {validationErrors.childTitle && (
                        <span
                          style={{
                            fontSize: 12,
                            color: "#EF4444",
                            fontWeight: 400,
                          }}
                        >
                          {childTitleValidationMessage || "This is a required field."}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      width: "50%",
                    }}
                  >
                    <span style={{ marginBottom: 8 }}>Headcount</span>
                    <input
                      type="number"
                      value={careerForm.headcount || ""}
                      style={{
                        width: "100%",
                        height: "48px",
                        padding: "0.375rem 0.75rem",
                        fontSize: "1rem",
                        lineHeight: "1.5",
                        backgroundColor: "#FFFFFF",
                        border: `1px solid ${validationErrors.headcount ? "#EF4444" : "#E9EAEB"
                          }`,
                        borderRadius: "8px",
                      }}
                      placeholder="Enter headcount"
                      min={0}
                      onChange={(e) => {
                        setCareerForm({
                          ...careerForm,
                          headcount: e.target.value || "",
                        });
                        if (validationErrors.headcount) {
                          setValidationErrors({
                            ...validationErrors,
                            headcount: false,
                          });
                        }
                      }}
                    ></input>
                    <div style={{ minHeight: "18px", marginTop: 4 }}>
                      {validationErrors.headcount && (
                        <span
                          style={{
                            fontSize: 12,
                            color: "#EF4444",
                            fontWeight: 400,
                          }}
                        >
                          This is a required field.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {careerForm.careerPostType === "receiving_pool" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 8,
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      width: "50%",
                    }}
                  >
                    <span style={{ marginBottom: 8 }}>Headcount</span>
                    <input
                      type="number"
                      value={careerForm.headcount || ""}
                      style={{
                        width: "100%",
                        height: "48px",
                        padding: "0.375rem 0.75rem",
                        fontSize: "1rem",
                        lineHeight: "1.5",
                        backgroundColor: "#FFFFFF",
                        border: `1px solid ${validationErrors.headcount ? "#EF4444" : "#E9EAEB"
                          }`,
                        borderRadius: "8px",
                      }}
                      placeholder="Enter headcount"
                      min={0}
                      onChange={(e) => {
                        setCareerForm({
                          ...careerForm,
                          headcount: e.target.value || "",
                        });
                        if (validationErrors.headcount) {
                          setValidationErrors({
                            ...validationErrors,
                            headcount: false,
                          });
                        }
                      }}
                    ></input>
                    <div style={{ minHeight: "18px", marginTop: 4 }}>
                      {validationErrors.headcount && (
                        <span
                          style={{
                            fontSize: 12,
                            color: "#EF4444",
                            fontWeight: 400,
                          }}
                        >
                          This is a required field.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <span
                style={{
                  fontSize: 16,
                  color: "#181D27",
                  fontWeight: 700,
                  marginTop: 24,
                }}
              >
                Work Setting
              </span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
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
                  <span>Employment Type</span>
                  <CustomDropdown
                    onSelectSetting={(employmentType) => {
                      setCareerForm({
                        ...careerForm,
                        employmentType: employmentType,
                      });
                      if (validationErrors.employmentType) {
                        setValidationErrors({
                          ...validationErrors,
                          employmentType: false,
                        });
                      }
                    }}
                    screeningSetting={careerForm.employmentType}
                    settingList={employmentTypeOptions}
                    placeholder="Choose employment type"
                    error={
                      validationErrors.employmentType
                        ? "This is a required field."
                        : null
                    }
                  />
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
                  <span>Arrangement</span>
                  <CustomDropdown
                    onSelectSetting={(setting) => {
                      setCareerForm({ ...careerForm, workSetup: setting });
                      if (validationErrors.workSetup) {
                        setValidationErrors({
                          ...validationErrors,
                          workSetup: false,
                        });
                      }
                    }}
                    screeningSetting={careerForm.workSetup}
                    settingList={workSetupOptions}
                    placeholder="Choose work arrangement"
                    error={
                      validationErrors.workSetup
                        ? "This is a required field."
                        : null
                    }
                  />
                </div>
              </div>

              <span
                style={{
                  fontSize: 16,
                  color: "#181D27",
                  fontWeight: 700,
                  marginTop: 24,
                }}
              >
                Location
              </span>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  width: "100%",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                  {!showManualLocation && (
                    <>
                      <CustomDropdown
                        onSelectSetting={(val) => {
                          const selectedAddr = activeOrg?.organizationAddress?.find((addr: any) => addr.location === val);
                          let newCountry = careerForm.country;
                          let newCurrency = careerForm.currency;

                          if (selectedAddr && selectedAddr.country) {
                            newCountry = selectedAddr.country;
                            newCurrency = COUNTRY_CURRENCY_MAP[newCountry] || newCurrency;
                          }
                          const newSalaryUnit = COUNTRY_SALARY_UNIT_MAP[newCountry] || careerForm.salaryUnit;
                          setCareerForm({ ...careerForm, locationAddress: val, country: newCountry, currency: newCurrency, salaryUnit: newSalaryUnit });
                          setShowManualLocation(false);
                        }}
                        screeningSetting={
                          activeOrg?.organizationAddress?.some((addr: any) => addr.location === careerForm.locationAddress)
                            ? careerForm.locationAddress
                            : ""
                        }
                        settingList={
                          activeOrg?.organizationAddress?.map((addr: any) => ({ name: addr.location, isMarkedHQ: addr.isMarkedHQ })) || []
                        }
                        placeholder="Select Location"
                      />

                      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => {
                              setCareerForm({
                                  ...careerForm,
                                  locationAddress: "",
                                  province: "",
                                  city: "",
                                  locationCountryCode: "",
                              });
                              setShowManualLocation(true);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: "#175CD3",
                            fontSize: 14,
                            fontWeight: 500,
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          Enter address manually
                        </button>
                         <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                            <i
                              className="la la-question-circle"
                              style={{ fontSize: 16, color: "#98A2B3", cursor: "pointer" }}
                              onMouseEnter={() => setShowManualLocationTooltip(true)}
                              onMouseLeave={() => setShowManualLocationTooltip(false)}
                            ></i>
                            {showManualLocationTooltip && (
                                <div
                                style={{
                                    position: "absolute",
                                    left: "100%",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    marginLeft: 8,
                                    backgroundColor: "#111827",
                                    color: "#FFFFFF",
                                    fontSize: 11,
                                    fontWeight: 500,
                                    padding: "8px 12px",
                                    borderRadius: 8,
                                    width: 250,
                                    whiteSpace: "normal",
                                    lineHeight: 1.4,
                                    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.35)",
                                    zIndex: 9999,
                                    textAlign: "left"
                                }}
                                >
                                <div
                                    style={{
                                    position: "absolute",
                                    right: "100%",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    width: 0,
                                    height: 0,
                                    borderTop: "6px solid transparent",
                                    borderBottom: "6px solid transparent",
                                    borderRight: "6px solid #111827",
                                    }}
                                />
                                Add a location that is unique to this career and not listed among the organization's saved locations.
                                </div>
                            )}
                        </div>
                      </div>
                    </>
                  )}

                  {showManualLocation && (
                    <div style={{ marginTop: 8 }}>
                      <ManualAddressForm
                        value={
                          careerForm.locationAddress
                            ? {
                              displayName: careerForm.locationAddress,
                              country: careerForm.country,
                              countryCode: careerForm.locationCountryCode,
                              state: careerForm.province,
                              city: careerForm.city,
                              address: "",
                            }
                            : null
                        }
                        onChange={(loc) => {
                          const newCountry = loc?.country || careerForm.country;
                          const newSalaryUnit = COUNTRY_SALARY_UNIT_MAP[newCountry] || careerForm.salaryUnit;
                          const newCurrency = COUNTRY_CURRENCY_MAP[newCountry] || careerForm.currency;
                          setCareerForm({
                            ...careerForm,
                            locationAddress: loc?.displayName || "",
                            country: newCountry,
                            locationCountryCode: loc?.countryCode || "",
                            province: loc?.state || "",
                            city: loc?.city || "",
                            salaryUnit: newSalaryUnit,
                            currency: newCurrency,
                          });
                        }}
                      />
                      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => {
                              const hqAddress = activeOrg?.organizationAddress?.find((addr: any) => addr.isMarkedHQ);
                              if (hqAddress) {
                                  let newCountry = careerForm.country;
                                  let newCurrency = careerForm.currency;

                                  if (hqAddress.country) {
                                      newCountry = hqAddress.country;
                                      newCurrency = COUNTRY_CURRENCY_MAP[newCountry] || newCurrency;
                                  }
                                  const newSalaryUnit = COUNTRY_SALARY_UNIT_MAP[newCountry] || careerForm.salaryUnit;

                                  setCareerForm({
                                      ...careerForm,
                                      locationAddress: hqAddress.location,
                                      country: newCountry,
                                      currency: newCurrency,
                                      salaryUnit: newSalaryUnit,
                                      // Clear manual fields just in case
                                      province: "",
                                      city: "",
                                      locationCountryCode: "" 
                                  });
                              }
                              setShowManualLocation(false);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: "#175CD3",
                            fontSize: 14,
                            fontWeight: 500,
                            cursor: "pointer",
                            textDecoration: "underline",
                          }}
                        >
                          Select from organization's locations
                        </button>
                        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                            <i
                              className="la la-question-circle"
                              style={{ fontSize: 16, color: "#98A2B3", cursor: "pointer" }}
                              onMouseEnter={() => setShowOrgLocationTooltip(true)}
                              onMouseLeave={() => setShowOrgLocationTooltip(false)}
                            ></i>
                            {showOrgLocationTooltip && (
                                <div
                                style={{
                                    position: "absolute",
                                    left: "100%",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    marginLeft: 8,
                                    backgroundColor: "#111827",
                                    color: "#FFFFFF",
                                    fontSize: 11,
                                    fontWeight: 500,
                                    padding: "8px 12px",
                                    borderRadius: 8,
                                    width: 250,
                                    whiteSpace: "normal",
                                    lineHeight: 1.4,
                                    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.35)",
                                    zIndex: 9999,
                                    textAlign: "left"
                                }}
                                >
                                <div
                                    style={{
                                    position: "absolute",
                                    right: "100%",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    width: 0,
                                    height: 0,
                                    borderTop: "6px solid transparent",
                                    borderBottom: "6px solid transparent",
                                    borderRight: "6px solid #111827",
                                    }}
                                />
                                Choose a location that is already listed among the organization's saved locations.
                                </div>
                            )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>


              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 32,
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                  >
                    Salary
                  </span>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <i
                      className="la la-question-circle"
                      style={{ fontSize: 16, color: "#98A2B3", cursor: "pointer" }}
                      onMouseEnter={() => setShowSalaryTooltip(true)}
                      onMouseLeave={() => setShowSalaryTooltip(false)}
                      onFocus={() => setShowSalaryTooltip(true)}
                      onBlur={() => setShowSalaryTooltip(false)}
                      tabIndex={0}
                    ></i>
                    {showSalaryTooltip && (
                      <div
                        style={{
                          position: "absolute",
                          left: "100%",
                          top: "50%",
                          transform: "translateY(-50%)",
                          marginLeft: 8,
                          backgroundColor: "#111827",
                          color: "#FFFFFF",
                          fontSize: 11,
                          fontWeight: 500,
                          padding: "8px 12px",
                          borderRadius: 8,
                          width: 300,
                          whiteSpace: "normal",
                          lineHeight: 1.4,
                          boxShadow: "0 4px 12px rgba(15, 23, 42, 0.35)",
                          zIndex: 9999,
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            right: "100%",
                            top: "50%",
                            transform: "translateY(-50%)",
                            width: 0,
                            height: 0,
                            borderTop: "6px solid transparent",
                            borderBottom: "6px solid transparent",
                            borderRight: "6px solid #111827",
                          }}
                        />
                        These values are based on your organization’s default settings. You can override them here for global or remote roles, or update the defaults anytime in your organization’s Settings page.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 16,
                  width: "100%",
                }}
              >
                {/* Minimum Salary */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "33.33%",
                  }}
                >
                  <span style={{ marginBottom: 8 }}>Minimum Salary</span>
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
                      {currencyOptions.find(
                        (c) => c.name === careerForm.currency
                      )?.symbol || "₱"}
                    </span>
                    <input
                      type="number"
                      style={{
                        width: "100%",
                        height: "48px",
                        paddingTop: "0.375rem",
                        paddingBottom: "0.375rem",
                        paddingLeft: "48px",
                        paddingRight: "80px",
                        fontSize: "1rem",
                        lineHeight: "1.5",
                        backgroundColor: "#FFFFFF",
                        border: `1px solid ${validationErrors.minimumSalary ? "#EF4444" : "#E9EAEB"
                          }`,
                        borderRadius: "8px",
                      }}
                      placeholder="0"
                      min={0}
                      value={careerForm.minimumSalary}
                      onChange={(e) => {
                        setCareerForm({
                          ...careerForm,
                          minimumSalary: e.target.value || "",
                        });
                        if (validationErrors.minimumSalary) {
                          setValidationErrors({
                            ...validationErrors,
                            minimumSalary: false,
                          });
                        }
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                    >
                      <CurrencyDropdown minimal={true}
                        currency={careerForm.currency}
                        onCurrencyChange={(curr) => {
                          setCareerForm({
                            ...careerForm,
                            currency: curr,
                          });
                        }}
                        currencyOptions={currencyOptions}
                        disabled={!careerForm.globalHiringEnabled}
                      />
                    </div>
                  </div>
                  <div style={{ minHeight: "18px", marginTop: 4 }}>
                    {validationErrors.minimumSalary && (
                      <span
                        style={{
                          fontSize: 12,
                          color: "#EF4444",
                          fontWeight: 400,
                        }}
                      >
                        This is a required field.
                      </span>
                    )}
                  </div>
                </div>

                {/* Maximum Salary */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "33.33%",
                  }}
                >
                  <span style={{ marginBottom: 8 }}>Maximum Salary</span>
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
                      {currencyOptions.find(
                        (c) => c.name === careerForm.currency
                      )?.symbol || "₱"}
                    </span>
                    <input
                      type="number"
                      style={{
                        width: "100%",
                        height: "48px",
                        paddingTop: "0.375rem",
                        paddingBottom: "0.375rem",
                        paddingLeft: "48px",
                        paddingRight: "80px",
                        fontSize: "1rem",
                        lineHeight: "1.5",
                        backgroundColor: "#FFFFFF",
                        border: `1px solid ${validationErrors.maximumSalary ? "#EF4444" : "#E9EAEB"
                          }`,
                        borderRadius: "8px",
                      }}
                      placeholder="0"
                      min={0}
                      value={careerForm.maximumSalary}
                      onChange={(e) => {
                        setCareerForm({
                          ...careerForm,
                          maximumSalary: e.target.value || "",
                        });
                        if (validationErrors.maximumSalary) {
                          setValidationErrors({
                            ...validationErrors,
                            maximumSalary: false,
                          });
                        }
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                    >
                      <CurrencyDropdown minimal={true}
                        currency={careerForm.currency}
                        onCurrencyChange={(curr) => {
                          setCareerForm({
                            ...careerForm,
                            currency: curr,
                          });
                        }}
                        currencyOptions={currencyOptions}
                        disabled={!careerForm.globalHiringEnabled}
                      />
                    </div>
                  </div>
                  <div style={{ minHeight: "18px", marginTop: 4 }}>
                    {validationErrors.maximumSalary && (
                      <span
                        style={{
                          fontSize: 12,
                          color: "#EF4444",
                          fontWeight: 400,
                        }}
                      >
                        This is a required field.
                      </span>
                    )}
                  </div>
                </div>

                {/* Salary Unit */}
                <div style={{ width: "33.33%" }}>
                  <span style={{ marginBottom: 8, display: "block" }}>Salary Unit</span>
                  <CustomDropdown
                    onSelectSetting={(unit) => {
                      setCareerForm({ ...careerForm, salaryUnit: unit });
                    }}
                    screeningSetting={careerForm.salaryUnit}
                    settingList={salaryUnitOptions}
                    placeholder="Select Unit"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    // alignItems: "center",
                    gap: 8,
                  }}
                >
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={careerForm.salaryNegotiable}
                      onChange={() =>
                        setCareerForm({
                          ...careerForm,
                          salaryNegotiable: !careerForm.salaryNegotiable,
                        })
                      }
                    />
                    <span className="slider round"></span>
                  </label>
                  <span style={{ fontSize: 14, color: "#181D27", fontWeight: 500 }}>Negotiable</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={careerForm.showSalaryToApplicants}
                      onChange={() =>
                        setCareerForm({
                          ...careerForm,
                          showSalaryToApplicants: !careerForm.showSalaryToApplicants,
                        })
                      }
                    />
                    <span className="slider round"></span>
                  </label>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 14, color: "#181D27", fontWeight: 500 }}>Show salary to applicants</span>
                    <span style={{ fontSize: 13, color: "#717680" }}>When enabled, salary will be shown on the job posting.</span>
                  </div>
                </div>
              </div>

              {/* Global Hiring */}
              {activeOrg?.globalHiringEnabled !== false && (
                <div style={{ marginTop: 24 }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <span
                      style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                    >
                      Global Hiring
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                  >
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={careerForm.globalHiringEnabled}
                        onChange={() =>
                          setCareerForm({
                            ...careerForm,
                            globalHiringEnabled: !careerForm.globalHiringEnabled,
                          })
                        }
                      />
                      <span className="slider round"></span>
                    </label>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 14, color: "#181D27", fontWeight: 500 }}>Enable Global Hiring</span>
                      <span style={{ fontSize: 13, color: "#717680" }}>
                        Allows candidates outside your country to apply to this role.
                        <br />
                        When disabled, only candidates within your country can apply.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

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
                {activeOrg?.linkedCareersEnabled ? "3" : "2"}. Job Description
              </span>
            </div>
            <div className="layered-card-content">
              <StructuredDescriptionFields
                value={careerForm.structuredDescription}
                onChange={(next) => {
                  setCareerForm((prev: any) => ({
                    ...prev,
                    structuredDescription: next,
                    description: deriveLegacyDescription(next),
                  }));
                  if (validationErrors?.description) {
                    setValidationErrors({ ...validationErrors, description: false });
                  }
                }}
                error={validationErrors?.description || false}
              />
            </div>
          </div>
        </div>

        <div
          id="team-access"
          className="layered-card-outer"
          style={{ marginBottom: "32px" }}
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
              <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>
                {activeOrg?.linkedCareersEnabled ? "4" : "3"}. Team Access
              </span>
            </div>
            <div className="layered-card-content">
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {/* Projects Section */}
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        color: "#414651",
                        fontWeight: 700,
                      }}
                    >
                      Link to a Project
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#717680",
                        fontWeight: 400,
                      }}
                    >
                      All members of selected project will also be able to view
                      this career.
                    </span>
                  </div>

                  {/* Projects Dropdown */}
                  {!isMounted ? (
                    // Loading state - show disabled button to match SSR
                    <div style={{ width: 300 }}>
                      <button
                        className="dropdown-btn fade-in-bottom"
                        style={{
                          width: "100%",
                          height: "48px",
                          opacity: 0.6
                        }}
                        type="button"
                        disabled
                      >
                        <span>Select project</span>
                        <i className="la la-angle-down ml-10"></i>
                      </button>
                    </div>
                  ) : activeOrg?.projectsEnabled ? (
                    (activeOrg?.role === "hiring_manager" && formType === "edit") || activeOrg?.role === "guest" ? (
                      <>
                        <button
                          className="dropdown-btn fade-in-bottom"
                          data-tooltip-id="project-disabled-role-tooltip"
                          data-tooltip-content={
                            activeOrg?.role === "guest"
                              ? "Guest users have view-only access"
                              : "Hiring managers cannot change the linked project"
                          }
                          data-tooltip-place="left"
                          type="button"
                          disabled
                        >
                          <span>{careerForm.project || "Select project"}</span>
                          <i className="la la-angle-down ml-10"></i>
                        </button>
                        <Tooltip id="project-disabled-role-tooltip" />
                      </>
                    ) : (
                      <div style={{ width: 300 }}>
                        <ProjectDropdown
                          selectedProject={careerForm.project}
                          selectedProjectId={careerForm.projectId}
                          onSelectProject={(projectName, projectId) => {
                            setCareerForm({
                              ...careerForm,
                              project: projectName,
                              projectId: projectId,
                            });
                          }}
                          orgID={activeOrg?._id}
                          userEmail={user?.email}
                          error={validationErrors?.project}
                        />
                      </div>
                    )
                  ) : (
                    <div style={{ position: "relative" }}>
                      <button
                        className="dropdown-btn fade-in-bottom"
                        data-tooltip-id="project-disabled-tooltip"
                        data-tooltip-content="Projects feature is not enabled in this organization"
                        data-tooltip-place="left"
                        type="button"
                        disabled
                      >
                        <span>Select project</span>
                        <i className="la la-angle-down ml-10"></i>
                      </button>
                      <Tooltip id="project-disabled-tooltip" />
                    </div>
                  )}
                </div>


                {/* Divider line */}
                <div
                  style={{
                    width: "100%",
                    height: "1px",
                    backgroundColor: "#E9EAEB",
                    margin: "8px 0",
                  }}
                ></div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        color: "#414651",
                        fontWeight: 700,
                      }}
                    >
                      Add more members
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#717680",
                        fontWeight: 400,
                      }}
                    >
                      {currentUserRole === "Job Owner"
                        ? "You can add other members to collaborate on this career."
                        : "Only Job Owners can add team members."}
                    </span>
                  </div>
                  {currentUserRole === "Job Owner" && (
                    <div
                      style={{ position: "relative" }}
                      data-dropdown="member-dropdown"
                    >
                      <button
                        onClick={() =>
                          setShowMemberDropdown(!showMemberDropdown)
                        }
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          padding: "0 16px",
                          height: "48px",
                          backgroundColor: "#FFFFFF",
                          border: "2px solid #E9EAEB",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontSize: 14,
                          color: "#717680",
                          width: "300px",
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
                          <i
                            className="la la-user-plus"
                            style={{ fontSize: 18, color: "#717680" }}
                          ></i>
                          <span>Add member</span>
                        </div>
                        <i
                          className={`la la-angle-${showMemberDropdown ? "up" : "down"
                            }`}
                          style={{ fontSize: 18 }}
                        ></i>
                      </button>

                      {showMemberDropdown && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #E9EAEB",
                            borderRadius: "12px",
                            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                            zIndex: 1000,
                            marginTop: "4px",
                            width: "300px",
                            overflow: "hidden",
                          }}
                        >
                          {/* Search Bar */}
                          <div style={{ padding: "16px 16px 12px 16px" }}>
                            <div
                              style={{
                                position: "relative",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <i
                                className="la la-search"
                                style={{
                                  position: "absolute",
                                  left: "12px",
                                  fontSize: 16,
                                  color: "#9CA3AF",
                                  zIndex: 1,
                                }}
                              ></i>
                              <input
                                type="text"
                                placeholder="Search member"
                                value={memberSearchQuery}
                                onChange={(e) =>
                                  setMemberSearchQuery(e.target.value)
                                }
                                style={{
                                  width: "100%",
                                  height: "40px",
                                  paddingLeft: "40px",
                                  paddingRight: "12px",
                                  border: "2px solid #E9EAEB",
                                  borderRadius: "8px",
                                  fontSize: "14px",
                                  color: "#A4A7AE",
                                  backgroundColor: "#FFFFFF",
                                  outline: "none",
                                }}
                              />
                            </div>
                          </div>

                          {/* Member List */}
                          <div
                            style={{
                              maxHeight: "240px",
                              overflowY: "auto",
                            }}
                          >
                            {loadingMembers ? (
                              <div
                                style={{ padding: "20px", textAlign: "center" }}
                              >
                                <span
                                  style={{ fontSize: 14, color: "#717680" }}
                                >
                                  Loading...
                                </span>
                              </div>
                            ) : orgMembers.length === 0 ? (
                              <div
                                style={{ padding: "20px", textAlign: "center" }}
                              >
                                <span
                                  style={{ fontSize: 14, color: "#717680" }}
                                >
                                  No other members found
                                </span>
                              </div>
                            ) : (
                              (() => {
                                const filteredMembers = orgMembers.filter(
                                  (member: any) =>
                                    !teamMembers.find(
                                      (tm: any) => tm.email === member.email
                                    ) &&
                                    (member.name
                                      .toLowerCase()
                                      .includes(
                                        memberSearchQuery.toLowerCase()
                                      ) ||
                                      member.email
                                        .toLowerCase()
                                        .includes(
                                          memberSearchQuery.toLowerCase()
                                        ))
                                );

                                if (
                                  filteredMembers.length === 0 &&
                                  memberSearchQuery.trim() !== ""
                                ) {
                                  return (
                                    <div
                                      style={{
                                        padding: "20px",
                                        textAlign: "center",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: 14,
                                          color: "#717680",
                                        }}
                                      >
                                        No members match your search
                                      </span>
                                    </div>
                                  );
                                }

                                return filteredMembers.map(
                                  (member: any, index: number) => (
                                    <div
                                      key={`${member.email}-${index}`}
                                      onClick={() => {
                                        addTeamMember(member);
                                      }}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        padding: "12px 14px",
                                        cursor: "pointer",
                                        transition: "background-color 0.2s",
                                      }}
                                      onMouseEnter={(e) =>
                                      (e.currentTarget.style.backgroundColor =
                                        "#F8F9FA")
                                      }
                                      onMouseLeave={(e) =>
                                      (e.currentTarget.style.backgroundColor =
                                        "transparent")
                                      }
                                    >
                                      <div
                                        style={{
                                          width: 28,
                                          height: 28,
                                          borderRadius: "50%",
                                          backgroundColor: "#E9EAEB",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          overflow: "hidden",
                                          flexShrink: 0,
                                        }}
                                      >
                                        {member.image ? (
                                          <img
                                            src={member.image}
                                            alt={member.name}
                                            style={{
                                              width: "100%",
                                              height: "100%",
                                              objectFit: "cover",
                                            }}
                                          />
                                        ) : (
                                          <i
                                            className="la la-user"
                                            style={{
                                              fontSize: 12,
                                              color: "#717680",
                                            }}
                                          ></i>
                                        )}
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            overflow: "hidden",
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontSize: 14,
                                              fontWeight: 600,
                                              color: "#111827",
                                              flexShrink: 0,
                                            }}
                                          >
                                            {member.name}
                                          </span>
                                          <span
                                            style={{
                                              fontSize: 14,
                                              color: "#9CA3AF",
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              whiteSpace: "nowrap",
                                            }}
                                          >
                                            {member.email}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                );
                              })()
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Job Owner Error Message */}
                {validationErrors.teamAccess && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: "12px",
                    }}
                  >
                    <i
                      className="la la-exclamation-triangle"
                      style={{
                        fontSize: 20,
                        color: "#EF4444",
                        flexShrink: 0,
                      }}
                    ></i>
                    <span
                      style={{
                        fontSize: 14,
                        color: "#EF4444",
                        fontWeight: 400,
                      }}
                    >
                      Career must have a job owner. Please assign a job owner.
                    </span>
                  </div>
                )}

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {/* Current user */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      {user?.image ? (
                        <img
                          src={user.image}
                          alt={user.name}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            backgroundColor: "#E9EAEB",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                            fontWeight: 600,
                            color: "#414651",
                          }}
                        >
                          {user?.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            color: "#414651",
                            fontWeight: 600,
                          }}
                        >
                          {user?.name || "Current User"}{" "}
                          <span style={{ color: "#717680" }}>(You)</span>
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "#717680",
                            fontWeight: 400,
                          }}
                        >
                          {user?.email || "user@example.com"}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 16,
                      }}
                    >
                      <div
                        style={{ position: "relative" }}
                        data-dropdown="role-dropdown"
                      >
                        <button
                          onClick={() =>
                            setShowRoleDropdown(
                              showRoleDropdown === user?.email
                                ? null
                                : user?.email
                            )
                          }
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            padding: "0 16px",
                            height: "48px",
                            backgroundColor: "#FFFFFF",
                            border: "2px solid #E9EAEB",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: 14,
                            color: "#414651",
                            minWidth: "220px",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>{currentUserRole}</span>
                          <i
                            className={`la la-angle-${showRoleDropdown === user?.email ? "up" : "down"
                              }`}
                            style={{ fontSize: 18 }}
                          ></i>
                        </button>

                        {showRoleDropdown === user?.email && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              right: 0,
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #E9EAEB",
                              borderRadius: "12px",
                              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                              zIndex: 1000,
                              marginTop: "4px",
                              padding: "10px",
                              minWidth: "320px",
                            }}
                          >
                            {roleOptions.map((role) => {
                              const hasOtherJobOwner = teamMembers.some(
                                (member) => member.role === "Job Owner"
                              );
                              const canChangeRole =
                                role.name === "Job Owner" || hasOtherJobOwner;

                              return (
                                <div
                                  key={role.name}
                                  onClick={() => {
                                    if (role.name === currentUserRole) {
                                      // Already selected role, just close dropdown
                                      setShowRoleDropdown(null);
                                    } else if (
                                      hasOtherJobOwner ||
                                      role.name === "Job Owner"
                                    ) {
                                      // Can change role since there's another Job Owner, or selecting Job Owner
                                      setCurrentUserRole(role.name);
                                      // Update the role in teamMembers array for the current user
                                      updateMemberRole(user?.email, role.name);
                                      setShowRoleDropdown(null);
                                    } else {
                                      // Cannot change role - show a message or do nothing
                                      setShowRoleDropdown(null);
                                    }
                                  }}
                                  style={{
                                    padding: "10px",
                                    cursor: canChangeRole
                                      ? role.name === "Job Owner"
                                        ? "default"
                                        : "pointer"
                                      : "not-allowed",
                                    backgroundColor:
                                      role.name === currentUserRole
                                        ? "#EEF4FF"
                                        : "transparent",
                                    borderRadius: "8px",
                                    margin: "2px 0",
                                    opacity: canChangeRole ? 1 : 0.5,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      marginBottom: "4px",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: "#181D27",
                                      }}
                                    >
                                      {role.name}
                                    </span>
                                    {role.name === currentUserRole && (
                                      <i
                                        className="la la-check"
                                        style={{
                                          fontSize: 20,
                                          color: "#10B981",
                                        }}
                                      ></i>
                                    )}
                                  </div>
                                  <p
                                    style={{
                                      fontSize: 12,
                                      color: "#717680",
                                      margin: 0,
                                      lineHeight: "1.4",
                                    }}
                                  >
                                    {role.description}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <button
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #D5D7DA",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "not-allowed",
                          opacity: 0.5,
                        }}
                        disabled
                      >
                        <i
                          className="la la-trash"
                          style={{ fontSize: 18, color: "#717680" }}
                        ></i>
                      </button>
                    </div>
                  </div>

                  {/* Added team members */}
                  {teamMembers
                    .filter((member: any) => member.email !== user?.email)
                    .map((member: any, index: number) => (
                      <div
                        key={`${member.email}-${index}`}
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 16,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          {member.image ? (
                            <img
                              src={member.image}
                              alt={member.name}
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: "50%",
                                backgroundColor: "#E9EAEB",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 16,
                                fontWeight: 600,
                                color: "#414651",
                              }}
                            >
                              {member.name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 14,
                                color: "#414651",
                                fontWeight: 600,
                              }}
                            >
                              {member.name}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                color: "#717680",
                                fontWeight: 400,
                              }}
                            >
                              {member.email}
                            </span>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 16,
                          }}
                        >
                          <div
                            style={{ position: "relative" }}
                            data-dropdown="role-dropdown"
                          >
                            <button
                              onClick={() => {
                                if (currentUserRole === "Job Owner") {
                                  setShowRoleDropdown(
                                    showRoleDropdown === member.email
                                      ? null
                                      : member.email
                                  );
                                }
                              }}
                              disabled={currentUserRole !== "Job Owner"}
                              style={{
                                display: "flex",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                                padding: "0 16px",
                                height: "48px",
                                backgroundColor: "#FFFFFF",
                                border: "1px solid #D5D7DA",
                                borderRadius: "8px",
                                cursor:
                                  currentUserRole === "Job Owner"
                                    ? "pointer"
                                    : "not-allowed",
                                fontSize: 14,
                                color: "#414651",
                                minWidth: "220px",
                                justifyContent: "space-between",
                                opacity:
                                  currentUserRole === "Job Owner" ? 1 : 0.6,
                              }}
                            >
                              <span>{member.role}</span>
                              {currentUserRole === "Job Owner" && (
                                <i
                                  className={`la la-angle-${showRoleDropdown === member.email
                                    ? "up"
                                    : "down"
                                    }`}
                                  style={{ fontSize: 18 }}
                                ></i>
                              )}
                            </button>

                            {showRoleDropdown === member.email &&
                              currentUserRole === "Job Owner" && (
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: 0,
                                    right: 0,
                                    backgroundColor: "#FFFFFF",
                                    border: "1px solid #E9EAEB",
                                    borderRadius: "12px",
                                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                                    zIndex: 1000,
                                    marginTop: "4px",
                                    padding: "10px",
                                    minWidth: "320px",
                                  }}
                                >
                                  {roleOptions.map((role) => (
                                    <div
                                      key={role.name}
                                      onClick={() => {
                                        updateMemberRole(
                                          member.email,
                                          role.name
                                        );
                                        setShowRoleDropdown(null);
                                      }}
                                      style={{
                                        padding: "10px",
                                        cursor: "pointer",
                                        backgroundColor:
                                          member.role === role.name
                                            ? "#EEF4FF"
                                            : "transparent",
                                        borderRadius: "8px",
                                        margin: "2px 0",
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "space-between",
                                          marginBottom: "4px",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: "#181D27",
                                          }}
                                        >
                                          {role.name}
                                        </span>
                                        {member.role === role.name && (
                                          <i
                                            className="la la-check"
                                            style={{
                                              fontSize: 20,
                                              color: "#10B981",
                                            }}
                                          ></i>
                                        )}
                                      </div>
                                      <p
                                        style={{
                                          fontSize: 12,
                                          color: "#717680",
                                          margin: 0,
                                          lineHeight: "1.4",
                                        }}
                                      >
                                        {role.description}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                          </div>
                          <button
                            onClick={() => {
                              if (currentUserRole === "Job Owner") {
                                removeTeamMember(member.email);
                              }
                            }}
                            disabled={currentUserRole !== "Job Owner"}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #D5D7DA",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor:
                                currentUserRole === "Job Owner"
                                  ? "pointer"
                                  : "not-allowed",
                              opacity:
                                currentUserRole === "Job Owner" ? 1 : 0.5,
                            }}
                          >
                            <i
                              className="la la-trash"
                              style={{ fontSize: 18, color: "#717680" }}
                            ></i>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>

                <span
                  style={{
                    fontSize: 12,
                    color: "#717680",
                    fontWeight: 400,
                  }}
                >
                  *Admins can view all careers regardless of specific access
                  settings.
                </span>
              </div>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {activeOrg?.linkedCareersEnabled && (
                <>
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
                      Posting Type:
                    </span>{" "}
                    <span style={{ color: "#717680" }}>
                      Post end-to-end or link multiple careers with a parent-child setup.
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
                      End-to-end:
                    </span>{" "}
                    <span style={{ color: "#717680" }}>
                      An end-to-end job post from CV screening to Job Offer
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
                      Linked Career:
                    </span>{" "}
                    <span style={{ color: "#717680" }}>
                      A linked job post that separates the early and the later stages into separate job posts. This allows you to pool candidates for a broad requirement into a parent post, and then distribute them to child posts for more specific requirement.
                    </span>
                  </p>
                </>
              )}
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
                  Use clear, standard job titles
                </span>{" "}
                <span style={{ color: "#717680" }}>
                  for better searchability (e.g., "Software Engineer" instead of
                  "Code Ninja" or "Tech Rockstar").
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
                  Avoid abbreviations
                </span>{" "}
                <span style={{ color: "#717680" }}>
                  or internal role codes that applicants may not understand
                  (e.g., use "QA Engineer" instead of "QE II" or "QA-TL").
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
                  Keep it concise
                </span>{" "}
                <span style={{ color: "#717680" }}>
                  — job titles should be no more than a few words (2—4 max),
                  avoiding fluff or marketing terms.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreScreeningQuestionsForm({
  careerForm,
  setCareerForm,
  preScreeningQuestions,
  setPreScreeningQuestions,
  handleSaveAndContinue,
}: {
  careerForm: any;
  setCareerForm: (careerForm: any) => void;
  preScreeningQuestions: PreScreeningQuestion[];
  setPreScreeningQuestions: any;
  handleSaveAndContinue: () => void;
}) {
  const [suggestedQuestions, setSuggestedQuestions] = useState([
    {
      id: "1",
      questionType: "Notice Period",
      question: "How long is your notice period?",
      questionFormat: "Dropdown",
      answers: [
        { id: "1", value: "Immediately", type: "Dropdown" },
        { id: "2", value: "< 30 days", type: "Dropdown" },
        { id: "3", value: "> 30 days", type: "Dropdown" },
      ],
      added: false,
    },
    {
      id: "2",
      questionType: "Work Setup",
      question: "How often are you willing to report to the office each week?",
      questionFormat: "Dropdown",
      answers: [
        { id: "1", value: "At most 1-2x a week", type: "Dropdown" },
        { id: "2", value: "At most 3-4x a week", type: "Dropdown" },
        { id: "3", value: "Open to fully onsite work", type: "Dropdown" },
        { id: "4", value: "Only open to fully remote work", type: "Dropdown" },
      ],
      added: false,
    },
    {
      id: "3",
      questionType: "Asking Salary",
      question: "How much is your expected monthly salary?",
      questionFormat: "Range",
      answers: [
        { id: "1", value: 40000, type: "Minimum" },
        { id: "2", value: 60000, type: "Maximum" },
      ],
      added: false,
    },
  ]);

  useEffect(() => {
    if (preScreeningQuestions.length > 0) {
      setSuggestedQuestions(
        suggestedQuestions.map((question) => ({
          ...question,
          added: preScreeningQuestions.some(
            (q) => q.questionType === question.questionType
          ),
        }))
      );
    }
  }, [preScreeningQuestions]);

  return (
    <div
      id="pre-screening"
      style={{ display: "flex", flexDirection: "row", gap: 16, width: "100%" }}
    >
      <div
        className="layered-card-outer"
        style={{ width: "60%", height: "100%" }}
      >
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
              <div
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: "#181D27",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i
                  className="la la-user-check"
                  style={{ color: "#FFFFFF", fontSize: 20 }}
                ></i>
              </div>
              <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>
                Pre-Screening Questions
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
                {preScreeningQuestions?.length || 0}
              </div>
            </div>

            <Button
              variant="primary"
              onClick={() => {
                setPreScreeningQuestions([
                  ...preScreeningQuestions,
                  {
                    id: guid(),
                    questionType: "Custom Question",
                    question: "",
                    questionFormat: "Dropdown",
                    answers: [{ id: guid(), value: "", type: "Dropdown" }],
                  },
                ]);
              }}
              label="Add custom"
              icon="/icons/plus.svg"
            >
            </Button>
          </div>

          <div className="layered-card-content">
            {preScreeningQuestions.length > 0 ? (
              preScreeningQuestions.map((question, index) => (
                <div
                  key={index}
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
                      const question = JSON.parse(questionString);
                      // Insert at the current index
                      let newQuestions = [...preScreeningQuestions];
                      newQuestions = newQuestions.filter(
                        (q) => q.id !== question.id
                      );
                      newQuestions.splice(index, 0, question);
                      setPreScreeningQuestions(newQuestions);
                    } catch (error) {
                      return;
                    }
                  }}
                >
                  <div
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "question",
                        JSON.stringify(question)
                      );
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      gap: 8,
                      width: "100%",
                      alignItems: "center",
                      cursor: "grab",
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
                            q.id === updatedQuestion.id ? updatedQuestion : q
                          )
                        );
                      }}
                      onDelete={(id) => {
                        setSuggestedQuestions(
                          suggestedQuestions.map((q) => ({
                            ...q,
                            added: q.id === id ? false : q.added,
                          }))
                        );
                        setPreScreeningQuestions(
                          preScreeningQuestions.filter((q) => q.id !== id)
                        );
                      }}
                      currency={careerForm.currency}
                      onCurrencyChange={(curr) => {
                        setCareerForm({
                          ...careerForm,
                          currency: curr,
                        });
                      }}
                    />
                  </div>
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
                <button
                  style={{
                    width: "fit-content",
                    color: "#414651",
                    background: "#fff",
                    border: "1px solid #D5D7DA",
                    padding: "8px 16px",
                    borderRadius: "60px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                  onClick={handleSaveAndContinue}
                >
                  Skip this step <i className="la la-arrow-right" />
                </button>
              </div>
            )}

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
                color: "#414651",
                fontWeight: 500,
                marginBottom: 16,
              }}
            >
              Suggested Pre-screening Questions:
            </span>
            {suggestedQuestions.map((question, index) => (
              <div
                key={index}
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
                      color: question.added ? "#D5D7DA" : "#414651",
                      fontWeight: 500,
                    }}
                  >
                    {question.questionType}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      color: question.added ? "#D5D7DA" : "#717680",
                      fontWeight: 500,
                    }}
                  >
                    {question.question}
                  </span>
                </div>
                <Button
                  disabled={question.added}
                  variant={question.added ? "secondary" : "primary"}
                  onClick={() => {
                    setSuggestedQuestions(
                      suggestedQuestions.map((q) => ({
                        ...q,
                        added: q.id === question.id ? true : q.added,
                      }))
                    );
                    setPreScreeningQuestions([
                      ...preScreeningQuestions,
                      {
                        id: question.id,
                        questionType: question.questionType,
                        question: question.question,
                        questionFormat: question.questionFormat,
                        answers: question.answers,
                      },
                    ]);
                  }}
                  label={question.added ? "Added" : "Add"}
                >
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="layered-card-outer"
        style={{ width: "40%", height: "100%" }}
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
            <div
              style={{
                width: 32,
                height: 32,
                backgroundColor: "#181D27",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i
                className="la la-lightbulb-o"
                style={{ color: "#FFFFFF", fontSize: 20 }}
              ></i>
            </div>
            <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>
              Tips
            </span>
          </div>
          <div className="layered-card-content">
            <span style={{ fontSize: 14, color: "#717680", fontWeight: 400 }}>
              Pre-screening questions are completely optional — you can skip
              them and still post your job.
              <br />
              <br />
              However, adding them helps you gather more context about
              applicants, such as their notice period, preferred work setup, or
              expected salary. This information won’t affect Jia’s assessment,
              but it can guide your review and make conversations with
              candidates easier.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreScreeningQuestionCard({
  question,
  setQuestion,
  onDelete,
  currency,
  onCurrencyChange,
}: {
  question: any;
  setQuestion: (updatedQuestion: any) => void;
  onDelete: (id: string) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(true);
  const questionFormats = [
    {
      name: "Short Answer",
    },
    {
      name: "Long Answer",
    },
    {
      name: "Dropdown",
    },
    {
      name: "Checkboxes",
    },
    {
      name: "Range",
    },
  ];

  return (
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
          <input
            type="text"
            placeholder="Write your question..."
            className="form-control"
            value={question.question}
            onChange={(e) => {
              setQuestion({ ...question, question: e.target.value });
            }}
          />
        ) : (
          <span>{question.question}</span>
        )}
        {isEditing ? (
          <CustomDropdown
            onSelectSetting={(setting) => {
              let defaultAnswers = [];
              if (["Dropdown", "Checkboxes"].includes(setting)) {
                defaultAnswers = [{ id: "1", value: "", type: setting }];
              }
              if (setting === "Range") {
                defaultAnswers = [
                  { id: "1", value: 0, type: "Minimum" },
                  { id: "2", value: 0, type: "Maximum" },
                ];
              }
              if (setting === "Short Answer" || setting === "Long Answer") {
                defaultAnswers = [{ id: "1", value: "", type: setting }];
              }
              setQuestion({
                ...question,
                questionFormat: setting,
                answers: defaultAnswers,
              });
            }}
            screeningSetting={question.questionFormat}
            settingList={questionFormats}
            placeholder="Select Question Format"
          />
        ) : (
          <Button
            variant="primary"
            style={{ backgroundColor: "#FFFFFF", color: "#181D27" }}
            onClick={() => setIsEditing(!isEditing)}
            label="Edit"
            icon="/iconsV2/edit.svg"
          >
          </Button>
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
                    question.answers.find((a: any) => a.type === "Short Answer")
                      ?.value
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
                    question.answers.find((a: any) => a.type === "Long Answer")
                      ?.value
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
                        e.dataTransfer.setData("option", JSON.stringify(option));
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
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        cursor: "grab",
                      }}
                    >
                      <i
                        className="la la-grip-vertical"
                        style={{ color: "#181D27", fontSize: 20 }}
                      />
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          gap: 8,
                          alignItems: "center",
                          border: "1px solid #E9EAEB",
                          padding: "0px 0px 0px 16px",
                          borderRadius: "6px",
                          width: "90%",
                          height: "40px",
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
                            width: "100%",
                            height: "100%",
                            border: "none",
                          }}
                          placeholder={`Option ${index + 1}`}
                          value={option.value}
                          onChange={(e) => {
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
                      </div>
                      <i
                        className="la la-times"
                        style={{ color: "#181D27", fontSize: 20 }}
                        onClick={() => {
                          setQuestion({
                            ...question,
                            answers: question.answers.filter(
                              (_, i) => i !== index
                            ),
                          });
                        }}
                      ></i>
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
                      {currencyOptions.find((c) => c.name === currency)
                        ?.symbol || "₱"}
                    </span>
                    <input
                      type="number"
                      className="form-control"
                      style={{ paddingLeft: "28px", paddingRight: "80px" }}
                      placeholder="0"
                      min={0}
                      value={
                        question.answers.find((a: any) => a.type === "Minimum")
                          ?.value
                      }
                      onChange={(e) => {
                        setQuestion({
                          ...question,
                          answers: question.answers.map((a: any) => {
                            if (a.type === "Minimum") {
                              return { ...a, value: Number(e.target.value) };
                            }
                            return a;
                          }),
                        });
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                    >
                      <CurrencyDropdown
                        currency={currency}
                        onCurrencyChange={onCurrencyChange}
                        currencyOptions={currencyOptions}
                      />
                    </div>
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
                      {currencyOptions.find((c) => c.name === currency)
                        ?.symbol || "₱"}
                    </span>
                    <input
                      type="number"
                      className="form-control"
                      style={{ paddingLeft: "28px", paddingRight: "80px" }}
                      placeholder="0"
                      min={0}
                      value={
                        question.answers.find((a: any) => a.type === "Maximum")
                          ?.value
                      }
                      onChange={(e) => {
                        setQuestion({
                          ...question,
                          answers: question.answers.map((a: any) => {
                            if (a.type === "Maximum") {
                              return { ...a, value: Number(e.target.value) };
                            }
                            return a;
                          }),
                        });
                      }}
                    ></input>
                    <div
                      style={{
                        position: "absolute",
                        right: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                    >
                      <CurrencyDropdown
                        currency={currency}
                        onCurrencyChange={onCurrencyChange}
                        currencyOptions={currencyOptions}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div
              style={{
                width: "100%",
                height: "1px",
                backgroundColor: "#E9EAEB",
                margin: "16px 0",
              }}
            />
            <button
              style={{
                alignSelf: "flex-end",
                backgroundColor: "transparent",
                cursor: "pointer",
                borderRadius: 16,
                border: "1px solid #FDA29B",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#B32318",
                padding: "4px 8px",
                gap: 8,
              }}
              onClick={() => {
                onDelete(question.id);
              }}
            >
              <i
                className="la la-trash"
                style={{ color: "#B32318", fontSize: 20 }}
              ></i>{" "}
              Delete Question
            </button>
          </div>
        ) : (
          <span>Edit to customize</span>
        )}
      </div>
      <div></div>
    </div>
  );
}

function JobDescriptionForm({
  careerForm,
  setCareerForm,
  validationErrors,
  setValidationErrors,
}: {
  careerForm: any;
  setCareerForm: (careerForm: any) => void;
  validationErrors: { [key: string]: boolean };
  setValidationErrors: (errors: { [key: string]: boolean }) => void;
}) {
  return (
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
            <div
              style={{
                width: 32,
                height: 32,
                backgroundColor: "#181D27",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <i
                className="la la-file-text-o"
                style={{ color: "#FFFFFF", fontSize: 20 }}
              ></i>
            </div>
            <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}>
              Job Description
            </span>
          </div>
        </div>
        <div className="layered-card-content">
          <StructuredDescriptionFields
            value={careerForm.structuredDescription}
            onChange={(next) => {
              setCareerForm((prev: any) => ({
                ...prev,
                structuredDescription: next,
                description: deriveLegacyDescription(next),
              }));
              if (validationErrors?.description) {
                setValidationErrors({ ...validationErrors, description: false });
              }
            }}
            error={validationErrors?.description || false}
          />
        </div>
      </div>
    </div>
  );
}

function ReviewCareerForm({
  careerForm,
  jobPipeline,
  setCurrentStep,
}: {
  careerForm: any;
  jobPipeline: any[];
  setCurrentStep: (stepIndex: number) => void;
}) {
  return (
    <div className="thread-set">
      <div className="left-thread">
        <div className="layered-card-outer">
          <div className="layered-card-middle">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  width: "100%",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 8,
                    background: "#181D27",
                    borderRadius: "60px",
                  }}
                >
                  <i
                    className="la la-suitcase"
                    style={{ fontSize: 20, color: "#FFFFFF" }}
                  />
                </div>
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Career Information
                </span>
              </div>
              <EditCareerStepButton setCurrentStep={() => setCurrentStep(0)} />
            </div>
            <div className="layered-card-content">
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  width: "70%",
                }}
              >
                <span>Employment Type</span>
                <span>{careerForm.employmentType}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  width: "70%",
                }}
              >
                <span>Work Arrangement</span>
                <span>{careerForm.workSetup}</span>
              </div>
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
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  width: "70%",
                }}
              >
                <span>Country</span>
                <span>{careerForm.country}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  width: "70%",
                }}
              >
                <span>State / Province</span>
                <span>{careerForm.province}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  width: "70%",
                }}
              >
                <span>City</span>
                <span>{careerForm.city}</span>
              </div>
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
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  width: "70%",
                }}
              >
                <span>Minimum Salary</span>
                <span>
                  {currencyOptions.find((c) => c.name === careerForm.currency)
                    ?.symbol || "₱"}{" "}
                  {careerForm.minimumSalary} {careerForm.currency}{" "}
                  {careerForm.salaryNegotiable
                    ? "Negotiable"
                    : "Not Negotiable"}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  width: "70%",
                }}
              >
                <span>Maximum Salary</span>
                <span>
                  {currencyOptions.find((c) => c.name === careerForm.currency)
                    ?.symbol || "₱"}{" "}
                  {careerForm.maximumSalary} {careerForm.currency}{" "}
                  {careerForm.salaryNegotiable
                    ? "Negotiable"
                    : "Not Negotiable"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="layered-card-outer">
          <div className="layered-card-middle">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  width: "100%",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 8,
                    background: "#181D27",
                    borderRadius: "60px",
                  }}
                >
                  <i
                    className="la la-suitcase"
                    style={{ fontSize: 20, color: "#FFFFFF" }}
                  />
                </div>
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
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
                  {careerForm.preScreeningQuestions?.length || 0}
                </div>
              </div>
              <EditCareerStepButton setCurrentStep={() => setCurrentStep(2)} />
            </div>
            <div className="layered-card-content">
              {careerForm.preScreeningQuestions.length > 0 ? (
                careerForm.preScreeningQuestions.map((question, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      marginBottom: 16,
                      borderBottom: "1px solid #E9EAEB",
                      paddingBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 16,
                          color: "#414651",
                          fontWeight: 500,
                          marginBottom: 8,
                        }}
                      >
                        {question.questionType}
                      </span>
                    </div>
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
                ))
              ) : (
                <span>No questions added yet</span>
              )}
            </div>
          </div>
        </div>
        <div className="layered-card-outer">
          <div className="layered-card-middle">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  width: "100%",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 8,
                    background: "#181D27",
                    borderRadius: "60px",
                  }}
                >
                  <i
                    className="la la-suitcase"
                    style={{ fontSize: 20, color: "#FFFFFF" }}
                  />
                </div>
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Job Description
                </span>
              </div>
              <EditCareerStepButton setCurrentStep={() => setCurrentStep(2)} />
            </div>
            <div className="layered-card-content">
              <p
                style={{ whiteSpace: "pre-wrap" }}
                dangerouslySetInnerHTML={{ __html: careerForm.description }}
              />
            </div>
          </div>
        </div>
        <div className="layered-card-outer">
          <div className="layered-card-middle">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  width: "100%",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 8,
                    background: "#181D27",
                    borderRadius: "60px",
                  }}
                >
                  <i
                    className="la la-comment-alt"
                    style={{ fontSize: 20, color: "#FFFFFF" }}
                  />
                </div>
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Interview Questions
                </span>
                <div
                  style={{
                    borderRadius: "50%",
                    width: 30,
                    height: 22,
                    border: "1px solid #D5D9EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    backgroundColor: "#F8F9FC",
                    color: "#181D27",
                    fontWeight: 700,
                  }}
                >
                  {careerForm.questions.reduce(
                    (acc, group) => acc + group.questions.length,
                    0
                  )}
                </div>
              </div>
              <EditCareerStepButton setCurrentStep={() => setCurrentStep(3)} />
            </div>

            <div className="layered-card-content">
              {careerForm.questions?.length > 0 &&
                careerForm.questions?.map(
                  (questionGroup: any, index: number) => (
                    <div key={index}>
                      <h4>{questionGroup.category}</h4>
                      {questionGroup?.questions?.length > 0 &&
                        questionGroup?.questions?.map(
                          (question: any, index: number) => (
                            <ul key={index}>
                              <li>{question.question}</li>
                            </ul>
                          )
                        )}
                    </div>
                  )
                )}
            </div>
          </div>
        </div>
      </div>
      <div className="right-thread">
        <div className="layered-card-outer">
          <div className="layered-card-middle">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  width: "100%",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 8,
                    background: "#181D27",
                    borderRadius: "60px",
                  }}
                >
                  <i
                    className="la la-cog"
                    style={{ fontSize: 20, color: "#FFFFFF" }}
                  />
                </div>
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Settings
                </span>
              </div>
              <EditCareerStepButton setCurrentStep={() => setCurrentStep(3)} />
            </div>
            <div className="layered-card-content">
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <span>Screening Setting</span>
                <span>{careerForm.screeningSetting}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <span>Require Video</span>
                <span>{careerForm.requireVideo ? "Yes" : "No"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="layered-card-outer">
          <div className="layered-card-middle">
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  width: "100%",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 8,
                    background: "#181D27",
                    borderRadius: "60px",
                  }}
                >
                  <i
                    className="la la-cog"
                    style={{ fontSize: 20, color: "#FFFFFF" }}
                  />
                </div>
                <span
                  style={{ fontSize: 16, color: "#181D27", fontWeight: 700 }}
                >
                  Pipeline Stages
                </span>
              </div>
              <EditCareerStepButton setCurrentStep={() => setCurrentStep(1)} />
            </div>
            <div className="layered-card-content">
              {jobPipeline?.length > 0 &&
                jobPipeline?.map((stage: any, index: number) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      justifyContent: "center",
                      width: "100%",
                      border: "1px solid #E9EAEB",
                      backgroundColor: "#F8F9FC",
                      borderRadius: "6px",
                      padding: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        gap: 8,
                        marginBottom: 16,
                      }}
                    >
                      <i
                        className={stage.icon}
                        style={{ fontSize: 20, color: "#181D27" }}
                      />
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#1E1F3B",
                        }}
                      >
                        {stage.alias || stage.name}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#717680",
                        marginBottom: 8,
                      }}
                    >
                      Substages
                    </span>
                    {stage.substages?.length > 0 &&
                      stage.substages?.map(
                        (
                          substage: {
                            id: string;
                            name: string;
                            currentStep: string;
                            status: string;
                          },
                          index: number
                        ) => (
                          <div
                            key={index}
                            style={{
                              display: "flex",
                              height: 52,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              border: "1px solid #E9EAEB",
                              padding: 8,
                              borderRadius: 16,
                              backgroundColor: "#FFFFFF",
                              width: "100%",
                              marginBottom: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: "#414651",
                              }}
                            >
                              {substage.name}
                            </span>
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                              }}
                            ></div>
                          </div>
                        )
                      )}

                    {["AI Interview", "CV Screening"].includes(stage.name) && (
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
                          <span>Auto-endorse</span>
                          <span>{stage.autoEndorse}</span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                          }}
                        >
                          <span>Auto-drop</span>
                          <span>{stage.autoDrop}</span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditCareerStepButton({
  setCurrentStep,
}: {
  setCurrentStep: () => void;
}) {
  return (
    <button
      style={{
        width: 32,
        height: 32,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        background: "#FFFFFF",
        border: "1px solid #E9EAEB",
        borderRadius: "60px",
        cursor: "pointer",
      }}
      onClick={() => {
        setCurrentStep();
      }}
    >
      <i className="la la-pencil" style={{ fontSize: 20 }} />
    </button>
  );
}
