// TODO (Job Portal) - Check API

"use client";

import Loader from "@/lib/components/commonV2/Loader";
import PhoneVerificationModal from "@/lib/components/PhoneVerification/PhoneVerificationModal";
import styles from "@/lib/styles/screens/dashboard.module.scss";
import { usePasscodeValue } from "@/lib/hooks/usePasscodeValue";
import { usePhoneVerificationFlow } from "@/lib/hooks/usePhoneVerificationFlow";
import { useAppContext } from "@/lib/context/ContextV2";
import { assetConstants, pathConstants } from "@/lib/utils/constantsV2";
import { processDisplayDate } from "@/lib/utils/helpersV2";
import { api } from "@/lib/utils/apiClient";
import {
  inferPhoneCountry,
  sanitizeInternationalPhoneInput,
} from "@/lib/utils/phoneInput";
import { extractSubdomain } from "@/lib/utils/subdomainUtils";
import Field from "@/lib/components/ui/field/Field";
import { SearchMd } from "@untitledui/icons";
import Fuse from "fuse.js";
import { useEffect, useState } from "react";
import moment from "moment";
import { InvitationBanner } from "@/app/(talent-vault)/components/applicant-dashboard/InvitationBanner";
import { resolveTalentVaultExpiresAt } from "@/app/(talent-vault)/lib/talentVaultStatus";
import { isTalentVaultEnabled } from "@/app/(talent-vault)/lib/helpers";

const PHONE_VERIFICATION_RECAPTCHA_ID = "dashboard-recaptcha-container";

export default function () {
  const [activeInterviewIndex, setActiveInterviewIndex] = useState(null);
  const [activeInterviews, setActiveInterviews] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [archivedInterviews, setArchivedInterviews] = useState([]);
  const [filteredActiveInterview, setFilteredActiveInterview] = useState([]);
  const [filteredArchiveInterview, setFilteredArchiveInterview] = useState([]);
  const [filterDropdown, setFilterDropdown] = useState(false);
  const [filterValue, setFilterValue] = useState(null);
  const [isPhoneVerificationModalOpen, setIsPhoneVerificationModalOpen] =
    useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [maskedMobileNumber, setMaskedMobileNumber] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [mobileNumberError, setMobileNumberError] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(105);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [pendingUploadInterview, setPendingUploadInterview] = useState(null);
  const [phoneVerificationStep, setPhoneVerificationStep] = useState<
    "phone" | "otp" | "contact"
  >("phone");
  const [search, setSearch] = useState("");
  const [viewDropdown, setViewDropdown] = useState(null);
  const { user, isUserRevalidating, setModalType, toasterType, setToasterType } = useAppContext();
  const [hasShownTalentVaultExpiredToast, setHasShownTalentVaultExpiredToast] =
    useState(false);
  const { passcode, onDigitChange, onComplete, reset } = usePasscodeValue();
  const {
    handleBackToPhone,
    handleOtpDigitChange,
    handlePhoneVerificationNext,
    handleResendOtp,
    handleVerifyOtp,
    resetVerificationSession,
  } = usePhoneVerificationFlow({
    isPhoneVerificationModalOpen,
    mobileNumber,
    onDigitChange,
    onRequestMobileApplied: (nextMobileNumber) => {
      setMobileNumber(sanitizeInternationalPhoneInput(nextMobileNumber));
    },
    onVerificationApproved: (_, verifiedMobileNumber) => {
      setMobileNumber(sanitizeInternationalPhoneInput(verifiedMobileNumber));

      if (pendingUploadInterview) {
        setModalType("loading");
        sessionStorage.setItem(
          "selectedCareer",
          JSON.stringify(pendingUploadInterview)
        );
        window.location.href = pathConstants.uploadCV;
        return;
      }

      closePhoneVerificationModal();
    },
    otpCountdown,
    passcode,
    phoneVerificationStep,
    recaptchaContainerId: PHONE_VERIFICATION_RECAPTCHA_ID,
    resetPasscode: reset,
    setIsRequestingOtp,
    setIsVerifyingOtp,
    setMaskedMobileNumber,
    setMobileNumber,
    setMobileNumberError,
    setOtpCountdown,
    setOtpError,
    setPhoneVerificationStep,
    updateStoredUser: (nextUser) => {
      localStorage.setItem("user", JSON.stringify(nextUser));
      window.dispatchEvent(
        new CustomEvent("localStorageChange", {
          detail: { key: "user", value: nextUser },
        })
      );
    },
    user,
  });

  function isPhoneVerificationComplete(candidateUser) {
    const structuredVerification =
      candidateUser?.structuredCV?.contactInfo?.isPhoneVerified;
    const topLevelVerification = candidateUser?.isPhoneVerified;

    return (
      structuredVerification === true ||
      `${structuredVerification || ""}`.toLowerCase() === "true" ||
      topLevelVerification === true ||
      `${topLevelVerification || ""}`.toLowerCase() === "true"
    );
  }

  async function isPhoneVerificationCompleteFromServer() {
    // T5: mobile verification is a paid feature and out of scope. When disabled,
    // treat the gate as satisfied so applicants are never blocked.
    if (process.env.NEXT_PUBLIC_PHONE_VERIFICATION_REQUIRED === "false") {
      return true;
    }
    try {
      const response = await api.post("/api/whitecloak/fetch-cv");
      return isPhoneVerificationComplete(response?.data);
    } catch {
      return false;
    }
  }

  function getCandidateMobileNumber(candidateUser) {
    return sanitizeInternationalPhoneInput(
      `${candidateUser?.structuredCV?.contactInfo?.phone || ""}`.trim()
    );
  }

  function resetPhoneVerificationModalState() {
    resetVerificationSession();
    setMobileNumberError("");
    setMaskedMobileNumber("");
    setOtpError(null);
    setOtpCountdown(105);
    reset();
    setPhoneVerificationStep("phone");
  }

  function openPhoneVerificationModal(interview) {
    setPendingUploadInterview(interview);
    resetPhoneVerificationModalState();
    setMobileNumber(getCandidateMobileNumber(user));
    setIsPhoneVerificationModalOpen(true);
  }

  function closePhoneVerificationModal() {
    resetPhoneVerificationModalState();
    setIsPhoneVerificationModalOpen(false);
    setPendingUploadInterview(null);
  }

  async function handleSubmitCV(interview) {
    setModalType("loading");
    const isVerified = await isPhoneVerificationCompleteFromServer();

    if (isVerified) {
      sessionStorage.setItem("selectedCareer", JSON.stringify(interview));
      window.location.href = pathConstants.uploadCV;
      return;
    }

    setModalType(null);
    openPhoneVerificationModal(interview);
  }

  const applicationPhase = [
    "For CV Screening",
    "For AI Interview",
    "For AI Interview Review",
    "For Human Interview",
    "For Human Interview Review",
  ];
  const applicationStep = [
    "CV Screening",
    "AI Interview",
    "Human Interview",
    "Job Offer",
  ];
  const buttonStatus = [
    {
      buttonText: "Submit CV",
      disabled: false,
      spanText: "Required",
      handleClick: function (interview) {
        handleSubmitCV(interview);
      },
    },
    {
      buttonText: "Start AI Interview",
      disabled: true,
      spanText: "Required",
      status: applicationPhase[0],
      handleClick: function () {
        return true;
      },
    },
    {
      buttonText: "Start AI Interview",
      disabled: false,
      spanText: "Required",
      status: applicationPhase[1],
      handleClick: function (interview) {
        setModalType("loading");
        sessionStorage.setItem("interviewRedirection", pathConstants.dashboard);
        window.location.href = `/interview/${interview.interviewID}`;
      },
    },
    {
      buttonText: "Request to Retake",
      spanText: "Optional",
      status: applicationPhase[2],
      handleClick: function (interview) {
        if (interview.interviewDuration < 5) {
          retakeInterview(interview);
        } else {
          sessionStorage.setItem("selectedCareer", JSON.stringify(interview));
          setModalType("retake");
        }
      },
    },
  ];
  const dropdownItems = [
    {
      text: "Cancel Application",
      handleClick: function (interview) {
        sessionStorage.setItem("selectedCareer", JSON.stringify(interview));
        setModalType("cancel");
        setViewDropdown(null);
      },
    },
  ];
  const droppedStatus = {
    [applicationStep[0]]: {
      description:
        "Thanks for applying! However, after reviewing your CV, we found that your current experience isn’t the best match for this role. We encourage you to reapply in the future once you've gained more relevant experience.",
      tips: [
        "Try highlighting more results-driven achievements in your CV",
        "Align your experience more closely with the job requirements",
        "Consider adding relevant certifications or skills",
      ],
    },
    [applicationStep[1]]: {
      description:
        "Thanks for applying! After reviewing your AI interview responses, we found that your current experience and answers aren’t the best fit for this role. We encourage you to reapply in the future after refining your responses and gaining more relevant experience.",
      tips: [
        "Be more specific with examples that show impact",
        "Practice structuring your answers (e.g., using STAR: Situation, Task, Action, Result)",
        "Demonstrate deeper familiarity with the role’s key skills",
      ],
    },
    [applicationStep[2]]: {
      description:
        "Thank you for the time and effort you put into this process. While we were impressed by aspects of your background, we’ve decided to move forward with another candidate. We hope you’ll consider applying again in the future.",
      tips: [
        "Reflect on common interview questions and prepare tailored responses",
        "Continue building your experience in areas related to the role",
        "Keep showcasing your strengths — you were close!",
      ],
    },
    [applicationStep[3]]: {
      description:
        "Thank you for the time and effort you put into this process. While we were impressed by aspects of your background, we’ve decided to move forward with another candidate. We hope you’ll consider applying again in the future.",
      tips: [
        "Reflect on common interview questions and prepare tailored responses",
        "Continue building your experience in areas related to the role",
        "Keep showcasing your strengths — you were close!",
      ],
    },
    Applied: {
      description:
        "Thanks for applying! After an initial review, we’ve decided not to move forward with your application at this time. We truly appreciate your interest and encourage you to apply again in the future.",
      tips: [
        "Consider applying to roles that more closely match your background",
        "Tailor your CV and application materials to highlight relevant strengths",
        "Continue building experience aligned with your target roles",
      ],
    },
    generic: {
      description:
        "Thanks for applying! While we won’t be moving forward with your application, we appreciate your interest and encourage you to reapply in the future as you continue to grow your experience.",
      tips: [
        "Highlight measurable achievements and outcomes in your application",
        "Tailor your experiences and responses to align with the role",
        "Continue building relevant skills and gaining practical experience",
      ],
    },
  };
  const filters = [
    "All Application Stages",
    ...applicationStep,
    "Application Closed",
  ];
  const interviewStatus = ["Ongoing", "Dropped", "Hired", "Cancelled"];
  const stepNote = [
    "Your CV is being reviewed by the hiring team.",
    "Your interview is being reviewed by the hiring team.",
  ];
  const stepStatus = ["Completed", "Pending", "In Progress"];
  const tabs = [
    {
      image: assetConstants.briefcaseV2,
      name: "Active",
      value: filteredActiveInterview.length,
    },
    {
      image: assetConstants.archive,
      name: "Archived",
      value: filteredArchiveInterview.length,
    },
  ];

  useEffect(() => {
    setHasShownTalentVaultExpiredToast(false);
  }, [user?.email]);

  useEffect(() => {
    if (!isTalentVaultEnabled(user?.email ?? "")) return;

    if (!user?.talentVault || hasShownTalentVaultExpiredToast) {
      return;
    }

    const normalizedState = String(user.talentVault.state || "").toLowerCase();
    const expiresAt = resolveTalentVaultExpiresAt(
      user.talentVault.expiresAt || user.talentVault.expirationDate,
      user.talentVault.completedAt
    );
    const isExpiredByDate = expiresAt ? expiresAt.getTime() < Date.now() : false;
    const isExpired = normalizedState === "expired" || isExpiredByDate;

    if (!isExpired) {
      return;
    }

    if (toasterType && toasterType !== "talentVaultExpired") {
      return;
    }

    setToasterType("talentVaultExpired");
    setHasShownTalentVaultExpiredToast(true);
  }, [hasShownTalentVaultExpiredToast, setToasterType, toasterType, user?.talentVault]);

  function handleActiveTab(tab) {
    setActiveTab(tab);
    setViewDropdown(null);
  }

  function handleArchive(interview) {
    const data = {
      email: user.email,
      interviewData: interview,
      body: {
        archived: true,
      },
    };

    manageInterview(data);
  }

  function handleApplication(interview, index) {
    if (interview.applicationStatus == interviewStatus[0]) {
      setActiveInterviewIndex((prev) => (prev != index ? index : null));
    }
  }

  function handleBrowseJob() {
    window.location.href = pathConstants.dashboardJobOpenings;
  }

  function handleDropdown(e, index) {
    e.stopPropagation();
    setViewDropdown((prev) => (prev == index ? null : index));
  }

  function handleViewScreeningResult(interview) {
    sessionStorage.setItem("selectedCareer", JSON.stringify(interview));
    setModalType("screening");
  }

  function processButtonState(interview): any {
    if (interview.currentStep == "Applied") {
      return buttonStatus[0];
    }

    if (interview.applicationStatus) {
      return buttonStatus.find((btn) => btn.status === interview.status);
    }
  }

  function processCurrentStep(interview) {
    const pipelineStages = interview?.pipelineStages || [];
    const pipelineStageSteps = pipelineStages?.map((stage) => stage.name);
    if (interview.currentStep == "Applied") {
      return pipelineStageSteps[0];
    }

    // old data
    if (interview.currentStep == "Job Interview") {
      return "Human Interview";
    }

    if (pipelineStageSteps.includes(interview.currentStep)) {
      // CV Screening
      if (interview.currentStep == pipelineStageSteps[0]) {
        return interview.status ==
          pipelineStages
            .find((stage) => stage.name === pipelineStageSteps[1])
            ?.substages?.find(
              (substage) => substage.currentStep === pipelineStageSteps[0]
            )?.status
          ? pipelineStageSteps[1]
          : pipelineStageSteps[0];
      }

      // AI Interview
      if (interview.currentStep == pipelineStageSteps[1]) {
        return interview.status.toLowerCase().includes("review")
          ? `${pipelineStageSteps[1]} Review`
          : pipelineStageSteps[2];
      }

      if (interview.currentStep == "Human Interview") {
        const humanInterviewSubstage = pipelineStages
          .find((stage) => stage.name === "Human Interview")
          ?.substages?.find((substage) => substage.status === interview.status);
        if (humanInterviewSubstage) {
          return humanInterviewSubstage.name;
        }
        return interview.status.toLowerCase().includes("review")
          ? `Human Interview Review`
          : `Pending Job Offer`;
      }
    }

    if (
      interview.currentStep &&
      !pipelineStageSteps.includes(interview.currentStep)
    ) {
      return `Final Job Offer`;
    }

    if (!interview.currentStep) {
      if (interview.summary) {
        return pipelineStageSteps[1];
      }

      return pipelineStageSteps[0];
    }

    return interview.currentStep;
  }

  function resolveCurrentStageIndex(interview, pipelineStageSteps) {
    const pipelineStages = interview?.pipelineStages || [];

    if (interview?.stageId) {
      const stageIndex = pipelineStages.findIndex(
        (stage) => stage.id === interview.stageId
      );
      if (stageIndex !== -1) {
        return stageIndex;
      }
    }

    const canonicalStep = processCurrentStep(interview);

    if (pipelineStageSteps.includes(canonicalStep)) {
      return pipelineStageSteps.indexOf(canonicalStep);
    }

    if (typeof canonicalStep === "string") {
      if (canonicalStep.endsWith(" Review")) {
        const baseStep = canonicalStep.replace(/ Review$/, "");
        const baseStepIndex = pipelineStageSteps.indexOf(baseStep);
        if (baseStepIndex !== -1) {
          return baseStepIndex;
        }
      }

      if (["Final Job Offer", "Pending Job Offer"].includes(canonicalStep)) {
        const jobOfferIndex = pipelineStageSteps.indexOf("Job Offer");
        if (jobOfferIndex !== -1) {
          return jobOfferIndex;
        }
      }
    }

    const substageStageIndex = pipelineStages.findIndex((stage) =>
      stage?.substages?.some(
        (substage) =>
          substage?.name === canonicalStep || substage?.status === canonicalStep
      )
    );
    if (substageStageIndex !== -1) {
      return substageStageIndex;
    }

    return pipelineStageSteps.indexOf(interview.currentStep);
  }

  // function processDate(date) {
  //   const newDate = new Date(date);
  //   const options: Intl.DateTimeFormatOptions = {
  //     year: "numeric",
  //     month: "short",
  //     day: "numeric",
  //   };

  //   return newDate.toLocaleDateString("en-US", options);
  // }

  function processNoteState(interview, index) {
    if (interview.status == applicationPhase[0] && index == 0) {
      return stepNote[0];
    }

    if (interview.status == applicationPhase[2] && index == 1) {
      return stepNote[1];
    }

    if (interview.status == applicationPhase[4] && index == 2) {
      return stepNote[1];
    }
  }

  function getStatusBadge(interview) {
    const currentStep = processCurrentStep(interview);

    // Needs Your Action - when action is required from user
    if (
      interview.currentStep == "Applied" ||
      (!interview.currentStep && !interview.summary) ||
      (currentStep == "AI Interview" &&
        interview.status == applicationPhase[1]) ||
      (currentStep == "Human Interview" &&
        interview.status == applicationPhase[3])
    ) {
      return {
        text: "Needs Your Action",
        bgColor: "#FFFAEB",
        borderColor: "#FEDF89",
        textColor: "#B54708",
        dotColor: "#B54708",
      };
    }

    // In Review - when something is being reviewed
    if (
      (currentStep == "CV Screening" &&
        interview.status == applicationPhase[0]) ||
      currentStep == "AI Interview Review" ||
      (currentStep == "AI Interview" &&
        interview.status == applicationPhase[2]) ||
      currentStep == "Human Interview Review" ||
      (currentStep == "Human Interview" &&
        interview.status == applicationPhase[4])
    ) {
      return {
        text: "In Review",
        bgColor: "#F8F9FC",
        borderColor: "#D5D9EB",
        textColor: "#363F72",
        dotColor: "#363F72",
      };
    }

    // Completed - when job offer is received
    if (currentStep == "Job Offer" || currentStep == "Final Job Offer") {
      return {
        text: "Completed",
        bgColor: "#ECFDF3",
        borderColor: "#A6F4C5",
        textColor: "#027948",
        dotColor: "#027948",
      };
    }

    return {
      text: "In Review",
      bgColor: "#F8F9FC",
      borderColor: "#D5D9EB",
      textColor: "#363F72",
      dotColor: "#363F72",
    };
  }

  function getDisplayStep(interview) {
    const canonicalStep = processCurrentStep(interview);
    const pipelineStages = interview?.pipelineStages || [];
    
    // For CV Screening or AI Interview stages, use alias if available
    if (canonicalStep === "CV Screening") {
      const cvStage = pipelineStages.find((s) => s.id === "1");
      return cvStage?.alias || canonicalStep;
    }
    
    if (canonicalStep === "AI Interview" || canonicalStep === "AI Interview Review") {
      const aiStage = pipelineStages.find((s) => s.id === "2");
      const aliasName = aiStage?.alias || "AI Interview";
      return canonicalStep === "AI Interview Review" ? `${aliasName} Review` : aliasName;
    }
    
    return canonicalStep;
  }

  function getActionButton(interview) {
    const currentStep = processCurrentStep(interview);

    // Submit CV button
    if (
      interview.currentStep == "Applied" ||
      (!interview.currentStep && !interview.summary)
    ) {
      return {
        text: "Submit CV",
        icon: assetConstants.upload,
        isPrimary: true,
        onClick: () => {
          handleSubmitCV(interview);
        },
      };
    }

    // View Next Steps button - when ready for AI Interview
    if (
      currentStep == "AI Interview" &&
      interview.status == applicationPhase[1]
    ) {
      return {
        text: "View Next Steps",
        icon: assetConstants.arrowV3,
        iconPosition: "right",
        isPrimary: true,
        onClick: () => {
          sessionStorage.setItem("selectedCareer", JSON.stringify(interview));
          setModalType("preScreeningGuide");
        },
      };
    }

    // Request to Retake button - when AI Interview is under review
    if (
      currentStep == "AI Interview Review" ||
      (currentStep == "AI Interview" && interview.status == applicationPhase[2])
    ) {
      return {
        text: "Request to Retake",
        icon: assetConstants.rotateCcw,
        isPrimary: true,
        onClick: () => {
          if (interview.interviewDuration < 5) {
            retakeInterview(interview);
          } else {
            sessionStorage.setItem("selectedCareer", JSON.stringify(interview));
            setModalType("retake");
          }
        },
      };
    }

    // Archive Application button - when Job Offer is received
    if (currentStep == "Job Offer" || currentStep == "Final Job Offer") {
      return {
        text: "Archive Application",
        icon: assetConstants.archiveV2,
        isPrimary: true,
        onClick: () => {
          handleArchive(interview);
        },
      };
    }

    return null;
  }

  function getJourneyTrackerContent(interview) {
    const pipelineStages = interview?.pipelineStages || [];
    const pipelineStageSteps = pipelineStages?.map((stage) => stage.name);
    const currentStep = processCurrentStep(interview);
    const userName = user.name.split(" ")[0];

    // Applied state - before CV submission
    if (
      interview.currentStep == "Applied" ||
      (!interview.currentStep && !interview.summary)
    ) {
      return {
        showBanner: true,
        bannerMessage: `Great start, ${userName}! You're one step closer to your next opportunity.`,
        nextStep: "CV Submission",
        description:
          "Submit your latest CV so we can get a better sense of your experience.",
        tip: "Tip: A clean, well-structured CV makes a solid first impression.",
      };
    }

    // CV Submitted but not yet reviewed
    if (
      currentStep == "CV Screening" &&
      interview.status == applicationPhase[0]
    ) {
      return {
        showBanner: true,
        bannerMessage: `CV submitted! Nice work, ${userName}.`,
        nextStep: "CV Review",
        description:
          "We're going through your CV and seeing how you might fit in. Nothing else to do for now — we'll be in touch once we have an update!",
      };
    }

    // CV Passed - ready for AI Interview
    if (
      currentStep == "AI Interview" &&
      interview.status == applicationPhase[1]
    ) {
      const deadline = interview.deadline || interview.interviewDeadline;
      const deadlineText = deadline
        ? ` on or before ${moment(deadline).format("MMMM D, YYYY")}`
        : "";

      return {
        showBanner: true,
        bannerMessage: `Great progress, ${userName}! You've passed the CV Screening. Keep the momentum going!`,
        nextStep: "AI Interview",
        description: `Complete your AI interview${deadlineText} to stay ahead.`,
        tip: "Want to prepare better? Read our Interview Guide before you start.",
      };
    }

    // AI Interview Complete - under review
    if (
      currentStep == "AI Interview Review" ||
      (currentStep == "AI Interview" && interview.status == applicationPhase[2])
    ) {
      return {
        showBanner: true,
        bannerMessage: `Well done, ${userName}. Your AI Interview is in!`,
        nextStep: "AI Interview Review",
        description:
          "Your responses are on their way to our recruiters! We'll reach out once we've wrapped up the review.",
      };
    }

    // AI Interview Passed - ready for Human Interview
    if (
      (["Human Interview", "Waiting Schedule"].includes(currentStep) &&
        interview.status == applicationPhase[3]) ||
      (currentStep == "Waiting Interview" &&
        interview.status == "For Interview")
    ) {
      return {
        showBanner: true,
        bannerMessage: `You're almost there, ${userName}! Your human interview is up next.`,
        nextStep: "Human Interview",
        description:
          "Our team will reach out via email with your interview schedule. Keep an eye on your inbox and confirm your slot once you receive it!",
      };
    }

    // Human Interview Complete - under review
    if (
      currentStep == "For Review" &&
      interview.status == applicationPhase[4]
    ) {
      return {
        showBanner: true,
        bannerMessage: `That's a wrap, ${userName} — well done on your interview!`,
        nextStep: "Human Interview Review",
        description:
          "Thanks for taking the time to chat with us! We're reviewing everything and will reach out soon with what's next.",
      };
    }

    // Human Interview Passed - Job Offer
    if (currentStep == "Job Offer" || currentStep == "Final Job Offer") {
      return {
        showBanner: true,
        bannerMessage: `Congratulations! You made it to the finish line, ${userName}!`,
        nextStep: "Job Offer",
        description:
          "Our HR team is preparing your job offer and will send it to your email soon. We can't wait to welcome you aboard!",
        tip: "Tip: Take time to review your offer and celebrate how far you've come!",
      };
    }

    // Default/fallback
    return null;
  }

  function processState(interview, step, isAdvance: boolean = false) {
    const pipelineStageSteps = interview?.pipelineStages?.map(
      (stage) => stage.name
    );
    const stepIndex = pipelineStageSteps.indexOf(step);
    const currentStepIndex = resolveCurrentStageIndex(
      interview,
      pipelineStageSteps
    );

    if (stepIndex === -1) {
      return stepStatus[1];
    }

    if (interview.currentStep == "Applied" && currentStepIndex == -1) {
      if (stepIndex == 0) {
        return isAdvance ? stepStatus[2] : stepStatus[1];
      }
    }

    // old data
    if (interview.currentStep == "Job Interview" && currentStepIndex == -1) {
      const humanInterviewIndex = pipelineStageSteps.indexOf("Human Interview");
      if (stepIndex == humanInterviewIndex) {
        return stepStatus[2];
      }
      if (stepIndex > humanInterviewIndex) {
        return stepStatus[1];
      }
    }

    if (currentStepIndex != -1) {
      if (stepIndex < currentStepIndex) {
        return stepStatus[0];
      }

      if (stepIndex > currentStepIndex) {
        return stepStatus[1];
      }

      return stepStatus[2];
    }

    if (
      interview.currentStep &&
      currentStepIndex == -1 &&
      interview.currentStep != "Applied"
    ) {
      return stepStatus[0];
    }

    return stepStatus[1];
  }

  useEffect(() => {
    fetchInterviews();
  }, []);

  useEffect(() => {
    if (activeTab) {
      let filteredInterviews;

      if (activeTab.name == tabs[0].name) {
        filteredInterviews = [...activeInterviews];
      } else {
        filteredInterviews = [...archivedInterviews];
      }

      if (search.trim()) {
        const fuse = new Fuse(filteredInterviews, {
          threshold: 0.3,
          keys: ["jobTitle"],
        });
        const searchResults = fuse.search(search.trim());

        filteredInterviews = searchResults.map((res) => res.item);
      }

      if (activeTab.name == tabs[0].name) {
        setFilteredActiveInterview(filteredInterviews);
      } else {
        setFilteredArchiveInterview(filteredInterviews);
      }
    }
  }, [activeTab, search]);

  function fetchInterviews() {
    api
      .post("/api/job-portal/fetch-interviews", {
        email: user.email,
        interviewID: "all",
      })
      .then((res) => {
        const result = res.data;
        
        // Filter by subdomain if present
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        const subdomain = extractSubdomain(hostname);
        
        const filteredResult = subdomain 
          ? result.filter((interview) => interview.organization?.brandedJobPortalSubdomain === subdomain)
          : result;

        const activeInterviews = filteredResult.filter(
          (interview) => interview.archived !== true
        );
        const archivedInterviews = filteredResult.filter(
          (interview) => interview.archived === true
        );

        setActiveInterviews(activeInterviews);
        setArchivedInterviews(archivedInterviews);
        setFilterValue(filters[0]);
        setFilteredActiveInterview(activeInterviews);
        setFilteredArchiveInterview(archivedInterviews);
      })
      .catch((err) => {
        alert("Error fetching interviews.");
        console.log(err);
      })
      .finally(() => {
        setActiveTab(tabs[0]);
      });
  }

  function manageInterview(data) {
    setModalType("loading");

    api
      .post("/api/whitecloak/manage-application", data)
      .then(() => {
        location.reload();
      })
      .catch((err) => {
        console.log(err);
        alert(err.response.data.message || "Job management failed.");
        setModalType(null);
      });
  }

  function retakeInterview(interview) {
    setModalType("loading");

    api
      .post("/api/reset-interview-data", {
        id: interview._id,
      })
      .then((res) => {
        const result = res.data;

        if (result.success) {
          window.location.href = `/interview/${interview.interviewID}`;
        } else {
          alert("Failed to submit retake interview.");
        }
      })
      .catch((err) => {
        alert("Failed to submit retake interview.");
        console.log(err);
      })
      .finally(() => {
        setModalType(null);
      });
  }

  return (
    <div className={styles.dashboard}>
      <PhoneVerificationModal
        opened={
          isPhoneVerificationModalOpen &&
          (phoneVerificationStep === "phone" || phoneVerificationStep === "otp")
        }
        onClose={closePhoneVerificationModal}
        onBack={handleBackToPhone}
        step={phoneVerificationStep === "otp" ? "otp" : "phone"}
        organizationLogo={pendingUploadInterview?.organization?.image}
        organizationName={pendingUploadInterview?.organization?.name}
        mobileNumber={mobileNumber}
        mobileNumberError={mobileNumberError}
        onMobileNumberChange={(value) => {
          setMobileNumber(
            sanitizeInternationalPhoneInput(value, inferPhoneCountry(mobileNumber))
          );
          if (mobileNumberError) {
            setMobileNumberError("");
          }
        }}
        isRequestingOtp={isRequestingOtp}
        onNext={handlePhoneVerificationNext}
        maskedMobileNumber={maskedMobileNumber}
        otpError={otpError}
        otpCountdown={otpCountdown}
        onOtpDigitChange={handleOtpDigitChange}
        onOtpComplete={onComplete}
        onResendOtp={handleResendOtp}
        isVerifyingOtp={isVerifyingOtp}
        onVerifyOtp={handleVerifyOtp}
      />

      <div className={styles.infoFilter}>
        <div className={styles.textContainer}>
          <span className={styles.name}>
            Welcome, {user.name.split(" ")[0]}!
          </span>
          <span className={styles.description}>
            Here are your pending job applications.
          </span>
        </div>

        <div className={styles.buttonContainer}>
          <button
            className="secondaryBtn"
            onClick={() => setFilterDropdown(!filterDropdown)}
            style={{ display: "none" }}
          >
            <img alt="" src={assetConstants.filter} />
            {filterValue ? filterValue : "Filters"}
          </button>

          {filterDropdown && (
            <div className={styles.filterDropdownContainer}>
              {filters.map((item, index) => (
                <span
                  key={index}
                  className={`${item == filterValue ? styles.active : ""}`}
                  onClick={() => {
                    setFilterDropdown(false);
                    setFilterValue(item);
                  }}
                >
                  {item}
                  {item == filterValue && (
                    <img alt="" src={assetConstants.checkV5} />
                  )}
                </span>
              ))}
            </div>
          )}

          <Field
            autoComplete="off"
            className={styles.searchField}
            inputClassName={styles.searchInput}
            name="dashboard-search"
            section={<SearchMd />}
            type="search"
            placeholder="Search"
            value={search}
            onBlur={(e) => {
              e.target.placeholder = "Search";
            }}
            onFocus={(e) => {
              (e.target as HTMLInputElement).placeholder = "";
            }}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {user && !isUserRevalidating && !user?.talentVault?.profileId && isTalentVaultEnabled(user?.email ?? "") && (
        <div className={styles.invitationBannerContainer}>
          <InvitationBanner />
        </div>
      )}

      <div className={styles.tabContainer}>
        {activeTab ? (
          tabs.map((tab, index) => (
            <div key={index} onClick={() => handleActiveTab(tab)}>
              <span className={styles.tab}>
                <img alt="" src={tab.image} />
                {tab.name}
                <span>{tab.value}</span>
              </span>
              {activeTab.name == tab.name && <hr />}
            </div>
          ))
        ) : (
          <>
            <div className={styles.loadingContainer}>
              <div className={styles.loading} />
            </div>
            <div className={styles.loadingContainer}>
              <div className={styles.loading} />
            </div>
          </>
        )}
      </div>

      {activeTab ? (
        ((filteredActiveInterview.length == 0 &&
          activeTab.name == tabs[0].name) ||
          (filteredArchiveInterview.length == 0 &&
            activeTab.name == tabs[1].name)) && (
          <div className={styles.gradientContainer}>
            <div className={styles.emptyContainer}>
              <span className={styles.emptyTitle}>
                {activeTab.name == tabs[0].name
                  ? "No Applications Yet"
                  : "Nothing Yet"}
              </span>
              <span className={styles.emptyDescription}>
                {activeTab.name == tabs[0].name
                  ? "You haven’t applied to any roles yet."
                  : "You haven’t archived any roles yet."}
              </span>
              <span className={styles.emptyDescription}>
                Once you do, they’ll appear here.
              </span>
              <button onClick={handleBrowseJob}>
                Browse Job Openings
                <img alt="arrow" src={assetConstants.arrow} />
              </button>
            </div>
          </div>
        )
      ) : (
        <Loader loaderType={"application"} loaderData={{ length: 10 }} />
      )}

      {activeTab && (
        <>
          {filteredActiveInterview.length > 0 &&
            activeTab.name == tabs[0].name && (
              <div className={styles.applicationContainer}>
                {filteredActiveInterview.map((interview, index) => (
                  <div
                    className={styles.applicationDetailsContainer}
                    key={index}
                  >
                    <div
                      className={`${styles.titleContainer} ${
                        interview.applicationStatus != interviewStatus[0]
                          ? styles.disabled
                          : activeInterviewIndex == index
                          ? styles.active
                          : ""
                      }`}
                      onClick={() => handleApplication(interview, index)}
                    >
                      {interview.organization &&
                        interview.organization.image && (
                          <img
                            alt=""
                            className={styles.companyLogo}
                            src={interview.organization.image}
                          />
                        )}

                      <div className={styles.companyDetailsContainer}>
                        <span className={styles.jobTitle}>
                          {typeof window !== "undefined" ? new DOMParser().parseFromString(interview.jobTitle, "text/html").body.textContent : interview.jobTitle}
                        </span>
                        {interview.organization &&
                          interview.organization.name && (
                            <span className={styles.companyName}>
                              {interview.organization.name}
                            </span>
                          )}
                      </div>

                      {/* <div
                        className={`webView ${styles.applicationStatusContainer}`}
                      >
                        <span className={styles.statusTitle}>Stage</span>
                        <span className={styles.statusValue}>
                          {processCurrentStep(interview)}
                        </span>
                      </div> */}

                      {/* <div
                        className={`webView ${styles.applicationStatusContainer}`}
                      >
                        <span className={styles.statusTitle}>
                          Stage Updated
                        </span>
                        <span className={styles.statusValue}>
                          {[interviewStatus[1], interviewStatus[3]].includes(
                            interview.applicationStatus
                          )
                            ? processDisplayDate(
                                interview.completedAt || interview.updatedAt
                              )
                            : processDisplayDate(interview.updatedAt)}
                        </span>
                      </div> */}

                      <div
                        className={`webView ${styles.applicationStatusContainer}`}
                      >
                        <div className={styles.nextStepContainer}>
                          <span className={styles.statusTitle}>Next Step:</span>
                          <span className={styles.statusValue}>
                            {getDisplayStep(interview)}
                          </span>
                        </div>
                        {(() => {
                          const statusBadge = getStatusBadge(interview);
                          if (statusBadge) {
                            return (
                              <div
                                className={styles.statusBadge}
                                style={{
                                  backgroundColor: statusBadge.bgColor,
                                  borderColor: statusBadge.borderColor,
                                  color: statusBadge.textColor,
                                }}
                              >
                                <div
                                  className={styles.statusBadgeDot}
                                  style={{
                                    backgroundColor: statusBadge.dotColor,
                                  }}
                                ></div>
                                <span>{statusBadge.text}</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {interview.applicationStatus == interviewStatus[0] && (
                        <img
                          alt="ellipsis"
                          className={styles.menu}
                          src={assetConstants.ellipsis}
                          onClick={(e) => handleDropdown(e, index)}
                        />
                      )}
                    </div>

                    {viewDropdown == index && (
                      <div className={styles.dropDownContainer}>
                        {dropdownItems.map((item, index) => (
                          <span
                            key={index}
                            onClick={() => item.handleClick(interview)}
                          >
                            {item.text}
                          </span>
                        ))}
                      </div>
                    )}

                    {interview.applicationStatus == interviewStatus[0] &&
                      activeInterviewIndex == index && (
                        <div className={styles.bottomContainer}>
                          {/* Make changes here */}
                          {/* DO NOT REMOVE COMMENTED OUT CODE */}
                          {(() => {
                            const journeyContent =
                              getJourneyTrackerContent(interview);
                            if (!journeyContent) return null;

                            return (
                              <div className={styles.journeyTrackerContainer}>
                                {journeyContent.showBanner && (
                                  <div className={styles.banner}>
                                    <img
                                      alt="Party popper"
                                      src={assetConstants.partyPopper}
                                    />
                                    <span>{journeyContent.bannerMessage}</span>
                                  </div>
                                )}
                                <div className={styles.journeyTracker}>
                                  <div className={styles.journeyContent}>
                                    <div className={styles.gradientIcon}>
                                      <img
                                        alt="Gradient icon"
                                        src={assetConstants.gradientIcon}
                                      />
                                    </div>
                                    <div className={styles.journeyText}>
                                      <div className={styles.nextStepHeader}>
                                        <span className={styles.nextStepLabel}>
                                          Next Step: {journeyContent.nextStep}
                                        </span>
                                      </div>
                                      <div
                                        className={styles.journeyDescription}
                                      >
                                        <span>
                                          {journeyContent.description}
                                        </span>
                                        {journeyContent.tip && (
                                          <span className={styles.tip}>
                                            {journeyContent.tip.includes(
                                              "Interview Guide"
                                            ) ? (
                                              <>
                                                {
                                                  journeyContent.tip.split(
                                                    "Interview Guide"
                                                  )[0]
                                                }
                                                <span
                                                  onClick={() => {
                                                    sessionStorage.setItem(
                                                      "selectedCareer",
                                                      JSON.stringify(interview)
                                                    );
                                                    setModalType(
                                                      "preScreeningGuide"
                                                    );
                                                  }}
                                                  style={{
                                                    cursor: "pointer",
                                                    textDecoration: "underline",
                                                  }}
                                                >
                                                  Interview Guide
                                                </span>
                                                {
                                                  journeyContent.tip.split(
                                                    "Interview Guide"
                                                  )[1]
                                                }
                                              </>
                                            ) : (
                                              journeyContent.tip
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          {/* <div className={styles.applicationStepContainer}>
                            {interview.pipelineStages.map((step: {name: string, substages: {currentStep: string, status: string}[]}, index) => (
                              <div className={styles.stepContainer} key={index}>
                                <div className={styles.indicator}>
                                  <img
                                    alt=""
                                    src={
                                      assetConstants[
                                        processState(interview, step.name, true)
                                          .toLowerCase()
                                          .replace(" ", "_")
                                      ]
                                    }
                                  />

                                  <div className={styles.stepDetails}>
                                    <span
                                      className={`mobileView ${
                                        styles.stepNumber
                                      } ${
                                        styles[
                                          processState(interview, step.name, true)
                                            .toLowerCase()
                                            .replace(" ", "_")
                                        ]
                                      }`}
                                    >
                                      STEP {index + 1}
                                    </span>
                                    <span
                                      className={`mobileView ${
                                        styles.stepDescription
                                      } ${
                                        styles[
                                          processState(interview, step.name, true)
                                            .toLowerCase()
                                            .replace(" ", "_")
                                        ]
                                      }`}
                                    >
                                      {step.name}
                                    </span>

                                    <span
                                      className={`mobileView ${styles.stepNote}`}
                                    >
                                      {processNoteState(interview, index)}
                                    </span>
                                  </div>

                                  {index < interview.pipelineStages.length - 1 && (
                                    <hr
                                      className={`webView ${
                                        styles[
                                          processState(interview, step.name)
                                            .toLowerCase()
                                            .replace(" ", "_")
                                        ]
                                      }`}
                                    />
                                  )}
                                </div>
                                <div className={styles.stepDetails}>
                                  <span
                                    className={`webView ${styles.stepNumber} ${
                                      styles[
                                        processState(interview, step.name, true)
                                          .toLowerCase()
                                          .replace(" ", "_")
                                      ]
                                    }`}
                                  >
                                    STEP {index + 1}
                                  </span>
                                  <span
                                    className={`webView ${
                                      styles.stepDescription
                                    } ${
                                      styles[
                                        processState(interview, step.name, true)
                                          .toLowerCase()
                                          .replace(" ", "_")
                                      ]
                                    }`}
                                  >
                                    {step.name}
                                  </span>
                                  <span
                                    className={`${styles.stepStatus} ${
                                      styles[
                                        processState(interview, step.name)
                                          .toLowerCase()
                                          .replace(" ", "_")
                                      ]
                                    }`}
                                  >
                                    {processState(interview, step.name)}
                                  </span>

                                  <span
                                    className={`webView ${styles.stepNote}`}
                                  >
                                    {processNoteState(interview, index)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div> */}

                          {/* OLD BUTTON CODE - COMMENTED OUT */}
                          {/* {processButtonState(interview) && (
                            <div className={styles.buttonContainer}>
                              {interview.retakeRequest &&
                                interview.retakeRequest.reason && (
                                  <div className={styles.hoverContainer}>
                                    <span>
                                      You've already submitted a retake request
                                      for this application.
                                    </span>
                                  </div>
                                )}
                              <span>
                                {processButtonState(interview).spanText}:
                              </span>
                              <button
                                className={`${
                                  processButtonState(interview).disabled ||
                                  (interview.retakeRequest &&
                                    interview.retakeRequest.reason)
                                    ? "disabled"
                                    : ""
                                }`}
                                disabled={
                                  (interview.retakeRequest &&
                                    interview.retakeRequest.reason) ||
                                  processButtonState(interview).disabled
                                }
                                onClick={() =>
                                  processButtonState(interview).handleClick(
                                    interview
                                  )
                                }
                              >
                                {processButtonState(interview).buttonText}
                              </button>
                            </div>
                          )} */}

                          <div className={styles.buttonSection}>
                            <div className={styles.buttonSectionRow}>
                              <button
                                className={styles.secondaryButton}
                                onClick={() => {
                                  sessionStorage.setItem(
                                    "selectedCareer",
                                    JSON.stringify(interview)
                                  );
                                  setModalType("journeyTracker");
                                }}
                              >
                                <img
                                  alt="trending up"
                                  src={assetConstants.trendingUp}
                                />
                                <span>View My Progress</span>
                              </button>
                              {(() => {
                                const actionButton = getActionButton(interview);
                                if (actionButton) {
                                  return (
                                    <button
                                      className={
                                        actionButton.isPrimary
                                          ? styles.primaryButton
                                          : styles.secondaryButton
                                      }
                                      onClick={actionButton.onClick}
                                      disabled={
                                        interview.retakeRequest &&
                                        interview.retakeRequest.reason
                                      }
                                    >
                                      {actionButton.iconPosition !== "right" &&
                                        actionButton.icon && (
                                          <img alt="" src={actionButton.icon} />
                                        )}
                                      <span>{actionButton.text}</span>
                                      {actionButton.iconPosition === "right" &&
                                        actionButton.icon && (
                                          <img alt="" src={actionButton.icon} />
                                        )}
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        </div>
                      )}

                    {interview.applicationStatus == interviewStatus[1] && (
                      <div className={styles.updateContainer}>
                        <div className={styles.applicationUpdate}>
                          <img alt="" src={assetConstants.userRejected} />
                          <div className={styles.textContainer}>
                            <span className={styles.title}>
                              Application Update
                            </span>
                            <span className={styles.description}>
                              {interview.currentStep &&
                              interviewStatus.includes(interview.currentStep)
                                ? droppedStatus[interview.currentStep]
                                    .description
                                : droppedStatus.generic.description}
                            </span>
                          </div>
                        </div>

                        <div className={styles.tipsUpdate}>
                          <div className={styles.leftContainer}>
                            <img alt="" src={assetConstants.hilight} />
                            <div className={styles.textContainer}>
                              <span className={styles.title}>
                                Jia's tips for your next application:
                              </span>
                              <ul>
                                {(interview.currentStep &&
                                interviewStatus.includes(interview.currentStep)
                                  ? droppedStatus[interview.currentStep].tips
                                  : droppedStatus.generic.tips
                                ).map((item, index) => (
                                  <li key={index}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <div className={styles.rightContainer}></div>
                        </div>
                        <button onClick={() => handleArchive(interview)}>
                          <img alt="" src={assetConstants.archiveV2} />
                          Archive Application
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          {filteredArchiveInterview.length > 0 &&
            activeTab.name == tabs[1].name && (
              <div className={styles.applicationContainer}>
                {filteredArchiveInterview.map((interview, index) => (
                  <div
                    className={styles.applicationDetailsContainer}
                    key={index}
                  >
                    <div
                      className={`${styles.titleContainer} ${
                        interview.applicationStatus != interviewStatus[0]
                          ? styles.disabled
                          : activeInterviewIndex == index
                          ? styles.active
                          : ""
                      }`}
                      onClick={() => handleApplication(interview, index)}
                    >
                      {interview.organization &&
                        interview.organization.image && (
                          <img
                            alt=""
                            className={styles.companyLogo}
                            src={interview.organization.image}
                          />
                        )}

                      <div className={styles.companyDetailsContainer}>
                        <span className={styles.jobTitle}>
                          {typeof window !== "undefined" ? new DOMParser().parseFromString(interview.jobTitle, "text/html").body.textContent : interview.jobTitle}
                        </span>
                        {interview.organization &&
                          interview.organization.name && (
                            <span className={styles.companyName}>
                              {interview.organization.name}
                            </span>
                          )}
                      </div>

                      <div
                        className={`webView ${styles.applicationStatusContainer}`}
                      >
                        <span className={styles.statusTitle}>Stage</span>
                        <span className={styles.statusValue}>
                          {processCurrentStep(interview)}
                        </span>
                      </div>

                      <div
                        className={`webView ${styles.applicationStatusContainer}`}
                      >
                        <span className={styles.statusTitle}>
                          Stage Updated
                        </span>
                        <span className={styles.statusValue}>
                          {[interviewStatus[1], interviewStatus[3]].includes(
                            interview.applicationStatus
                          )
                            ? processDisplayDate(
                                interview.completedAt || interview.updatedAt
                              )
                            : processDisplayDate(interview.updatedAt)}
                        </span>
                      </div>

                      {(() => {
                        const statusBadge = getStatusBadge(interview);
                        if (statusBadge) {
                          return (
                            <div
                              className={styles.statusBadge}
                              style={{
                                backgroundColor: statusBadge.bgColor,
                                borderColor: statusBadge.borderColor,
                                color: statusBadge.textColor,
                              }}
                            >
                              <div
                                className={styles.statusBadgeDot}
                                style={{
                                  backgroundColor: statusBadge.dotColor,
                                }}
                              ></div>
                              <span>{statusBadge.text}</span>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {interview.applicationStatus == interviewStatus[0] && (
                        <img
                          alt="ellipsis"
                          className={styles.menu}
                          src={assetConstants.ellipsis}
                          onClick={(e) => handleDropdown(e, index)}
                        />
                      )}
                    </div>

                    {viewDropdown == index && (
                      <div className={styles.dropDownContainer}>
                        {dropdownItems.map((item, index) => (
                          <span
                            key={index}
                            onClick={() => item.handleClick(interview)}
                          >
                            {item.text}
                          </span>
                        ))}
                      </div>
                    )}

                    {interview.applicationStatus == interviewStatus[0] &&
                      activeInterviewIndex == index && (
                        <div className={styles.bottomContainer}>
                          {/* Make changes here */}
                          {/* DO NOT REMOVE COMMENTED OUT CODE */}
                          {(() => {
                            const journeyContent =
                              getJourneyTrackerContent(interview);
                            if (!journeyContent) return null;

                            return (
                              <div className={styles.journeyTrackerContainer}>
                                {journeyContent.showBanner && (
                                  <div className={styles.banner}>
                                    <img
                                      alt="Party popper"
                                      src={assetConstants.partyPopper}
                                    />
                                    <span>{journeyContent.bannerMessage}</span>
                                  </div>
                                )}
                                <div className={styles.journeyTracker}>
                                  <div className={styles.journeyContent}>
                                    <div className={styles.gradientIcon}>
                                      <img
                                        alt="Gradient icon"
                                        src={assetConstants.gradientIcon}
                                      />
                                    </div>
                                    <div className={styles.journeyText}>
                                      <div className={styles.nextStepHeader}>
                                        <span className={styles.nextStepLabel}>
                                          Next Step: {journeyContent.nextStep}
                                        </span>
                                      </div>
                                      <div
                                        className={styles.journeyDescription}
                                      >
                                        <span>
                                          {journeyContent.description}
                                        </span>
                                        {journeyContent.tip && (
                                          <span className={styles.tip}>
                                            {journeyContent.tip.includes(
                                              "Interview Guide"
                                            ) ? (
                                              <>
                                                {
                                                  journeyContent.tip.split(
                                                    "Interview Guide"
                                                  )[0]
                                                }
                                                <span
                                                  onClick={() => {
                                                    sessionStorage.setItem(
                                                      "selectedCareer",
                                                      JSON.stringify(interview)
                                                    );
                                                    setModalType(
                                                      "preScreeningGuide"
                                                    );
                                                  }}
                                                  style={{
                                                    cursor: "pointer",
                                                    textDecoration: "underline",
                                                  }}
                                                >
                                                  Interview Guide
                                                </span>
                                                {
                                                  journeyContent.tip.split(
                                                    "Interview Guide"
                                                  )[1]
                                                }
                                              </>
                                            ) : (
                                              journeyContent.tip
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          {/* <div className={styles.applicationStepContainer}>
                            {interview.pipelineStages.map((step: {name: string, substages: {currentStep: string, status: string}[]}, index) => (
                              <div className={styles.stepContainer} key={index}>
                                <div className={styles.indicator}>
                                  <img
                                    alt=""
                                    src={
                                      assetConstants[
                                        processState(interview, step.name, true)
                                          .toLowerCase()
                                          .replace(" ", "_")
                                      ]
                                    }
                                  />

                                  <div className={styles.stepDetails}>
                                    <span
                                      className={`mobileView ${
                                        styles.stepNumber
                                      } ${
                                        styles[
                                          processState(interview, step.name, true)
                                            .toLowerCase()
                                            .replace(" ", "_")
                                        ]
                                      }`}
                                    >
                                      STEP {index + 1}
                                    </span>
                                    <span
                                      className={`mobileView ${
                                        styles.stepDescription
                                      } ${
                                        styles[
                                          processState(interview, step.name, true)
                                            .toLowerCase()
                                            .replace(" ", "_")
                                        ]
                                      }`}
                                    >
                                      {step.name}
                                    </span>

                                    <span
                                      className={`mobileView ${styles.stepNote}`}
                                    >
                                      {processNoteState(interview, index)}
                                    </span>
                                  </div>

                                  {index < interview.pipelineStages.length - 1 && (
                                    <hr
                                      className={`webView ${
                                        styles[
                                          processState(interview, step.name)
                                            .toLowerCase()
                                            .replace(" ", "_")
                                        ]
                                      }`}
                                    />
                                  )}
                                </div>
                                <div className={styles.stepDetails}>
                                  <span
                                    className={`webView ${styles.stepNumber} ${
                                      styles[
                                        processState(interview, step.name, true)
                                          .toLowerCase()
                                          .replace(" ", "_")
                                      ]
                                    }`}
                                  >
                                    STEP {index + 1}
                                  </span>
                                  <span
                                    className={`webView ${
                                      styles.stepDescription
                                    } ${
                                      styles[
                                        processState(interview, step.name, true)
                                          .toLowerCase()
                                          .replace(" ", "_")
                                      ]
                                    }`}
                                  >
                                    {step.name}
                                  </span>
                                  <span
                                    className={`${styles.stepStatus} ${
                                      styles[
                                        processState(interview, step.name)
                                          .toLowerCase()
                                          .replace(" ", "_")
                                      ]
                                    }`}
                                  >
                                    {processState(interview, step.name)}
                                  </span>

                                  <span
                                    className={`webView ${styles.stepNote}`}
                                  >
                                    {processNoteState(interview, index)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div> */}

                          {/* OLD BUTTON CODE - COMMENTED OUT */}
                          {/* {processButtonState(interview) && (
                            <div className={styles.buttonContainer}>
                              {interview.retakeRequest &&
                                interview.retakeRequest.reason && (
                                  <div className={styles.hoverContainer}>
                                    <span>
                                      You've already submitted a retake request
                                      for this application.
                                    </span>
                                  </div>
                                )}
                              <span>
                                {processButtonState(interview).spanText}:
                              </span>
                              <button
                                className={`${
                                  processButtonState(interview).disabled ||
                                  (interview.retakeRequest &&
                                    interview.retakeRequest.reason)
                                    ? "disabled"
                                    : ""
                                }`}
                                disabled={
                                  (interview.retakeRequest &&
                                    interview.retakeRequest.reason) ||
                                  processButtonState(interview).disabled
                                }
                                onClick={() =>
                                  processButtonState(interview).handleClick(
                                    interview
                                  )
                                }
                              >
                                {processButtonState(interview).buttonText}
                              </button>
                            </div>
                          )} */}

                          <div className={styles.buttonSection}>
                            <div className={styles.buttonSectionRow}>
                              <button
                                className={styles.secondaryButton}
                                onClick={() => {
                                  sessionStorage.setItem(
                                    "selectedCareer",
                                    JSON.stringify(interview)
                                  );
                                  setModalType("journeyTracker");
                                }}
                              >
                                <img
                                  alt="trending up"
                                  src={assetConstants.trendingUp}
                                />
                                <span>View My Progress</span>
                              </button>
                              {(() => {
                                const actionButton = getActionButton(interview);
                                if (actionButton) {
                                  return (
                                    <button
                                      className={
                                        actionButton.isPrimary
                                          ? styles.primaryButton
                                          : styles.secondaryButton
                                      }
                                      onClick={actionButton.onClick}
                                      disabled={
                                        interview.retakeRequest &&
                                        interview.retakeRequest.reason
                                      }
                                    >
                                      {actionButton.iconPosition !== "right" &&
                                        actionButton.icon && (
                                          <img alt="" src={actionButton.icon} />
                                        )}
                                      <span>{actionButton.text}</span>
                                      {actionButton.iconPosition === "right" &&
                                        actionButton.icon && (
                                          <img alt="" src={actionButton.icon} />
                                        )}
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        </div>
                      )}

                    {interview.applicationStatus == interviewStatus[1] && (
                      <div className={styles.updateContainer}>
                        <div className={styles.applicationUpdate}>
                          <img alt="" src={assetConstants.userRejected} />
                          <div className={styles.textContainer}>
                            <span className={styles.title}>
                              Application Update
                            </span>
                            <span className={styles.description}>
                              {interview.currentStep &&
                              interviewStatus.includes(interview.currentStep)
                                ? droppedStatus[interview.currentStep]
                                    .description
                                : droppedStatus.generic.description}
                            </span>
                          </div>
                        </div>

                        <div className={styles.tipsUpdate}>
                          <div className={styles.leftContainer}>
                            <img alt="" src={assetConstants.hilight} />
                            <div className={styles.textContainer}>
                              <span className={styles.title}>
                                Jia's tips for your next application:
                              </span>
                              <ul>
                                {(interview.currentStep &&
                                interviewStatus.includes(interview.currentStep)
                                  ? droppedStatus[interview.currentStep].tips
                                  : droppedStatus.generic.tips
                                ).map((item, index) => (
                                  <li key={index}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <div className={styles.rightContainer}></div>
                        </div>
                      </div>
                    )}

                    {interview.applicationStatus == interviewStatus[3] && (
                      <div
                        className={`${styles.updateContainer} ${styles.cancelled}`}
                      >
                        <div className={styles.applicationUpdate}>
                          <img alt="" src={assetConstants.trash} />
                          <div className={styles.textContainer}>
                            <span className={styles.title}>
                              Application Update
                            </span>
                            <span className={styles.description}>
                              This application is no longer active.
                            </span>
                          </div>
                        </div>

                        <div className={styles.statusDetails}>
                          <div className={styles.detailsContainer}>
                            <span className={styles.detailsTitle}>Status:</span>
                            <span className={styles.detailsStatus}>
                              {interview.applicationStatus}
                            </span>
                          </div>

                          <div className={styles.detailsContainer}>
                            <span className={styles.detailsTitle}>
                              Cancelled on:
                            </span>
                            <span className={styles.detailsDate}>
                              {processDisplayDate(
                                interview.completedAt || interview.updatedAt
                              )}
                            </span>
                          </div>

                          <div className={styles.detailsContainer}>
                            <span className={styles.detailsTitle}>
                              Reason for cancelling:
                            </span>
                            <span className={styles.detailsReason}>
                              {interview.selectedReason != "Others" ? (
                                interview.selectedReason
                              ) : (
                                <>
                                  {interview.selectedReason}:{" "}
                                  <span>{interview.cancelReason}</span>
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
        </>
      )}
    </div>
  );
}
