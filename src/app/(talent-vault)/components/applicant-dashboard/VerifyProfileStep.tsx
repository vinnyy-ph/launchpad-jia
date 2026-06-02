"use client";

import styles from "@/app/(talent-vault)/styles/modules/profile-setup.module.scss";
import { useEffect, useMemo, useState } from "react";
import { assetConstants } from "@/lib/utils/constantsV2";
import { UploadIcon } from "../icons/Upload";

// Section display components
import IntroductionSectionContent from "@/lib/components/screens/IntroductionSectionContent";
import ContactInfoSectionContent from "@/lib/components/screens/ContactInfoSectionContent";
import ExperienceSectionContent from "@/lib/components/screens/ExperienceSectionContent";
import EducationSectionContent from "@/lib/components/screens/EducationSectionContent";
import SkillsSectionContent from "@/lib/components/screens/SkillsSectionContent";
import ProjectsSectionContent from "@/lib/components/screens/ProjectsSectionContent";
import CertificationsSectionContent from "@/lib/components/screens/CertificationsSectionContent";
import AwardsSectionContent from "@/lib/components/screens/AwardsSectionContent";

// Modal components
import IntroductionModal from "@/lib/components/screens/IntroductionModal";
import ContactInfoModal from "@/lib/components/screens/ContactInfoModal";
import ExperienceModal, {
  type ExperienceItem,
} from "@/lib/components/screens/ExperienceModal";
import SkillModal from "@/lib/components/screens/SkillModal";
import EducationModal, {
  type EducationItem,
} from "@/lib/components/screens/EducationModal";
import ProjectsModal, {
  type ProjectItem,
} from "@/lib/components/screens/ProjectsModal";
import CertificationModal, {
  type CertificationItem,
} from "@/lib/components/screens/CertificationModal";
import AwardModal, {
  type AwardItem,
} from "@/lib/components/screens/AwardModal";

import {
  normalizeStructuredCVInput,
  buildStructuredCVFromDigitalCV,
  buildDigitalCVFromStructuredCV,
  type StructuredCV,
  type ContactInfoSection,
} from "@/lib/utils/structuredCV";

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

const ARRAY_SECTIONS = [
  "Experience",
  "Education",
  "Projects",
  "Certifications",
  "Awards",
];

const MAX_SKILLS = 60;

type DigitalCvSection = {
  name: string;
  content: string;
};

export type VerifyProfileMatchingSignals = {
  roleTitles?: string[];
  hardSkills?: string[];
  domains?: string[];
  industries?: string[];
  seniority?: string | null;
  keywords?: string[];
  confidence?: number | null;
} | null;

export type VerifyProfileInitialData = {
  digitalCV: DigitalCvSection[];
  structuredCV?: StructuredCV | null;
  education?: any[];
  fileInfo?: {
    name?: string;
    size?: number;
    type?: string;
  } | null;
  matchingSignals?: VerifyProfileMatchingSignals;
};

export type VerifyProfileContinuePayload = {
  digitalCV: DigitalCvSection[];
  structuredCV: StructuredCV;
  education: any[];
  fileInfo: {
    name?: string;
    size?: number;
    type?: string;
  } | null;
  matchingSignals?: VerifyProfileMatchingSignals;
};

interface VerifyProfileStepProps {
  initialData?: VerifyProfileInitialData | null;
  onResubmit?(): void;
  onContinue?(payload: VerifyProfileContinuePayload): Promise<void> | void;
  isSaving?: boolean;
}

// -- Helpers --

function safeJsonParse<T>(value: unknown, fallback: T): T;
function safeJsonParse(value: unknown): any;
function safeJsonParse(value: unknown, fallback: any = null) {
  if (typeof value !== "string" || !value || value === "null") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
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

const DEFAULT_CONTACT_INFO_DATA: ContactInfoSection = {
  email: "",
  phone: "",
  isPhoneVerified: false,
  countryCode: "",
  address: "",
  linkedin: "",
  websites: [],
};

function buildUserCVFromInitialData(initialData: VerifyProfileInitialData): {
  userCV: Record<string, string>;
  skills: string[];
  structuredCV: StructuredCV;
} {
  const structuredCV = initialData.structuredCV
    ? normalizeStructuredCVInput(initialData.structuredCV)
    : buildStructuredCVFromDigitalCV(initialData.digitalCV);

  const userCV: Record<string, string> = {
    Introduction: structuredCV.introduction,
    "Contact Info": JSON.stringify(structuredCV.contactInfo),
    Experience: JSON.stringify(structuredCV.experience),
    Skills: JSON.stringify(structuredCV.skills),
    Education: JSON.stringify(structuredCV.education),
    Projects: JSON.stringify(structuredCV.projects),
    Certifications: JSON.stringify(structuredCV.certifications),
    Awards: JSON.stringify(structuredCV.awards),
  };

  return { userCV, skills: structuredCV.skills, structuredCV };
}

// -- Component --

export function VerifyProfileStep({
  initialData,
  onResubmit,
  onContinue,
  isSaving = false,
}: VerifyProfileStepProps) {
  const [userCV, setUserCV] = useState<Record<string, string> | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [file, setFile] = useState<VerifyProfileInitialData["fileInfo"]>(null);
  const [matchingSignals, setMatchingSignals] = useState<
    VerifyProfileContinuePayload["matchingSignals"] | undefined
  >(undefined);

  // Per-section modal state
  const [showIntroductionModal, setShowIntroductionModal] = useState(false);
  const [introductionValue, setIntroductionValue] = useState("");
  const [showContactInfoModal, setShowContactInfoModal] = useState(false);
  const [contactInfoData, setContactInfoData] =
    useState<ContactInfoSection | null>(null);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [showExperienceModal, setShowExperienceModal] = useState(false);
  const [editingExperienceId, setEditingExperienceId] = useState<string | null>(
    null
  );
  const [showEducationModal, setShowEducationModal] = useState(false);
  const [editingEducationId, setEditingEducationId] = useState<string | null>(
    null
  );
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [showCertificationModal, setShowCertificationModal] = useState(false);
  const [editingCertificationId, setEditingCertificationId] = useState<
    string | null
  >(null);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [editingAwardId, setEditingAwardId] = useState<string | null>(null);

  // Any modal open → block continue
  const isAnyModalOpen =
    showIntroductionModal ||
    showContactInfoModal ||
    showSkillModal ||
    showExperienceModal ||
    showEducationModal ||
    showProjectsModal ||
    showCertificationModal ||
    showAwardModal;

  // -- Initialization effect --

  useEffect(() => {
    if (!initialData?.digitalCV || !Array.isArray(initialData.digitalCV)) {
      setUserCV(null);
      setSkills([]);
      setFile(null);
      setMatchingSignals(undefined);
      return;
    }

    const { userCV: nextUserCV, skills: nextSkills } =
      buildUserCVFromInitialData(initialData);
    setUserCV(nextUserCV);
    setSkills(nextSkills);
    setFile(initialData.fileInfo || null);
    setMatchingSignals(initialData.matchingSignals);
  }, [initialData]);

  const canContinue = useMemo(
    () => !isSaving && !!userCV && !isAnyModalOpen,
    [isSaving, userCV, isAnyModalOpen]
  );

  // -- Edit handler (opens the correct modal) --

  function handleEditCV(section: string) {
    if (section === "Introduction") {
      setIntroductionValue(userCV?.["Introduction"] || "");
      setShowIntroductionModal(true);
      return;
    }

    if (section === "Contact Info") {
      const parsed = safeJsonParse(userCV?.["Contact Info"]);
      setContactInfoData(
        parsed && typeof parsed === "object"
          ? { ...DEFAULT_CONTACT_INFO_DATA, ...parsed }
          : { ...DEFAULT_CONTACT_INFO_DATA }
      );
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

  // -- Section save handlers --

  function handleIntroductionModalSave(updatedIntroduction: string) {
    setUserCV((prev) => ({
      ...(prev || {}),
      Introduction: updatedIntroduction,
    }));
  }

  function handleContactInfoSave(contactInfo: any) {
    setUserCV((prev) => ({
      ...(prev || {}),
      "Contact Info": JSON.stringify(contactInfo),
    }));
    setContactInfoData(null);
  }

  function handleSkillModalSave(updatedSkills: string[]) {
    const limitedSkills = updatedSkills.slice(0, MAX_SKILLS);
    setSkills(limitedSkills);
    setUserCV((prev) => ({
      ...(prev || {}),
      Skills: JSON.stringify(limitedSkills),
    }));
  }

  // Experience
  function handleExperienceSave(newExperience: ExperienceItem) {
    const current = parseSectionArray<ExperienceItem>(userCV?.["Experience"]);
    const updated = editingExperienceId
      ? current.map((exp) =>
          exp.id === editingExperienceId ? newExperience : exp
        )
      : [...current, newExperience];

    setUserCV((prev) => ({
      ...(prev || {}),
      Experience: JSON.stringify(updated),
    }));
    setEditingExperienceId(null);
  }

  function handleEditExperienceItem(id: string) {
    setEditingExperienceId(id);
    setShowExperienceModal(true);
  }

  function handleDeleteExperienceItem(id: string) {
    const current = parseSectionArray<ExperienceItem>(userCV?.["Experience"]);
    const updated = current.filter((exp) => exp.id !== id);
    setUserCV((prev) => ({
      ...(prev || {}),
      Experience: JSON.stringify(updated),
    }));
  }

  // Education
  function handleEducationSave(newEducation: EducationItem) {
    const current = parseSectionArray<EducationItem>(userCV?.["Education"]);
    const updated = editingEducationId
      ? current.map((edu) =>
          edu.id === editingEducationId ? newEducation : edu
        )
      : [...current, newEducation];

    setUserCV((prev) => ({
      ...(prev || {}),
      Education: JSON.stringify(updated),
    }));
    setEditingEducationId(null);
  }

  function handleEditEducationItem(id: string) {
    setEditingEducationId(id);
    setShowEducationModal(true);
  }

  function handleDeleteEducationItem(id: string) {
    const current = parseSectionArray<EducationItem>(userCV?.["Education"]);
    const updated = current.filter((edu) => edu.id !== id);
    setUserCV((prev) => ({
      ...(prev || {}),
      Education: JSON.stringify(updated),
    }));
  }

  // Projects
  function handleProjectsSave(newProject: ProjectItem) {
    const current = parseSectionArray<ProjectItem>(userCV?.["Projects"]);
    const updated = editingProjectId
      ? current.map((project) =>
          project.id === editingProjectId ? newProject : project
        )
      : [...current, newProject];

    setUserCV((prev) => ({
      ...(prev || {}),
      Projects: JSON.stringify(updated),
    }));
    setEditingProjectId(null);
  }

  function handleEditProjectItem(id: string) {
    setEditingProjectId(id);
    setShowProjectsModal(true);
  }

  function handleDeleteProjectItem(id: string) {
    const current = parseSectionArray<ProjectItem>(userCV?.["Projects"]);
    const updated = current.filter((project) => project.id !== id);
    setUserCV((prev) => ({
      ...(prev || {}),
      Projects: JSON.stringify(updated),
    }));
  }

  // Certifications
  function handleCertificationsSave(newCertification: CertificationItem) {
    const current = parseSectionArray<CertificationItem>(
      userCV?.["Certifications"]
    );
    const updated = editingCertificationId
      ? current.map((cert) =>
          cert.id === editingCertificationId ? newCertification : cert
        )
      : [...current, newCertification];

    setUserCV((prev) => ({
      ...(prev || {}),
      Certifications: JSON.stringify(updated),
    }));
    setEditingCertificationId(null);
  }

  function handleEditCertificationItem(id: string) {
    setEditingCertificationId(id);
    setShowCertificationModal(true);
  }

  function handleDeleteCertificationItem(id: string) {
    const current = parseSectionArray<CertificationItem>(
      userCV?.["Certifications"]
    );
    const updated = current.filter((cert) => cert.id !== id);
    setUserCV((prev) => ({
      ...(prev || {}),
      Certifications: JSON.stringify(updated),
    }));
  }

  // Awards
  function handleAwardsSave(newAward: AwardItem) {
    const current = parseSectionArray<AwardItem>(userCV?.["Awards"]);
    const updated = editingAwardId
      ? current.map((award) =>
          award.id === editingAwardId ? newAward : award
        )
      : [...current, newAward];

    setUserCV((prev) => ({
      ...(prev || {}),
      Awards: JSON.stringify(updated),
    }));
    setEditingAwardId(null);
  }

  function handleEditAwardItem(id: string) {
    setEditingAwardId(id);
    setShowAwardModal(true);
  }

  function handleDeleteAwardItem(id: string) {
    const current = parseSectionArray<AwardItem>(userCV?.["Awards"]);
    const updated = current.filter((award) => award.id !== id);
    setUserCV((prev) => ({
      ...(prev || {}),
      Awards: JSON.stringify(updated),
    }));
  }

  // -- Continue handler --

  const handleContinueClick = async () => {
    if (!userCV) return;

    if (isAnyModalOpen) {
      alert("Please close the current edit modal first.");
      return;
    }

    // Build structuredCV from current userCV state
    const structuredCV = normalizeStructuredCVInput({
      introduction: userCV["Introduction"] || "",
      contactInfo: safeJsonParse(userCV["Contact Info"]),
      experience: safeJsonParse(userCV["Experience"], []),
      skills,
      education: safeJsonParse(userCV["Education"], []),
      projects: safeJsonParse(userCV["Projects"], []),
      certifications: safeJsonParse(userCV["Certifications"], []),
      awards: safeJsonParse(userCV["Awards"], []),
    });

    // Build legacy digitalCV for backward compat
    const digitalCV = buildDigitalCVFromStructuredCV(structuredCV);

    await onContinue?.({
      digitalCV,
      structuredCV,
      education: structuredCV.education,
      fileInfo: file || null,
      ...(matchingSignals !== undefined ? { matchingSignals } : {}),
    });
  };

  // -- Section content rendering helper --

  function renderSectionContent(section: string) {
    switch (section) {
      case "Introduction":
        return (
          <IntroductionSectionContent
            buildingCV={false}
            loading={false}
            value={userCV?.["Introduction"]}
          />
        );
      case "Contact Info":
        return (
          <ContactInfoSectionContent
            buildingCV={false}
            loading={false}
            value={userCV?.["Contact Info"]}
            defaultContactInfo={DEFAULT_CONTACT_INFO_DATA}
          />
        );
      case "Skills":
        return (
          <SkillsSectionContent
            buildingCV={false}
            loading={false}
            skills={skills}
          />
        );
      case "Experience":
        return (
          <ExperienceSectionContent
            buildingCV={false}
            loading={false}
            value={userCV?.["Experience"]}
            defaultExperienceData={[]}
            onEditExperienceItem={handleEditExperienceItem}
          />
        );
      case "Education":
        return (
          <EducationSectionContent
            buildingCV={false}
            loading={false}
            value={userCV?.["Education"]}
            defaultEducationData={[]}
            onEditEducationItem={handleEditEducationItem}
          />
        );
      case "Projects":
        return (
          <span
            className={`${styles.sectionDetails} ${
              userCV?.["Projects"]?.trim() ? styles.withDetails : ""
            }`}
          >
            <ProjectsSectionContent
              value={userCV?.["Projects"]}
              defaultProjectsData={[]}
              onEditProjectItem={handleEditProjectItem}
            />
          </span>
        );
      case "Certifications":
        return (
          <span
            className={`${styles.sectionDetails} ${
              userCV?.["Certifications"]?.trim() ? styles.withDetails : ""
            }`}
          >
            <CertificationsSectionContent
              value={userCV?.["Certifications"]}
              defaultCertificationsData={[]}
              onEditCertificationItem={handleEditCertificationItem}
            />
          </span>
        );
      case "Awards":
        return (
          <span
            className={`${styles.sectionDetails} ${
              userCV?.["Awards"]?.trim() ? styles.withDetails : ""
            }`}
          >
            <AwardsSectionContent
              value={userCV?.["Awards"]}
              defaultAwardsData={[]}
              onEditAwardItem={handleEditAwardItem}
            />
          </span>
        );
      default:
        return null;
    }
  }

  // -- Render --

  return (
    <div className={styles.cvDetailsContainer}>
      <div className={styles.gradient}>
        <div className={styles.cvDetailsCard}>
          <span className={styles.sectionTitle}>
            <img alt="" src="/iconsV3/account.svg" />
            Submit CV
            <div className={styles.resubmitBtn} onClick={onResubmit}>
              <UploadIcon /> <span>Resubmit</span>
            </div>
          </span>

          <div className={styles.detailsContainer}>
            {file ? (
              <span className={styles.fileTitle}>
                <img alt="" src="/iconsV3/checkV4.svg" />
                {file.name}
              </span>
            ) : (
              <span className={styles.fileTitle}>
                <img alt="" src="/iconsV3/fileV2.svg" />
                You can also upload your CV and let our AI automatically fill in
                your profile information.
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
                    ARRAY_SECTIONS.includes(section)
                      ? assetConstants.plus
                      : assetConstants.edit
                  }
                  onClick={() => handleEditCV(section)}
                  onContextMenu={(e) => e.preventDefault()}
                  style={
                    ARRAY_SECTIONS.includes(section)
                      ? { width: 24, height: 24 }
                      : {}
                  }
                />
              </div>
            </span>
            <div className={styles.detailsContainer}>
              {renderSectionContent(section)}
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={handleContinueClick}
        disabled={!canContinue}
        style={{
          opacity: canContinue ? 1 : 0.7,
          cursor: canContinue ? "pointer" : "not-allowed",
        }}
      >
        {isSaving ? "Saving..." : "Continue"}
      </button>

      {/* Modals */}
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
    </div>
  );
}
