"use client";

import axios from "axios";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Star06 } from "@untitledui/icons";

import { useAppContext } from "@/lib/context/ContextV2";
import styles from "@/lib/styles/screens/manageCV.module.scss";
import { CORE_API_URL } from "@/lib/Utils";
import { assetConstants } from "@/lib/utils/constantsV2";
import { checkFile, formatFileSize } from "@/lib/utils/helpersV2";
import { usePasscodeValue } from "@/lib/hooks/usePasscodeValue";
import { usePhoneVerificationFlow } from "@/lib/hooks/usePhoneVerificationFlow";
import PhoneVerificationModal from "@/lib/components/PhoneVerification/PhoneVerificationModal";
import { sanitizeInternationalPhoneInput } from "@/lib/utils/phoneInput";

import { api } from "../../utils/apiClient";

import IntroductionModal from "./IntroductionModal";
import IntroductionSectionContent from "./IntroductionSectionContent";

import ContactInfoModal from "./ContactInfoModal";
import ContactInfoSectionContent from "./ContactInfoSectionContent";

import ExperienceModal, { ExperienceItem } from "./ExperienceModal";
import ExperienceSectionContent from "./ExperienceSectionContent";

import SkillModal from "./SkillModal";
import SkillsSectionContent from "./SkillsSectionContent";

import EducationModal, { EducationItem } from "./EducationModal";
import EducationSectionContent from "./EducationSectionContent";

import ProjectsModal, { ProjectItem } from "./ProjectsModal";
import ProjectsSectionContent from "./ProjectsSectionContent";

import CertificationModal, { CertificationItem } from "./CertificationModal";
import CertificationsSectionContent from "./CertificationsSectionContent";

import AwardModal, { AwardItem } from "./AwardModal";
import AwardsSectionContent from "./AwardsSectionContent";

const DISPLAY_SECTIONS = [
  "Introduction",
  "Contact Info",
  "Experience",
  "Skills",
  "Education",
  "Projects",
  "Certifications",
  "Awards",
] as const;

const DISPLAY_SECTION_SET = new Set<string>(DISPLAY_SECTIONS);

const EMPTY_CONTACT_INFO = {
  email: "",
  phone: "",
  isPhoneVerified: false,
  countryCode: "",
  address: "",
  linkedin: "",
  websites: [],
};
const PHONE_VERIFICATION_RECAPTCHA_ID = "manage-cv-recaptcha-container";

function normalizeContactInfo(contactInfo: any, lockedEmail?: string) {
  const normalizedLockedEmail =
    typeof lockedEmail === "string" ? lockedEmail.trim() : "";
  const source =
    contactInfo && typeof contactInfo === "object" ? contactInfo : EMPTY_CONTACT_INFO;

  return {
    ...EMPTY_CONTACT_INFO,
    ...source,
    email:
      normalizedLockedEmail ||
      (typeof source.email === "string" ? source.email : ""),
    websites: Array.isArray(source.websites) ? source.websites : [],
  };
}

function formatCVBySections(
  digitalCV: any[] | undefined,
  lockedEmail?: string
): Record<string, string> {
  const formattedCV: Record<string, string> = {};
  DISPLAY_SECTIONS.forEach((section) => {
    formattedCV[section] = "";
  });

  if (!Array.isArray(digitalCV)) return formattedCV;

  const hasNamedEntries = digitalCV.some(
    (entry) => typeof entry?.name === "string" && entry.name.trim().length > 0
  );

  if (hasNamedEntries) {
    digitalCV.forEach((entry) => {
      if (!entry || typeof entry.name !== "string") return;
      if (!DISPLAY_SECTION_SET.has(entry.name)) return;

      if (entry.name === "Contact Info") {
        const rawContactValue =
          typeof entry.content === "string" ? entry.content.trim() : "";
        if (!rawContactValue) return;

        try {
          const parsedContact = JSON.parse(rawContactValue);
          formattedCV["Contact Info"] = JSON.stringify(
            normalizeContactInfo(parsedContact, lockedEmail)
          );
          return;
        } catch {
          formattedCV["Contact Info"] = rawContactValue;
          return;
        }
      }

      formattedCV[entry.name] =
        typeof entry.content === "string" ? entry.content.trim() : "";
    });
  }

  return formattedCV;
}

function formatStructuredCVBySections(
  structuredCV: any,
  lockedEmail?: string
): Record<string, string> {
  const formattedCV: Record<string, string> = {};
  DISPLAY_SECTIONS.forEach((section) => {
    formattedCV[section] = "";
  });

  if (!structuredCV || typeof structuredCV !== "object") return formattedCV;

  const intro = typeof structuredCV.introduction === "string" ? structuredCV.introduction.trim() : "";
  if (intro) formattedCV["Introduction"] = intro;

  if (structuredCV.contactInfo && typeof structuredCV.contactInfo === "object") {
    const contact = normalizeContactInfo(structuredCV.contactInfo, lockedEmail);
    const hasContactData =
      typeof contact.email === "string" && contact.email.trim() !== "" ||
      typeof contact.phone === "string" && contact.phone.trim() !== "" ||
      typeof contact.countryCode === "string" && contact.countryCode.trim() !== "" ||
      typeof contact.address === "string" && contact.address.trim() !== "" ||
      typeof contact.linkedin === "string" && contact.linkedin.trim() !== "" ||
      (Array.isArray(contact.websites) &&
        contact.websites.some((website: any) => website?.url && String(website.url).trim() !== ""));

    if (hasContactData) {
      formattedCV["Contact Info"] = JSON.stringify(contact);
    }
  }

  const setArraySection = (sectionName: keyof Record<string, string>, value: unknown) => {
    if (!Array.isArray(value) || value.length === 0) return;
    formattedCV[sectionName] = JSON.stringify(value);
  };

  setArraySection("Experience", structuredCV.experience);
  setArraySection("Education", structuredCV.education);
  setArraySection("Projects", structuredCV.projects);
  setArraySection("Certifications", structuredCV.certifications);
  setArraySection("Awards", structuredCV.awards);

  if (Array.isArray(structuredCV.skills) && structuredCV.skills.length > 0) {
    formattedCV["Skills"] = JSON.stringify(structuredCV.skills);
  }

  return formattedCV;
}

function buildStructuredCVFromSectionState(
  userCV: Record<string, any>,
  skills: string[],
  lockedEmail?: string
) {
  const parseSectionArray = (value: unknown) => {
    if (typeof value !== "string" || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const parseContactSection = (value: unknown) => {
    if (typeof value !== "string" || !value.trim()) return normalizeContactInfo({}, lockedEmail);

    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        return normalizeContactInfo(parsed, lockedEmail);
      }
    } catch {
      // no-op, keep fallback
    }

    return normalizeContactInfo({}, lockedEmail);
  };

  return {
    introduction: typeof userCV?.Introduction === "string" ? userCV.Introduction.trim() : "",
    contactInfo: parseContactSection(userCV?.["Contact Info"]),
    experience: parseSectionArray(userCV?.Experience),
    skills: Array.isArray(skills) ? skills.filter((s) => typeof s === "string" && s.trim().length > 0).map((s) => s.trim()) : [],
    education: parseSectionArray(userCV?.Education),
    projects: parseSectionArray(userCV?.Projects),
    certifications: parseSectionArray(userCV?.Certifications),
    awards: parseSectionArray(userCV?.Awards),
  };
}

export default function () {
  const fileInputRef = useRef(null);
  const [buildingCV, setBuildingCV] = useState(false);
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
  const [isHover, setIsHover] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileNumber, setMobileNumber] = useState("");
  const [mobileNumberError, setMobileNumberError] = useState("");
  const [isPhoneVerificationModalOpen, setIsPhoneVerificationModalOpen] =
    useState(false);
  const [phoneVerificationStep, setPhoneVerificationStep] = useState<
    "phone" | "otp" | "contact"
  >("phone");
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [maskedMobileNumber, setMaskedMobileNumber] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpCountdown, setOtpCountdown] = useState(105);
  const [refresh, setRefresh] = useState(false);
  const [userCV, setUserCV] = useState(null);
  const [skills, setSkills] = useState<string[]>([]);
  const MAX_SKILLS = 60;
  const { user, setModalType, setToasterType } = useAppContext();
  const { passcode, onDigitChange, onComplete, reset } = usePasscodeValue();
  const lockedEmail = typeof user?.email === "string" ? user.email.trim() : "";
  const hasUserCV = !!userCV;

  const getCurrentContactInfo = () => {
    if (!userCV?.["Contact Info"]) {
      return normalizeContactInfo(
        {
          email: lockedEmail || user?.email || "",
          phone: user?.structuredCV?.contactInfo?.phone || "",
          isPhoneVerified: user?.structuredCV?.contactInfo?.isPhoneVerified === true,
        },
        lockedEmail,
      );
    }

    try {
      const parsed = JSON.parse(userCV["Contact Info"]);
      return normalizeContactInfo(parsed, lockedEmail);
    } catch {
      return normalizeContactInfo({}, lockedEmail);
    }
  };

  const updateStoredUser = (nextUser: any) => {
    localStorage.setItem("user", JSON.stringify(nextUser));
    window.dispatchEvent(
      new CustomEvent("localStorageChange", {
        detail: { key: "user", value: nextUser },
      }),
    );
  };

  const upsertVerifiedPhoneInContactInfo = (
    nextPhone: string,
    isVerified: boolean,
  ) => {
    const currentContact = getCurrentContactInfo();
    const nextContactInfo = normalizeContactInfo(
      {
        ...currentContact,
        phone: nextPhone,
        isPhoneVerified: isVerified,
      },
      lockedEmail,
    );
    const nextSectionValue = JSON.stringify(nextContactInfo);

    setUserCV((current) => {
      if (!current) {
        return {
          Introduction: "",
          "Contact Info": nextSectionValue,
          Experience: "",
          Skills: "",
          Education: "",
          Projects: "",
          Certifications: "",
          Awards: "",
        };
      }

      return {
        ...current,
        "Contact Info": nextSectionValue,
      };
    });
  };

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
      upsertVerifiedPhoneInContactInfo(nextMobileNumber, false);
    },
    onVerificationApproved: (updatedUser, verifiedMobileNumber) => {
      const nextUser = {
        ...updatedUser,
        structuredCV: {
          ...updatedUser?.structuredCV,
          contactInfo: {
            ...(updatedUser?.structuredCV?.contactInfo || {}),
            phone: verifiedMobileNumber,
            isPhoneVerified: true,
          },
        },
      };
      updateStoredUser(nextUser);
      upsertVerifiedPhoneInContactInfo(verifiedMobileNumber, true);
      closePhoneVerificationModal();
      setToasterType("manageCV");
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

  function openPhoneVerificationModal() {
    const currentContact = getCurrentContactInfo();
    resetVerificationSession();
    setMobileNumber(sanitizeInternationalPhoneInput(currentContact.phone || ""));
    setMobileNumberError("");
    setOtpError(null);
    setOtpCountdown(105);
    setMaskedMobileNumber("");
    reset();
    setPhoneVerificationStep("phone");
    setIsPhoneVerificationModalOpen(true);
  }

  function closePhoneVerificationModal() {
    resetVerificationSession();
    setMobileNumberError("");
    setOtpError(null);
    setOtpCountdown(105);
    setMaskedMobileNumber("");
    reset();
    setPhoneVerificationStep("phone");
    setIsPhoneVerificationModalOpen(false);
  }

  const parseStructuredSkills = (skillsContent?: string): string[] => {
    if (!skillsContent) return [];

    try {
      const parsed = JSON.parse(skillsContent);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((skill): skill is string => typeof skill === "string")
        .map((skill) => skill.trim())
        .filter((skill) => skill.length > 0)
        .slice(0, MAX_SKILLS);
    } catch {
      return [];
    }
  };

  const loadCandidateSkills = async (): Promise<string[]> => {
    try {
      const response = await api.get("/api/get-candidate-skills");
      const items = Array.isArray(response?.data?.items) ? response.data.items : [];
      return items
        .map((item: any) =>
          typeof item?.skillName === "string" ? item.skillName.trim() : ""
        )
        .filter((skill: string) => skill.length > 0)
        .slice(0, MAX_SKILLS);
    } catch {
      return [];
    }
  };

  const DEFAULT_EXPERIENCE_DATA: ExperienceItem[] = [];

  const DEFAULT_EDUCATION_DATA: EducationItem[] = [];

  const DEFAULT_PROJECTS_DATA: ProjectItem[] = [];

  const DEFAULT_CERTIFICATIONS_DATA: CertificationItem[] = [];

  const DEFAULT_AWARDS_DATA: AwardItem[] = [];

  const DEFAULT_CONTACT_INFO_DATA = {
    ...normalizeContactInfo({}, lockedEmail),
  };

  function handleClick() {
    if (buildingCV) {
      alert("You can't upload a new file while JIA is building your profile.");
    } else {
      fileInputRef.current.click();
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDrop(e) {
    e.preventDefault();

    if (buildingCV) {
      alert("You can't upload a new file while JIA is building your profile.");
    } else {
      handleFile(e.dataTransfer.files);
    }
  }

  function handleEditCV(section) {
    if (file && !userCV) {
      alert(
        "Please upload and submit your file to build your CV before editing."
      );
      return;
    }

    if (section === "Introduction") {
      setIntroductionValue(userCV && userCV["Introduction"] ? userCV["Introduction"] : "");
      setShowIntroductionModal(true);
    } else if (section === "Contact Info") {
      setShowContactInfoModal(true);
      if (userCV && userCV["Contact Info"]) {
        try {
          const contactData = JSON.parse(userCV["Contact Info"]);
          setContactInfoData(normalizeContactInfo(contactData, lockedEmail));
        } catch (e) {
          setContactInfoData(DEFAULT_CONTACT_INFO_DATA);
          setUserCV({
            ...userCV,
            "Contact Info": JSON.stringify(DEFAULT_CONTACT_INFO_DATA),
          });
          setHasChanges(true);
        }
      } else {
        setContactInfoData(DEFAULT_CONTACT_INFO_DATA);
        setUserCV({
          ...userCV,
          "Contact Info": JSON.stringify(DEFAULT_CONTACT_INFO_DATA),
        });
        setHasChanges(true);
      }
    } else if (section === "Experience") {
      setShowExperienceModal(true);
      setEditingExperienceId(null);
    } else if (section === "Education") {
      setShowEducationModal(true);
      setEditingEducationId(null);
    } else if (section === "Projects") {
      setShowProjectsModal(true);
      setEditingProjectId(null);
    } else if (section === "Certifications") {
      setShowCertificationModal(true);
      setEditingCertificationId(null);
    } else if (section === "Awards") {
      setShowAwardModal(true);
      setEditingAwardId(null);
    } else if (section === "Skills") {
      setShowSkillModal(true);
    }
  }

  function handleContactInfoSave(contactInfo) {
    const normalizedContactInfo = normalizeContactInfo(contactInfo, lockedEmail);
    const contactInfoString = JSON.stringify(normalizedContactInfo);
    setUserCV({
      ...userCV,
      "Contact Info": contactInfoString,
    });
    setHasChanges(true);
    setContactInfoData(null);
  }

  function handleExperienceSave(newExperience: ExperienceItem) {
    let currentExperiences: ExperienceItem[] = [];
    
    if (userCV && userCV["Experience"]) {
      try {
        const parsed = JSON.parse(userCV["Experience"]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          currentExperiences = parsed;
        } else {
           currentExperiences = DEFAULT_EXPERIENCE_DATA;
        }
      } catch {
        currentExperiences = DEFAULT_EXPERIENCE_DATA;
      }
    } else {
       currentExperiences = DEFAULT_EXPERIENCE_DATA;
    }

    let updatedExperiences;
    if (editingExperienceId) {
      updatedExperiences = currentExperiences.map(exp => 
        exp.id === editingExperienceId ? newExperience : exp
      );
    } else {
      updatedExperiences = [...currentExperiences, newExperience];
    }

    const experienceString = JSON.stringify(updatedExperiences);
    setUserCV({
      ...userCV,
      Experience: experienceString,
    });
    setHasChanges(true);
    setEditingExperienceId(null);
  }

  function handleEditExperienceItem(id: string) {
    setEditingExperienceId(id);
    setShowExperienceModal(true);
  }

  function handleDeleteExperienceItem(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    
    if (window.confirm("Are you sure you want to delete this experience?")) {
      let currentExperiences: ExperienceItem[] = [];
      if (userCV && userCV["Experience"]) {
        try {
          const parsed = JSON.parse(userCV["Experience"]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            currentExperiences = parsed;
          } else {
             currentExperiences = DEFAULT_EXPERIENCE_DATA;
          }
        } catch {
             currentExperiences = DEFAULT_EXPERIENCE_DATA;
        }
      } else {
         currentExperiences = DEFAULT_EXPERIENCE_DATA;
      }

      const updatedExperiences = currentExperiences.filter(exp => exp.id !== id);
      const experienceString = JSON.stringify(updatedExperiences);
       setUserCV({
        ...userCV,
        Experience: experienceString,
      });
      setHasChanges(true);
    }
  }

  function handleEducationSave(newEducation: EducationItem) {
    let currentEducation: EducationItem[] = [];
    
    if (userCV && userCV["Education"]) {
      try {
        const parsed = JSON.parse(userCV["Education"]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          currentEducation = parsed;
        } else {
          currentEducation = DEFAULT_EDUCATION_DATA;
        }
      } catch {
        currentEducation = DEFAULT_EDUCATION_DATA;
      }
    } else {
      currentEducation = DEFAULT_EDUCATION_DATA;
    }

    let updatedEducation;
    if (editingEducationId) {
      updatedEducation = currentEducation.map(edu => 
        edu.id === editingEducationId ? newEducation : edu
      );
    } else {
      updatedEducation = [...currentEducation, newEducation];
    }

    const educationString = JSON.stringify(updatedEducation);
    setUserCV({
      ...userCV,
      Education: educationString,
    });
    setHasChanges(true);
    setEditingEducationId(null);
  }

  function handleEditEducationItem(id: string) {
    setEditingEducationId(id);
    setShowEducationModal(true);
  }

  function handleDeleteEducationItem(id: string, e?: React.MouseEvent) {
     if (e) e.stopPropagation();
    
    if (window.confirm("Are you sure you want to delete this education?")) {
      let currentEducation: EducationItem[] = [];
      if (userCV && userCV["Education"]) {
        try {
          const parsed = JSON.parse(userCV["Education"]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            currentEducation = parsed;
          } else {
             currentEducation = DEFAULT_EDUCATION_DATA;
          }
        } catch {
             currentEducation = DEFAULT_EDUCATION_DATA;
        }
      } else {
         currentEducation = DEFAULT_EDUCATION_DATA;
      }

      const updatedEducation = currentEducation.filter(edu => edu.id !== id);
      const educationString = JSON.stringify(updatedEducation);
       setUserCV({
        ...userCV,
        Education: educationString,
      });
      setHasChanges(true);
    }
  }

  function handleProjectsSave(newProject: ProjectItem) {
    let currentProjects: ProjectItem[] = [];
    
    if (userCV && userCV["Projects"]) {
      try {
        const parsed = JSON.parse(userCV["Projects"]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          currentProjects = parsed;
        } else {
          currentProjects = DEFAULT_PROJECTS_DATA;
        }
      } catch {
        currentProjects = DEFAULT_PROJECTS_DATA;
      }
    } else {
      currentProjects = DEFAULT_PROJECTS_DATA;
    }

    let updatedProjects;
    if (editingProjectId) {
      updatedProjects = currentProjects.map(proj => 
        proj.id === editingProjectId ? newProject : proj
      );
    } else {
      updatedProjects = [...currentProjects, newProject];
    }

    const projectsString = JSON.stringify(updatedProjects);
    setUserCV({
      ...userCV,
      Projects: projectsString,
    });
    setHasChanges(true);
    setEditingProjectId(null);
  }

  function handleEditProjectItem(id: string) {
    setEditingProjectId(id);
    setShowProjectsModal(true);
  }

  function handleDeleteProjectItem(id: string, e?: React.MouseEvent) {
     if (e) e.stopPropagation();
    
    if (window.confirm("Are you sure you want to delete this project?")) {
      let currentProjects: ProjectItem[] = [];
      if (userCV && userCV["Projects"]) {
        try {
          const parsed = JSON.parse(userCV["Projects"]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            currentProjects = parsed;
          } else {
             currentProjects = DEFAULT_PROJECTS_DATA;
          }
        } catch {
             currentProjects = DEFAULT_PROJECTS_DATA;
        }
      } else {
         currentProjects = DEFAULT_PROJECTS_DATA;
      }

      const updatedProjects = currentProjects.filter(proj => proj.id !== id);
      const projectsString = JSON.stringify(updatedProjects);
       setUserCV({
        ...userCV,
        Projects: projectsString,
      });
      setHasChanges(true);
    }
  }

  function handleCertificationsSave(newCertification: CertificationItem) {
    let currentCertifications: CertificationItem[] = [];
    
    if (userCV && userCV["Certifications"]) {
      try {
        const parsed = JSON.parse(userCV["Certifications"]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          currentCertifications = parsed;
        } else {
          currentCertifications = DEFAULT_CERTIFICATIONS_DATA;
        }
      } catch {
        currentCertifications = DEFAULT_CERTIFICATIONS_DATA;
      }
    } else {
      currentCertifications = DEFAULT_CERTIFICATIONS_DATA;
    }

    let updatedCertifications;
    if (editingCertificationId) {
      updatedCertifications = currentCertifications.map(cert => 
        cert.id === editingCertificationId ? newCertification : cert
      );
    } else {
      updatedCertifications = [...currentCertifications, newCertification];
    }

    const certificationsString = JSON.stringify(updatedCertifications);
    setUserCV({
      ...userCV,
      Certifications: certificationsString,
    });
    setHasChanges(true);
    setEditingCertificationId(null);
  }

  function handleEditCertificationItem(id: string) {
    setEditingCertificationId(id);
    setShowCertificationModal(true);
  }

  function handleDeleteCertificationItem(id: string, e?: React.MouseEvent) {
     if (e) e.stopPropagation();
    
    if (window.confirm("Are you sure you want to delete this certification?")) {
      let currentCertifications: CertificationItem[] = [];
      if (userCV && userCV["Certifications"]) {
        try {
          const parsed = JSON.parse(userCV["Certifications"]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            currentCertifications = parsed;
          } else {
             currentCertifications = DEFAULT_CERTIFICATIONS_DATA;
          }
        } catch {
             currentCertifications = DEFAULT_CERTIFICATIONS_DATA;
        }
      } else {
         currentCertifications = DEFAULT_CERTIFICATIONS_DATA;
      }

      const updatedCertifications = currentCertifications.filter(cert => cert.id !== id);
      const certificationsString = JSON.stringify(updatedCertifications);
       setUserCV({
        ...userCV,
        Certifications: certificationsString,
      });
      setHasChanges(true);
    }
  }

  function handleAwardsSave(newAward: AwardItem) {
    let currentAwards: AwardItem[] = [];
    
    if (userCV && userCV["Awards"]) {
      try {
        const parsed = JSON.parse(userCV["Awards"]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          currentAwards = parsed;
        } else {
          currentAwards = DEFAULT_AWARDS_DATA;
        }
      } catch {
        currentAwards = DEFAULT_AWARDS_DATA;
      }
    } else {
      currentAwards = DEFAULT_AWARDS_DATA;
    }

    let updatedAwards;
    if (editingAwardId) {
      updatedAwards = currentAwards.map(award => 
        award.id === editingAwardId ? newAward : award
      );
    } else {
      updatedAwards = [...currentAwards, newAward];
    }

    const awardsString = JSON.stringify(updatedAwards);
    setUserCV({
      ...userCV,
      Awards: awardsString,
    });
    setHasChanges(true);
    setEditingAwardId(null);
  }

  function handleEditAwardItem(id: string) {
    setEditingAwardId(id);
    setShowAwardModal(true);
  }

  function handleDeleteAwardItem(id: string, e?: React.MouseEvent) {
     if (e) e.stopPropagation();
    
    if (window.confirm("Are you sure you want to delete this award?")) {
      let currentAwards: AwardItem[] = [];
      if (userCV && userCV["Awards"]) {
        try {
          const parsed = JSON.parse(userCV["Awards"]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            currentAwards = parsed;
          } else {
             currentAwards = DEFAULT_AWARDS_DATA;
          }
        } catch {
             currentAwards = DEFAULT_AWARDS_DATA;
        }
      } else {
         currentAwards = DEFAULT_AWARDS_DATA;
      }

      const updatedAwards = currentAwards.filter(award => award.id !== id);
      const awardsString = JSON.stringify(updatedAwards);
       setUserCV({
        ...userCV,
        Awards: awardsString,
      });
      setHasChanges(true);
    }
  }

  function handleSkillModalSave(updatedSkills: string[]) {
    const limitedSkills = updatedSkills.slice(0, MAX_SKILLS);

    setSkills(limitedSkills);
    setUserCV({
      ...userCV,
      Skills: JSON.stringify(limitedSkills),
    });
    setHasChanges(true);
  }

  function handleIntroductionModalSave(updatedIntroduction: string) {
    setUserCV({
      ...userCV,
      Introduction: updatedIntroduction,
    });
    setHasChanges(true);
  }

  function handleFile(files) {
    const file = checkFile(files);

    if (file) {
      setDigitalCV(null);
      setFile(file);
      setUserCV(null);
      setSkills([]);
    }
  }

  function handleFileChange(e) {
    const files = e.target.files;

    if (files.length > 0) {
      handleFile(files);
    }
  }

  function handleRefresh() {
    if (buildingCV) {
      alert("CV building is in progress. Please wait for it to complete.");
    } else {
      setHasChanges(false);
      setLoading(true);
      setRefresh(true);
    }
  }

  function handleRemoveFile(e) {
    e.stopPropagation();
    e.target.value = "";

    if (buildingCV) {
      alert("You can't remove your file while JIA is building your profile.");
    } else {
      const currentContact = getCurrentContactInfo();
      const keepVerifiedPhone =
        currentContact?.isPhoneVerified === true &&
        typeof currentContact?.phone === "string" &&
        currentContact.phone.trim() !== "";
      const contactInfoOnlyCV = {
        Introduction: "",
        "Contact Info": JSON.stringify(
          normalizeContactInfo(
            {
              countryCode: "",
              address: "",
              linkedin: "",
              websites: [],
              phone: keepVerifiedPhone ? currentContact.phone : "",
              isPhoneVerified: keepVerifiedPhone,
              email: currentContact?.email || lockedEmail || user?.email || "",
            },
            lockedEmail,
          ),
        ),
        Experience: "",
        Skills: "",
        Education: "",
        Projects: "",
        Certifications: "",
        Awards: "",
      };

      setDigitalCV(null);
      setFile(null);
      setUserCV(contactInfoOnlyCV);
      setSkills([]);
      setHasChanges(true);
    }
  }

  useEffect(() => {
    let isMounted = true;

    const loadCVState = async () => {
      let resolvedCV: any = null;

      if (user?.email) {
        try {
          const response = await api.post("/api/whitecloak/fetch-cv");
          if (response?.data && (response.data?.structuredCV || response.data?.digitalCV)) {
            resolvedCV = response.data;
          }
        } catch (error) {
          console.log("No CV found in database");
        }
      }

      if (!isMounted) return;

      if (resolvedCV) {
        const formattedCV = resolvedCV?.structuredCV
          ? formatStructuredCVBySections(resolvedCV.structuredCV, lockedEmail)
          : formatCVBySections(resolvedCV?.digitalCV, lockedEmail);

        const loadedSkills = parseStructuredSkills(formattedCV["Skills"]);
        const candidateSkills = await loadCandidateSkills();

        setDigitalCV(JSON.stringify(resolvedCV));
        setFile(resolvedCV.fileInfo || null);
        setUserCV(formattedCV);
        setSkills(candidateSkills.length > 0 ? candidateSkills : loadedSkills);
      } else {
        const candidateSkills = await loadCandidateSkills();
        setDigitalCV(null);
        setFile(null);
        setUserCV(null);
        setSkills(candidateSkills);
      }

      if (!isMounted) return;
      setLoading(false);
      setRefresh(false);
    };

    loadCVState();

    return () => {
      isMounted = false;
    };
  }, [refresh, user?.email]);

  useEffect(() => {
    sessionStorage.setItem("hasChanges", JSON.stringify(hasChanges));
  }, [hasChanges]);

  function handleSaveChanges(skip, userCV) {
    const skillsMarkdown = skills
      .map((skill) => `- ${String(skill || "").trim()}`)
      .filter((line) => line !== "-")
      .join("\n");

    const formattedUserCV = DISPLAY_SECTIONS.map((section) => ({
      name: section,
      content:
        section === "Skills"
          ? skillsMarkdown
          : userCV[section]?.trim() || "",
    }));

    const allEmpty = formattedUserCV.every((section) => {
      if (section.name === "Skills") return skills.length === 0;
      return section.content.trim() === "";
    });

    if (allEmpty) {
      alert("No details to be save.");
      return false;
    }

    setModalType("loading");

    let parsedDigitalCV = {
      errorRemarks: null,
      digitalCV: null,
      structuredCV: null,
    };

    if (digitalCV) {
      parsedDigitalCV = JSON.parse(digitalCV);

      if (parsedDigitalCV.errorRemarks && !hasChanges) {
        alert(
          "Please fix the errors in the CV first.\n\n" +
            parsedDigitalCV.errorRemarks
        );
        return false;
      } else if (hasChanges) {
        parsedDigitalCV.errorRemarks = null;
      }
    }

    // Always persist the latest section edits, including Skills.
    parsedDigitalCV.digitalCV = formattedUserCV;

    parsedDigitalCV.structuredCV = buildStructuredCVFromSectionState(
      userCV,
      skills,
      lockedEmail
    );

    const data = {
      name: user.name,
      cvData: parsedDigitalCV,
      email: user.email,
      fileInfo: null,
    };

    if (file) {
      data.fileInfo = { name: file.name, size: file.size, type: file.type };
    }

    api.post(`/api/whitecloak/store-cv`, data)
      .then(() => {
        setHasChanges(false);
        setToasterType("manageCV");
        setDigitalCV(JSON.stringify({ ...data, ...data.cvData }));
        void loadCandidateSkills().then((candidateSkills) => {
          if (candidateSkills.length > 0) setSkills(candidateSkills);
        });
      })
      .catch((err) => {
        alert("Error saving CV. Please try again.");
        console.log(err);
      })
      .finally(() => {
        setBuildingCV(false);
        setModalType(null);
      });
  }

  function handleSubmit() {
    setBuildingCV(true);
    setHasChanges(true);
    const hasExistingCV = !!digitalCV;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("fName", file.name);
    formData.append("userEmail", user.email);

    axios({
      method: "POST",
      url: `${CORE_API_URL}/upload-cv`,
      data: formData,
    })
      .then((res) => {
        api.post(`/api/whitecloak/autofill-cv`, { 
          chunks: res.data.cvChunks
        })
          .then((res) => {
            const parsedUserCV = res?.data?.parsed || JSON.parse(res.data.result);
            const currentContactInfo = getCurrentContactInfo();
            const hasVerifiedPhone =
              currentContactInfo?.isPhoneVerified === true &&
              typeof currentContactInfo?.phone === "string" &&
              currentContactInfo.phone.trim() !== "";

            if (
              hasVerifiedPhone &&
              parsedUserCV?.structuredCV &&
              typeof parsedUserCV.structuredCV === "object"
            ) {
              const nextContactInfo = normalizeContactInfo(
                {
                  ...(parsedUserCV.structuredCV.contactInfo || {}),
                  phone: currentContactInfo.phone,
                  isPhoneVerified: true,
                },
                lockedEmail,
              );

              parsedUserCV.structuredCV = {
                ...parsedUserCV.structuredCV,
                contactInfo: nextContactInfo,
              };
            }

            const result = JSON.stringify(parsedUserCV);
            const formattedCV = parsedUserCV?.structuredCV
              ? formatStructuredCVBySections(parsedUserCV.structuredCV, lockedEmail)
              : formatCVBySections(parsedUserCV?.digitalCV, lockedEmail);
            const uploadedSkills = parseStructuredSkills(formattedCV["Skills"]);

            setDigitalCV(result);
            setUserCV(formattedCV);
            setSkills(uploadedSkills);

            if (!hasExistingCV) {
              const saveData = {
                name: user.name,
                cvData: parsedUserCV,
                email: user.email,
                fileInfo: file
                  ? { name: file.name, size: file.size, type: file.type }
                  : null,
              };

              api.post(`/api/whitecloak/store-cv`, saveData)
                .then(() => {
                  setHasChanges(false);
                  setToasterType("manageCV");
                  setDigitalCV(JSON.stringify({ ...saveData.cvData, fileInfo: saveData.fileInfo }));
                  void loadCandidateSkills().then((candidateSkills) => {
                    if (candidateSkills.length > 0) setSkills(candidateSkills);
                  });
                })
                .catch((err) => {
                  alert("Error saving CV. Please try again.");
                  console.log(err);
                })
                .finally(() => {
                  setBuildingCV(false);
                  setModalType(null);
                });
            } else {
              setBuildingCV(false);
            }
          })
          .catch((err) => {
            alert("Error building CV. Please try again.");
            setBuildingCV(false);
            console.log(err);
          });
      })
      .catch((err) => {
        alert("Error building CV. Please try again.");
        setBuildingCV(false);
        console.log(err);
      });
  }

  return (
    <div className={styles.manageCV}>
      <PhoneVerificationModal
        opened={
          isPhoneVerificationModalOpen &&
          (phoneVerificationStep === "phone" || phoneVerificationStep === "otp")
        }
        onClose={closePhoneVerificationModal}
        onBack={handleBackToPhone}
        step={phoneVerificationStep === "otp" ? "otp" : "phone"}
        organizationLogo={assetConstants.jiaLogo2}
        showRequirementSubtitle={false}
        mobileNumber={mobileNumber}
        mobileNumberError={mobileNumberError}
        onMobileNumberChange={(value) => {
          setMobileNumber(sanitizeInternationalPhoneInput(value));
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

      <div className={styles.textContainer}>
        <div className={styles.titleRow}>
          <span className={styles.name}>Manage CV</span>
          <div className={styles.newCvBadgeWrapper}>
            <span className={styles.newCvBadge}>
              <Star06 size={12} color="#175cd3" />
              New
            </span>
            <button
              type="button"
              className={styles.newCvHelp}
              aria-label="About the new CV structure"
            >
              ?
            </button>
            <div className={styles.newCvTooltip}>
              Your CV now uses a new structured format to organize your
              information more clearly. Some details may still be inconsistent,
              so please review each section and edit anything manually when
              needed.
            </div>
          </div>
        </div>
        <span className={styles.description}>
          Apply to more jobs in less time by managing your CV here.
        </span>
      </div>

      <div className={styles.cvContainer}>
        <div className={`${styles.gradient} ${styles.maxWidth}`}>
          <div className={styles.cvDetailsCard}>
            <span className={styles.uploadTitle}>
              <div className={styles.uploadIcon}>
                <img alt="" src={assetConstants.upload} />
              </div>
              Upload CV
              <img
                alt=""
                className={styles.refreshIcon}
                src={assetConstants.rotate}
                onClick={handleRefresh}
                onContextMenu={(e) => e.preventDefault()}
                onMouseEnter={() => setIsHover(true)}
                onMouseLeave={() => setIsHover(false)}
              />
              {isHover && (
                <div className={styles.hoverContainer}>
                  <span>Revert your CV to the previous saved version.</span>
                </div>
              )}
            </span>
            <div className={styles.uploadDetailsContainer}>
              {!loading && (
                <>
                  <div
                    className={`${styles.fileUpload} ${
                      file ? styles.uploaded : ""
                    }`}
                    onClick={handleClick}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    {file ? (
                      <div className={styles.uploadedFile}>
                        <img alt="" src={assetConstants.fileV2} />
                        <span>{file.name}</span>({formatFileSize(file.size)} MB)
                        <img
                          alt=""
                          className={styles.xIcon}
                          onClick={handleRemoveFile}
                          onContextMenu={(e) => e.preventDefault()}
                          src={assetConstants.xV2}
                        />
                      </div>
                    ) : (
                      <>
                        <img alt="" src={assetConstants.fileV2} />
                        <span className={styles.uploadFileText}>
                          <span>Click to upload</span> or drag and drop
                        </span>
                        <span className={styles.uploadFileRules}>
                          PDF, DOC, DOCX, or TXT (max 10MB)
                        </span>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    style={{ display: "none" }}
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                </>
              )}

              {(buildingCV || loading) && (
                <div className={styles.loadingContainer}>
                  <Image
                    alt=""
                    src={assetConstants.loading}
                    unoptimized
                    width={114}
                    height={90}
                  />
                  {buildingCV && (
                    <>
                      <span className={styles.cvExtract}>
                        Extracting information from your CV...
                      </span>
                      <span className={styles.building}>
                        Jia is building your profile...
                      </span>
                    </>
                  )}
                </div>
              )}

              {!buildingCV && !userCV && !loading && (
                <>
                  <span className={styles.uploadDetails}>
                    Upload your CV and let our AI automatically fill in your
                    profile information.
                  </span>
                  <button
                    className={file ? "" : "disabled"}
                    disabled={!file}
                    onClick={handleSubmit}
                  >
                    Submit
                  </button>
                </>
              )}

              {!buildingCV && userCV && !loading && (
                <>
                  {file && (
                    <span className={styles.cvUploaded}>
                      <img alt="" src={assetConstants.check} />
                      CV Uploaded
                    </span>
                  )}

                  <button
                    className={hasChanges ? "" : "disabled"}
                    disabled={!hasChanges}
                    onClick={() => handleSaveChanges(false, userCV)}
                  >
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={styles.cvDetailsContainer}>
          {DISPLAY_SECTIONS.map((section, index) => (
            <div key={index} className={styles.gradient}>
              <div className={styles.cvDetailsCard}>
                <span className={styles.sectionTitle}>
                  {section}

                  <div className={styles.editIcon}>
                    <img
                      alt=""
                      src={
                        section === "Experience" || section === "Education" || section === "Certifications" || section === "Projects" || section === "Awards"
                          ? assetConstants.plus
                          : assetConstants.edit
                      }
                      onClick={() => handleEditCV(section)}
                      onContextMenu={(e) => e.preventDefault()}
                      style={section === "Experience" || section === "Education" ? { width: 24, height: 24 } : {}}
                    />
                  </div>
                </span>

                <div className={styles.detailsContainer}>
                  {section === "Introduction" ? (
                    <IntroductionSectionContent
                      buildingCV={buildingCV}
                      loading={loading}
                      value={userCV?.[section]}
                    />
                  ) : section === "Contact Info" ? (
                    <ContactInfoSectionContent
                      buildingCV={buildingCV}
                      loading={loading}
                      value={userCV?.["Contact Info"]}
                      defaultContactInfo={hasUserCV ? DEFAULT_CONTACT_INFO_DATA : {}}
                      showPhoneVerifyButton={true}
                      onPhoneVerifyClick={openPhoneVerificationModal}
                    />
                  ) : section === "Experience" ? (
                    <ExperienceSectionContent
                      buildingCV={buildingCV}
                      loading={loading}
                      value={userCV?.[section]}
                      defaultExperienceData={hasUserCV ? DEFAULT_EXPERIENCE_DATA : []}
                      onEditExperienceItem={handleEditExperienceItem}
                    />
                  ) : section === "Skills" ? (
                    <SkillsSectionContent
                      buildingCV={buildingCV}
                      loading={loading}
                      skills={skills}
                    />
                  ) : section === "Education" ? (
                    <EducationSectionContent
                      buildingCV={buildingCV}
                      loading={loading}
                      value={userCV?.[section]}
                      defaultEducationData={hasUserCV ? DEFAULT_EDUCATION_DATA : []}
                      onEditEducationItem={handleEditEducationItem}
                    />
                  ) : (
                    <span
                      className={`${styles.sectionDetails} ${
                        userCV && userCV[section] && userCV[section].trim()
                          ? styles.withDetails
                          : ""
                      }`}
                    >
                      {buildingCV || loading ? (
                        <>
                          <div className={styles.loading} />
                          <div className={styles.loading} />
                        </>
                      ) : section === "Projects" ? (
                        <ProjectsSectionContent
                          value={userCV?.["Projects"]}
                          defaultProjectsData={hasUserCV ? DEFAULT_PROJECTS_DATA : []}
                          onEditProjectItem={handleEditProjectItem}
                        />
                      ) : section === "Certifications" ? (
                        <CertificationsSectionContent
                          value={userCV?.["Certifications"]}
                          defaultCertificationsData={hasUserCV ? DEFAULT_CERTIFICATIONS_DATA : []}
                          onEditCertificationItem={handleEditCertificationItem}
                        />
                      ) : section === "Awards" ? (
                        <AwardsSectionContent
                          value={userCV?.["Awards"]}
                          defaultAwardsData={hasUserCV ? DEFAULT_AWARDS_DATA : []}
                          onEditAwardItem={handleEditAwardItem}
                        />
                      ) : (
                        <span style={{ whiteSpace: "pre-wrap" }}>
                          {userCV && userCV[section] && userCV[section].trim()
                            ? userCV[section].trim()
                            : "Upload your CV to auto-fill this section."}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

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

      <ExperienceModal
        isOpen={showExperienceModal}
        onClose={() => {
          setShowExperienceModal(false);
          setEditingExperienceId(null);
        }}
        onSave={handleExperienceSave}
        onDelete={(id) => handleDeleteExperienceItem(id)}
        initialData={(() => {
          if (!editingExperienceId) return null;
          
          let found: ExperienceItem | undefined;
          
          if (userCV && userCV["Experience"]) {
            try {
              const data = JSON.parse(userCV["Experience"]);
              if (Array.isArray(data)) {
                found = data.find((e: ExperienceItem) => e.id === editingExperienceId);
              }
            } catch {}
          }
          
          if (!found) {
             found = DEFAULT_EXPERIENCE_DATA.find(e => e.id === editingExperienceId);
          }
          
          return found || null;
        })()}
      />

      <SkillModal
        isOpen={showSkillModal}
        onClose={() => setShowSkillModal(false)}
        onSave={handleSkillModalSave}
        initialSkills={skills}
        maxSkills={MAX_SKILLS}
      />

      <EducationModal
        isOpen={showEducationModal}
        onClose={() => setShowEducationModal(false)}
        onSave={handleEducationSave}
        onDelete={handleDeleteEducationItem}
        initialData={(() => {
          if (!editingEducationId) return null;
          
          let found: EducationItem | undefined;
          
          if (userCV && userCV["Education"]) {
            try {
              const data = JSON.parse(userCV["Education"]);
              if (Array.isArray(data)) {
                found = data.find((e: EducationItem) => e.id === editingEducationId);
              }
            } catch {}
          }
          
          if (!found) {
             found = DEFAULT_EDUCATION_DATA.find(e => e.id === editingEducationId);
          }
          
          return found || null;
        })()}
      />

      <ProjectsModal
        isOpen={showProjectsModal}
        onClose={() => {
          setShowProjectsModal(false);
          setEditingProjectId(null);
        }}
        onSave={handleProjectsSave}
        onDelete={handleDeleteProjectItem}
        initialData={(() => {
          if (!editingProjectId) return null;
          
          let found: ProjectItem | undefined;
          
          if (userCV && userCV["Projects"]) {
            try {
              const data = JSON.parse(userCV["Projects"]);
              if (Array.isArray(data)) {
                found = data.find((e: ProjectItem) => e.id === editingProjectId);
              }
            } catch {}
          }
          
          if (!found) {
             found = DEFAULT_PROJECTS_DATA.find(e => e.id === editingProjectId);
          }
          
          return found || null;
        })()}
      />

      <CertificationModal
        isOpen={showCertificationModal}
        onClose={() => {
          setShowCertificationModal(false);
          setEditingCertificationId(null);
        }}
        onSave={handleCertificationsSave}
        onDelete={handleDeleteCertificationItem}
        initialData={(() => {
          if (!editingCertificationId) return null;
          
          let found: CertificationItem | undefined;
          
          if (userCV && userCV["Certifications"]) {
            try {
              const data = JSON.parse(userCV["Certifications"]);
              if (Array.isArray(data)) {
                found = data.find((e: CertificationItem) => e.id === editingCertificationId);
              }
            } catch {}
          }
          
          if (!found) {
             found = DEFAULT_CERTIFICATIONS_DATA.find(e => e.id === editingCertificationId);
          }
          
          return found || null;
        })()}
      />

      <AwardModal
        isOpen={showAwardModal}
        onClose={() => {
          setShowAwardModal(false);
          setEditingAwardId(null);
        }}
        onSave={handleAwardsSave}
        onDelete={handleDeleteAwardItem}
        initialData={(() => {
          if (!editingAwardId) return null;
          
          let found: AwardItem | undefined;
          
          if (userCV && userCV["Awards"]) {
            try {
              const data = JSON.parse(userCV["Awards"]);
              if (Array.isArray(data)) {
                found = data.find((e: AwardItem) => e.id === editingAwardId);
              }
            } catch {}
          }
          
          if (!found) {
             found = DEFAULT_AWARDS_DATA.find(e => e.id === editingAwardId);
          }
          
          return found || null;
        })()}
      />
    </div>
  );
}
