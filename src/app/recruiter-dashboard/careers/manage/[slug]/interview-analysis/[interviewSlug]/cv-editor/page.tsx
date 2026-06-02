"use client";

import HeaderBar from "@/lib/PageComponent/HeaderBar";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/utils/apiClient";
import LoadingAnimation from "@/lib/components/Loaders/LoadingAnimation";
import IntroductionSectionContent from "@/lib/components/screens/IntroductionSectionContent";
import ContactInfoSectionContent from "@/lib/components/screens/ContactInfoSectionContent";
import ExperienceSectionContent from "@/lib/components/screens/ExperienceSectionContent";
import EducationSectionContent from "@/lib/components/screens/EducationSectionContent";
import ProjectsSectionContent from "@/lib/components/screens/ProjectsSectionContent";
import CertificationsSectionContent from "@/lib/components/screens/CertificationsSectionContent";
import AwardsSectionContent from "@/lib/components/screens/AwardsSectionContent";
import SkillsSectionContent from "@/lib/components/screens/SkillsSectionContent";
import IntroductionModal from "@/lib/components/screens/IntroductionModal";
import ContactInfoModal from "@/lib/components/screens/ContactInfoModal";
import ExperienceModal, {
  type ExperienceItem,
} from "@/lib/components/screens/ExperienceModal";
import EducationModal, {
  type EducationItem,
} from "@/lib/components/screens/EducationModal";
import ProjectsModal, {
  type ProjectItem,
} from "@/lib/components/screens/ProjectsModal";
import CertificationModal, {
  type CertificationItem,
} from "@/lib/components/screens/CertificationModal";
import AwardModal, { type AwardItem } from "@/lib/components/screens/AwardModal";
import SkillModal from "@/lib/components/screens/SkillModal";
import {
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogIcon,
  DialogTextGroup,
  DialogTitle,
} from "@/lib/components/ui";
import {
  buildStructuredCVFromDigitalCV,
  normalizeStructuredCVInput,
  type StructuredCV,
} from "@/lib/utils/structuredCV";
import { parseSkillsFromMarkdown } from "@/lib/Utils";
import { useAppContext } from "@/lib/context/AppContext";

type SectionName =
  | "Introduction"
  | "Contact Info"
  | "Experience"
  | "Skills"
  | "Education"
  | "Projects"
  | "Certifications"
  | "Awards";

type SectionMap = Record<SectionName, string>;

const EMPTY_SECTION_MAP: SectionMap = {
  "Introduction": "",
  "Contact Info": "",
  "Experience": "",
  "Skills": "",
  "Education": "",
  "Projects": "",
  "Certifications": "",
  "Awards": "",
};

function normalizeContactInfoWithLockedEmail(
  contactInfo: StructuredCV["contactInfo"] | null | undefined,
  lockedEmail?: string
): StructuredCV["contactInfo"] {
  const source =
    contactInfo && typeof contactInfo === "object" ? contactInfo : null;
  const normalizedLockedEmail =
    typeof lockedEmail === "string" ? lockedEmail.trim() : "";

  return {
    email: normalizedLockedEmail || source?.email || "",
    phone: source?.phone || "",
    countryCode: source?.countryCode || "",
    address: source?.address || "",
    linkedin: source?.linkedin || "",
    websites: Array.isArray(source?.websites) ? source.websites : [],
  };
}

function normalizeStructuredCVWithLockedEmail(
  structuredCV: StructuredCV,
  lockedEmail?: string
): StructuredCV {
  return {
    ...structuredCV,
    contactInfo: normalizeContactInfoWithLockedEmail(
      structuredCV.contactInfo,
      lockedEmail
    ),
  };
}

function formatStructuredCVBySections(
  structuredCV: StructuredCV | null,
  lockedEmail?: string
): SectionMap {
  if (!structuredCV) return { ...EMPTY_SECTION_MAP };

  const sectionMap: SectionMap = { ...EMPTY_SECTION_MAP };

  if (structuredCV.introduction?.trim()) {
    sectionMap["Introduction"] = structuredCV.introduction.trim();
  }

  if (structuredCV.contactInfo) {
    const contact = normalizeContactInfoWithLockedEmail(
      structuredCV.contactInfo,
      lockedEmail
    );
    const hasContact =
      Boolean(contact.email?.trim()) ||
      Boolean(contact.phone?.trim()) ||
      Boolean(contact.countryCode?.trim()) ||
      Boolean(contact.address?.trim()) ||
      Boolean(contact.linkedin?.trim()) ||
      (Array.isArray(contact.websites) &&
        contact.websites.some((item) => Boolean(item?.url?.trim())));

    if (hasContact) {
      sectionMap["Contact Info"] = JSON.stringify(contact);
    }
  }

  if (structuredCV.experience.length > 0) {
    sectionMap["Experience"] = JSON.stringify(structuredCV.experience);
  }
  if (Array.isArray(structuredCV.skills) && structuredCV.skills.length > 0) {
    sectionMap["Skills"] = JSON.stringify(structuredCV.skills);
  }
  if (structuredCV.education.length > 0) {
    sectionMap["Education"] = JSON.stringify(structuredCV.education);
  }
  if (structuredCV.projects.length > 0) {
    sectionMap["Projects"] = JSON.stringify(structuredCV.projects);
  }
  if (structuredCV.certifications.length > 0) {
    sectionMap["Certifications"] = JSON.stringify(structuredCV.certifications);
  }
  if (structuredCV.awards.length > 0) {
    sectionMap["Awards"] = JSON.stringify(structuredCV.awards);
  }

  return sectionMap;
}

function parseSkillsFromStructuredContent(value: string): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  } catch {
    return parseSkillsFromMarkdown(value);
  }
}

const shellStyle: React.CSSProperties = { padding: 10 };

function SectionCard({
  title,
  children,
  onEdit,
  showEditedBadge = false,
}: {
  title: string;
  children: React.ReactNode;
  onEdit?: () => void;
  showEditedBadge?: boolean;
}) {
  return (
    <div className="layered-card-middle" style={shellStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "6px 0 6px 16px",
        }}
      >
        <span style={{ fontSize: 16, color: "#181D27", fontWeight: 500 }}>
          {title}
        </span>
        {onEdit ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {showEditedBadge ? (
              <Badge
                backgroundColor="#FFFAEB"
                borderColor="#FEC84B"
                textColor="#B54708"
                radius="md"
                size="md"
                variant="outline"
              >
                Edited
              </Badge>
            ) : null}
            <button
              type="button"
              onClick={onEdit}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "1px solid #D5D7DA",
                background: "#FFFFFF",
                color: "#667085",
                cursor: "pointer",
              }}
            >
              <i className="la la-pen" />
            </button>
          </div>
        ) : null}
      </div>
      <div className="layered-card-content">{children}</div>
    </div>
  );
}

export default function CVEditorPage() {
  const { orgID: contextOrgID } = useAppContext();
  const router = useRouter();
  const params = useParams<{ slug: string; interviewSlug: string }>();
  const searchParams = useSearchParams();

  const orgIDParam = searchParams.get("orgID") || "";
  const orgID = orgIDParam || contextOrgID || "";
  const versionId = searchParams.get("versionId") || "";
  const candidateEmail = searchParams.get("candidateEmail") || "";
  const interviewAnalysisHref = useMemo(() => {
    if (!params?.slug || !params?.interviewSlug) return "";

    const basePath = `/recruiter-dashboard/careers/manage/${params.slug}/interview-analysis/${params.interviewSlug}`;
    const query = new URLSearchParams();
    if (orgID) query.set("orgID", orgID);
    if (candidateEmail) query.set("candidateEmail", candidateEmail);
    const queryString = query.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  }, [candidateEmail, orgID, params?.interviewSlug, params?.slug]);
  const navigateBackToInterviewAnalysis = useCallback(() => {
    if (!interviewAnalysisHref) {
      router.back();
      return;
    }
    router.push(interviewAnalysisHref);
  }, [interviewAnalysisHref, router]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<"" | "saved">("");
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const [interviewInfo, setInterviewInfo] = useState<any>(null);
  const [versionLabel, setVersionLabel] = useState("CV Version");
  const [baseStructuredCV, setBaseStructuredCV] = useState<StructuredCV | null>(null);
  const [savedStructuredCV, setSavedStructuredCV] = useState<StructuredCV | null>(null);
  const [currentStructuredCV, setCurrentStructuredCV] = useState<StructuredCV | null>(null);
  const [persistedEditedSections, setPersistedEditedSections] = useState<string[]>([]);
  const [isIntroductionModalOpen, setIsIntroductionModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isSkillsModalOpen, setIsSkillsModalOpen] = useState(false);
  const [isExperienceModalOpen, setIsExperienceModalOpen] = useState(false);
  const [isEducationModalOpen, setIsEducationModalOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isCertificationModalOpen, setIsCertificationModalOpen] = useState(false);
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [editingExperienceId, setEditingExperienceId] = useState<string | null>(null);
  const [editingEducationId, setEditingEducationId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingCertificationId, setEditingCertificationId] = useState<string | null>(null);
  const [editingAwardId, setEditingAwardId] = useState<string | null>(null);
  const pendingNavigationRef = useRef<(() => void) | null>(null);
  const hasPushedGuardRef = useRef(false);
  const bypassPopstateRef = useRef(false);
  const lockedCandidateEmail = useMemo(() => {
    const emailFromQuery =
      typeof candidateEmail === "string" ? candidateEmail.trim() : "";
    if (emailFromQuery) return emailFromQuery;

    const emailFromInterview =
      typeof interviewInfo?.email === "string" ? interviewInfo.email.trim() : "";
    return emailFromInterview;
  }, [candidateEmail, interviewInfo?.email]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      if (!orgID || !versionId) {
        setIsLoading(false);
        return;
      }

      try {
        const [versionRes, interviewRes] = await Promise.all([
          api.post("/api/whitecloak/cv-version/get", { orgID, versionId }),
          api.post("/api/interview-details", {
            id: params?.interviewSlug,
            orgID,
          }),
        ]);

        const version = versionRes?.data?.version;
        const interview = interviewRes?.data;

        const normalizedCurrent = version?.structuredCV
          ? normalizeStructuredCVInput(version.structuredCV)
          : buildStructuredCVFromDigitalCV(
              Array.isArray(version?.digitalCV) ? version.digitalCV : []
            );
        const normalizedBase = version?.baseStructuredCV
          ? normalizeStructuredCVInput(version.baseStructuredCV)
          : normalizedCurrent;
        const emailFromQuery =
          typeof candidateEmail === "string" ? candidateEmail.trim() : "";
        const emailFromInterview =
          typeof interview?.email === "string" ? interview.email.trim() : "";
        const resolvedLockedEmail = emailFromQuery || emailFromInterview;
        const lockedCurrent = normalizeStructuredCVWithLockedEmail(
          normalizedCurrent,
          resolvedLockedEmail
        );
        const lockedBase = normalizeStructuredCVWithLockedEmail(
          normalizedBase,
          resolvedLockedEmail
        );

        setVersionLabel(version?.label || "CV Version");
        setBaseStructuredCV(lockedBase);
        setSavedStructuredCV(lockedCurrent);
        setCurrentStructuredCV(lockedCurrent);
        setPersistedEditedSections(
          Array.isArray(version?.editedSections) ? version.editedSections : []
        );
        setSaveFeedback("");
        setInterviewInfo(interview || null);
      } catch (error) {
        console.error("Failed to load cv editor data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [candidateEmail, orgID, params?.interviewSlug, versionId]);

  useEffect(() => {
    if (!lockedCandidateEmail) return;

    setBaseStructuredCV((prev) =>
      prev ? normalizeStructuredCVWithLockedEmail(prev, lockedCandidateEmail) : prev
    );
    setSavedStructuredCV((prev) =>
      prev ? normalizeStructuredCVWithLockedEmail(prev, lockedCandidateEmail) : prev
    );
    setCurrentStructuredCV((prev) =>
      prev ? normalizeStructuredCVWithLockedEmail(prev, lockedCandidateEmail) : prev
    );
  }, [lockedCandidateEmail]);

  const sectionValues = useMemo(
    () => formatStructuredCVBySections(currentStructuredCV, lockedCandidateEmail),
    [currentStructuredCV, lockedCandidateEmail]
  );

  const hasSectionContent = useMemo(
    () => ({
      introduction: sectionValues["Introduction"].trim().length > 0,
      contactInfo: sectionValues["Contact Info"].trim().length > 0,
      experience: sectionValues["Experience"].trim().length > 0,
      skills: sectionValues["Skills"].trim().length > 0,
      education: sectionValues["Education"].trim().length > 0,
      projects: sectionValues["Projects"].trim().length > 0,
      certifications: sectionValues["Certifications"].trim().length > 0,
      awards: sectionValues["Awards"].trim().length > 0,
    }),
    [sectionValues]
  );

  const skills = useMemo(
    () => parseSkillsFromStructuredContent(sectionValues["Skills"]),
    [sectionValues]
  );
  const editingExperience = useMemo(
    () =>
      currentStructuredCV?.experience.find((item) => item.id === editingExperienceId) ??
      null,
    [currentStructuredCV?.experience, editingExperienceId]
  );
  const editingEducation = useMemo(
    () =>
      currentStructuredCV?.education.find((item) => item.id === editingEducationId) ??
      null,
    [currentStructuredCV?.education, editingEducationId]
  );
  const editingProject = useMemo(
    () =>
      currentStructuredCV?.projects.find((item) => item.id === editingProjectId) ?? null,
    [currentStructuredCV?.projects, editingProjectId]
  );
  const editingCertification = useMemo(
    () =>
      currentStructuredCV?.certifications.find(
        (item) => item.id === editingCertificationId
      ) ?? null,
    [currentStructuredCV?.certifications, editingCertificationId]
  );
  const editingAward = useMemo(
    () =>
      currentStructuredCV?.awards.find((item) => item.id === editingAwardId) ?? null,
    [currentStructuredCV?.awards, editingAwardId]
  );
  const editedSectionFlags = useMemo(() => {
    if (!baseStructuredCV || !currentStructuredCV) {
      return {
        introduction: false,
        contactInfo: false,
        skills: false,
      };
    }

    return {
      introduction:
        baseStructuredCV.introduction !== currentStructuredCV.introduction ||
        persistedEditedSections.includes("introduction"),
      contactInfo:
        JSON.stringify(baseStructuredCV.contactInfo) !==
          JSON.stringify(currentStructuredCV.contactInfo) ||
        persistedEditedSections.includes("contactInfo"),
      skills:
        JSON.stringify(baseStructuredCV.skills) !==
          JSON.stringify(currentStructuredCV.skills) ||
        persistedEditedSections.includes("skills"),
    };
  }, [baseStructuredCV, currentStructuredCV, persistedEditedSections]);
  const editedExperienceIds = useMemo(() => {
    if (!currentStructuredCV) return [];

    const baseById = new Map(
      (baseStructuredCV?.experience || []).map((item) => [item.id, item])
    );

    return currentStructuredCV.experience
      .filter((item) => {
        const baseItem = baseById.get(item.id);
        if (!baseItem) return true;
        return JSON.stringify(baseItem) !== JSON.stringify(item);
      })
      .map((item) => item.id);
  }, [baseStructuredCV?.experience, currentStructuredCV]);
  const hasUnsavedChanges = useMemo(() => {
    if (!savedStructuredCV || !currentStructuredCV) return false;
    return JSON.stringify(savedStructuredCV) !== JSON.stringify(currentStructuredCV);
  }, [savedStructuredCV, currentStructuredCV]);
  useEffect(() => {
    if (hasUnsavedChanges && saveFeedback) {
      setSaveFeedback("");
    }
  }, [hasUnsavedChanges, saveFeedback]);
  useEffect(() => {
    if (!isDiscardDialogOpen) {
      pendingNavigationRef.current = null;
    }
  }, [isDiscardDialogOpen]);
  useEffect(() => {
    if (!hasUnsavedChanges) {
      hasPushedGuardRef.current = false;
      return;
    }

    if (!hasPushedGuardRef.current) {
      window.history.pushState({ unsavedChangesGuard: true }, "", window.location.href);
      hasPushedGuardRef.current = true;
    }
  }, [hasUnsavedChanges]);
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);
  useEffect(() => {
    const handlePopState = () => {
      if (!hasUnsavedChanges || bypassPopstateRef.current) return;

      window.history.pushState({ unsavedChangesGuard: true }, "", window.location.href);
      pendingNavigationRef.current = navigateBackToInterviewAnalysis;
      setIsDiscardDialogOpen(true);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [hasUnsavedChanges, navigateBackToInterviewAnalysis]);
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!hasUnsavedChanges) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      if (
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      const nextUrl = new URL(anchor.href, window.location.origin);
      if (nextUrl.origin !== window.location.origin) return;

      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const next = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (next === current) return;

      event.preventDefault();
      event.stopPropagation();
      pendingNavigationRef.current = () => router.push(next);
      setIsDiscardDialogOpen(true);
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [hasUnsavedChanges, router]);

  const upsertById = <T extends { id: string }>(items: T[], nextItem: T): T[] => {
    const index = items.findIndex((item) => item.id === nextItem.id);
    if (index === -1) return [...items, nextItem];

    const next = [...items];
    next[index] = nextItem;
    return next;
  };

  const removeById = <T extends { id: string }>(items: T[], id: string): T[] =>
    items.filter((item) => item.id !== id);

  const handleSave = async () => {
    if (!orgID || !versionId || !currentStructuredCV) return;

    try {
      setIsSaving(true);
      const response = await api.post("/api/whitecloak/cv-version/save", {
        orgID,
        versionId,
        structuredCV: normalizeStructuredCVWithLockedEmail(
          currentStructuredCV,
          lockedCandidateEmail
        ),
      });
      setSavedStructuredCV(
        normalizeStructuredCVWithLockedEmail(
          normalizeStructuredCVInput(currentStructuredCV),
          lockedCandidateEmail
        )
      );
      setPersistedEditedSections(
        Array.isArray(response?.data?.version?.editedSections)
          ? response.data.version.editedSections
          : persistedEditedSections
      );
      setSaveFeedback("saved");
    } catch (error) {
      console.error("Failed to save CV version:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = () => {
    if (!savedStructuredCV) return;
    setCurrentStructuredCV(savedStructuredCV);
    setSaveFeedback("");
  };

  const handleEditExperienceItem = (id: string) => {
    setEditingExperienceId(id);
    setIsExperienceModalOpen(true);
  };

  const handleEditEducationItem = (id: string) => {
    setEditingEducationId(id);
    setIsEducationModalOpen(true);
  };

  const handleEditProjectItem = (id: string) => {
    setEditingProjectId(id);
    setIsProjectModalOpen(true);
  };

  const handleEditCertificationItem = (id: string) => {
    setEditingCertificationId(id);
    setIsCertificationModalOpen(true);
  };

  const handleEditAwardItem = (id: string) => {
    setEditingAwardId(id);
    setIsAwardModalOpen(true);
  };
  const handleAttemptLeave = (navigationAction: () => void) => {
    if (!hasUnsavedChanges) {
      navigationAction();
      return;
    }

    pendingNavigationRef.current = navigationAction;
    setIsDiscardDialogOpen(true);
  };
  const handleDiscardChanges = () => {
    setIsDiscardDialogOpen(false);
    const pendingAction = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    if (pendingAction) pendingAction();
  };
  const handleContinueEditing = () => {
    setIsDiscardDialogOpen(false);
    pendingNavigationRef.current = null;
  };

  if (isLoading) {
    return <LoadingAnimation text="Loading" subtext="Preparing CV editor" />;
  }

  if (!orgID || !versionId || !currentStructuredCV) {
    return (
      <div style={{ padding: 24 }}>
        Invalid CV editor link. Missing `orgID` or `versionId`.
      </div>
    );
  }

  return (
    <>
      <HeaderBar activeLink="Careers" currentPage="CV Editor" icon="la la-suitcase" />

      <div style={{ padding: "16px 20px 28px" }}>
        <div style={{ maxWidth: 1360, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => handleAttemptLeave(navigateBackToInterviewAnalysis)}
                  style={{
                    height: 36,
                    padding: "0 12px",
                    borderRadius: 10,
                    border: "1px solid #D0D5DD",
                    background: "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  <i className="la la-arrow-left" /> Back
                </button>
                <h1 style={{ margin: 0, fontSize: 36, fontWeight: 600, color: "#181D27" }}>
                  {versionLabel}
                </h1>
              </div>
              <span style={{ fontSize: 14, color: "#667085" }}>
                {interviewInfo?.name || "Candidate"} | Candidate for {interviewInfo?.jobTitle || "Role"}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleRevert}
                    disabled={!hasUnsavedChanges || isSaving}
                    style={{
                      height: 40,
                      padding: "0 14px",
                      borderRadius: 10,
                      border: "1px solid #D0D5DD",
                      background: "#FFFFFF",
                      cursor: !hasUnsavedChanges || isSaving ? "not-allowed" : "pointer",
                      opacity: !hasUnsavedChanges || isSaving ? 0.6 : 1,
                    }}
                  >
                    Revert changes
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!hasUnsavedChanges || isSaving}
                    style={{
                      height: 40,
                      padding: "0 20px",
                      borderRadius: 10,
                      border: "1px solid #101828",
                      background: "#101828",
                      color: "#FFFFFF",
                      cursor: !hasUnsavedChanges || isSaving ? "not-allowed" : "pointer",
                      opacity: !hasUnsavedChanges || isSaving ? 0.7 : 1,
                    }}
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
                {hasUnsavedChanges ? (
                  <span style={{ fontSize: 14, color: "#6C727F", fontWeight: 400, textAlign: "right" }}>
                    You have unsaved changes
                  </span>
                ) : saveFeedback === "saved" ? (
                  <span style={{ fontSize: 14, color: "#6C727F", fontWeight: 400, textAlign: "right" }}>
                    Saved
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div
            style={{
              width: "100%",
              height: 1,
              background: "#E4E7EC",
              margin: "4px 0 18px",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", paddingLeft: 20, paddingRight: 20 }}>
            {hasSectionContent.introduction && (
              <SectionCard
                title="Introduction"
                onEdit={() => setIsIntroductionModalOpen(true)}
                showEditedBadge={editedSectionFlags.introduction}
              >
                <IntroductionSectionContent
                  buildingCV={false}
                  loading={false}
                  value={sectionValues["Introduction"]}
                />
              </SectionCard>
            )}

            {hasSectionContent.contactInfo && (
              <SectionCard
                title="Contact Information"
                onEdit={() => setIsContactModalOpen(true)}
                showEditedBadge={editedSectionFlags.contactInfo}
              >
                <ContactInfoSectionContent
                  buildingCV={false}
                  loading={false}
                  value={sectionValues["Contact Info"]}
                  defaultContactInfo={{
                    email: "",
                    phone: "",
                    countryCode: "",
                    address: "",
                    linkedin: "",
                    websites: [],
                  }}
                />
              </SectionCard>
            )}

            {hasSectionContent.experience && (
              <SectionCard title="Experience">
                <ExperienceSectionContent
                  buildingCV={false}
                  loading={false}
                  value={sectionValues["Experience"]}
                  defaultExperienceData={[]}
                  onEditExperienceItem={handleEditExperienceItem}
                  editedItemIds={editedExperienceIds}
                />
              </SectionCard>
            )}

            {hasSectionContent.skills && skills.length > 0 && (
              <SectionCard
                title="Skills"
                onEdit={() => setIsSkillsModalOpen(true)}
                showEditedBadge={editedSectionFlags.skills}
              >
                <SkillsSectionContent
                  buildingCV={false}
                  loading={false}
                  skills={skills}
                />
              </SectionCard>
            )}

            {hasSectionContent.education && (
              <SectionCard title="Education">
                <EducationSectionContent
                  buildingCV={false}
                  loading={false}
                  value={sectionValues["Education"]}
                  defaultEducationData={[]}
                  onEditEducationItem={handleEditEducationItem}
                />
              </SectionCard>
            )}

            {hasSectionContent.projects && (
              <SectionCard title="Projects">
                <ProjectsSectionContent
                  value={sectionValues["Projects"]}
                  defaultProjectsData={[]}
                  onEditProjectItem={handleEditProjectItem}
                />
              </SectionCard>
            )}

            {hasSectionContent.certifications && (
              <SectionCard title="Certifications">
                <CertificationsSectionContent
                  value={sectionValues["Certifications"]}
                  defaultCertificationsData={[]}
                  onEditCertificationItem={handleEditCertificationItem}
                />
              </SectionCard>
            )}

            {hasSectionContent.awards && (
              <SectionCard title="Awards">
                <AwardsSectionContent
                  value={sectionValues["Awards"]}
                  defaultAwardsData={[]}
                  onEditAwardItem={handleEditAwardItem}
                />
              </SectionCard>
            )}
          </div>
        </div>
      </div>

      <IntroductionModal
        isOpen={isIntroductionModalOpen}
        onClose={() => setIsIntroductionModalOpen(false)}
        initialValue={currentStructuredCV.introduction}
        onSave={(nextIntroduction) =>
          setCurrentStructuredCV((prev) =>
            prev ? { ...prev, introduction: nextIntroduction } : prev
          )
        }
      />

      <ContactInfoModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        initialData={currentStructuredCV.contactInfo}
        lockedEmail={lockedCandidateEmail}
        disableEmailEdit
        onSave={(nextContactInfo) =>
          setCurrentStructuredCV((prev) =>
            prev
              ? {
                  ...prev,
                  contactInfo: normalizeContactInfoWithLockedEmail(
                    nextContactInfo,
                    lockedCandidateEmail
                  ),
                }
              : prev
          )
        }
      />

      <SkillModal
        isOpen={isSkillsModalOpen}
        onClose={() => setIsSkillsModalOpen(false)}
        initialSkills={currentStructuredCV.skills}
        onSave={(nextSkills) =>
          setCurrentStructuredCV((prev) =>
            prev ? { ...prev, skills: nextSkills } : prev
          )
        }
      />

      <ExperienceModal
        isOpen={isExperienceModalOpen}
        onClose={() => {
          setIsExperienceModalOpen(false);
          setEditingExperienceId(null);
        }}
        initialData={(editingExperience as ExperienceItem | null) || null}
        onSave={(nextExperience) =>
          setCurrentStructuredCV((prev) =>
            prev
              ? {
                  ...prev,
                  experience: upsertById(
                    prev.experience as ExperienceItem[],
                    nextExperience
                  ),
                }
              : prev
          )
        }
        onDelete={(id) =>
          setCurrentStructuredCV((prev) =>
            prev
              ? {
                  ...prev,
                  experience: removeById(prev.experience, id),
                }
              : prev
          )
        }
      />

      <EducationModal
        isOpen={isEducationModalOpen}
        onClose={() => {
          setIsEducationModalOpen(false);
          setEditingEducationId(null);
        }}
        initialData={(editingEducation as EducationItem | null) || null}
        onSave={(nextEducation) =>
          setCurrentStructuredCV((prev) =>
            prev
              ? {
                  ...prev,
                  education: upsertById(
                    prev.education as EducationItem[],
                    nextEducation
                  ),
                }
              : prev
          )
        }
        onDelete={(id) =>
          setCurrentStructuredCV((prev) =>
            prev
              ? {
                  ...prev,
                  education: removeById(prev.education, id),
                }
              : prev
          )
        }
      />

      <ProjectsModal
        isOpen={isProjectModalOpen}
        onClose={() => {
          setIsProjectModalOpen(false);
          setEditingProjectId(null);
        }}
        initialData={(editingProject as ProjectItem | null) || null}
        onSave={(nextProject) =>
          setCurrentStructuredCV((prev) =>
            prev
              ? {
                  ...prev,
                  projects: upsertById(prev.projects as ProjectItem[], nextProject),
                }
              : prev
          )
        }
        onDelete={(id) =>
          setCurrentStructuredCV((prev) =>
            prev
              ? {
                  ...prev,
                  projects: removeById(prev.projects, id),
                }
              : prev
          )
        }
      />

      <CertificationModal
        isOpen={isCertificationModalOpen}
        onClose={() => {
          setIsCertificationModalOpen(false);
          setEditingCertificationId(null);
        }}
        initialData={(editingCertification as CertificationItem | null) || null}
        onSave={(nextCertification) =>
          setCurrentStructuredCV((prev) =>
            prev
              ? {
                  ...prev,
                  certifications: upsertById(
                    prev.certifications as CertificationItem[],
                    nextCertification
                  ),
                }
              : prev
          )
        }
        onDelete={(id) =>
          setCurrentStructuredCV((prev) =>
            prev
              ? {
                  ...prev,
                  certifications: removeById(prev.certifications, id),
                }
              : prev
          )
        }
      />

      <AwardModal
        isOpen={isAwardModalOpen}
        onClose={() => {
          setIsAwardModalOpen(false);
          setEditingAwardId(null);
        }}
        initialData={(editingAward as AwardItem | null) || null}
        onSave={(nextAward) =>
          setCurrentStructuredCV((prev) =>
            prev
              ? {
                  ...prev,
                  awards: upsertById(prev.awards as AwardItem[], nextAward),
                }
              : prev
          )
        }
        onDelete={(id) =>
          setCurrentStructuredCV((prev) =>
            prev
              ? {
                  ...prev,
                  awards: removeById(prev.awards, id),
                }
              : prev
          )
        }
      />

      <Dialog open={isDiscardDialogOpen} onOpenChange={setIsDiscardDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogIcon variant="warning">
              <i className="la la-exclamation-circle" style={{ fontSize: 20 }} />
            </DialogIcon>
            <DialogTextGroup>
              <DialogTitle className="cv-editor-discard-title">Discard unsaved changes?</DialogTitle>
              <DialogDescription className="cv-editor-discard-description">
                You&apos;ve made changes that haven&apos;t been saved. Leaving this page will discard them.
              </DialogDescription>
            </DialogTextGroup>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={handleContinueEditing}
              style={{
                height: 44,
                border: "1px solid #D5D7DA",
                borderRadius: 12,
                background: "#FFFFFF",
                color: "#414651",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Continue editing
            </button>
            <button
              type="button"
              onClick={handleDiscardChanges}
              style={{
                height: 44,
                border: "1px solid #E1251B",
                borderRadius: 12,
                background: "#E1251B",
                color: "#FFFFFF",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Discard changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <style jsx>{`
        :global(.cv-editor-discard-title) {
          font-size: 16px;
          line-height: 24px;
        }
        :global(.cv-editor-discard-description) {
          font-size: 14px;
          line-height: 20px;
        }
      `}</style>
    </>
  );
}
