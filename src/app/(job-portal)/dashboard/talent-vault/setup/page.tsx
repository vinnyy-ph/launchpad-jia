"use client";

import { StepBar } from "@/app/(talent-vault)/components/applicant-dashboard/StepBar";
import { SubmitCVStep } from "@/app/(talent-vault)/components/applicant-dashboard/SubmitCVStep";
import {
  VerifyProfileStep,
  type VerifyProfileContinuePayload,
  type VerifyProfileInitialData,
} from "@/app/(talent-vault)/components/applicant-dashboard/VerifyProfileStep";
import { UploadingCVState } from "@/app/(talent-vault)/components/applicant-dashboard/UploadingCVState";
import { ConfirmCVUploadStep } from "@/app/(talent-vault)/components/applicant-dashboard/ConfirmCVUploadStep";
import {
  GoalSettingStep,
  type GoalsSelection,
} from "@/app/(talent-vault)/components/applicant-dashboard/GoalSettingStep";
import {
  TVPreScreeningStep,
  type PreScreeningAnsweredQuestion,
} from "@/app/(talent-vault)/components/applicant-dashboard/TVPreScreeningStep";
import { TVInterviewStep } from "@/app/(talent-vault)/components/applicant-dashboard/TVInterviewStep";
import { TalentVaultInfoHelp } from "@/app/(talent-vault)/components/applicant-dashboard/TalentVaultInfoHelp";
import ManualProfileWizard from "@/lib/components/ManualProfile/ManualProfileWizard";
import styles from "@/app/(talent-vault)/styles/modules/profile-setup.module.scss";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { checkFile } from "@/lib/utils/helpersV2";
import { CORE_API_URL } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient";
import { extractTvError } from "@/app/(talent-vault)/lib/tvErrorMap";
import axios from "axios";
import { useAppContext } from "@/lib/context/ContextV2";
import { isTalentVaultEnabled } from "@/app/(talent-vault)/lib/helpers";
import { pathConstants } from "@/lib/utils/constantsV2";
import {
  getTalentVaultInProgressStep,
  getTalentVaultInterviewID,
  isTalentVaultSetupComplete,
  type TalentVaultSetupCurrentStep,
} from "@/app/(talent-vault)/lib/talentVaultStatus";

type StepStatus = "done" | "in_progress" | "next" | "pending";

function getStepStatus(stepNumber: number, currentStep: number): StepStatus {
  if (stepNumber < currentStep) return "done";
  if (stepNumber === currentStep) return "in_progress";
  if (stepNumber === currentStep + 1) return "next";
  return "pending";
}

function safeJsonParse(str: string, fallback: any = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function parseSkillsFromMarkdown(skillsText: string): string[] {
  if (!skillsText) return [];

  const lines = skillsText.split("\n");
  const skills: string[] = [];

  lines.forEach((line) => {
    const cleaned = line
      .trim()
      .replace(/^[-*+]\s*/, "")
      .replace(/^\d+\.\s*/, "");

    if (cleaned) {
      skills.push(cleaned);
    }
  });

  return Array.from(new Set(skills));
}

function getReviewDataFromProfile(profile: any): VerifyProfileInitialData | null {
  const digitalCV = Array.isArray(profile?.profile?.digitalCV)
    ? profile.profile.digitalCV
    : [];

  if (digitalCV.length === 0) {
    return null;
  }

  return {
    digitalCV,
    education: Array.isArray(profile?.profile?.education)
      ? profile.profile.education
      : [],
    fileInfo: profile?.profile?.fileInfo || null,
    matchingSignals:
      profile?.profile?.matchingSignals && typeof profile.profile.matchingSignals === "object"
        ? profile.profile.matchingSignals
        : null,
    structuredCV: profile?.profile?.structuredCV || null,
  };
}

function getReviewDataFromApplicantCv(
  applicantCv: any,
  fallbackEducation: any[]
): VerifyProfileInitialData | null {
  const digitalCV = Array.isArray(applicantCv?.digitalCV)
    ? applicantCv.digitalCV
    : [];

  if (digitalCV.length === 0) {
    return null;
  }

  return {
    digitalCV,
    education: Array.isArray(applicantCv?.education)
      ? applicantCv.education
      : fallbackEducation,
    fileInfo: applicantCv?.fileInfo || null,
    matchingSignals:
      applicantCv?.matchingSignals && typeof applicantCv.matchingSignals === "object"
        ? applicantCv.matchingSignals
        : null,
    structuredCV: applicantCv?.structuredCV || null,
  };
}

function getSetupPageStep(profile: any, hasPersistedCvProfile: boolean): number {
  const persistedCurrentStep = profile?.setup?.currentStep;

  if (persistedCurrentStep === "submitCV") return 1;
  if (persistedCurrentStep === "verifyProfile") return 2;
  if (persistedCurrentStep === "goalSetting") return 3;
  if (persistedCurrentStep === "preScreening") return 4;
  if (persistedCurrentStep === "aiInterview") return 5;

  const inProgressStep = getTalentVaultInProgressStep(profile?.setup);

  if (inProgressStep === "cvProfile") {
    return hasPersistedCvProfile ? 2 : 1;
  }

  if (inProgressStep === "goalSetting") return 3;
  if (inProgressStep === "preScreening") return 4;
  if (inProgressStep === "aiInterview" || inProgressStep === null) return 5;

  return hasPersistedCvProfile ? 2 : 1;
}

// Fetch profile + applicant CV and derive the review-data view of them.
// Shared by mount init and the manual-wizard onSubmitted refresh; pure
// (no state writes) so each caller keeps its own cancellation semantics.
async function fetchReviewState() {
  const [profileResponse, applicantCvResponse] = await Promise.all([
    api.post("/api/talent-vault/profiles"),
    api.post("/api/whitecloak/fetch-cv").catch(() => null),
  ]);

  const profileData = profileResponse?.data?.data || null;
  const profileReviewData = getReviewDataFromProfile(profileData);
  const fallbackReviewData = !profileReviewData
    ? getReviewDataFromApplicantCv(
        applicantCvResponse?.data,
        profileReviewData?.education || []
      )
    : null;

  const nextSavedReviewData = profileReviewData || fallbackReviewData;
  return {
    profileData,
    nextSavedReviewData,
    hasReviewData: Boolean(nextSavedReviewData?.digitalCV?.length),
    hasPersistedCvProfile: Boolean(profileReviewData?.digitalCV?.length),
  };
}

export default function TalentVaulSetupPage() {
  const { user, setModalType } = useAppContext();
  const router = useRouter();

  useEffect(() => {
    if (user?.email && !isTalentVaultEnabled(user.email)) {
      router.replace(pathConstants.dashboard);
    }
  }, [user?.email, router]);

  const [currentStep, setCurrentStep] = useState(1);
  const [isCreatingManually, setIsCreatingManually] = useState(false);
  const [hasCV, setHasCV] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isBuildingCV, setIsBuildingCV] = useState(false);
  const [isPreparingInterview, setIsPreparingInterview] = useState(false);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [savedReviewData, setSavedReviewData] =
    useState<VerifyProfileInitialData | null>(null);
  const [verifyInitialData, setVerifyInitialData] =
    useState<VerifyProfileInitialData | null>(null);
  const [subprogramDetail, setSubprogramDetail] = useState<any>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  useEffect(() => {
    let cancelled = false;

    const initializeProfile = async () => {
      if (!user?.email) {
        if (!cancelled) {
          setIsInitializing(false);
        }
        return;
      }

      setIsInitializing(true);

      try {
        const { profileData, nextSavedReviewData, hasReviewData, hasPersistedCvProfile } =
          await fetchReviewState();

        if (cancelled) return;

        setProfile(profileData);
        setSavedReviewData(nextSavedReviewData);
        setHasCV(hasReviewData);

        const resolvedStep = profileData
          ? getSetupPageStep(profileData, hasPersistedCvProfile)
          : 1;

        // Fetch subprogram detail when returning to pre-screening or later steps.
        const selectedSubprogramId =
          profileData?.profile?.goals?.selectedSubprogramId;

        if (resolvedStep >= 4 && selectedSubprogramId) {
          try {
            const detailResponse = await api.get(
              `/api/talent-vault/subprograms/candidate/${selectedSubprogramId}`
            );

            if (!cancelled) {
              setSubprogramDetail(detailResponse.data);
            }
          } catch (detailError) {
            console.error(
              "Failed to fetch subprogram detail during init:",
              detailError
            );

            if (!cancelled) {
              setUploadError(
                "Failed to load subprogram details. Please re-select your subprogram."
              );
              setCurrentStep(3);
              return;
            }
          }
        }

        if (cancelled) return;

        setCurrentStep(resolvedStep);
      } catch (error: any) {
        if (!cancelled) {
          console.error("Error initializing talent vault setup:", error);
      const { message } = extractTvError(error);
          setUploadError(message);
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    };

    initializeProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.email, user?.uid]);

  const goalInitialSelection = useMemo(() => {
    const goals = profile?.profile?.goals;
    if (!goals) return null;

    return {
      selectedSubprogramId: goals.selectedSubprogramId || null,
      selectedSubprogramSnapshot: goals.selectedSubprogramSnapshot || null,
      workGoals: Array.isArray(goals.workGoals) ? goals.workGoals : [],
      startDatePreference:
        goals.startDatePreference === "Immediate" ||
        goals.startDatePreference === "Flexible"
          ? goals.startDatePreference
          : null,
      fieldOfInterests: Array.isArray(goals.fieldOfInterests)
        ? goals.fieldOfInterests
            .map((fieldOfInterest: any) => String(fieldOfInterest).trim())
            .filter(Boolean)
        : [],
      careerGoalIds: Array.isArray(goals.careerGoalIds)
        ? goals.careerGoalIds.map((goalId: any) => String(goalId))
        : [],
      careerGoalsSnapshot: Array.isArray(goals.careerGoalsSnapshot)
        ? goals.careerGoalsSnapshot
        : [],
    };
  }, [profile]);

  const preScreeningInitial = useMemo(() => {
    return Array.isArray(profile?.profile?.preScreening)
      ? profile.profile.preScreening
      : null;
  }, [profile]);

  const preScreeningQuestions = useMemo(() => {
    return Array.isArray(subprogramDetail?.subprogram?.preScreeningQuestions)
      ? subprogramDetail.subprogram.preScreeningQuestions
      : [];
  }, [subprogramDetail]);

  const hasPreScreening = useMemo(() => {
    const selectedSubprogramId = profile?.profile?.goals?.selectedSubprogramId;
    if (!selectedSubprogramId) return false;
    return preScreeningQuestions.length > 0;
  }, [profile, preScreeningQuestions]);
  const verifyStepData = useMemo(() => {
    return verifyInitialData || savedReviewData || getReviewDataFromProfile(profile);
  }, [verifyInitialData, savedReviewData, profile]);

  const initialFieldOfInterests = useMemo(() => {
    const persistedFieldOfInterests = Array.isArray(profile?.profile?.goals?.fieldOfInterests)
      ? profile.profile.goals.fieldOfInterests
          .map((fieldOfInterest: any) => String(fieldOfInterest || "").trim())
          .filter(Boolean)
      : [];

    if (persistedFieldOfInterests.length > 0) {
      return persistedFieldOfInterests;
    }

    // Prefer structuredCV.skills (already a string[]) over markdown parsing
    const structuredSkills = verifyStepData?.structuredCV?.skills;
    if (Array.isArray(structuredSkills) && structuredSkills.length > 0) {
      return structuredSkills.map((s: any) => String(s || "").trim()).filter(Boolean);
    }

    const digitalCV = Array.isArray(verifyStepData?.digitalCV)
      ? verifyStepData.digitalCV
      : [];
    const skillsSection = digitalCV.find(
      (section: any) => String(section?.name || "").toLowerCase() === "skills"
    );

    return parseSkillsFromMarkdown(String(skillsSection?.content || ""));
  }, [profile, verifyStepData]);

  const persistCurrentSetupStep = async (
    nextStep: TalentVaultSetupCurrentStep
  ) => {
    const response = await api.patch("/api/talent-vault/profiles", {
      action: "set_setup_step_status",
      payload: {
        currentStep: nextStep,
      },
    });

    const updatedProfile = response.data?.data || null;
    setProfile(updatedProfile);
    return updatedProfile;
  };

  const handleViewInterviewGuide = async () => {
    if (isPreparingInterview) {
      return;
    }

    setIsPreparingInterview(true);

    try {
      const response = await api.patch("/api/talent-vault/profiles", {
        action: "ensure_ai_interview",
        payload: {},
      });

      const updatedProfile = response?.data?.data || profile;
      const ensuredInterviewID = response?.data?.meta?.interviewID;
      const interviewID =
        typeof ensuredInterviewID === "string" && ensuredInterviewID.trim().length > 0
          ? ensuredInterviewID.trim()
          : getTalentVaultInterviewID(updatedProfile);

      if (!interviewID) {
        throw new Error("Interview is not ready yet. Please try again.");
      }

      setProfile(updatedProfile);

      const modalPayload = {
        source: "talent-vault",
        interviewID,
        profileId:
          updatedProfile?._id && typeof updatedProfile._id.toString === "function"
            ? updatedProfile._id.toString()
            : null,
        name: updatedProfile?.userInfo?.name || user?.name || "",
        email: updatedProfile?.userInfo?.email || user?.email || "",
      };

      sessionStorage.setItem("selectedCareer", JSON.stringify(modalPayload));
      setModalType("preScreeningGuide");
    } catch (error: any) {
      console.error("Error preparing Talent Vault interview:", error);
      
      const { errorCode, message } = extractTvError(error);
      
      if (errorCode === "SUBPROGRAM_NOT_ELIGIBLE" || errorCode === "SUBPROGRAM_NOT_FOUND") {
        setUploadError("This subprogram is no longer available. Please select a different subprogram.");
        setSubprogramDetail(null);
        await persistCurrentSetupStep("goalSetting");
        setCurrentStep(3);
        return;
      }
      
      setUploadError(message);
    } finally {
      setIsPreparingInterview(false);
    }
  };

  const handleFileSelect = (file: File) => {
    const validFile = checkFile([file]);
    if (!validFile) {
      return;
    }

    setSelectedFile(file);
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;

    setUploadingFile(selectedFile);
    setSelectedFile(null);
    await handleFileSubmit(selectedFile);
  };

  const handleCancelUpload = () => {
    setSelectedFile(null);
  };

  const handleFileSubmit = async (file: File) => {
    try {
      if (!user?.email) {
        throw new Error("User email not available. Please log in.");
      }

      setIsBuildingCV(true);
      setIsUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("fName", file.name);
      formData.append("userEmail", user.email);

      const uploadResponse = await axios({
        method: "POST",
        url: `${CORE_API_URL}/upload-cv`,
        data: formData,
      });

      if (!uploadResponse.data?.cvChunks) {
        throw new Error("Invalid response from upload service");
      }

      const autofillResponse = await api.post(`/api/whitecloak/autofill-cv`, {
        chunks: uploadResponse.data.cvChunks,
      });

      const parsedUserCV = autofillResponse.data.parsed || safeJsonParse(autofillResponse.data.result);
      if (!parsedUserCV || !parsedUserCV.digitalCV) {
        throw new Error("Invalid digitalization result structure");
      }

      const nextVerifyData: VerifyProfileInitialData = {
        digitalCV: parsedUserCV.digitalCV,
        education: Array.isArray(parsedUserCV.structuredCV?.education)
          ? parsedUserCV.structuredCV.education
          : [],
        fileInfo: {
          name: file.name,
          size: file.size,
          type: file.type,
        },
        structuredCV: parsedUserCV.structuredCV || null,
      };

      const profileResponse = await api.post("/api/talent-vault/profiles");
      setProfile(profileResponse?.data?.data || null);
      await persistCurrentSetupStep("verifyProfile");

      setVerifyInitialData(nextVerifyData);
      setHasCV(true);
      setCurrentStep(2);
    } catch (error: any) {
      console.error("Error uploading CV:", error);
      const { message } = extractTvError(error);
      alert(message);
    } finally {
      setIsBuildingCV(false);
      setIsUploading(false);
      setUploadingFile(null);
    }
  };

  const handleReviewCV = async () => {
    if (!savedReviewData) {
      alert("No saved CV found yet. Please upload a CV first.");
      return;
    }

    try {
      await persistCurrentSetupStep("verifyProfile");
      setVerifyInitialData(savedReviewData);
      setCurrentStep(2);
    } catch (error: any) {
      console.error("Error moving setup to verify profile step:", error);
      const { message } = extractTvError(error);
      alert(message);
    }
  };

  const handleResubmit = async () => {
    try {
      await persistCurrentSetupStep("submitCV");
    } catch (error: any) {
      console.error("Error moving setup back to submit CV step:", error);
    }

    setVerifyInitialData(null);
    setCurrentStep(1);
  };

  const handleSaveVerifyProfile = async (
    payload: VerifyProfileContinuePayload
  ) => {
    setIsSavingStep(true);
    setUploadError(null);

    try {
      const response = await api.patch("/api/talent-vault/profiles", {
        action: "save_cv_profile",
        payload,
      });

      const updatedProfile = response.data?.data;
      setProfile(updatedProfile);

      const nextSavedReviewData: VerifyProfileInitialData = {
        digitalCV: payload.digitalCV,
        education: payload.education,
        fileInfo: payload.fileInfo,
        matchingSignals:
          payload.matchingSignals && typeof payload.matchingSignals === "object"
            ? payload.matchingSignals
            : null,
        structuredCV: payload.structuredCV || null,
      };

      setSavedReviewData(nextSavedReviewData);
      setVerifyInitialData(null);
      setHasCV(true);
      setCurrentStep(getSetupPageStep(updatedProfile, true));
    } catch (error: any) {
      console.error("Error saving verify profile step:", error);
      const { message } = extractTvError(error);
      alert(message);
    } finally {
      setIsSavingStep(false);
    }
  };

  const handleBackToVerifyProfile = () => {
    setCurrentStep(2);
  };

  const handleSaveGoalSetting = async (selection: GoalsSelection) => {
    setIsSavingStep(true);
    setUploadError(null);
    setSubprogramDetail(null);

    try {
      const response = await api.patch("/api/talent-vault/profiles", {
        action: "save_goal_setting",
        payload: {
          goals: selection,
        },
      });

      const updatedProfile = response.data?.data;
      setProfile(updatedProfile);

// Fetch candidate-safe subprogram detail after goal save succeeds
// subprogramDetail is cleared at top of function to prevent stale pre-screening questions
try {
  if (selection.selectedSubprogramId) {
    const detailResponse = await api.get(
      `/api/talent-vault/subprograms/candidate/${selection.selectedSubprogramId}`
    );
    setSubprogramDetail(detailResponse.data);

    // Skip pre-screening step if subprogram has zero questions
    const preScreeningQuestionsCount =
      detailResponse?.data?.subprogram?.preScreeningQuestions?.length || 0;
    if (preScreeningQuestionsCount === 0) {
      setCurrentStep(5);
      return;
    }

    // Subprogram has pre-screening questions — always go to step 4
    setCurrentStep(4);
    return;
  }
} catch (detailError) {
  console.error("Failed to fetch subprogram detail:", detailError);
        setUploadError("Failed to load subprogram details. Please try again.");
        return;
}
      setCurrentStep(getSetupPageStep(updatedProfile, hasCV));
    } catch (error: any) {
      console.error("Error saving goal setting step:", error);
      
      const { errorCode, message } = extractTvError(error);
      
      if (errorCode === "SUBPROGRAM_NOT_ELIGIBLE" || errorCode === "SUBPROGRAM_NOT_FOUND") {
        setUploadError("This subprogram is no longer available. Please select a different subprogram.");
        setSubprogramDetail(null);
        await persistCurrentSetupStep("goalSetting");
        setCurrentStep(3);
        return;
      }
      
      setUploadError(message);
      alert(message);
    } finally {
      setIsSavingStep(false);
    }
  };

  const handleBackToGoalSetting = () => {
    setCurrentStep(3);
  };

  const handleBackToPreScreeningOrGoalSetting = () => {
    setCurrentStep(hasPreScreening ? 4 : 3);
  };

  const handleSavePreScreening = async (
    preScreening: PreScreeningAnsweredQuestion[]
  ) => {
    setIsSavingStep(true);
    setUploadError(null);

    try {
      const response = await api.patch("/api/talent-vault/profiles", {
        action: "save_pre_screening_assessment",
        payload: {
          preScreening,
        },
      });

      const updatedProfile = response.data?.data;
      setProfile(updatedProfile);
      setCurrentStep(getSetupPageStep(updatedProfile, hasCV));
    } catch (error: any) {
      console.error("Error saving pre-screening step:", error);
      
      const { errorCode, message } = extractTvError(error);
      
      if (errorCode === "SUBPROGRAM_NOT_ELIGIBLE" || errorCode === "SUBPROGRAM_NOT_FOUND") {
        setUploadError("This subprogram is no longer available. Please select a different subprogram.");
        setSubprogramDetail(null);
        await persistCurrentSetupStep("goalSetting");
        setCurrentStep(3);
        return;
      }
      
      alert(message);
    } finally {
      setIsSavingStep(false);
    }
  };

  const isSetupAlreadyComplete = !isInitializing
    && profile
    && profile.state === "completed"
    && isTalentVaultSetupComplete(profile?.setup);

  useEffect(() => {
    if (isSetupAlreadyComplete) {
      router.replace("/dashboard/talent-vault");
    }
  }, [isSetupAlreadyComplete, router]);

  if (isInitializing || isSetupAlreadyComplete) {
    return (
      <div className={styles.profileSetupContainer}>
        <div className={`${styles.profileSetupContent} ${styles.loadingState}`}>
          <img
            className={styles.loadingGif}
            src="/gifs/analysis-loading.gif"
            alt="Loading animation"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.profileSetupContainer}>
      <div className={styles.profileSetupHeader}>
        <div className={styles.profileSetupHeaderTitle}>
          <h1>Set up your Jia Talent Vault profile</h1>
          <TalentVaultInfoHelp />
        </div>

        <div className={styles.stepBarsWrapper}>
          <div className={styles.stepBars}>
            <StepBar title="Submit CV" step={1} status={getStepStatus(1, currentStep)} />
            <StepBar title="Verify Profile" step={2} status={getStepStatus(2, currentStep)} />
            <StepBar title="Goal Setting" step={3} status={getStepStatus(3, currentStep)} />
            {hasPreScreening && (
              <StepBar title="Pre-screening" step={4} status={getStepStatus(4, currentStep)} />
            )}
            <StepBar
              title="AI Interview"
              step={hasPreScreening ? 5 : 4}
              status={getStepStatus(hasPreScreening ? 5 : 4, hasPreScreening ? currentStep : Math.min(currentStep, 4))}
              lastStep
            />
          </div>
          </div>
        </div>

      {uploadError && (
        <div
          style={{
            background: "#f8d7da",
            color: "#721c24",
            padding: "1rem",
            marginBottom: "1rem",
            borderRadius: "4px",
            border: "1px solid #f5c6cb",
          }}
        >
          <strong>Error:</strong> {uploadError}
          <button
            onClick={() => setUploadError(null)}
            style={{
              marginLeft: "1rem",
              background: "none",
              border: "none",
              color: "#721c24",
              cursor: "pointer",
              fontSize: "1.5rem",
            }}
          >
            ×
          </button>
        </div>
      )}

      <div className={styles.profileSetupContent}>
        {currentStep === 1 && isCreatingManually && (
          <ManualProfileWizard
            userEmail={user?.email || ""}
            onExit={() => setIsCreatingManually(false)}
            onSubmitted={async () => {
              // Mirror the job-portal mount: exit the wizard, then refresh CV
              // state so SubmitCVStep reflects the newly saved profile instead
              // of the mount-time hasCV.
              setIsCreatingManually(false);
              try {
                const { nextSavedReviewData, hasReviewData } = await fetchReviewState();
                setSavedReviewData(nextSavedReviewData);
                setHasCV(hasReviewData);
              } catch (error) {
                console.error("Failed to refresh CV state after manual submit:", error);
              }
            }}
          />
        )}

        {currentStep === 1 && !isCreatingManually && !isBuildingCV && !selectedFile && (
          <SubmitCVStep
            hasCV={hasCV}
            onReviewCV={handleReviewCV}
            onFileSelect={handleFileSelect}
            onCreateManually={() => setIsCreatingManually(true)}
            isUploading={isUploading}
          />
        )}

        {currentStep === 1 && selectedFile && !isBuildingCV && (
          <ConfirmCVUploadStep
            fileName={selectedFile.name}
            onConfirm={handleConfirmUpload}
            onCancel={handleCancelUpload}
          />
        )}

        {currentStep === 1 && isBuildingCV && uploadingFile && (
          <UploadingCVState fileName={uploadingFile.name} />
        )}

        {currentStep === 2 && verifyStepData && (
          <VerifyProfileStep
            key={`verify-${verifyStepData.fileInfo?.name || "draft"}`}
            initialData={verifyStepData}
            onResubmit={handleResubmit}
            onContinue={handleSaveVerifyProfile}
            isSaving={isSavingStep}
          />
        )}

        {currentStep === 3 && (
          <GoalSettingStep
            initialSelection={goalInitialSelection}
            initialFieldOfInterests={initialFieldOfInterests}
            onBack={handleBackToVerifyProfile}
            onContinue={handleSaveGoalSetting}
            isSaving={isSavingStep}
          />
        )}

        {currentStep === 4 && (
<TVPreScreeningStep
  initialPreScreening={preScreeningInitial}
  preScreeningQuestions={preScreeningQuestions}
  questionsReady={subprogramDetail !== null}
  onBack={handleBackToGoalSetting}
  onContinue={handleSavePreScreening}
  isSaving={isSavingStep}
/>
        )}

        {currentStep === 5 && (
          <TVInterviewStep
            onBack={handleBackToPreScreeningOrGoalSetting}
            onViewNextStep={handleViewInterviewGuide}
            isPreparing={isPreparingInterview}
          />
        )}
      </div>
    </div>
  );
}
