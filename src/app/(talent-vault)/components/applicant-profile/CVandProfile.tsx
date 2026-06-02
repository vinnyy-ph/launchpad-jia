"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { InfoCard } from "./InfoCard";
import { Badge } from "../base/Badge";
import Button from "@/lib/components/ui/button/Button";
import styles from "@/app/(talent-vault)/styles/modules/applicant-dashboard.module.scss";
import profileSetupStyles from "@/app/(talent-vault)/styles/modules/profile-setup.module.scss";
import { GoalCard } from "../applicant-dashboard/GoalCard";
import { VisibilityConfirmModal } from "../applicant-dashboard/VisibilityConfirmModal";
import { api } from "@/lib/utils/apiClient";
import { assetConstants, pathConstants } from "@/lib/utils/constantsV2";
import { resolveTalentVaultExpiresAt } from "@/app/(talent-vault)/lib/talentVaultStatus";
import { checkFile } from "@/lib/utils/helpersV2";
import { CORE_API_URL } from "@/lib/Utils";
import { useAppContext } from "@/lib/context/ContextV2";
import axios from "axios";
import { Folder, ImageUser, Mail02 } from "@untitledui/icons";
import {
  normalizeStructuredCVInput,
  buildStructuredCVFromDigitalCV,
  buildDigitalCVFromStructuredCV,
  type StructuredCV,
} from "@/lib/utils/structuredCV";

import IntroductionSectionContent from "@/lib/components/screens/IntroductionSectionContent";
import ContactInfoSectionContent from "@/lib/components/screens/ContactInfoSectionContent";
import ExperienceSectionContent from "@/lib/components/screens/ExperienceSectionContent";
import EducationSectionContent from "@/lib/components/screens/EducationSectionContent";
import SkillsSectionContent from "@/lib/components/screens/SkillsSectionContent";
import ProjectsSectionContent from "@/lib/components/screens/ProjectsSectionContent";
import CertificationsSectionContent from "@/lib/components/screens/CertificationsSectionContent";
import AwardsSectionContent from "@/lib/components/screens/AwardsSectionContent";

import IntroductionModal from "@/lib/components/screens/IntroductionModal";
import ContactInfoModal from "@/lib/components/screens/ContactInfoModal";
import ExperienceModal, { type ExperienceItem } from "@/lib/components/screens/ExperienceModal";
import SkillModal from "@/lib/components/screens/SkillModal";
import EducationModal, { type EducationItem } from "@/lib/components/screens/EducationModal";
import ProjectsModal, { type ProjectItem } from "@/lib/components/screens/ProjectsModal";
import CertificationModal, { type CertificationItem } from "@/lib/components/screens/CertificationModal";
import AwardModal, { type AwardItem } from "@/lib/components/screens/AwardModal";
import gpWomanMg from "@/app/(talent-vault)/assets/gp-woman-mg.png";
import gpStability from "@/app/(talent-vault)/assets/career-goals/gp-stability.jpg";
import gpRealWorldExp from "@/app/(talent-vault)/assets/career-goals/gp-realworld-exp.jpg";
import gpMentorship from "@/app/(talent-vault)/assets/career-goals/gp-mentorship.jpg";
import gpConfCred from "@/app/(talent-vault)/assets/career-goals/gp-conf-cred.jpg";
import gpCompanyCulture from "@/app/(talent-vault)/assets/career-goals/gp-company-culture.jpg";
import gpFairPay from "@/app/(talent-vault)/assets/career-goals/gp-fair-pay.jpg";
import gpBuildResume from "@/app/(talent-vault)/assets/career-goals/gp-build-resume.jpg";
import gpWorkLifeBal from "@/app/(talent-vault)/assets/career-goals/gp-worklife-bal.jpg";

const cvSections = [
  "Introduction",
  "Contact Info",
  "Experience",
  "Skills",
  "Education",
  "Projects",
  "Certifications",
  "Awards",
];

type StartDatePreference = "Immediate" | "Flexible";

type CareerGoalOption = {
  id: string;
  title: string;
  description: string;
  illustration: string;
};

const careerGoalOptions: CareerGoalOption[] = [
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

const careerGoalOptionsById = new Map(careerGoalOptions.map((goal) => [goal.id, goal]));
const careerGoalOptionIdByTitle = new Map(
  careerGoalOptions.map((goal) => [goal.title.toLowerCase(), goal.id])
);

type DigitalCvSection = {
  name?: string;
  content?: string;
};

type CareerGoalSnapshot = {
  title?: string;
  description?: string;
};

type SubprogramOption = {
  _id: string;
  title: string;
  roleType: string;
};

type TalentVaultProfile = {
  state?: string;
  status?: string;
  completedAt?: string | number | Date | null;
  expiresAt?: string | number | Date | null;
  expirationDate?: string | number | Date | null;
  profile?: {
    digitalCV?: DigitalCvSection[];
    structuredCV?: StructuredCV | null;
    goals?: {
      workGoals?: string[];
      startDatePreference?: string | null;
      fieldOfInterests?: string[];
      careerGoalIds?: string[];
      careerGoalsSnapshot?: CareerGoalSnapshot[];
      selectedSubprogramId?: string | null;
      selectedSubprogramSnapshot?: { title: string; roleType: string } | null;
    };
    fileInfo?: {
      name?: string;
      size?: number;
      type?: string;
    } | null;
  };
};

type CVandProfileProps = {
  profile?: TalentVaultProfile | null;
  isLoading?: boolean;
  onProfileUpdated?(profile: TalentVaultProfile | null): void;
};

type GoalDraft = {
  careerGoalIds: string[];
  careerGoalsSnapshot: Array<{ title: string; description: string }>;
};

type EditableSection =
  | "careerGoal"
  | "introduction"
  | "contactInfo"
  | "skills"
  | "workExperience"
  | "school"
  | "projects"
  | "certifications"
  | "awards";

function buildCVStateFromProfile(profileData: TalentVaultProfile["profile"]) {
  const digitalCV = Array.isArray(profileData?.digitalCV) ? profileData.digitalCV : [];

  const structuredCV = profileData?.structuredCV
    ? normalizeStructuredCVInput(profileData.structuredCV)
    : buildStructuredCVFromDigitalCV(digitalCV);

  const userCV: Record<string, string> = {
    Introduction: structuredCV.introduction || "",
    "Contact Info": JSON.stringify(structuredCV.contactInfo || {}),
    Experience: JSON.stringify(structuredCV.experience || []),
    Skills: JSON.stringify(structuredCV.skills || []),
    Education: JSON.stringify(structuredCV.education || []),
    Projects: JSON.stringify(structuredCV.projects || []),
    Certifications: JSON.stringify(structuredCV.certifications || []),
    Awards: JSON.stringify(structuredCV.awards || []),
  };

  return { userCV, skills: structuredCV.skills || [], structuredCV };
}

function parseSectionArray<T>(value?: string): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getEditingItemById<T extends { id: string }>(
  sectionValue: string | undefined,
  id: string | null
): T | null {
  if (!id) return null;
  const items = parseSectionArray<T>(sectionValue);
  return items.find((item) => item.id === id) || null;
}

function toDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDaysRemaining(expiresAtValue: unknown) {
  const expiresAt = toDate(expiresAtValue);
  if (!expiresAt) return null;

  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = expiresAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / msPerDay));
}

function normalizeStartDatePreference(value: unknown): StartDatePreference | null {
  return value === "Immediate" || value === "Flexible" ? value : null;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
    )
  );
}


function normalizeGoalsForComparison(
  goalDraft: GoalDraft,
  fieldOfInterests: unknown
) {
  return {
    fieldOfInterests: normalizeStringList(fieldOfInterests),
    careerGoalIds: Array.isArray(goalDraft.careerGoalIds)
      ? goalDraft.careerGoalIds.map((goalId) => String(goalId || "").trim()).filter(Boolean)
      : [],
    careerGoalsSnapshot: Array.isArray(goalDraft.careerGoalsSnapshot)
      ? goalDraft.careerGoalsSnapshot
          .map((goal) => ({
            title: String(goal.title || "").trim(),
            description: String(goal.description || "").trim(),
          }))
          .filter((goal) => goal.title.length > 0)
      : [],
  };
}

function createGoalDraft(goalsInput: TalentVaultProfile["profile"] extends { goals?: infer G }
  ? G
  : unknown): GoalDraft {
  const careerGoalIdsFromProfile = Array.isArray((goalsInput as any)?.careerGoalIds)
    ? (goalsInput as any).careerGoalIds
        .map((goalId: any) => String(goalId || "").trim())
        .filter((goalId: string) => careerGoalOptionsById.has(goalId))
    : [];

  const snapshotsFromProfile = Array.isArray((goalsInput as any)?.careerGoalsSnapshot)
    ? (goalsInput as any).careerGoalsSnapshot
        .filter((goal: any) => goal && typeof goal === "object")
        .map((goal: any) => ({
          title: String(goal.title || "").trim(),
          description: String(goal.description || "").trim(),
        }))
        .filter((goal: any) => goal.title.length > 0)
    : [];

  const inferredIdsFromSnapshots = snapshotsFromProfile
    .map((goal: any) => careerGoalOptionIdByTitle.get(goal.title.toLowerCase()) || "")
    .filter(Boolean);

  const careerGoalIds =
    careerGoalIdsFromProfile.length > 0 ? careerGoalIdsFromProfile : inferredIdsFromSnapshots;

  const careerGoalsSnapshot =
    careerGoalIds.length > 0
      ? careerGoalIds
          .map((goalId) => careerGoalOptionsById.get(goalId))
          .filter((goal): goal is CareerGoalOption => Boolean(goal))
          .map((goal) => ({
            title: goal.title,
            description: goal.description,
          }))
      : snapshotsFromProfile;

  return {
    careerGoalIds,
    careerGoalsSnapshot,
  };
}

function syncGoalSnapshot(goalDraft: GoalDraft): GoalDraft {
  const careerGoalsSnapshot = goalDraft.careerGoalIds
    .map((goalId) => careerGoalOptionsById.get(goalId))
    .filter((goal): goal is CareerGoalOption => Boolean(goal))
    .map((goal) => ({
      title: goal.title,
      description: goal.description,
    }));

  return {
    ...goalDraft,
    careerGoalsSnapshot,
  };
}

function renderLoadingFallback() {
  return (
    <span className={styles.recordingLoadingState}>
      <img
        src="/gifs/analysis-loading.gif"
        alt="Loading"
        className={styles.recordingLoadingGif}
      />
    </span>
  );
}

function renderSectionSkeleton() {
  return (
    <span className={`${styles.sectionDetails} ${styles.sectionDetailsLoading}`}>
      <span className={styles.sectionSkeletonLine}></span>
      <span className={`${styles.sectionSkeletonLine} ${styles.sectionSkeletonLineShort}`}></span>
    </span>
  );
}

function safeJsonParse(value?: string, fallback: any = null) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function CVandProfile({
  profile,
  isLoading = false,
  onProfileUpdated,
}: CVandProfileProps) {
  const { user } = useAppContext();
  const reuploadInputRef = useRef<HTMLInputElement | null>(null);
  const profileData = profile?.profile || {};

  const [subprograms, setSubprograms] = useState<SubprogramOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.get("/api/talent-vault/subprograms/candidate")
      .then((res) => { if (!cancelled) setSubprograms(res.data.subprograms || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const [fallbackFileName, setFallbackFileName] = useState<string | null>(null);
  const [isResolvingFileName, setIsResolvingFileName] = useState(false);
  const [editingSection, setEditingSection] = useState<EditableSection | null>(null);
  const [savingSection, setSavingSection] = useState<EditableSection | null>(null);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [isUploadingNewCv, setIsUploadingNewCv] = useState(false);
  const [isUploadNewCvHover, setIsUploadNewCvHover] = useState(false);
  const [stagedCvFile, setStagedCvFile] = useState<File | null>(null);
  const isCvExtractionInProgress = isUploadingNewCv;
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [draftCV, setDraftCV] = useState<Record<string, string>>({});
  const [draftSkills, setDraftSkills] = useState<string[]>([]);
  const [goalDraft, setGoalDraft] = useState<GoalDraft>(createGoalDraft(profileData.goals));

  const [showIntroductionModal, setShowIntroductionModal] = useState(false);
  const [introductionValue, setIntroductionValue] = useState("");
  const [showContactInfoModal, setShowContactInfoModal] = useState(false);
  const [contactInfoData, setContactInfoData] = useState<any>(null);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [showExperienceModal, setShowExperienceModal] = useState(false);
  const [editingExperienceId, setEditingExperienceId] = useState<string | null>(null);
  const [showEducationModal, setShowEducationModal] = useState(false);
  const [editingEducationId, setEditingEducationId] = useState<string | null>(null);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [showCertificationModal, setShowCertificationModal] = useState(false);
  const [editingCertificationId, setEditingCertificationId] = useState<string | null>(null);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [editingAwardId, setEditingAwardId] = useState<string | null>(null);

  const persistedSubprogramId = (profileData.goals as any)?.selectedSubprogramId || null;
  const persistedSubprogramSnapshot = (profileData.goals as any)?.selectedSubprogramSnapshot || null;
  const persistedWorkStartDate: StartDatePreference | null =
    (profileData.goals as any)?.startDatePreference === "Immediate" ||
    (profileData.goals as any)?.startDatePreference === "Flexible"
      ? (profileData.goals as any).startDatePreference
      : null;

  const [draftSubprogramId, setDraftSubprogramId] = useState<string | null>(persistedSubprogramId);
  const [draftWorkStartDate, setDraftWorkStartDate] = useState<StartDatePreference | null>(persistedWorkStartDate);
  const [isSavingWorkDetails, setIsSavingWorkDetails] = useState(false);

  useEffect(() => {
    const { userCV, skills } = buildCVStateFromProfile(profileData);
    setDraftCV(userCV);
    setDraftSkills(skills);
    setGoalDraft(createGoalDraft(profileData.goals));
    setDraftSubprogramId((profileData.goals as any)?.selectedSubprogramId || null);
    setDraftWorkStartDate(
      (profileData.goals as any)?.startDatePreference === "Immediate" ||
      (profileData.goals as any)?.startDatePreference === "Flexible"
        ? (profileData.goals as any).startDatePreference
        : null
    );
    setEditingSection(null);
  }, [profile]);

  const normalizedStatus = String(profile?.status || "").toLowerCase();
  const normalizedState = String(profile?.state || "").toLowerCase();

  const effectiveExpiresAt = resolveTalentVaultExpiresAt(
    profile?.expiresAt || profile?.expirationDate,
    profile?.completedAt
  );
  const isExpiredByDate = Boolean(
    effectiveExpiresAt && effectiveExpiresAt.getTime() < Date.now()
  );
  const isExpired = normalizedState === "expired" || isExpiredByDate;
  const isActive = !isExpired && normalizedStatus === "active";
  const isProfileLocked = isExpired || !isActive;
  const daysRemaining = getDaysRemaining(effectiveExpiresAt);

  useEffect(() => {
    if (isProfileLocked && editingSection !== null) {
      setEditingSection(null);
    }
  }, [editingSection, isProfileLocked]);

  useEffect(() => {
    if (isCvExtractionInProgress && editingSection !== null) {
      setEditingSection(null);
    }
  }, [editingSection, isCvExtractionInProgress]);

  const fileInfo = profileData.fileInfo || null;
  const fileName = typeof fileInfo?.name === "string" ? fileInfo.name.trim() : "";

  useEffect(() => {
    let cancelled = false;

    async function resolveFileName() {
      if (fileName) {
        if (!cancelled) {
          setFallbackFileName(null);
          setIsResolvingFileName(false);
        }
        return;
      }

      try {
        if (!cancelled) {
          setIsResolvingFileName(true);
        }
        const response = await api.post("/api/whitecloak/fetch-cv");
        const fetchedFileName = response?.data?.fileInfo?.name;

        if (!cancelled) {
          setFallbackFileName(
            typeof fetchedFileName === "string" && fetchedFileName.trim().length > 0
              ? fetchedFileName.trim()
              : null
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading CV filename:", error);
          setFallbackFileName(null);
        }
      } finally {
        if (!cancelled) {
          setIsResolvingFileName(false);
        }
      }
    }

    void resolveFileName();

    return () => {
      cancelled = true;
    };
  }, [fileName]);

  const resolvedFileName = fileName || fallbackFileName;
  const documentFileName = resolvedFileName || (isResolvingFileName ? "Loading..." : "No file uploaded");
  const displayedDocumentFileName = stagedCvFile?.name?.trim() || documentFileName;
  const normalizedDaysRemaining = daysRemaining ?? 0;

  const tvStatusMessage = isExpired
    ? "Your Talent Vault Profile has expired and is no longer visible to employers. Reactivate your profile to become visible again."
    : !isActive
      ? "Your Talent Vault Profile is currently inactive and not visible to employers. Turn your status to Active to become visible."
      : `Your Talent Vault Profile will be active for ${normalizedDaysRemaining} more day${normalizedDaysRemaining === 1 ? "" : "s"}. Employers who are looking for a profile like yours will be able to invite you to their career openings.`;

  const selectedCareerGoals = useMemo(() => {
    if (goalDraft.careerGoalIds.length > 0) {
      return goalDraft.careerGoalIds
        .map((goalId) => careerGoalOptionsById.get(goalId))
        .filter((goal): goal is CareerGoalOption => Boolean(goal));
    }

    if (goalDraft.careerGoalsSnapshot.length > 0) {
      return goalDraft.careerGoalsSnapshot.map((goal, index) => ({
        id: `snapshot-${index}`,
        title: goal.title,
        description: goal.description,
        illustration: gpWorkLifeBal.src,
      }));
    }

    return [] as CareerGoalOption[];
  }, [goalDraft]);

  const persistedFieldOfInterests = useMemo(
    () => normalizeStringList((profileData.goals as any)?.fieldOfInterests),
    [profileData.goals]
  );

  const persistedGoalSnapshot = useMemo(
    () =>
      normalizeGoalsForComparison(
        syncGoalSnapshot(createGoalDraft(profileData.goals)),
        (profileData.goals as any)?.fieldOfInterests
      ),
    [profileData.goals]
  );

  const hasWorkDetailsChanges =
    draftSubprogramId !== persistedSubprogramId ||
    draftWorkStartDate !== persistedWorkStartDate;

  const selectedSubprogram = subprograms.find((sp) => sp._id === draftSubprogramId) || null;
  const workDetailsBadgeContent = useMemo(() => {
    const subprogramTitle =
      selectedSubprogram?.title ||
      persistedSubprogramSnapshot?.title ||
      null;
    if (!subprogramTitle) return "Loading...";
    const prefix =
      draftWorkStartDate === "Immediate"
        ? "Actively looking for"
        : draftWorkStartDate === "Flexible"
          ? "Casually looking for"
          : "Looking for";
    return `${prefix}: ${subprogramTitle}`;
  }, [draftWorkStartDate, selectedSubprogram, persistedSubprogramSnapshot]);

  const handleSaveWorkDetails = async () => {
    if (isSavingWorkDetails || !hasWorkDetailsChanges) return;

    const matchedSubprogram = subprograms.find((sp) => sp._id === draftSubprogramId);

    try {
      setIsSavingWorkDetails(true);
      const response = await api.patch("/api/talent-vault/profiles", {
        action: "save_profile_sections",
        payload: {
          goals: {
            startDatePreference: draftWorkStartDate,
            selectedSubprogramId: draftSubprogramId || "",
            selectedSubprogramSnapshot: matchedSubprogram
              ? { title: matchedSubprogram.title, roleType: matchedSubprogram.roleType }
              : null,
          },
        },
      });
      onProfileUpdated?.(response?.data?.data || null);
    } catch (error: any) {
      console.error("Error saving work details:", error);
      alert(error?.message || "Failed to save work details. Please try again.");
    } finally {
      setIsSavingWorkDetails(false);
    }
  };

  const handleSectionEditToggle = (section: EditableSection) => {
    if (isProfileLocked || isCvExtractionInProgress) return;
    if (section !== "careerGoal") return;

    setEditingSection((current) => {
      if (current === "careerGoal") {
        setGoalDraft((prev) => syncGoalSnapshot(prev));
        return null;
      }
      return "careerGoal";
    });
  };

  const handleSaveSection = async (section: EditableSection) => {
    if (isProfileLocked || isCvExtractionInProgress) return;
    if (savingSection) return;

    try {
      if (section === "careerGoal") {
        const nextGoalDraft = syncGoalSnapshot(goalDraft);
        const nextGoals = normalizeGoalsForComparison(
          nextGoalDraft,
          persistedFieldOfInterests
        );

        if (JSON.stringify(nextGoals) === JSON.stringify(persistedGoalSnapshot)) {
          setEditingSection(null);
          return;
        }

        setSavingSection(section);
        const response = await api.patch("/api/talent-vault/profiles", {
          action: "save_profile_sections",
          payload: {
            goals: nextGoals,
          },
        });

        onProfileUpdated?.(response?.data?.data || null);
        setEditingSection(null);
        return;
      }

      setEditingSection(null);
    } catch (error: any) {
      console.error(`Error saving ${section} section:`, error);
      alert(error?.message || "Failed to save profile changes. Please try again.");
    } finally {
      setSavingSection(null);
    }
  };

  const handleEditActionClick = (section: EditableSection) => {
    if (isProfileLocked || isCvExtractionInProgress) {
      return;
    }

    if (editingSection === section) {
      void handleSaveSection(section);
      return;
    }

    handleSectionEditToggle(section);
  };

  function handleEditCV(section: string) {
    if (isProfileLocked || isCvExtractionInProgress) return;

    if (section === "Introduction") {
      setIntroductionValue(draftCV?.Introduction || "");
      setShowIntroductionModal(true);
      return;
    }
    if (section === "Contact Info") {
      setContactInfoData(safeJsonParse(draftCV?.["Contact Info"]));
      setShowContactInfoModal(true);
      return;
    }
    if (section === "Skills") {
      setShowSkillModal(true);
      return;
    }
    if (section === "Experience") {
      setEditingExperienceId(null);
      setShowExperienceModal(true);
      return;
    }
    if (section === "Education") {
      setEditingEducationId(null);
      setShowEducationModal(true);
      return;
    }
    if (section === "Projects") {
      setEditingProjectId(null);
      setShowProjectsModal(true);
      return;
    }
    if (section === "Certifications") {
      setEditingCertificationId(null);
      setShowCertificationModal(true);
      return;
    }
    if (section === "Awards") {
      setEditingAwardId(null);
      setShowAwardModal(true);
      return;
    }
  }

  async function saveCVSectionsToApi(nextDraftCV: Record<string, string>) {
    const structuredCV = normalizeStructuredCVInput({
      introduction: nextDraftCV["Introduction"] || "",
      contactInfo: safeJsonParse(nextDraftCV["Contact Info"], {}),
      experience: safeJsonParse(nextDraftCV["Experience"], []),
      skills: safeJsonParse(nextDraftCV["Skills"], []),
      education: safeJsonParse(nextDraftCV["Education"], []),
      projects: safeJsonParse(nextDraftCV["Projects"], []),
      certifications: safeJsonParse(nextDraftCV["Certifications"], []),
      awards: safeJsonParse(nextDraftCV["Awards"], []),
    });

    const digitalCV = buildDigitalCVFromStructuredCV(structuredCV);

    try {
      setSavingSection("workExperience");
      const response = await api.patch("/api/talent-vault/profiles", {
        action: "save_profile_sections",
        payload: {
          digitalCV,
          structuredCV,
        },
      });
      onProfileUpdated?.(response?.data?.data || null);
    } catch (error: any) {
      console.error("Error saving CV sections:", error);
      alert(error?.message || "Failed to save profile changes. Please try again.");
    } finally {
      setSavingSection(null);
    }
  }

  function handleIntroductionSave(updatedIntroduction: string) {
    const nextDraftCV = { ...draftCV, Introduction: updatedIntroduction };
    setDraftCV((prev) => ({ ...prev, Introduction: updatedIntroduction }));
    setShowIntroductionModal(false);
    void saveCVSectionsToApi(nextDraftCV);
  }

  function handleContactInfoSave(contactInfo: any) {
    const serialized = JSON.stringify(contactInfo);
    const nextDraftCV = { ...draftCV, "Contact Info": serialized };
    setDraftCV((prev) => ({ ...prev, "Contact Info": serialized }));
    setShowContactInfoModal(false);
    void saveCVSectionsToApi(nextDraftCV);
  }

  function handleSkillModalSave(updatedSkills: string[]) {
    setDraftSkills(updatedSkills);
    const serialized = JSON.stringify(updatedSkills);
    const nextDraftCV = { ...draftCV, Skills: serialized };
    setDraftCV((prev) => ({ ...prev, Skills: serialized }));
    setShowSkillModal(false);
    void saveCVSectionsToApi(nextDraftCV);
  }

  function handleExperienceSave(newExperience: ExperienceItem) {
    const current = parseSectionArray<ExperienceItem>(draftCV?.Experience);
    const updated = editingExperienceId
      ? current.map((exp) => (exp.id === editingExperienceId ? newExperience : exp))
      : [...current, newExperience];
    const serialized = JSON.stringify(updated);
    const nextDraftCV = { ...draftCV, Experience: serialized };
    setDraftCV((prev) => ({ ...prev, Experience: serialized }));
    setEditingExperienceId(null);
    setShowExperienceModal(false);
    void saveCVSectionsToApi(nextDraftCV);
  }

  function handleEditExperienceItem(id: string) {
    setEditingExperienceId(id);
    setShowExperienceModal(true);
  }

  function handleDeleteExperienceItem(id: string) {
    const current = parseSectionArray<ExperienceItem>(draftCV?.Experience);
    const updated = current.filter((exp) => exp.id !== id);
    const serialized = JSON.stringify(updated);
    const nextDraftCV = { ...draftCV, Experience: serialized };
    setDraftCV((prev) => ({ ...prev, Experience: serialized }));
    setEditingExperienceId(null);
    setShowExperienceModal(false);
    void saveCVSectionsToApi(nextDraftCV);
  }

  function handleEducationSave(newEducation: EducationItem) {
    const current = parseSectionArray<EducationItem>(draftCV?.Education);
    const updated = editingEducationId
      ? current.map((edu) => (edu.id === editingEducationId ? newEducation : edu))
      : [...current, newEducation];
    const serialized = JSON.stringify(updated);
    const nextDraftCV = { ...draftCV, Education: serialized };
    setDraftCV((prev) => ({ ...prev, Education: serialized }));
    setEditingEducationId(null);
    setShowEducationModal(false);
    void saveCVSectionsToApi(nextDraftCV);
  }

  function handleEditEducationItem(id: string) {
    setEditingEducationId(id);
    setShowEducationModal(true);
  }

  function handleDeleteEducationItem(id: string) {
    const current = parseSectionArray<EducationItem>(draftCV?.Education);
    const updated = current.filter((edu) => edu.id !== id);
    const serialized = JSON.stringify(updated);
    const nextDraftCV = { ...draftCV, Education: serialized };
    setDraftCV((prev) => ({ ...prev, Education: serialized }));
    setEditingEducationId(null);
    setShowEducationModal(false);
    void saveCVSectionsToApi(nextDraftCV);
  }

  function handleProjectsSave(newProject: ProjectItem) {
    const current = parseSectionArray<ProjectItem>(draftCV?.Projects);
    const updated = editingProjectId
      ? current.map((proj) => (proj.id === editingProjectId ? newProject : proj))
      : [...current, newProject];
    const serialized = JSON.stringify(updated);
    const nextDraftCV = { ...draftCV, Projects: serialized };
    setDraftCV((prev) => ({ ...prev, Projects: serialized }));
    setEditingProjectId(null);
    setShowProjectsModal(false);
    void saveCVSectionsToApi(nextDraftCV);
  }

  function handleEditProjectItem(id: string) {
    setEditingProjectId(id);
    setShowProjectsModal(true);
  }

  function handleDeleteProjectItem(id: string) {
    const current = parseSectionArray<ProjectItem>(draftCV?.Projects);
    const updated = current.filter((proj) => proj.id !== id);
    const serialized = JSON.stringify(updated);
    const nextDraftCV = { ...draftCV, Projects: serialized };
    setDraftCV((prev) => ({ ...prev, Projects: serialized }));
    setEditingProjectId(null);
    setShowProjectsModal(false);
    void saveCVSectionsToApi(nextDraftCV);
  }

  function handleCertificationsSave(newCertification: CertificationItem) {
    const current = parseSectionArray<CertificationItem>(draftCV?.Certifications);
    const updated = editingCertificationId
      ? current.map((cert) => (cert.id === editingCertificationId ? newCertification : cert))
      : [...current, newCertification];
    const serialized = JSON.stringify(updated);
    const nextDraftCV = { ...draftCV, Certifications: serialized };
    setDraftCV((prev) => ({ ...prev, Certifications: serialized }));
    setEditingCertificationId(null);
    setShowCertificationModal(false);
    void saveCVSectionsToApi(nextDraftCV);
  }

  function handleEditCertificationItem(id: string) {
    setEditingCertificationId(id);
    setShowCertificationModal(true);
  }

  function handleDeleteCertificationItem(id: string) {
    const current = parseSectionArray<CertificationItem>(draftCV?.Certifications);
    const updated = current.filter((cert) => cert.id !== id);
    const serialized = JSON.stringify(updated);
    const nextDraftCV = { ...draftCV, Certifications: serialized };
    setDraftCV((prev) => ({ ...prev, Certifications: serialized }));
    setEditingCertificationId(null);
    setShowCertificationModal(false);
    void saveCVSectionsToApi(nextDraftCV);
  }

  function handleAwardsSave(newAward: AwardItem) {
    const current = parseSectionArray<AwardItem>(draftCV?.Awards);
    const updated = editingAwardId
      ? current.map((award) => (award.id === editingAwardId ? newAward : award))
      : [...current, newAward];
    const serialized = JSON.stringify(updated);
    const nextDraftCV = { ...draftCV, Awards: serialized };
    setDraftCV((prev) => ({ ...prev, Awards: serialized }));
    setEditingAwardId(null);
    setShowAwardModal(false);
    void saveCVSectionsToApi(nextDraftCV);
  }

  function handleEditAwardItem(id: string) {
    setEditingAwardId(id);
    setShowAwardModal(true);
  }

  function handleDeleteAwardItem(id: string) {
    const current = parseSectionArray<AwardItem>(draftCV?.Awards);
    const updated = current.filter((award) => award.id !== id);
    const serialized = JSON.stringify(updated);
    const nextDraftCV = { ...draftCV, Awards: serialized };
    setDraftCV((prev) => ({ ...prev, Awards: serialized }));
    setEditingAwardId(null);
    setShowAwardModal(false);
    void saveCVSectionsToApi(nextDraftCV);
  }

  const handleReactivate = async () => {
    if (isUpdatingVisibility) {
      return;
    }

    try {
      setIsUpdatingVisibility(true);
      await api.patch("/api/talent-vault/profiles", {
        action: "reactivate_profile",
        payload: {},
      });
      window.location.href = pathConstants.talentVaultSetup;
    } catch (error: any) {
      console.error("Error resetting Talent Vault setup:", error);
      alert(error?.message || "Failed to restart setup. Please try again.");
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const applyToggleVisibility = async (nextIsActive: boolean) => {
    if (isExpired || isUpdatingVisibility) {
      return;
    }

    try {
      setIsUpdatingVisibility(true);
      const response = await api.patch("/api/talent-vault/profiles", {
        action: "set_visibility_status",
        payload: {
          isActive: nextIsActive,
        },
      });
      onProfileUpdated?.(response?.data?.data || null);
    } catch (error: any) {
      console.error("Error updating Talent Vault visibility:", error);
      alert(error?.message || "Failed to update visibility. Please try again.");
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const handleToggleVisibility = (nextIsActive: boolean) => {
    if (isExpired || isUpdatingVisibility) {
      return;
    }

    if (!nextIsActive) {
      setShowDeactivateConfirm(true);
      return;
    }

    void applyToggleVisibility(true);
  };

  const handleConfirmDeactivate = () => {
    setShowDeactivateConfirm(false);
    void applyToggleVisibility(false);
  };

  const toggleCareerGoal = (goalId: string) => {
    setGoalDraft((previousValue) => {
      const isSelected = previousValue.careerGoalIds.includes(goalId);

      if (isSelected) {
        const nextGoalIds = previousValue.careerGoalIds.filter((value) => value !== goalId);
        return syncGoalSnapshot({
          ...previousValue,
          careerGoalIds: nextGoalIds,
        });
      }

      if (previousValue.careerGoalIds.length >= 3) {
        return previousValue;
      }

      return syncGoalSnapshot({
        ...previousValue,
        careerGoalIds: [...previousValue.careerGoalIds, goalId],
      });
    });
  };

  const renderEditAction = (section: EditableSection) => {
    const isEditing = editingSection === section;
    const isSaving = savingSection === section;
    const isAnySaving = savingSection !== null || isCvExtractionInProgress;

    return (
      <span
        className={styles.profileEditIcon}
        onClick={() => handleEditActionClick(section)}
        onContextMenu={(event) => event.preventDefault()}
        style={{
          opacity: isSaving || isCvExtractionInProgress ? 0.7 : 1,
          pointerEvents: isAnySaving ? "none" : "auto",
        }}
      >
        <img
          src={isEditing ? "/iconsV3/save.svg" : "/iconsV3/edit.svg"}
          alt={isEditing ? "Save" : "Edit"}
        />
      </span>
    );
  };

  const openReuploadPicker = () => {
    if (isUploadingNewCv || isLoading) {
      return;
    }

    reuploadInputRef.current?.click();
  };

  const handleReuploadFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    const validFile = checkFile(files);
    event.target.value = "";

    if (!validFile) {
      return;
    }

    setStagedCvFile(validFile as File);
  };

  const resetStagedCvFile = () => {
    if (isUploadingNewCv) {
      return;
    }

    setStagedCvFile(null);
  };

  const handleSaveStagedCv = async () => {
    if (!stagedCvFile || isUploadingNewCv) {
      return;
    }

    if (!user?.email) {
      alert("User email not available. Please log in again.");
      return;
    }

    try {
      setIsUploadingNewCv(true);

      const formData = new FormData();
      formData.append("file", stagedCvFile);
      formData.append("fName", stagedCvFile.name);
      formData.append("userEmail", user.email);

      const uploadResponse = await axios({
        method: "POST",
        url: `${CORE_API_URL}/upload-cv`,
        data: formData,
      });

      if (!uploadResponse.data?.cvChunks) {
        throw new Error("Invalid response from upload service");
      }

      const autofillResponse = await api.post("/api/whitecloak/autofill-cv", {
        chunks: uploadResponse.data.cvChunks,
      });

      const parsedUserCv = autofillResponse?.data;
      const digitalCvPayload = Array.isArray(parsedUserCv?.digitalCV) ? parsedUserCv.digitalCV : [];

      if (digitalCvPayload.length === 0) {
        throw new Error("Invalid digitalCV data from extraction service");
      }

      const structuredCVPayload = parsedUserCv?.structuredCV
        ? normalizeStructuredCVInput(parsedUserCv.structuredCV)
        : null;

      const response = await api.patch("/api/talent-vault/profiles", {
        action: "save_profile_sections",
        payload: {
          digitalCV: digitalCvPayload,
          structuredCV: structuredCVPayload,
          education: structuredCVPayload?.education || [],
          fileInfo: {
            name: stagedCvFile.name,
            size: stagedCvFile.size,
            type: stagedCvFile.type,
          },
          matchingSignals:
            parsedUserCv?.matchingSignals && typeof parsedUserCv.matchingSignals === "object"
              ? parsedUserCv.matchingSignals
              : null,
        },
      });

      setFallbackFileName(stagedCvFile.name);
      onProfileUpdated?.(response?.data?.data || null);
      setStagedCvFile(null);
    } catch (error: any) {
      console.error("Error uploading new CV:", error);
      alert(error?.message || "Failed to upload and extract new CV. Please try again.");
    } finally {
      setIsUploadingNewCv(false);
    }
  };

  return (
    <div className={styles.profileColumns}>
      <div className={styles.profileMainColumn}>
        <div className={isProfileLocked ? styles.disabledSectionCard : undefined}>
          <InfoCard
            title="Career Goal"
            icon={<img src="/icons/rocket.svg" alt="Rocket icon" />}
            actionButton={!isProfileLocked ? renderEditAction("careerGoal") : undefined}
          >
          {isLoading ? (
            renderLoadingFallback()
          ) : editingSection === "careerGoal" ? (
            <div className={profileSetupStyles.goalSetting}>
              <p>
                Select up to <strong>3</strong> that best resonated with you.
              </p>

              <div className={`${profileSetupStyles.goalCards} ${styles.careerGoalCardsResponsive}`}>
                {careerGoalOptions.map((goal) => {
                  const isSelected = goalDraft.careerGoalIds.includes(goal.id);
                  const isDisabled = !isSelected && goalDraft.careerGoalIds.length >= 3;

                  return (
                    <GoalCard
                      key={goal.id}
                      title={goal.title}
                      description={goal.description}
                      imgSrc={goal.illustration}
                      selected={isSelected}
                      disabled={isDisabled}
                      onClick={() => toggleCareerGoal(goal.id)}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className={styles.careerGoalWrapper}>
              <div className={styles.goals}>
                {selectedCareerGoals.length > 0 ? (
                  selectedCareerGoals.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      title={goal.title}
                      description={goal.description}
                      imgSrc={goal.illustration}
                    />
                  ))
                ) : (
                  <p>N/A</p>
                )}
              </div>
            </div>
          )}
          </InfoCard>
        </div>

        <div className={isProfileLocked ? styles.disabledSectionCard : undefined}>
          <InfoCard
            title="Introduction"
            icon={<ImageUser aria-hidden="true" width={18} height={18} color="#FFFFFF" />}
            actionButton={
              !isProfileLocked ? (
                <span className={styles.profileEditIcon} onClick={() => handleEditCV("Introduction")}>
                  <img src={assetConstants.edit} alt="Edit" />
                </span>
              ) : undefined
            }
          >
          {isLoading ? renderLoadingFallback() : isCvExtractionInProgress ? renderSectionSkeleton() : (
            <IntroductionSectionContent
              buildingCV={false}
              loading={false}
              value={draftCV?.Introduction}
            />
          )}
          </InfoCard>
        </div>

        <div className={isProfileLocked ? styles.disabledSectionCard : undefined}>
          <InfoCard
            title="Contact Info"
            icon={<Mail02 aria-hidden="true" width={18} height={18} color="#FFFFFF" />}
            actionButton={
              !isProfileLocked ? (
                <span className={styles.profileEditIcon} onClick={() => handleEditCV("Contact Info")}>
                  <img src={assetConstants.edit} alt="Edit" />
                </span>
              ) : undefined
            }
          >
          {isLoading ? renderLoadingFallback() : isCvExtractionInProgress ? renderSectionSkeleton() : (
            <ContactInfoSectionContent
              buildingCV={false}
              loading={false}
              value={draftCV?.["Contact Info"]}
              defaultContactInfo={{}}
            />
          )}
          </InfoCard>
        </div>

        <div className={isProfileLocked ? styles.disabledSectionCard : undefined}>
          <InfoCard
            title="Work Experience"
            icon={<img src="/icons/briefcase_white.svg" alt="Briefcase Icon" />}
            actionButton={
              !isProfileLocked ? (
                <span className={styles.profileEditIcon} onClick={() => handleEditCV("Experience")}>
                  <img src={assetConstants.plus} alt="Add" />
                </span>
              ) : undefined
            }
          >
          {isLoading ? renderLoadingFallback() : isCvExtractionInProgress ? renderSectionSkeleton() : (
            <ExperienceSectionContent
              buildingCV={false}
              loading={false}
              value={draftCV?.Experience}
              defaultExperienceData={[]}
              onEditExperienceItem={handleEditExperienceItem}
            />
          )}
          </InfoCard>
        </div>

        <div className={isProfileLocked ? styles.disabledSectionCard : undefined}>
          <InfoCard
            title="Skills"
            icon={<img src="/icons/bulb-white.svg" alt="Bulb Icon" />}
            actionButton={
              !isProfileLocked ? (
                <span className={styles.profileEditIcon} onClick={() => handleEditCV("Skills")}>
                  <img src={assetConstants.edit} alt="Edit" />
                </span>
              ) : undefined
            }
          >
          {isLoading ? renderLoadingFallback() : isCvExtractionInProgress ? renderSectionSkeleton() : (
            <SkillsSectionContent
              buildingCV={false}
              loading={false}
              skills={draftSkills}
            />
          )}
          </InfoCard>
        </div>

        <div className={isProfileLocked ? styles.disabledSectionCard : undefined}>
          <InfoCard
            title="Education"
            icon={<img src="/icons/school.svg" alt="School Icon" />}
            actionButton={
              !isProfileLocked ? (
                <span className={styles.profileEditIcon} onClick={() => handleEditCV("Education")}>
                  <img src={assetConstants.plus} alt="Add" />
                </span>
              ) : undefined
            }
          >
          {isLoading ? renderLoadingFallback() : isCvExtractionInProgress ? renderSectionSkeleton() : (
            <EducationSectionContent
              buildingCV={false}
              loading={false}
              value={draftCV?.Education}
              defaultEducationData={[]}
              onEditEducationItem={handleEditEducationItem}
            />
          )}
          </InfoCard>
        </div>

        <div className={isProfileLocked ? styles.disabledSectionCard : undefined}>
          <InfoCard
            title="Projects"
            icon={<Folder aria-hidden="true" width={18} height={18} color="#FFFFFF" />}
            actionButton={
              !isProfileLocked ? (
                <span className={styles.profileEditIcon} onClick={() => handleEditCV("Projects")}>
                  <img src={assetConstants.plus} alt="Add" />
                </span>
              ) : undefined
            }
          >
          {isLoading ? renderLoadingFallback() : isCvExtractionInProgress ? renderSectionSkeleton() : (
            <ProjectsSectionContent
              value={draftCV?.Projects}
              defaultProjectsData={[]}
              onEditProjectItem={handleEditProjectItem}
            />
          )}
          </InfoCard>
        </div>

        <div className={isProfileLocked ? styles.disabledSectionCard : undefined}>
          <InfoCard
            title="Certifications"
            icon={<img src="/icons/fact_check_light.svg" alt="Fact Check Icon" />}
            actionButton={
              !isProfileLocked ? (
                <span className={styles.profileEditIcon} onClick={() => handleEditCV("Certifications")}>
                  <img src={assetConstants.plus} alt="Add" />
                </span>
              ) : undefined
            }
          >
          {isLoading ? renderLoadingFallback() : isCvExtractionInProgress ? renderSectionSkeleton() : (
            <CertificationsSectionContent
              value={draftCV?.Certifications}
              defaultCertificationsData={[]}
              onEditCertificationItem={handleEditCertificationItem}
            />
          )}
          </InfoCard>
        </div>

        <div className={isProfileLocked ? styles.disabledSectionCard : undefined}>
          <InfoCard
            title="Awards"
            icon={<img src="/icons/star_white.svg" alt="Star Icon" />}
            actionButton={
              !isProfileLocked ? (
                <span className={styles.profileEditIcon} onClick={() => handleEditCV("Awards")}>
                  <img src={assetConstants.plus} alt="Add" />
                </span>
              ) : undefined
            }
          >
          {isLoading ? renderLoadingFallback() : isCvExtractionInProgress ? renderSectionSkeleton() : (
            <AwardsSectionContent
              value={draftCV?.Awards}
              defaultAwardsData={[]}
              onEditAwardItem={handleEditAwardItem}
            />
          )}
          </InfoCard>
        </div>
      </div>

      <div className={styles.profileSideColumn}>
        <InfoCard
          title="Job Status"
          icon={<img src="/icons/settings.svg" alt="Gear icon" />}
        >
          <div className={styles.jobStatusContent}>
            <div className={styles.jobStatusHeaderRow}>
              <span className={styles.jobStatusLabel}>Status</span>
              <div className={styles.jobStatusControlRow}>
                <Badge
                  prefixIcon={isActive ? <span className={styles.activeDot}></span> : undefined}
                  variant={isActive ? "success" : "error"}
                  content={isActive ? "Active" : "Inactive"}
                />
                <label className="switch" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(event) => handleToggleVisibility(event.target.checked)}
                    disabled={isExpired || isLoading || isUpdatingVisibility}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>

            <div style={{ fontWeight: 400 }}>{isLoading ? renderLoadingFallback() : tvStatusMessage}</div>
            {isExpired && (
              <div className={styles.tipsRetakeAction}>
                <button
                  type="button"
                  className={styles.filledPillActionButton}
                  onClick={() => void handleReactivate()}
                  disabled={isUpdatingVisibility}
                >
                  {isUpdatingVisibility ? "Redirecting..." : "Reactivate"}
                </button>
              </div>
            )}

            <div className={styles.workDetailsSection}>
              <div className={styles.workDetailsHeaderRow}>
                <span className={styles.jobStatusLabel}>Work Details</span>
                <Badge content={workDetailsBadgeContent} />
              </div>

              <div className={styles.workDetailsField}>
                <label className={styles.workDetailsLabel} htmlFor="work-details-subprogram">
                  What job are you looking for?
                </label>
                <select
                  id="work-details-subprogram"
                  className={styles.workDetailsSelect}
                  value={draftSubprogramId || ""}
                  onChange={(event) => setDraftSubprogramId(event.target.value || null)}
                  disabled={isProfileLocked || isSavingWorkDetails}
                >
                  <option value="">Select a program</option>
                  {subprograms.map((sp) => (
                    <option key={sp._id} value={sp._id}>{sp.title}</option>
                  ))}
                </select>
              </div>

              <div className={styles.workDetailsField}>
                <label className={styles.workDetailsLabel} htmlFor="work-details-start-date">
                  Work Start Date
                </label>
                <select
                  id="work-details-start-date"
                  className={styles.workDetailsSelect}
                  value={draftWorkStartDate || ""}
                  onChange={(event) =>
                    setDraftWorkStartDate(
                      (event.target.value as StartDatePreference) || null
                    )
                  }
                  disabled={isProfileLocked || isSavingWorkDetails}
                >
                  <option value="">Select start date preference</option>
                  <option value="Immediate">Actively looking for work</option>
                  <option value="Flexible">Casually looking for work</option>
                </select>
              </div>

              {hasWorkDetailsChanges && (
                <Button
                  label={isSavingWorkDetails ? "Saving..." : "Save"}
                  onClick={() => void handleSaveWorkDetails()}
                  disabled={isSavingWorkDetails}
                  style={{ width: "fit-content", alignSelf: "flex-end" }}
                />
              )}
            </div>
          </div>
        </InfoCard>

        <div className={isProfileLocked ? styles.disabledSectionCard : undefined}>
          <InfoCard
            title="Documents and Details"
            icon={<img src="/icons/business.svg" alt="Document icon" />}
          >
          {isLoading ? (
            renderLoadingFallback()
          ) : (
            <div className={styles.documentsSection}>
              <div className={styles.documentsHeading}>Documents</div>
              <div className={styles.documentsEntry}>
                <p style={{ fontWeight: 500 }}>CV</p>
                <div className={styles.documentFileCard}>
                  <span className={styles.documentFileIcon}>
                    <img src="/icons/file-white.svg" alt="File Icon" />
                  </span>
                  <strong className={styles.documentFileName}>{displayedDocumentFileName}</strong>
                  {!isProfileLocked && (
                    <div className={styles.documentReuploadControl}>
                      <button
                        type="button"
                        className={styles.documentReuploadButton}
                        onClick={openReuploadPicker}
                        onMouseEnter={() => setIsUploadNewCvHover(true)}
                        onMouseLeave={() => setIsUploadNewCvHover(false)}
                        onContextMenu={(event) => event.preventDefault()}
                        disabled={isUploadingNewCv || isLoading}
                      >
                        <img src="/iconsV3/rotate.svg" alt="Upload new CV" />
                      </button>
                      {isUploadNewCvHover && (
                        <div className={styles.documentReuploadTooltip}>
                          <span>Upload new CV</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {!isProfileLocked && (
                  <input
                    ref={reuploadInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    style={{ display: "none" }}
                    onChange={handleReuploadFileChange}
                  />
                )}
                {!isProfileLocked && stagedCvFile && (
                  <div className={styles.documentReuploadActions}>
                    {!isUploadingNewCv ? (
                      <div className={styles.documentReuploadButtons}>
                        <button
                          type="button"
                          className={styles.documentResetButton}
                          onClick={resetStagedCvFile}
                          disabled={isUploadingNewCv}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          className={styles.filledPillActionButton}
                          onClick={() => void handleSaveStagedCv()}
                          disabled={isUploadingNewCv}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className={styles.documentExtractionLoading}>
                        <img src="/gifs/analysis-loading.gif" alt="CV extraction loading" />
                        <span className={styles.documentExtractionTitle}>
                          Extracting information from your CV...
                        </span>
                        <span className={styles.documentExtractionSubtitle}>
                          Jia is building your profile...
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          </InfoCard>
        </div>
      </div>
      <IntroductionModal
        isOpen={showIntroductionModal}
        onClose={() => setShowIntroductionModal(false)}
        onSave={handleIntroductionSave}
        initialValue={introductionValue}
      />
      <ContactInfoModal
        isOpen={showContactInfoModal}
        onClose={() => setShowContactInfoModal(false)}
        onSave={handleContactInfoSave}
        initialData={contactInfoData}
      />
      <ExperienceModal
        isOpen={showExperienceModal}
        onClose={() => { setShowExperienceModal(false); setEditingExperienceId(null); }}
        onSave={handleExperienceSave}
        onDelete={handleDeleteExperienceItem}
        initialData={getEditingItemById<ExperienceItem>(draftCV?.Experience, editingExperienceId)}
      />
      <SkillModal
        isOpen={showSkillModal}
        onClose={() => setShowSkillModal(false)}
        onSave={handleSkillModalSave}
        initialSkills={draftSkills}
      />
      <EducationModal
        isOpen={showEducationModal}
        onClose={() => { setShowEducationModal(false); setEditingEducationId(null); }}
        onSave={handleEducationSave}
        onDelete={handleDeleteEducationItem}
        initialData={getEditingItemById<EducationItem>(draftCV?.Education, editingEducationId)}
      />
      <ProjectsModal
        isOpen={showProjectsModal}
        onClose={() => { setShowProjectsModal(false); setEditingProjectId(null); }}
        onSave={handleProjectsSave}
        onDelete={handleDeleteProjectItem}
        initialData={getEditingItemById<ProjectItem>(draftCV?.Projects, editingProjectId)}
      />
      <CertificationModal
        isOpen={showCertificationModal}
        onClose={() => { setShowCertificationModal(false); setEditingCertificationId(null); }}
        onSave={handleCertificationsSave}
        onDelete={handleDeleteCertificationItem}
        initialData={getEditingItemById<CertificationItem>(draftCV?.Certifications, editingCertificationId)}
      />
      <AwardModal
        isOpen={showAwardModal}
        onClose={() => { setShowAwardModal(false); setEditingAwardId(null); }}
        onSave={handleAwardsSave}
        onDelete={handleDeleteAwardItem}
        initialData={getEditingItemById<AwardItem>(draftCV?.Awards, editingAwardId)}
      />
      <VisibilityConfirmModal
        open={showDeactivateConfirm}
        onCancel={() => setShowDeactivateConfirm(false)}
        onConfirm={handleConfirmDeactivate}
        isSubmitting={isUpdatingVisibility}
      />
    </div>
  );
}
