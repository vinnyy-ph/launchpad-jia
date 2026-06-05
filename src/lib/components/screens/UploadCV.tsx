// TODO (Job Portal) - Check API

"use client";

import Loader from "@/lib/components/commonV2/Loader";
import PhoneVerificationModal from "@/lib/components/PhoneVerification/PhoneVerificationModal";
import styles from "@/lib/styles/screens/uploadCV.module.scss";
import { usePasscodeValue } from "@/lib/hooks/usePasscodeValue";
import { usePhoneVerificationFlow } from "@/lib/hooks/usePhoneVerificationFlow";
import { useAppContext } from "@/lib/context/ContextV2";
import { assetConstants, pathConstants } from "@/lib/utils/constantsV2";
import { checkFile } from "@/lib/utils/helpersV2";
import {
  inferPhoneCountry,
  sanitizeInternationalPhoneInput,
} from "@/lib/utils/phoneInput";

import { CORE_API_URL } from "@/lib/Utils";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/utils/apiClient";
import ErrorBoundary from "@/lib/components/ErrorBoundary";
import { customLog } from "@/lib/CustomLogs";
import { decodeHtmlEntities } from "@/lib/utils/sanitizeInput";
import SkillTagInput from "../CandidateComponents/SkillTagInput";
import { SkillTag } from "../CandidateComponents/SkillTag";
import Field from "@/lib/components/ui/field/Field";
import Image from "next/image";
import { Textarea } from "../ui";
import IntroductionSectionContent from "./IntroductionSectionContent";
import ContactInfoSectionContent from "./ContactInfoSectionContent";
import ExperienceSectionContent from "./ExperienceSectionContent";
import EducationSectionContent from "./EducationSectionContent";
import ProjectsSectionContent from "./ProjectsSectionContent";
import CertificationsSectionContent from "./CertificationsSectionContent";
import AwardsSectionContent from "./AwardsSectionContent";
import SkillsSectionContent from "./SkillsSectionContent";
import IntroductionModal from "./IntroductionModal";
import ContactInfoModal from "./ContactInfoModal";
import ExperienceModal, { ExperienceItem } from "./ExperienceModal";
import SkillModal from "./SkillModal";
import EducationModal, { EducationItem } from "./EducationModal";
import ProjectsModal, { ProjectItem } from "./ProjectsModal";
import CertificationModal, { CertificationItem } from "./CertificationModal";
import AwardModal, { AwardItem } from "./AwardModal";
import {
  buildStructuredCVFromDigitalCV,
  normalizeStructuredCVInput,
} from "@/lib/utils/structuredCV";
import ManualProfileWizard from "@/lib/components/ManualProfile/ManualProfileWizard";

const PHONE_VERIFICATION_RECAPTCHA_ID = "upload-cv-recaptcha-container";

export default function () {
  const fileInputRef = useRef(null);
  const { user, setModalType } = useAppContext();
  const lockedEmail = typeof user?.email === "string" ? user.email.trim() : "";
  const [buildingCV, setBuildingCV] = useState(false);
  const [showManualWizard, setShowManualWizard] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [digitalCV, setDigitalCV] = useState(null);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [showIntroductionModal, setShowIntroductionModal] = useState(false);
  const [introductionValue, setIntroductionValue] = useState("");
  const [showContactInfoModal, setShowContactInfoModal] = useState(false);
  const [contactInfoData, setContactInfoData] = useState(null);
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
  const [file, setFile] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState(null);
  const [screeningResult, setScreeningResult] = useState(null);
  const [userCV, setUserCV] = useState(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [initialSkills, setInitialSkills] = useState<string[]>([]);
  const MAX_SKILLS = 60;
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isScreening, setIsScreening] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPhoneGatePassed, setIsPhoneGatePassed] = useState(false);
  const [isPhoneVerificationModalOpen, setIsPhoneVerificationModalOpen] =
    useState(false);
  const [phoneVerificationStep, setPhoneVerificationStep] = useState<
    "phone" | "otp" | "contact"
  >("phone");
  const [mobileNumber, setMobileNumber] = useState("");
  const [mobileNumberError, setMobileNumberError] = useState("");
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [maskedMobileNumber, setMaskedMobileNumber] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpCountdown, setOtpCountdown] = useState(105);
  const { passcode, onDigitChange, onComplete, reset } = usePasscodeValue();
  const cvSections = [
    "Introduction",
    "Contact Info",
    "Skills",
    "Experience",
    "Education",
    "Projects",
    "Certifications",
    "Awards",
  ];
  const [step, setStep] = useState(["Submit CV", "CV Screening", "Review"]);
  const stepStatus = ["Completed", "Pending", "In Progress"];
  const [viewDropdown, setViewDropdown] = useState(null);
  const [preScreeningQuestions, setPreScreeningQuestions] = useState([]);
  const structuredSections = [
    "Contact Info",
    "Experience",
    "Education",
    "Projects",
    "Certifications",
    "Awards",
  ];
  const DEFAULT_EXPERIENCE_DATA: ExperienceItem[] = [];
  const DEFAULT_EDUCATION_DATA: EducationItem[] = [];
  const DEFAULT_PROJECTS_DATA: ProjectItem[] = [];
  const DEFAULT_CERTIFICATIONS_DATA: CertificationItem[] = [];
  const DEFAULT_AWARDS_DATA: AwardItem[] = [];
  const normalizeContactInfo = (
    contactInfo: any,
    preserveVerifiedContact?: { phone?: string; isPhoneVerified?: boolean } | null
  ) => {
    const source =
      contactInfo && typeof contactInfo === "object" ? contactInfo : {};
    const sourcePhone =
      typeof source.phone === "string" ? source.phone.trim() : "";
    const normalizedPreservedPhone = `${preserveVerifiedContact?.phone || ""}`.trim();
    const shouldPreserveVerifiedPhone =
      preserveVerifiedContact?.isPhoneVerified === true &&
      normalizedPreservedPhone.length > 0 &&
      source.isPhoneVerified !== false;

    return {
      email: lockedEmail || (typeof source.email === "string" ? source.email : ""),
      phone: shouldPreserveVerifiedPhone
        ? normalizedPreservedPhone
        : sourcePhone,
      isPhoneVerified: shouldPreserveVerifiedPhone
        ? true
        : source.isPhoneVerified === true,
      countryCode: typeof source.countryCode === "string" ? source.countryCode : "",
      address: typeof source.address === "string" ? source.address : "",
      linkedin: typeof source.linkedin === "string" ? source.linkedin : "",
      websites: Array.isArray(source.websites) ? source.websites : [],
    };
  };
  const DEFAULT_CONTACT_INFO_DATA = normalizeContactInfo({});

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

  function updateStoredUser(nextUser) {
    localStorage.setItem("user", JSON.stringify(nextUser));
    window.dispatchEvent(
      new CustomEvent("localStorageChange", {
        detail: { key: "user", value: nextUser },
      })
    );
  }

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
      completePhoneVerificationGate(verifiedMobileNumber);
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
    updateStoredUser,
    user,
  });

  function resetPhoneVerificationModalState() {
    resetVerificationSession();
    setMobileNumberError("");
    setMaskedMobileNumber("");
    setOtpError(null);
    setOtpCountdown(105);
    reset();
    setPhoneVerificationStep("phone");
  }

  function openPhoneVerificationGate() {
    resetPhoneVerificationModalState();
    setMobileNumber(getCandidateMobileNumber(user));
    setIsPhoneVerificationModalOpen(true);
  }

  function closePhoneVerificationGate() {
    resetPhoneVerificationModalState();
    setIsPhoneVerificationModalOpen(false);
    window.location.href = pathConstants.dashboard;
  }

  function completePhoneVerificationGate(verifiedMobileNumber = "") {
    resetPhoneVerificationModalState();
    setMobileNumber(sanitizeInternationalPhoneInput(verifiedMobileNumber));
    setIsPhoneGatePassed(true);
    setIsPhoneVerificationModalOpen(false);
  }

  // Parse HTML to extract strong points and weak points
  const parseScreeningReason = (htmlString) => {
    if (!htmlString) return { strongPoints: [], weakPoints: [] };

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, "text/html");
      const strongPoints = [];
      const weakPoints = [];

      // Find all h2 and h3 tags (support both)
      const headings = doc.querySelectorAll("h2, h3");
      headings.forEach((heading) => {
        const text = heading.textContent.trim();
        if (text.toLowerCase().includes("strong")) {
          // Get the next ul element
          let nextElement = heading.nextElementSibling;
          while (nextElement && nextElement.tagName !== "UL") {
            nextElement = nextElement.nextElementSibling;
          }
          if (nextElement) {
            const listItems = nextElement.querySelectorAll("li");
            listItems.forEach((li) => {
              strongPoints.push(li.textContent.trim());
            });
          }
        } else if (text.toLowerCase().includes("weak")) {
          // Get the next ul element
          let nextElement = heading.nextElementSibling;
          while (nextElement && nextElement.tagName !== "UL") {
            nextElement = nextElement.nextElementSibling;
          }
          if (nextElement) {
            const listItems = nextElement.querySelectorAll("li");
            listItems.forEach((li) => {
              weakPoints.push(li.textContent.trim());
            });
          }
        }
      });

      return { strongPoints, weakPoints };
    } catch (error) {
      console.error("Error parsing screening reason:", error);
      return { strongPoints: [], weakPoints: [] };
    }
  };

  // Safe JSON parsing utility
  const safeJsonParse = (jsonString, fallback = null) => {
    try {
      if (!jsonString || jsonString === "null") return fallback;
      return JSON.parse(jsonString);
    } catch (error) {
      customLog({
        error: "JSON Parse Error",
        message: error.message,
        data: { jsonString: jsonString?.substring(0, 100) + "..." },
        component: "UploadCV",
        timestamp: new Date().toISOString(),
      });
      return fallback;
    }
  };

  // Error handling utility
  const handleError = (error, context = "Unknown") => {
    const errorData = {
      error: error.message || "Unknown error",
      context: context,
      component: "UploadCV",
      timestamp: new Date().toISOString(),
      user: user?.email || "unknown",
      stack: error.stack,
    };

    customLog(errorData);
    setError(error.message || "An unexpected error occurred");
    console.error(`UploadCV Error [${context}]:`, error);
  };

  const convertSkillsToMarkdown = (skillsList: string[]): string => {
    return skillsList.map((skill) => `- ${skill}`).join("\n");
  };

  const parseSkillsFromMarkdown = (content: unknown): string[] => {
    if (typeof content !== "string") return [];

    return content
      .split("\n")
      .map((line) => line.replace(/^[-*+]\s*/, "").trim())
      .filter((line) => line.length > 0 && !/^skills?$/i.test(line));
  };

  const extractSkillsFromParsedCV = (parsedUserCV: any): string[] => {
    if (!parsedUserCV || typeof parsedUserCV !== "object") return [];

    const skillsSection = Array.isArray(parsedUserCV?.digitalCV)
      ? parsedUserCV.digitalCV.find((section: any) => section?.name === "Skills")
      : null;

    return Array.from(new Set(parseSkillsFromMarkdown(skillsSection?.content))).slice(
      0,
      MAX_SKILLS
    );
  };

  const serializeFetchedCV = (cvDoc: any): string | null => {
    if (!cvDoc || !Array.isArray(cvDoc.digitalCV)) return null;

    return JSON.stringify({
      digitalCV: cvDoc.digitalCV,
      structuredCV: cvDoc.structuredCV || null,
      fileInfo: cvDoc.fileInfo || null,
      errorRemarks: cvDoc.errorRemarks || null,
    });
  };

  const fetchPersistedCV = async (): Promise<string | null> => {
    try {
      const cvResponse = await api.post("/api/whitecloak/fetch-cv");
      return serializeFetchedCV(cvResponse?.data);
    } catch {
      return null;
    }
  };

  const extractVerifiedContactInfo = (source: any) => {
    const contactInfo = source?.structuredCV?.contactInfo;

    if (
      contactInfo?.isPhoneVerified === true &&
      typeof contactInfo?.phone === "string" &&
      contactInfo.phone.trim()
    ) {
      return {
        phone: contactInfo.phone.trim(),
        isPhoneVerified: true,
      };
    }

    return null;
  };

  const getVerifiedPhoneFallback = () => {
    return extractVerifiedContactInfo(user);
  };

  const buildFormattedCVFromParsed = (parsedUserCV: any) => {
    const formattedCV = {};
    const sectionsByName = new Map<string, any>();
    const verifiedPhoneFallback = getVerifiedPhoneFallback();

    if (Array.isArray(parsedUserCV?.digitalCV)) {
      parsedUserCV.digitalCV.forEach((section: any) => {
        const name =
          typeof section?.name === "string" ? section.name.trim() : "";
        if (!name) return;
        sectionsByName.set(name, section);
      });
    }

    cvSections.forEach((section) => {
      const matched = sectionsByName.get(section);
      const content =
        typeof matched?.content === "string"
          ? matched.content.trim()
          : "";

      if (section === "Contact Info" && content) {
        try {
          formattedCV[section] = JSON.stringify(
            normalizeContactInfo(JSON.parse(content), verifiedPhoneFallback)
          );
        } catch {
          formattedCV[section] = content;
        }
      } else {
        formattedCV[section] = content;
      }
    });

    const enhanced = parsedUserCV?.structuredCV;
    if (enhanced && typeof enhanced === "object") {
      if (typeof enhanced.introduction === "string") {
        formattedCV["Introduction"] = enhanced.introduction;
      }

      const enhancedSkills = extractSkillsFromParsedCV({ structuredCV: enhanced });
      if (enhancedSkills.length > 0) {
        formattedCV["Skills"] = convertSkillsToMarkdown(enhancedSkills);
      }

      structuredSections.forEach((section) => {
        let value = null;

        if (section === "Contact Info") value = enhanced.contactInfo;
        if (section === "Experience") value = enhanced.experience;
        if (section === "Education") value = enhanced.education;
        if (section === "Projects") value = enhanced.projects;
        if (section === "Certifications") value = enhanced.certifications;
        if (section === "Awards") value = enhanced.awards;

        if (value != null) {
          if (section === "Contact Info") {
            formattedCV[section] = JSON.stringify(
              normalizeContactInfo(value, verifiedPhoneFallback)
            );
          } else {
            formattedCV[section] = JSON.stringify(value);
          }
        }
      });
    }

    return formattedCV;
  };

  const loadCandidateSkillsFromMetadata = async (fallbackSkills: string[] = []) => {
    const normalizedFallbackSkills = fallbackSkills
      .map((skill) => (typeof skill === "string" ? skill.trim() : ""))
      .filter(Boolean)
      .slice(0, MAX_SKILLS);

    if (!user?.email) {
      setSkills(normalizedFallbackSkills);
      setInitialSkills(normalizedFallbackSkills);
      return normalizedFallbackSkills;
    }

    try {
      const response = await api.get(
        "/api/get-candidate-skills"
      );
      const items = Array.isArray(response?.data?.items)
        ? response.data.items
        : [];
      const skillsFromMeta = items
        .map((item: any) =>
          typeof item?.skillName === "string" ? item.skillName.trim() : ""
        )
        .filter((skill: string) => skill.length > 0)
        .slice(0, MAX_SKILLS);

      const nextSkills =
        skillsFromMeta.length > 0 ? skillsFromMeta : normalizedFallbackSkills;

      setSkills(nextSkills);
      setInitialSkills(nextSkills);
      return nextSkills;
    } catch (error) {
      console.error("Error loading candidate skills metadata:", error);
      setSkills(normalizedFallbackSkills);
      setInitialSkills(normalizedFallbackSkills);
      return normalizedFallbackSkills;
    }
  };

  const syncSkillsMetadataDiff = async (
    originalSkills: string[],
    currentSkills: string[]
  ) => {
    if (!user?.email) return;

    const originalSet = new Set(originalSkills || []);
    const currentSet = new Set(currentSkills || []);

    const addedSkills = (currentSkills || []).filter(
      (skill) => !originalSet.has(skill)
    );
    const removedSkills = (originalSkills || []).filter(
      (skill) => !currentSet.has(skill)
    );

    if (addedSkills.length === 0 && removedSkills.length === 0) return;

    try {
      await api.post("/api/sync-candidate-skills", {
        candidateEmail: user.email,
        addedSkills,
        removedSkills,
        source: "candidate",
      });
    } catch (error) {
      console.error("Error syncing skills metadata changes:", error);
    }
  };

  const handleSkillsChange = (newSkills: string[]) => {
    const limitedSkills = newSkills.slice(0, MAX_SKILLS);
    setSkills(limitedSkills);
    const markdownContent = convertSkillsToMarkdown(limitedSkills);
    setUserCV({
      ...(userCV || {}),
      Skills: markdownContent,
    });
    setHasChanges(true);
  };

  const parseSectionArray = <T,>(value?: string): T[] => {
    if (!value) return [];

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const getEditingItemById = <T extends { id: string }>(
    sectionValue: string | undefined,
    id: string | null
  ): T | null => {
    if (!id) return null;
    const items = parseSectionArray<T>(sectionValue);
    return items.find((item) => item.id === id) || null;
  };

  const parseContactInfoSection = (value?: string) => {
    if (!value) return { ...DEFAULT_CONTACT_INFO_DATA };

    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        return normalizeContactInfo(parsed, getVerifiedPhoneFallback());
      }
    } catch {
      // no-op
    }

    return { ...DEFAULT_CONTACT_INFO_DATA };
  };

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDrop(e) {
    e.preventDefault();
    handleFile(e.dataTransfer.files);
  }

  function handleEditCV(section: string) {
    if (section === "Introduction") {
      setIntroductionValue(userCV?.Introduction || "");
      setShowIntroductionModal(true);
      return;
    }

    if (section === "Contact Info") {
      setContactInfoData(parseContactInfoSection(userCV?.["Contact Info"]));
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
    }
  }

  function handleIntroductionModalSave(updatedIntroduction: string) {
    setUserCV((prev) => ({
      ...(prev || {}),
      Introduction: updatedIntroduction,
    }));
    setHasChanges(true);
  }

  function handleContactInfoSave(contactInfo: any) {
    const normalizedContactInfo = normalizeContactInfo(
      contactInfo,
      getVerifiedPhoneFallback()
    );
    setUserCV((prev) => ({
      ...(prev || {}),
      "Contact Info": JSON.stringify(normalizedContactInfo),
    }));
    setHasChanges(true);
    setContactInfoData(null);
  }

  function handleSkillModalSave(updatedSkills: string[]) {
    handleSkillsChange(updatedSkills);
  }

  function handleExperienceSave(newExperience: ExperienceItem) {
    const currentExperiences = parseSectionArray<ExperienceItem>(
      userCV?.["Experience"]
    );

    const updatedExperiences = editingExperienceId
      ? currentExperiences.map((exp) =>
          exp.id === editingExperienceId ? newExperience : exp
        )
      : [...currentExperiences, newExperience];

    setUserCV((prev) => ({
      ...(prev || {}),
      Experience: JSON.stringify(updatedExperiences),
    }));
    setHasChanges(true);
    setEditingExperienceId(null);
  }

  function handleEditExperienceItem(id: string) {
    setEditingExperienceId(id);
    setShowExperienceModal(true);
  }

  function handleDeleteExperienceItem(id: string) {
    const currentExperiences = parseSectionArray<ExperienceItem>(
      userCV?.["Experience"]
    );
    const updatedExperiences = currentExperiences.filter((exp) => exp.id !== id);
    setUserCV((prev) => ({
      ...(prev || {}),
      Experience: JSON.stringify(updatedExperiences),
    }));
    setHasChanges(true);
  }

  function handleEducationSave(newEducation: EducationItem) {
    const currentEducation = parseSectionArray<EducationItem>(
      userCV?.["Education"]
    );

    const updatedEducation = editingEducationId
      ? currentEducation.map((edu) =>
          edu.id === editingEducationId ? newEducation : edu
        )
      : [...currentEducation, newEducation];

    setUserCV((prev) => ({
      ...(prev || {}),
      Education: JSON.stringify(updatedEducation),
    }));
    setHasChanges(true);
    setEditingEducationId(null);
  }

  function handleEditEducationItem(id: string) {
    setEditingEducationId(id);
    setShowEducationModal(true);
  }

  function handleDeleteEducationItem(id: string) {
    const currentEducation = parseSectionArray<EducationItem>(userCV?.["Education"]);
    const updatedEducation = currentEducation.filter((edu) => edu.id !== id);
    setUserCV((prev) => ({
      ...(prev || {}),
      Education: JSON.stringify(updatedEducation),
    }));
    setHasChanges(true);
  }

  function handleProjectsSave(newProject: ProjectItem) {
    const currentProjects = parseSectionArray<ProjectItem>(userCV?.["Projects"]);

    const updatedProjects = editingProjectId
      ? currentProjects.map((project) =>
          project.id === editingProjectId ? newProject : project
        )
      : [...currentProjects, newProject];

    setUserCV((prev) => ({
      ...(prev || {}),
      Projects: JSON.stringify(updatedProjects),
    }));
    setHasChanges(true);
    setEditingProjectId(null);
  }

  function handleEditProjectItem(id: string) {
    setEditingProjectId(id);
    setShowProjectsModal(true);
  }

  function handleDeleteProjectItem(id: string) {
    const currentProjects = parseSectionArray<ProjectItem>(userCV?.["Projects"]);
    const updatedProjects = currentProjects.filter((project) => project.id !== id);
    setUserCV((prev) => ({
      ...(prev || {}),
      Projects: JSON.stringify(updatedProjects),
    }));
    setHasChanges(true);
  }

  function handleCertificationsSave(newCertification: CertificationItem) {
    const currentCertifications = parseSectionArray<CertificationItem>(
      userCV?.["Certifications"]
    );

    const updatedCertifications = editingCertificationId
      ? currentCertifications.map((certification) =>
          certification.id === editingCertificationId
            ? newCertification
            : certification
        )
      : [...currentCertifications, newCertification];

    setUserCV((prev) => ({
      ...(prev || {}),
      Certifications: JSON.stringify(updatedCertifications),
    }));
    setHasChanges(true);
    setEditingCertificationId(null);
  }

  function handleEditCertificationItem(id: string) {
    setEditingCertificationId(id);
    setShowCertificationModal(true);
  }

  function handleDeleteCertificationItem(id: string) {
    const currentCertifications = parseSectionArray<CertificationItem>(
      userCV?.["Certifications"]
    );
    const updatedCertifications = currentCertifications.filter(
      (certification) => certification.id !== id
    );
    setUserCV((prev) => ({
      ...(prev || {}),
      Certifications: JSON.stringify(updatedCertifications),
    }));
    setHasChanges(true);
  }

  function handleAwardsSave(newAward: AwardItem) {
    const currentAwards = parseSectionArray<AwardItem>(userCV?.["Awards"]);

    const updatedAwards = editingAwardId
      ? currentAwards.map((award) =>
          award.id === editingAwardId ? newAward : award
        )
      : [...currentAwards, newAward];

    setUserCV((prev) => ({
      ...(prev || {}),
      Awards: JSON.stringify(updatedAwards),
    }));
    setHasChanges(true);
    setEditingAwardId(null);
  }

  function handleEditAwardItem(id: string) {
    setEditingAwardId(id);
    setShowAwardModal(true);
  }

  function handleDeleteAwardItem(id: string) {
    const currentAwards = parseSectionArray<AwardItem>(userCV?.["Awards"]);
    const updatedAwards = currentAwards.filter((award) => award.id !== id);
    setUserCV((prev) => ({
      ...(prev || {}),
      Awards: JSON.stringify(updatedAwards),
    }));
    setHasChanges(true);
  }

  function handleFile(files) {
    const file = checkFile(files);

    if (file) {
      setFile(file);
      handleFileSubmit(file);
    }
  }

  function handleFileChange(e) {
    const files = e.target.files;

    if (files.length > 0) {
      handleFile(files);
    }
  }

  function handleModal() {
    setModalType("jobDescription");
  }

  function handleRedirection(type) {
    if (type == "dashboard") {
      window.location.href = pathConstants.dashboard;
    }

    if (type == "interview") {
      sessionStorage.setItem("interviewRedirection", pathConstants.dashboard);
      window.location.href = `/interview/${interview.interviewID}`;
    }
  }

  async function handleRemoveFile(e) {
    e.stopPropagation();
    e.target.value = "";

    setFile(null);
    setHasChanges(false);
    setUserCV(null);
    setSkills([]);
    setInitialSkills([]);
    const persistedCV = await fetchPersistedCV();
    setDigitalCV(persistedCV);
  }

  async function handleReviewCV() {
    try {
      if (!digitalCV) {
        throw new Error("No digital CV data available");
      }

      const parsedUserCV = safeJsonParse(digitalCV);
      if (!parsedUserCV || !parsedUserCV.digitalCV) {
        throw new Error("Invalid digital CV data structure");
      }

      const formattedCV = buildFormattedCVFromParsed(parsedUserCV);
      const extractedSkills = extractSkillsFromParsedCV(parsedUserCV);

      setFile(parsedUserCV.fileInfo || null);
      setUserCV(formattedCV);
      await loadCandidateSkillsFromMetadata(extractedSkills);
      setError(null);
    } catch (error) {
      handleError(error, "handleReviewCV");
      alert("Error loading CV data. Please try uploading again.");
    }
  }

  function handleUploadCV() {
    fileInputRef.current.click();
  }

  function processState(index, isAdvance = false) {
    const currentStepIndex = step.indexOf(currentStep);

    if (currentStepIndex == index) {
      if (index == stepStatus.length - 1) {
        return stepStatus[0];
      }

      return isAdvance || userCV || buildingCV ? stepStatus[2] : stepStatus[1];
    }

    if (currentStepIndex > index) {
      return stepStatus[0];
    }

    return stepStatus[1];
  }

  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;

    const resolvePhoneGate = async () => {
      const isVerified = await isPhoneVerificationCompleteFromServer();

      if (!isMounted) {
        return;
      }

      if (isVerified) {
        setIsPhoneGatePassed(true);
        setIsPhoneVerificationModalOpen(false);
        return;
      }

      setIsPhoneGatePassed(false);
      openPhoneVerificationGate();
    };

    resolvePhoneGate();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (phoneVerificationStep === "contact") {
      completePhoneVerificationGate(mobileNumber);
    }
  }, [mobileNumber, phoneVerificationStep]);

  useEffect(() => {
    const initializeComponent = async () => {
      try {
        setIsInitializing(true);
        setError(null);

        // Check if user is available
        if (!user || !user.email) {
          throw new Error("User not authenticated");
        }

        if (!isPhoneGatePassed) {
          return;
        }

        const storedSelectedCareer = sessionStorage.getItem("selectedCareer");
        const persistedCV = await fetchPersistedCV();
        setDigitalCV(persistedCV);

        if (storedSelectedCareer) {
          const parseStoredSelectedCareer = safeJsonParse(storedSelectedCareer);
          if (parseStoredSelectedCareer && parseStoredSelectedCareer.id) {
            await fetchInterview(parseStoredSelectedCareer.id);
          } else {
            throw new Error("Invalid career selection data");
          }
        } else {
          alert("No application is currently being managed.");
          window.location.href = pathConstants.dashboard;
        }
      } catch (error) {
        handleError(error, "initializeComponent");
        alert("Error initializing application. Please try again.");
        window.location.href = pathConstants.dashboard;
      } finally {
        setIsInitializing(false);
      }
    };

    initializeComponent();
  }, [isPhoneGatePassed, user]);

  useEffect(() => {
    sessionStorage.setItem("hasChanges", JSON.stringify(hasChanges));
  }, [hasChanges]);

  useEffect(() => {
    if (interview) {
      sessionStorage.setItem("selectedCareer", JSON.stringify(interview));
    }
  }, [interview]);

  async function fetchInterview(interviewID) {
    try {
      if (!user?.email) {
        throw new Error("User email not available");
      }

      const response = await api.post("/api/job-portal/fetch-interviews", {
        email: user.email,
        interviewID,
      });

      const result = response.data;
      if (result.error) {
        throw new Error(result.error);
      }

      if (!result || !result[0]) {
        throw new Error("No interview data found");
      }

      if (result[0].cvStatus) {
        alert("This application has already been processed.");
        window.location.href = pathConstants.dashboard;
        return;
      }

      setInterview(result[0]);

      if (result[0]?.preScreeningQuestions?.length > 0) {
        setStep(["Submit CV", "Pre-screening Questions", "Review"]);
        setPreScreeningQuestions(
          result[0].preScreeningQuestions.map((p) => {
            return {
              ...p,
              selectedAnswers: [],
            };
          })
        );
      }
      setCurrentStep(step[0]);
      setLoading(false);
      setError(null);
    } catch (error) {
      handleError(error, "fetchInterview");
      alert("Error fetching interview data. Please try again.");
      window.location.href = pathConstants.dashboard;
    }
  }

  async function handleCVScreen() {
    try {
      if (
        showIntroductionModal ||
        showContactInfoModal ||
        showExperienceModal ||
        showEducationModal ||
        showProjectsModal ||
        showCertificationModal ||
        showAwardModal ||
        showSkillModal
      ) {
        alert("Please close the current edit modal first.");
        return false;
      }

      if (!userCV) {
        alert("No CV data available. Please upload a CV first.");
        return false;
      }

      const allEmpty = Object.values(userCV).every(
        (value: any) => value.trim() == ""
      );

      if (allEmpty) {
        alert("No details to be saved.");
        return false;
      }

      let parsedDigitalCV = {
        errorRemarks: null,
        digitalCV: null,
        structuredCV: null,
      };

      if (digitalCV) {
        parsedDigitalCV = safeJsonParse(digitalCV, {
          errorRemarks: null,
          digitalCV: null,
          structuredCV: null,
        });

        if (parsedDigitalCV.errorRemarks && !hasChanges) {
          alert(
            "Please fix the errors in the CV first.\n\n" +
              parsedDigitalCV.errorRemarks
          );
          return false;
        } else if (hasChanges) {
          // If the user has made changes, we assume they fixed the errors
          parsedDigitalCV.errorRemarks = null;
        }
      }

      setCurrentStep(step[1]);

      if (!step.includes("Pre-screening Questions")) {
        if (hasChanges) {
          setIsSaving(true);
          try {
            const formattedUserCV = cvSections.map((section) => ({
              name: section,
              content:
                section === "Contact Info"
                  ? JSON.stringify(parseContactInfoSection(userCV?.[section]))
                  : userCV[section]?.trim() || "",
            }));

            parsedDigitalCV.digitalCV = formattedUserCV;
            const rebuiltStructuredCV = normalizeStructuredCVInput(
              buildStructuredCVFromDigitalCV(formattedUserCV)
            );
            parsedDigitalCV.structuredCV = {
              ...rebuiltStructuredCV,
              skills: skills.slice(0, MAX_SKILLS),
            };

            const data = {
              name: user.name,
              cvData: parsedDigitalCV,
              email: user.email,
              fileInfo: null,
            };

            if (file) {
              data.fileInfo = {
                name: file.name,
                size: file.size,
                type: file.type,
              };
            }

            await api.post("/api/whitecloak/store-cv", data);
            await syncSkillsMetadataDiff(initialSkills, skills);
            setInitialSkills(skills);
          } catch (error) {
            handleError(error, "saveCV");
            alert("Error saving CV. Please try again.");
            setCurrentStep(step[0]);
            return false;
          } finally {
            setIsSaving(false);
          }
        }

        setHasChanges(true);
        setIsScreening(true);

        try {
          const response = await api.post("/api/whitecloak/screen-cv", {
            interviewID: interview.interviewID,
          });

          const result = response.data;

          if (result.error) {
            throw new Error(result.message || result.error);
          }

          setCurrentStep(step[2]);
          setScreeningResult(result);
          setError(null);
        } catch (error) {
          handleError(error, "screenCV");
          alert("Error screening CV. Please try again.");
          setCurrentStep(step[0]);
        } finally {
          setHasChanges(false);
          setIsScreening(false);
        }
      }
    } catch (error) {
      handleError(error, "handleCVScreen");
      alert("An error occurred while processing your CV. Please try again.");
    }
  }

  async function continueToReview() {
    try {
      const rangeQuestions = preScreeningQuestions.filter(
        (q) => q.questionFormat === "Range"
      );
      if (rangeQuestions.length) {
        for (const question of rangeQuestions) {
          const maxAnswer = question.selectedAnswers?.find(
            (answer) => answer.type === "Maximum"
          );
          const minAnswer = question.selectedAnswers?.find(
            (answer) => answer.type === "Minimum"
          );

          if (
            maxAnswer &&
            minAnswer &&
            Number(maxAnswer.value) <= Number(minAnswer.value)
          ) {
            alert(
              "Maximum value must be greater than the minimum value for all range questions."
            );
            return;
          }
        }
      }

      setCurrentStep(step[2]);

      let parsedDigitalCV = {
        errorRemarks: null,
        digitalCV: null,
        structuredCV: null,
      };

      if (digitalCV) {
        parsedDigitalCV = safeJsonParse(digitalCV, {
          errorRemarks: null,
          digitalCV: null,
          structuredCV: null,
        });
      }

      if (hasChanges) {
        setIsSaving(true);
        try {
          const formattedUserCV = cvSections.map((section) => ({
            name: section,
            content:
              section === "Contact Info"
                ? JSON.stringify(parseContactInfoSection(userCV?.[section]))
                : userCV[section]?.trim() || "",
          }));

          parsedDigitalCV.digitalCV = formattedUserCV;
          const rebuiltStructuredCV = normalizeStructuredCVInput(
            buildStructuredCVFromDigitalCV(formattedUserCV)
          );
          parsedDigitalCV.structuredCV = {
            ...rebuiltStructuredCV,
            skills: skills.slice(0, MAX_SKILLS),
          };

          const data = {
            name: user.name,
            cvData: parsedDigitalCV,
            email: user.email,
            fileInfo: null,
          };

          if (file) {
            data.fileInfo = {
              name: file.name,
              size: file.size,
              type: file.type,
            };
          }

          await api.post("/api/whitecloak/store-cv", data);
          await syncSkillsMetadataDiff(initialSkills, skills);
          setInitialSkills(skills);
        } catch (error) {
          handleError(error, "saveCV-continueToReview");
          alert("Error saving CV. Please try again.");
          setCurrentStep(step[0]);
          return;
        } finally {
          setIsSaving(false);
        }
      }

      setHasChanges(true);

      try {
        await api.post("/api/whitecloak/manage-application", {
          interviewData: interview,
          body: {
            preScreeningQuestions: preScreeningQuestions.map((q) => {
              if (q.questionFormat === "Range") {
                q.selectedAnswers = q.selectedAnswers.map((a) => ({
                  ...a,
                  value: Number(a.value),
                }));
              }
              return q;
            }),
          },
        });
      } catch (error) {
        handleError(error, "manageApplication");
        alert("Error updating pre-screening questions. Please try again.");
        setCurrentStep(step[1]);
        return;
      }

      setIsScreening(true);
      try {
        const response = await api.post("/api/whitecloak/screen-cv", {
          interviewID: interview.interviewID,
        });

        const result = response.data;

        if (result.error) {
          throw new Error(result.message || result.error);
        }

        setScreeningResult(result);
        setError(null);
      } catch (error) {
        handleError(error, "screenCV-continueToReview");
        alert("Error screening CV. Please try again.");
        setCurrentStep(step[0]);
      } finally {
        setHasChanges(false);
        setIsScreening(false);
      }
    } catch (error) {
      handleError(error, "continueToReview");
      alert(
        "An error occurred while processing your application. Please try again."
      );
    }
  }

  function isPreScreeningQuestionsValid() {
    return preScreeningQuestions.every((q) => {
      if (q.questionFormat === "Range") {
        return (
          q.selectedAnswers?.length === 2 &&
          q.selectedAnswers.every(
            (a) => !isNaN(Number(a.value)) && Number(a.value) > 0
          )
        );
      }
      return (
        q.selectedAnswers?.length > 0 &&
        q.selectedAnswers.every((a) => a.value.trim() != "")
      );
    });
  }

  async function handleFileSubmit(file) {
    try {
      if (!user?.email) {
        throw new Error("User email not available");
      }

      setBuildingCV(true);
      setIsUploading(true);
      setHasChanges(true);
      setError(null);

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

      const digitalizeResponse = await api.post(
        `/api/whitecloak/autofill-cv`,
        {
          chunks: uploadResponse.data.cvChunks,
        }
      );

      const result = digitalizeResponse.data.result;
      if (!result) {
        throw new Error("No result from digitalization service");
      }

      const parsedUserCV = safeJsonParse(result);
      if (!parsedUserCV || !parsedUserCV.digitalCV) {
        throw new Error("Invalid digitalization result structure");
      }

      const verifiedFallback = getVerifiedPhoneFallback();
      if (
        verifiedFallback?.isPhoneVerified === true &&
        typeof verifiedFallback?.phone === "string" &&
        verifiedFallback.phone.trim() !== "" &&
        parsedUserCV?.structuredCV &&
        typeof parsedUserCV.structuredCV === "object"
      ) {
        parsedUserCV.structuredCV = {
          ...parsedUserCV.structuredCV,
          contactInfo: normalizeContactInfo(
            {
              ...(parsedUserCV.structuredCV.contactInfo || {}),
              phone: verifiedFallback.phone,
              isPhoneVerified: true,
            },
            verifiedFallback,
          ),
        };
      }

      const formattedCV = buildFormattedCVFromParsed(parsedUserCV);
      const extractedSkills = extractSkillsFromParsedCV(parsedUserCV);

      setDigitalCV(result);
      setUserCV(formattedCV);
      await loadCandidateSkillsFromMetadata(extractedSkills);
    } catch (error) {
      handleError(error, "handleFileSubmit");
      alert("Error building CV. Please try again.");
    } finally {
      setBuildingCV(false);
      setIsUploading(false);
    }
  }

  // Early return for critical errors
  if (error && !user) {
    return (
      <div
        className="error-container"
        style={{ padding: "2rem", textAlign: "center" }}
      >
        <h2>Authentication Error</h2>
        <p>Please log in to continue.</p>
        <button
          onClick={() => (window.location.href = pathConstants.dashboard)}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <>
        <PhoneVerificationModal
          opened={
            isPhoneVerificationModalOpen &&
            (phoneVerificationStep === "phone" || phoneVerificationStep === "otp")
          }
          onClose={closePhoneVerificationGate}
          onBack={handleBackToPhone}
          step={phoneVerificationStep === "otp" ? "otp" : "phone"}
          organizationLogo={interview?.organization?.image}
          organizationName={interview?.organization?.name}
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

        {(loading || isInitializing) && (
          <Loader loaderData="Loading application..." loaderType="spinner" />
        )}

        {error && (
          <div
            className="error-banner"
            style={{
              backgroundColor: "#f8d7da",
              color: "#721c24",
              padding: "1rem",
              margin: "1rem",
              borderRadius: "4px",
              border: "1px solid #f5c6cb",
            }}
          >
            <strong>Error:</strong> {error}
            <button
              onClick={() => setError(null)}
              style={{
                marginLeft: "1rem",
                background: "none",
                border: "none",
                color: "#721c24",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
        )}

        {interview && (
          <div className={styles.uploadCVContainer}>
            {!screeningResult && !showManualWizard && (
              <div className={styles.uploadCVHeader}>
                {interview.organization && (
                  <div className={styles.companyLogoCard}>
                    {interview.organization.image && (
                      <img alt="" src={interview.organization.image} />
                    )}
                  </div>
                )}
                <div className={styles.textContainer}>
                  <span className={styles.tag}>You're applying for</span>
                  <span className={styles.title}>{interview.jobTitle}</span>
                  {interview.organization && interview.organization.name && (
                    <span className={styles.name}>
                      {interview.organization.name}
                    </span>
                  )}
                  <span className={styles.description} onClick={handleModal}>
                    View job description
                  </span>
                </div>
              </div>
            )}

            {!screeningResult && !showManualWizard && (
              <div className={styles.stepContainer}>
                <div className={styles.step}>
                  {step.map((_, index) => (
                    <div className={styles.stepBar} key={index}>
                      <img
                        alt=""
                        src={
                          assetConstants[
                            processState(index, true)
                              .toLowerCase()
                              .replace(" ", "_")
                          ]
                        }
                      />
                      {index < step.length - 1 && (
                        <hr
                          className={
                            styles[
                              processState(index)
                                .toLowerCase()
                                .replace(" ", "_")
                            ]
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className={styles.step}>
                  {step.map((item, index) => (
                    <span
                      className={`${styles.stepDetails} ${
                        styles[
                          processState(index, true)
                            .toLowerCase()
                            .replace(" ", "_")
                        ]
                      }`}
                      key={index}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {currentStep == step[0] && showManualWizard && (
              <ManualProfileWizard
                userEmail={lockedEmail}
                onExit={() => setShowManualWizard(false)}
                onSubmitted={async () => {
                  setShowManualWizard(false);
                  // Refresh the candidate's CV so "Review Current CV" reflects
                  // the newly saved profile without requiring a full page reload.
                  const refreshed = await fetchPersistedCV();
                  setDigitalCV(refreshed);
                }}
              />
            )}

            {currentStep == step[0] && !showManualWizard && (
              <>
                {!buildingCV && !userCV && !file && (
                  <div className={styles.cvManageContainer}>
                    <div className={styles.cvContainer}>
                      <img alt="" src="/iconsV3/create-profile.svg" />
                      <button onClick={() => setShowManualWizard(true)}>
                        Create a Profile Manually
                      </button>
                      <span>
                        Quickstart your job application by creating your own CV
                        from scratch.
                      </span>
                    </div>

                    <div
                      className={styles.cvContainer}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    >
                      <img alt="" src={assetConstants.uploadV2} />
                      <button onClick={handleUploadCV}>Upload CV</button>
                      <span>
                        Choose or drag and drop a file here. Our AI tools will
                        automatically pre-fill your CV and also check how well
                        it matches the role.
                      </span>
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      style={{ display: "none" }}
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />

                    <div className={styles.cvContainer}>
                      <img alt="" src={assetConstants.review} />
                      <button
                        className={`${digitalCV ? "" : "disabled"}`}
                        disabled={!digitalCV}
                        onClick={handleReviewCV}
                      >
                        Review Current CV
                      </button>
                      <span>
                        Already uploaded a CV? Take a moment to review your
                        details before we proceed.
                      </span>
                    </div>
                  </div>
                )}

                {buildingCV && file && (
                  <div className={styles.cvDetailsContainer}>
                    <div className={styles.gradient}>
                      <div className={styles.cvDetailsCard}>
                        <span className={styles.sectionTitle}>
                          <img alt="" src={assetConstants.account} />
                          Submit CV
                        </span>
                        <div className={styles.detailsContainer}>
                          <span className={styles.fileTitle}>
                            <img alt="" src={assetConstants.completed} />
                            {file.name}
                          </span>
                          <div className={styles.loadingContainer}>
                            <Image
                              alt=""
                              src={assetConstants.loading}
                              unoptimized
                              width={114}
                              height={90}
                            />
                            <div className={styles.textContainer}>
                              <span className={styles.title}>
                                Extracting information from your CV...
                              </span>
                              <span className={styles.description}>
                                Jia is building your profile...
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!buildingCV && userCV && (
                  <div className={styles.cvDetailsContainer}>
                    <div className={styles.gradient}>
                      <div className={styles.cvDetailsCard}>
                        <span className={styles.sectionTitle}>
                          <img alt="" src={assetConstants.account} />
                          Submit CV
                          <div className={styles.editIcon}>
                            <img
                              alt=""
                              src={
                                file ? assetConstants.xV2 : assetConstants.save
                              }
                              onClick={file ? handleRemoveFile : handleUploadCV}
                              onContextMenu={(e) => e.preventDefault()}
                            />
                          </div>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.txt"
                            style={{ display: "none" }}
                            ref={fileInputRef}
                            onChange={handleFileChange}
                          />
                        </span>

                        <div className={styles.detailsContainer}>
                          {file ? (
                            <span className={styles.fileTitle}>
                              <img alt="" src={assetConstants.completed} />
                              {file.name}
                            </span>
                          ) : (
                            <span className={styles.fileTitle}>
                              <img alt="" src={assetConstants.fileV2} />
                              You can also upload your CV and let our AI
                              automatically fill in your profile information.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {cvSections.map((section, index) => (
                      <div key={index} className={styles.gradient}>
                        <div className={styles.cvDetailsCard}>
                          <span className={styles.sectionTitle}>
                            {section}

                            <div className={styles.editIcon}>
                              <img
                                alt=""
                                src={
                                  section === "Experience" ||
                                  section === "Education" ||
                                  section === "Projects" ||
                                  section === "Certifications" ||
                                  section === "Awards"
                                    ? assetConstants.plus
                                    : assetConstants.edit
                                }
                                onClick={() => handleEditCV(section)}
                                onContextMenu={(e) => e.preventDefault()}
                                style={
                                  section === "Experience" ||
                                  section === "Education" ||
                                  section === "Projects" ||
                                  section === "Certifications" ||
                                  section === "Awards"
                                    ? { width: 24, height: 24 }
                                    : {}
                                }
                              />
                            </div>
                          </span>

                          <div className={styles.detailsContainer}>
                            {section === "Introduction" ? (
                              <IntroductionSectionContent
                                buildingCV={buildingCV}
                                loading={loading}
                                value={userCV?.["Introduction"]}
                              />
                            ) : section === "Contact Info" ? (
                              <ContactInfoSectionContent
                                buildingCV={buildingCV}
                                loading={loading}
                                value={userCV?.["Contact Info"]}
                                defaultContactInfo={DEFAULT_CONTACT_INFO_DATA}
                                showPhoneVerifiedBadge={true}
                              />
                            ) : section === "Skills" ? (
                              <SkillsSectionContent
                                buildingCV={buildingCV}
                                loading={loading}
                                skills={skills}
                              />
                            ) : section === "Experience" ? (
                              <ExperienceSectionContent
                                buildingCV={buildingCV}
                                loading={loading}
                                value={userCV?.["Experience"]}
                                defaultExperienceData={DEFAULT_EXPERIENCE_DATA}
                                onEditExperienceItem={handleEditExperienceItem}
                              />
                            ) : section === "Education" ? (
                              <EducationSectionContent
                                buildingCV={buildingCV}
                                loading={loading}
                                value={userCV?.["Education"]}
                                defaultEducationData={DEFAULT_EDUCATION_DATA}
                                onEditEducationItem={handleEditEducationItem}
                              />
                            ) : section === "Projects" ? (
                              <span
                                className={`${styles.sectionDetails} ${
                                  userCV?.[section]?.trim() ? styles.withDetails : ""
                                }`}
                              >
                                <ProjectsSectionContent
                                  value={userCV?.["Projects"]}
                                  defaultProjectsData={DEFAULT_PROJECTS_DATA}
                                  onEditProjectItem={handleEditProjectItem}
                                />
                              </span>
                            ) : section === "Certifications" ? (
                              <span
                                className={`${styles.sectionDetails} ${
                                  userCV?.[section]?.trim() ? styles.withDetails : ""
                                }`}
                              >
                                <CertificationsSectionContent
                                  value={userCV?.["Certifications"]}
                                  defaultCertificationsData={DEFAULT_CERTIFICATIONS_DATA}
                                  onEditCertificationItem={handleEditCertificationItem}
                                />
                              </span>
                            ) : section === "Awards" ? (
                              <span
                                className={`${styles.sectionDetails} ${
                                  userCV?.[section]?.trim() ? styles.withDetails : ""
                                }`}
                              >
                                <AwardsSectionContent
                                  value={userCV?.["Awards"]}
                                  defaultAwardsData={DEFAULT_AWARDS_DATA}
                                  onEditAwardItem={handleEditAwardItem}
                                />
                              </span>
                            ) : (
                              <span
                                className={`${styles.sectionDetails} ${
                                  userCV?.[section]?.trim() ? styles.withDetails : ""
                                }`}
                              >
                                {userCV?.[section]?.trim()
                                  ? userCV[section].trim()
                                  : "Upload your CV to auto-fill this section."}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={handleCVScreen}
                      disabled={isSaving || isScreening}
                      style={{
                        opacity: isSaving || isScreening ? 0.6 : 1,
                        cursor:
                          isSaving || isScreening ? "not-allowed" : "pointer",
                      }}
                    >
                      {isSaving ? (
                        "Saving..."
                      ) : isScreening ? (
                        "Processing..."
                      ) : !step.includes("Pre-screening Questions") ? (
                        "Submit CV"
                      ) : (
                        <>
                          Continue
                          <img alt="" src="/iconsV3/arrow.svg" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}

            {(currentStep === "CV Screening" ||
              (currentStep == step[2] && !screeningResult)) && (
              <div className={styles.cvScreeningContainer}>
                <Image
                  alt=""
                  src={assetConstants.loading}
                  unoptimized
                  width={114}
                  height={90}
                />
                <span className={styles.title}>Sit tight!</span>
                <span className={styles.description}>
                  Our smart reviewer is checking your qualifications.
                </span>
                <span className={styles.description}>
                  We'll let you know what's next in just a moment.
                </span>
              </div>
            )}

            {currentStep === "Pre-screening Questions" && (
              <div className={styles.preScreeningContainer}>
                <h1 className={styles.title}>Quick Pre-screening</h1>
                <span className={styles.description}>
                  Just a few short questions to help your recruiters assess you
                  faster. Takes less than a minute.
                </span>
                <div className={styles.questionContainer}>
                  {preScreeningQuestions.map((question, index) => (
                    <div key={index} className={styles.gradientContainer}>
                      <div className={styles.cardContainer}>
                        <span className={styles.question}>
                          {question.question}
                        </span>
                        {question.questionFormat === "Dropdown" && (
                          <div className={styles.answerContainer}>
                            <div
                              style={{
                                position: "relative",
                                width: "100%",
                                height: "100%",
                              }}
                            >
                              <div
                                className={styles.dropDownAnswerContainer}
                                onClick={() => {
                                  if (viewDropdown == index) {
                                    setViewDropdown(null);
                                  } else {
                                    setViewDropdown(index);
                                  }
                                }}
                              >
                                {decodeHtmlEntities(
                                  question.selectedAnswers?.[0]?.value || ""
                                ) || "Select an answer"}
                                <img
                                  alt="ellipsis"
                                  src="/iconsV3/chevron.svg"
                                />
                              </div>
                              {viewDropdown == index && (
                                <div className={styles.dropdownContainer}>
                                  {question.answers.map((option, index) => (
                                    <span
                                      key={index}
                                      onClick={() => {
                                        setPreScreeningQuestions(
                                          preScreeningQuestions.map((q) => {
                                            if (question.id == q.id) {
                                              return {
                                                ...q,
                                                selectedAnswers: [
                                                  {
                                                    id: option.id,
                                                    value: option.value,
                                                    type: "Dropdown",
                                                  },
                                                ],
                                              };
                                            }
                                            return q;
                                          })
                                        );
                                        setViewDropdown(null);
                                      }}
                                    >
                                      {decodeHtmlEntities(option.value || "")}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {question.questionFormat === "Range" && (
                          <div className={styles.answerContainer}>
                            <div className={styles.rangeInputContainer}>
                              <div className={styles.rangeInput}>
                                <span>Minimum Salary</span>
                                <Field
                                  autoComplete="off"
                                  className={styles.rangeField}
                                  inputMode="decimal"
                                  name={`prescreen-${question.id}-minimum-salary`}
                                  placeholder="0"
                                  section={
                                    <span className={styles.currencyPrefix}>
                                      P
                                    </span>
                                  }
                                  value={
                                    question.selectedAnswers?.find(
                                      (a) => a.type === "Minimum"
                                    )?.value || ""
                                  }
                                  onChange={(e) => {
                                    setPreScreeningQuestions(
                                      preScreeningQuestions.map((q) => {
                                        if (question.id == q.id) {
                                          const answers = q.answers.find(
                                            (a) => a.type === "Minimum"
                                          );
                                          const existingSelectedAnswers =
                                            q.selectedAnswers || [];
                                          const inputValue = (
                                            e.target.value || ""
                                          ).toString();
                                          const formattedValue = inputValue
                                            .replace(/,/g, "")
                                            .replace(/[^0-9.]/g, "");
                                          return {
                                            ...q,
                                            selectedAnswers:
                                              existingSelectedAnswers.find(
                                                (a) => a.type === "Minimum"
                                              )
                                                ? existingSelectedAnswers.map(
                                                    (a) =>
                                                      a.type === "Minimum"
                                                        ? {
                                                            ...a,
                                                            value:
                                                              formattedValue,
                                                          }
                                                        : a
                                                  )
                                                : [
                                                    ...existingSelectedAnswers,
                                                    {
                                                      id: answers.id,
                                                      value: formattedValue,
                                                      type: "Minimum",
                                                    },
                                                  ],
                                          };
                                        }
                                        return q;
                                      })
                                    );
                                  }}
                                />
                              </div>
                              <div className={styles.rangeInput}>
                                <span>Maximum Salary</span>
                                <Field
                                  autoComplete="off"
                                  className={styles.rangeField}
                                  inputMode="decimal"
                                  name={`prescreen-${question.id}-maximum-salary`}
                                  placeholder="0"
                                  section={
                                    <span className={styles.currencyPrefix}>
                                      P
                                    </span>
                                  }
                                  value={
                                    question.selectedAnswers?.find(
                                      (a) => a.type === "Maximum"
                                    )?.value || ""
                                  }
                                  onChange={(e) => {
                                    setPreScreeningQuestions(
                                      preScreeningQuestions.map((q) => {
                                        if (question.id == q.id) {
                                          const answers = q.answers.find(
                                            (a) => a.type === "Maximum"
                                          );
                                          const existingSelectedAnswers =
                                            q.selectedAnswers || [];
                                          const inputValue = (
                                            e.target.value || ""
                                          ).toString();
                                          const formattedValue = inputValue
                                            .replace(/,/g, "")
                                            .replace(/[^0-9.]/g, "");
                                          return {
                                            ...q,
                                            selectedAnswers:
                                              existingSelectedAnswers.find(
                                                (a) => a.type === "Maximum"
                                              )
                                                ? existingSelectedAnswers.map(
                                                    (a) =>
                                                      a.type === "Maximum"
                                                        ? {
                                                            ...a,
                                                            value:
                                                              formattedValue,
                                                          }
                                                        : a
                                                  )
                                                : [
                                                    ...existingSelectedAnswers,
                                                    {
                                                      id: answers.id,
                                                      value: formattedValue,
                                                      type: "Maximum",
                                                    },
                                                  ],
                                          };
                                        }
                                        return q;
                                      })
                                    );
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {question.questionFormat === "Checkboxes" && (
                          <div className={styles.answerContainer}>
                            {question.answers.map((option, index) => (
                              <div
                                key={index}
                                className={styles.checkboxContainer}
                              >
                                <input
                                  type="checkbox"
                                  checked={
                                    question.selectedAnswers?.find(
                                      (a) => a.id === option.id
                                    ) || false
                                  }
                                  onChange={(e) => {
                                    setPreScreeningQuestions(
                                      preScreeningQuestions.map((q) => {
                                        if (question.id == q.id) {
                                          const selectedAnswers: any[] =
                                            q.selectedAnswers || [];
                                          return {
                                            ...q,
                                            selectedAnswers:
                                              selectedAnswers.find(
                                                (a) => a.id === option.id
                                              )
                                                ? selectedAnswers.filter(
                                                    (a) => a.id !== option.id
                                                  )
                                                : [
                                                    ...selectedAnswers,
                                                    {
                                                      id: option.id,
                                                      value: option.value,
                                                      type: question.questionFormat,
                                                    },
                                                  ],
                                          };
                                        }
                                        return q;
                                      })
                                    );
                                  }}
                                />
                                <span>{option.value}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {["Short Answer", "Long Answer"].includes(
                          question.questionFormat
                        ) && (
                          <div className={styles.answerContainer}>
                            <Field
                              autoComplete="off"
                              className={`${styles.answerInput} ${
                                question.questionFormat === "Short Answer"
                                  ? styles.shortAnswer
                                  : styles.longAnswer
                              }`}
                              name={`prescreen-${question.id}-${question.questionFormat
                                .toLowerCase()
                                .replaceAll(" ", "-")}`}
                              placeholder="Your answer"
                              value={question.selectedAnswers?.[0]?.value || ""}
                              onChange={(e) => {
                                setPreScreeningQuestions(
                                  preScreeningQuestions.map((q) => {
                                    if (question.id == q.id) {
                                      return {
                                        ...q,
                                        selectedAnswers: q.selectedAnswers
                                          ?.length
                                          ? q.selectedAnswers.map((a) =>
                                              a.type === question.questionFormat
                                                ? {
                                                    ...a,
                                                    value: e.target.value,
                                                  }
                                                : a
                                            )
                                          : [
                                              {
                                                id: "1",
                                                value: e.target.value,
                                                type: question.questionFormat,
                                              },
                                            ],
                                      };
                                    }
                                    return q;
                                  })
                                );
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  disabled={
                    !isPreScreeningQuestionsValid() || isSaving || isScreening
                  }
                  className={
                    !isPreScreeningQuestionsValid() || isSaving || isScreening
                      ? styles.disabled
                      : ""
                  }
                  onClick={continueToReview}
                  style={{
                    opacity: isSaving || isScreening ? 0.6 : 1,
                    cursor: isSaving || isScreening ? "not-allowed" : "pointer",
                  }}
                >
                  {isSaving
                    ? "Saving..."
                    : isScreening
                    ? "Processing..."
                    : "Continue"}
                  {!isSaving && !isScreening && (
                    <img alt="" src="/iconsV3/arrow.svg" />
                  )}
                </button>
              </div>
            )}

            {currentStep == step[2] && screeningResult && (
              <div className={styles.cvResultContainer}>
                {screeningResult.applicationStatus == "Dropped" ? (
                  <>
                    <img
                      alt="User rejected"
                      src={assetConstants.userRejectedV2}
                    />
                    <span className={styles.title}>
                      Thank you for your interest!
                    </span>
                    <span className={styles.description}>
                      It looks like this role isn't the best match for your
                      profile right now.
                    </span>
                    <div className={styles.whatsNextContainer}>
                      <span className={styles.whatsNextTitle}>
                        WHAT'S NEXT:
                      </span>
                      <div className={styles.whatsNextContent}>
                        <span className={styles.whatsNextDescription}>
                          Explore other opportunities
                        </span>
                      </div>
                    </div>
                    <div className={styles.buttonContainer}>
                      <button onClick={() => handleRedirection("dashboard")}>
                        Back to Dashboard
                      </button>
                    </div>
                  </>
                ) : screeningResult.status == "For AI Interview" ? (
                  <>
                    <img alt="Party popper" src={assetConstants.partyPopper} />
                    <span className={styles.title}>Congratulations!</span>
                    <span className={styles.description}>
                      You're one step closer to getting a job offer.
                    </span>
                    <div className={styles.whatsNextContainer}>
                      <span className={styles.whatsNextTitle}>
                        WHAT'S NEXT:
                      </span>
                      <div className={styles.whatsNextContent}>
                        <span className={styles.whatsNextBold}>
                          Take your Pre-screening Interview
                        </span>
                        <span className={styles.whatsNextDescription}>
                          on or before{" "}
                          {new Date(
                            Date.now() + 3 * 24 * 60 * 60 * 1000
                          ).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className={styles.buttonContainer}>
                      <button
                        className="secondaryBtn"
                        onClick={() => handleRedirection("dashboard")}
                      >
                        Back to Dashboard
                      </button>
                      <button
                        onClick={() => {
                          sessionStorage.setItem(
                            "selectedCareer",
                            JSON.stringify(interview)
                          );
                          setModalType("preScreeningGuide");
                        }}
                      >
                        View Next Steps
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <img
                      alt=""
                      src={assetConstants.magnifyingGlassTiltedLeft}
                    />
                    <span className={styles.title}>
                      Pre-screening completed!
                    </span>
                    <span className={styles.description}>
                      Your CV is now being reviewed by the hiring team.
                    </span>
                    <div className={styles.whatsNextContainer}>
                      <span className={styles.whatsNextTitle}>
                        WHAT'S NEXT:
                      </span>
                      <span className={styles.whatsNextDescription}>
                        We'll be in touch soon with updates about your
                        application.
                      </span>
                    </div>
                    <div className={styles.buttonContainer}>
                      <button onClick={() => handleRedirection("dashboard")}>
                        Back to Dashboard
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <IntroductionModal
          isOpen={showIntroductionModal}
          onClose={() => setShowIntroductionModal(false)}
          onSave={handleIntroductionModalSave}
          initialValue={introductionValue}
          maxLength={2600}
        />

        <ContactInfoModal
          isOpen={showContactInfoModal}
          onClose={() => {
            setShowContactInfoModal(false);
            setContactInfoData(null);
          }}
          onSave={handleContactInfoSave}
          initialData={contactInfoData}
          lockedEmail={lockedEmail}
          disableEmailEdit
        />

        <SkillModal
          isOpen={showSkillModal}
          onClose={() => setShowSkillModal(false)}
          onSave={handleSkillModalSave}
          initialSkills={skills}
          maxSkills={MAX_SKILLS}
        />

        <ExperienceModal
          isOpen={showExperienceModal}
          onClose={() => {
            setShowExperienceModal(false);
            setEditingExperienceId(null);
          }}
          onSave={handleExperienceSave}
          onDelete={handleDeleteExperienceItem}
          initialData={getEditingItemById<ExperienceItem>(
            userCV?.["Experience"],
            editingExperienceId
          )}
        />

        <EducationModal
          isOpen={showEducationModal}
          onClose={() => {
            setShowEducationModal(false);
            setEditingEducationId(null);
          }}
          onSave={handleEducationSave}
          onDelete={handleDeleteEducationItem}
          initialData={getEditingItemById<EducationItem>(
            userCV?.["Education"],
            editingEducationId
          )}
        />

        <ProjectsModal
          isOpen={showProjectsModal}
          onClose={() => {
            setShowProjectsModal(false);
            setEditingProjectId(null);
          }}
          onSave={handleProjectsSave}
          onDelete={handleDeleteProjectItem}
          initialData={getEditingItemById<ProjectItem>(
            userCV?.["Projects"],
            editingProjectId
          )}
        />

        <CertificationModal
          isOpen={showCertificationModal}
          onClose={() => {
            setShowCertificationModal(false);
            setEditingCertificationId(null);
          }}
          onSave={handleCertificationsSave}
          onDelete={handleDeleteCertificationItem}
          initialData={getEditingItemById<CertificationItem>(
            userCV?.["Certifications"],
            editingCertificationId
          )}
        />

        <AwardModal
          isOpen={showAwardModal}
          onClose={() => {
            setShowAwardModal(false);
            setEditingAwardId(null);
          }}
          onSave={handleAwardsSave}
          onDelete={handleDeleteAwardItem}
          initialData={getEditingItemById<AwardItem>(
            userCV?.["Awards"],
            editingAwardId
          )}
        />
      </>
    </ErrorBoundary>
  );
}
