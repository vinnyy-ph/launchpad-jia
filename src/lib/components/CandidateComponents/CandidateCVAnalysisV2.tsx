"use client"
import React,{ useEffect, useMemo, useRef, useState } from "react";
// import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import Swal from "sweetalert2";
import { errorToast, parseSkillsFromMarkdown } from "@/lib/Utils";
import { CandidateCVDocument } from "./CandidateCVDocument";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { decodeHtmlEntities } from "@/lib/utils/sanitizeInput";
import { CandidateSkillsSection } from "./CandidateSkillsSection";
import { Button, Field, Modal } from "../ui";
import CareerFit from "../CareerComponents/CareerFit";
import type { ExperienceItem } from "./ExperienceSection";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EducationItem } from "../screens/EducationModal";
import type { ProjectItem } from "../screens/ProjectsModal";
import type { CertificationItem } from "../screens/CertificationModal";
import type { AwardItem } from "../screens/AwardModal";
import IntroductionSectionContent from "../screens/IntroductionSectionContent";
import ContactInfoSectionContent from "../screens/ContactInfoSectionContent";
import ExperienceSectionContent from "../screens/ExperienceSectionContent";
import EducationSectionContent from "../screens/EducationSectionContent";
import ProjectsSectionContent from "../screens/ProjectsSectionContent";
import CertificationsSectionContent from "../screens/CertificationsSectionContent";
import AwardsSectionContent from "../screens/AwardsSectionContent";
import {
    buildStructuredCVFromDigitalCV,
    buildDigitalCVFromStructuredCV,
    normalizeStructuredCVInput,
} from "@/lib/utils/structuredCV";
import { normalizeLegacyDigitalCVSections } from "@/lib/utils/digitalCVLegacy";
import { useAppContext } from "@/lib/context/AppContext";
import { Tooltip } from "react-tooltip";
import styles from "./CandidateCVAnalysisV2.module.scss";

export interface ContactInfoOverride {
    email: string;
    phone: string;
    countryCode: string;
    address: string;
    linkedin: string;
    websites: Array<{
        id: string;
        url: string;
        type: string;
    }>;
}

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

type SectionName = (typeof DISPLAY_SECTIONS)[number];
type SectionMap = Record<SectionName, string>;
type PartialSectionMap = Partial<Record<SectionName, string>>;
type CVVersionItem = {
    _id: string;
    label: string;
    versionNo: number;
    createdAt?: number;
    updatedAt?: number;
    createdBy?: {
        name?: string | null;
        email?: string | null;
        image?: string | null;
    };
};

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

const MAX_SKILLS = 60;

function formatStructuredCVBySections(structuredCV: any): SectionMap {
    const formattedCV: SectionMap = { ...EMPTY_SECTION_MAP };
    if (!structuredCV || typeof structuredCV !== "object") return formattedCV;

    const intro =
        typeof structuredCV.introduction === "string"
            ? structuredCV.introduction.trim()
            : "";
    if (intro) formattedCV["Introduction"] = intro;

    if (structuredCV.contactInfo && typeof structuredCV.contactInfo === "object") {
        const contact = structuredCV.contactInfo as any;
        const hasContactData =
            (typeof contact.email === "string" && contact.email.trim() !== "") ||
            (typeof contact.phone === "string" && contact.phone.trim() !== "") ||
            (typeof contact.countryCode === "string" && contact.countryCode.trim() !== "") ||
            (typeof contact.address === "string" && contact.address.trim() !== "") ||
            (typeof contact.linkedin === "string" && contact.linkedin.trim() !== "") ||
            (Array.isArray(contact.websites) &&
                contact.websites.some((website: any) => website?.url && String(website.url).trim() !== ""));

        if (hasContactData) {
            formattedCV["Contact Info"] = JSON.stringify(contact);
        }
    }

    const setArraySection = (sectionName: SectionName, value: unknown) => {
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

function mergeSectionMaps(base: SectionMap, override: PartialSectionMap): SectionMap {
    const merged: SectionMap = { ...base };

    (DISPLAY_SECTIONS as readonly SectionName[]).forEach((section) => {
        const overrideValue = override[section];
        if (typeof overrideValue === "string" && overrideValue.trim().length > 0) {
            merged[section] = overrideValue;
        }
    });

    return merged;
}

function applyOrgSkillsToDigitalCV(digitalCV: any[], skills: string[]): any[] {
    const base = Array.isArray(digitalCV) ? digitalCV : [];
    const normalizedSkills = skills
        .map((skill) => (typeof skill === "string" ? skill.trim() : ""))
        .filter((skill) => skill.length > 0)
        .slice(0, MAX_SKILLS);
    if (normalizedSkills.length === 0) return base;
    const skillsMarkdown = normalizedSkills.map((skill) => `- ${skill}`).join("\n");

    let hasSkillsSection = false;
    const withUpdatedSkills = base.map((section) => {
        if (section?.name !== "Skills") return section;
        hasSkillsSection = true;
        return {
            ...section,
            content: skillsMarkdown,
        };
    });

    if (!hasSkillsSection && skillsMarkdown) {
        return [...withUpdatedSkills, { name: "Skills", content: skillsMarkdown }];
    }

    return withUpdatedSkills;
}

function formatVersionDate(timestamp?: number): string {
    if (!timestamp || Number.isNaN(timestamp)) return "";
    return new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function getCreatorDisplayName(version: CVVersionItem): string {
    const name = version.createdBy?.name?.trim();
    if (name) return name;

    const email = version.createdBy?.email?.trim();
    if (!email) return "Unknown creator";

    return email.split("@")[0];
}

function getCreatorInitials(nameOrEmail: string): string {
    const trimmed = nameOrEmail.trim();
    if (!trimmed) return "?";

    const parts = trimmed
        .replace(/@.*$/, "")
        .split(/[\s._-]+/)
        .filter(Boolean)
        .slice(0, 2);

    if (parts.length === 0) {
        return trimmed.slice(0, 1).toUpperCase();
    }

    return parts.map((part) => part.slice(0, 1).toUpperCase()).join("");
}

function sanitizeFileNamePart(value: string): string {
    return String(value || "")
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, " ")
        .trim();
}

export default function CandidateCVAnalysis({
    candidate,
    interviews,
    setInterviews,
    includePreScreeningQuestions = false,
    includeEvaluationCard = true,
    experienceOverride = [],
    introductionOverride = "",
    educationOverride = [],
    projectsOverride = [],
    certificationsOverride = [],
    awardsOverride = [],
    contactInfoOverride = null,
}: {
    candidate: any,
    interviews: any,
    setInterviews: any,
    includePreScreeningQuestions?: boolean,
    includeEvaluationCard?: boolean,
    experienceOverride?: ExperienceItem[],
    introductionOverride?: string,
    educationOverride?: EducationItem[],
    projectsOverride?: ProjectItem[],
    certificationsOverride?: CertificationItem[],
    awardsOverride?: AwardItem[],
    contactInfoOverride?: ContactInfoOverride | null,
}) {
    const [isLoading, setIsLoading] = useState(false);
    const [cvData, setCvData] = useState<any[]>([]);
    const [orgCandidateSkills, setOrgCandidateSkills] = useState<string[] | null>(null);
    const [structuredCVData, setStructuredCVData] = useState<any | null>(null);
    const [regenerateLoading, setRegenerateLoading] = useState(false);
    const [showVersionDropdown, setShowVersionDropdown] = useState(false);
    const [showNewVersionModal, setShowNewVersionModal] = useState(false);
    const [newVersionName, setNewVersionName] = useState("");
    const [newVersionNameError, setNewVersionNameError] = useState("");
    const [versions, setVersions] = useState<CVVersionItem[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const [versionLoading, setVersionLoading] = useState(false);
    const [createVersionLoading, setCreateVersionLoading] = useState(false);
    const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);
    const [originalCVSnapshot, setOriginalCVSnapshot] = useState<{
        structuredCV: any | null;
        digitalCV: any[];
    } | null>(null);
    const versionDropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { orgID: contextOrgID } = useAppContext();
    const orgIDFromQuery = searchParams.get("orgID") || "";
    const orgID = orgIDFromQuery || contextOrgID || "";
    const versionIdFromQuery = searchParams.get("versionId");

    const getActiveInterviews = (interviews: any[]) => {
        return interviews?.filter((interview: any) => !["Dropped", "Cancelled"].includes(interview.applicationStatus));
    }

    useEffect(() => {
        const fetchCVData = async () => {
            setIsLoading(true);
            try {
                const response = await api.post("/api/load-user-cv", { email: candidate?.email });
                const rawCVData = response?.data || {};
                const nextStructuredCV =
                    rawCVData?.structuredCV && typeof rawCVData.structuredCV === "object"
                        ? rawCVData.structuredCV
                        : null;
                const nextDigitalCV = Array.isArray(rawCVData?.digitalCV)
                    ? rawCVData.digitalCV
                    : [];
                const normalizedStructuredCV = nextStructuredCV
                    ? normalizeStructuredCVInput(nextStructuredCV)
                    : nextDigitalCV.length > 0
                        ? buildStructuredCVFromDigitalCV(nextDigitalCV)
                        : null;

                setOriginalCVSnapshot({
                    structuredCV: normalizedStructuredCV,
                    digitalCV: nextDigitalCV.length > 0
                        ? nextDigitalCV
                        : normalizedStructuredCV
                            ? buildDigitalCVFromStructuredCV(normalizedStructuredCV)
                            : [],
                });
                setSelectedVersionId(null);
                setStructuredCVData(normalizedStructuredCV);

                if (nextDigitalCV.length > 0) {
                    setCvData(nextDigitalCV);
                } else if (normalizedStructuredCV) {
                    setCvData(
                        buildDigitalCVFromStructuredCV(normalizedStructuredCV)
                    );
                } else {
                    setCvData([]);
                }
            } catch (error) {
                Swal.fire({
                    icon: "error",
                    title: "Failed to load CV",
                    text: "Redirecting back to candidates page...",
                    allowOutsideClick: false,
                    confirmButtonText: "Back to Candidates Page",
                }).then(() => {
                    window.location.href = "/recruiter-dashboard/candidates";
                }); 
            } finally{
                setIsLoading(false);
            }
        }
        
        if (candidate) {
            fetchCVData();
        }
      }, [candidate]);

    useEffect(() => {
        const onOutsideClick = (event: MouseEvent) => {
            if (
                versionDropdownRef.current &&
                !versionDropdownRef.current.contains(event.target as Node)
            ) {
                setShowVersionDropdown(false);
            }
        };

        document.addEventListener("mousedown", onOutsideClick);
        return () => document.removeEventListener("mousedown", onOutsideClick);
    }, []);

    useEffect(() => {
        const fetchVersions = async () => {
            if (!orgID || !candidate?.email) {
                setVersions([]);
                return;
            }

            try {
                const response = await api.post("/api/whitecloak/cv-version/list", {
                    orgID,
                    candidateEmail: candidate.email,
                });
                const items = Array.isArray(response?.data?.items) ? response.data.items : [];
                setVersions(items);
            } catch (error) {
                console.error("Failed to load CV versions:", error);
                setVersions([]);
            }
        };

        fetchVersions();
    }, [candidate?.email, orgID]);

    const removeVersionIdFromUrl = () => {
        const query = new URLSearchParams(searchParams.toString());
        query.delete("versionId");
        const nextQuery = query.toString();
        router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    };

    useEffect(() => {
        const fetchOrgCandidateSkills = async () => {
            if (!candidate?.email || !orgID) {
                setOrgCandidateSkills(null);
                return;
            }

            try {
                const response = await api.get(
                    `/api/get-org-candidate-skills?candidateEmail=${encodeURIComponent(
                        candidate.email
                    )}&orgID=${encodeURIComponent(orgID)}`
                );
                const items = Array.isArray(response?.data?.items) ? response.data.items : [];
                const nextSkills = items
                    .map((item: any) =>
                        typeof item?.skillName === "string" ? item.skillName.trim() : ""
                    )
                    .filter((skill: string) => skill.length > 0)
                    .slice(0, MAX_SKILLS);
                setOrgCandidateSkills(nextSkills);
            } catch (error) {
                console.error("Failed to load org candidate skills:", error);
                setOrgCandidateSkills(null);
            }
        };

        void fetchOrgCandidateSkills();
    }, [candidate?.email, orgID]);

    useEffect(() => {
        if (!versionIdFromQuery || !versions.some((item) => item._id === versionIdFromQuery)) {
            return;
        }
        if (selectedVersionId === versionIdFromQuery) return;
        void handleSelectVersion(versionIdFromQuery);
    }, [selectedVersionId, versionIdFromQuery, versions]);

    const handleSelectOriginalCV = () => {
        if (!originalCVSnapshot) return;

        setSelectedVersionId(null);
        setStructuredCVData(originalCVSnapshot.structuredCV);
        setCvData(originalCVSnapshot.digitalCV);
        setShowVersionDropdown(false);
    };

    const hasDuplicateVersionLabel = (label: string) => {
        const normalized = label.trim().toLowerCase();
        if (!normalized) return false;
        return versions.some(
            (item) => (item.label || "").trim().toLowerCase() === normalized
        );
    };

    const handleSelectVersion = async (versionId: string) => {
        if (!orgID || !versionId) return;
        try {
            setVersionLoading(true);
            const response = await api.post("/api/whitecloak/cv-version/get", {
                orgID,
                versionId,
            });
            const version = response?.data?.version;
            if (!version) return;

            const nextStructuredCV = normalizeStructuredCVInput(version.structuredCV);
            setSelectedVersionId(versionId);
            setStructuredCVData(nextStructuredCV);
            setCvData(
                Array.isArray(version.digitalCV)
                    ? version.digitalCV
                    : buildDigitalCVFromStructuredCV(nextStructuredCV)
            );
            setShowVersionDropdown(false);
        } catch (error) {
            console.error("Failed to load CV version:", error);
            errorToast("Failed to load CV version", 1300);
        } finally {
            setVersionLoading(false);
        }
    };

    const handleCreateVersion = async () => {
        if (!orgID || !candidate?.email) {
            errorToast("Missing org or candidate context", 1500);
            return;
        }
        const label = newVersionName.trim() || "New CV Version";
        if (hasDuplicateVersionLabel(label)) {
            setNewVersionNameError("Version name already exists. Please use a different name.");
            return;
        }

        try {
            setCreateVersionLoading(true);
            setNewVersionNameError("");
            const response = await api.post("/api/whitecloak/cv-version/create", {
                orgID,
                candidateEmail: candidate.email,
                label,
            });
            const created = response?.data?.version;
            if (!created?.id) {
                throw new Error("Failed to create version");
            }

            // Refresh list and select created version.
            const listResponse = await api.post("/api/whitecloak/cv-version/list", {
                orgID,
                candidateEmail: candidate.email,
            });
            const items = Array.isArray(listResponse?.data?.items) ? listResponse.data.items : [];
            setVersions(items);
            await handleSelectVersion(created.id);

            setShowNewVersionModal(false);
            setNewVersionName("");
            setNewVersionNameError("");

            const query = new URLSearchParams();
            query.set("versionId", created.id);
            if (orgID) query.set("orgID", orgID);
            if (candidate?.email) query.set("candidateEmail", candidate.email);
            router.push(`${pathname}/cv-editor?${query.toString()}`);
        } catch (error) {
            console.error("Failed to create CV version:", error);
            errorToast("Failed to create CV version", 1300);
        } finally {
            setCreateVersionLoading(false);
        }
    };

    const handleDeleteVersion = async (version: CVVersionItem) => {
        if (!orgID || !version?._id) return;

        const confirmed = window.confirm(
            `Delete "${version.label || "this version"}"? This action cannot be undone.`
        );
        if (!confirmed) return;

        try {
            setDeletingVersionId(version._id);

            await api.post("/api/whitecloak/cv-version/delete", {
                orgID,
                versionId: version._id,
            });

            const listResponse = await api.post("/api/whitecloak/cv-version/list", {
                orgID,
                candidateEmail: candidate?.email,
            });
            const items = Array.isArray(listResponse?.data?.items) ? listResponse.data.items : [];
            setVersions(items);

            if (selectedVersionId === version._id) {
                handleSelectOriginalCV();
                removeVersionIdFromUrl();
            }
        } catch (error) {
            console.error("Failed to delete CV version:", error);
            errorToast("Failed to delete CV version", 1300);
        } finally {
            setDeletingVersionId(null);
        }
    };

    async function regenerateCV() {
        const interviewsToProcess = interviews.filter((interview: any) => !["Dropped", "Cancelled"].includes(interview.applicationStatus) && interview.currentStep !== "Applied");
        if (interviewsToProcess.length === 0) return;
        try {
            setRegenerateLoading(true);
            let updatedInterviews = [...interviews];
            
            for (const interview of interviewsToProcess) {
                const response = await api.post("/api/analyze-cv", {
                    interviewID: interview.interviewID,
                    userEmail: interview.email,
                });
                let updatedInterview = {...interview};

                if (response?.data?.update) {
                    updatedInterview = {...updatedInterview, ...response?.data?.update};
                }
                
                updatedInterviews = updatedInterviews.map((i: any) => i._id === interview._id ? updatedInterview : i);
            }
            setInterviews(updatedInterviews);
        } catch (error) {
            console.log(error);
            errorToast("Failed to regenerate CV Analysis", 1300);
        } finally {
            setRegenerateLoading(false);
        }
    }

    const activeInterviews = getActiveInterviews(interviews);
    const showPreScreeningAnswers =
        includePreScreeningQuestions &&
        interviews?.[0]?.preScreeningQuestions?.length > 0;
    const thinShellStyle: React.CSSProperties = { padding: 10 };
    const overrideSections = useMemo<PartialSectionMap>(
        () => ({
            "Introduction": introductionOverride.trim(),
            "Contact Info": contactInfoOverride
                ? JSON.stringify(contactInfoOverride)
                : "",
            "Experience":
                experienceOverride.length > 0
                    ? JSON.stringify(experienceOverride)
                    : "",
            "Skills": "",
            "Education":
                educationOverride.length > 0
                    ? JSON.stringify(educationOverride)
                    : "",
            "Projects":
                projectsOverride.length > 0
                    ? JSON.stringify(projectsOverride)
                    : "",
            "Certifications":
                certificationsOverride.length > 0
                    ? JSON.stringify(certificationsOverride)
                    : "",
            "Awards":
                awardsOverride.length > 0
                    ? JSON.stringify(awardsOverride)
                    : "",
        }),
        [
            introductionOverride,
            contactInfoOverride,
            experienceOverride,
            educationOverride,
            projectsOverride,
            certificationsOverride,
            awardsOverride,
        ]
    );
    const sectionValues = useMemo(() => {
        const baseSections = structuredCVData
            ? formatStructuredCVBySections(structuredCVData)
            : { ...EMPTY_SECTION_MAP };
        return mergeSectionMaps(baseSections, overrideSections);
    }, [structuredCVData, overrideSections]);
    const hasCVContent = useMemo(
        () =>
            Object.values(sectionValues).some(
                (value) => typeof value === "string" && value.trim().length > 0
            ),
        [sectionValues]
    );
    const normalizedOriginalSkills = useMemo(
        () =>
            !selectedVersionId && Array.isArray(orgCandidateSkills)
                ? orgCandidateSkills
                    .map((skill) => (typeof skill === "string" ? skill.trim() : ""))
                    .filter((skill) => skill.length > 0)
                : [],
        [orgCandidateSkills, selectedVersionId]
    );
    const selectedVersionSkills = useMemo(() => {
        if (!selectedVersionId) return [];

        const skillsFromStructured = Array.isArray(structuredCVData?.skills)
            ? structuredCVData.skills
                .map((skill: unknown) =>
                    typeof skill === "string" ? skill.trim() : ""
                )
                .filter((skill: string) => skill.length > 0)
            : [];
        if (skillsFromStructured.length > 0) return skillsFromStructured.slice(0, MAX_SKILLS);

        const skillsSection = Array.isArray(cvData)
            ? cvData.find(
                (section) =>
                    String(section?.name || "").trim().toLowerCase() === "skills"
            )
            : null;
        if (typeof skillsSection?.content !== "string") return [];

        return parseSkillsFromMarkdown(skillsSection.content).slice(0, MAX_SKILLS);
    }, [cvData, selectedVersionId, structuredCVData]);
    const hasSectionContent = useMemo(
        () => ({
            introduction: sectionValues["Introduction"].trim().length > 0,
            contactInfo: sectionValues["Contact Info"].trim().length > 0,
            experience: sectionValues["Experience"].trim().length > 0,
            skills: !selectedVersionId
                ? normalizedOriginalSkills.length > 0
                : selectedVersionSkills.length > 0,
            education: sectionValues["Education"].trim().length > 0,
            certifications: sectionValues["Certifications"].trim().length > 0,
            projects: sectionValues["Projects"].trim().length > 0,
            awards: sectionValues["Awards"].trim().length > 0,
        }),
        [normalizedOriginalSkills.length, sectionValues, selectedVersionId, selectedVersionSkills.length]
    );
    const hasPrimaryCVSectionContent = useMemo(
        () =>
            hasSectionContent.introduction ||
            hasSectionContent.experience ||
            hasSectionContent.education ||
            hasSectionContent.certifications ||
            hasSectionContent.projects ||
            hasSectionContent.awards,
        [
            hasSectionContent.introduction,
            hasSectionContent.experience,
            hasSectionContent.education,
            hasSectionContent.certifications,
            hasSectionContent.projects,
            hasSectionContent.awards,
        ]
    );
    const contactInfoIsPhoneVerified = useMemo(() => {
        const rawContactInfo = sectionValues["Contact Info"];
        if (typeof rawContactInfo !== "string" || rawContactInfo.trim().length === 0) {
            return false;
        }

        try {
            const parsedContactInfo = JSON.parse(rawContactInfo);
            return parsedContactInfo?.isPhoneVerified === true;
        } catch {
            return false;
        }
    }, [sectionValues]);
    const contactInfoDisplayValue = useMemo(() => {
        const rawContactInfo = sectionValues["Contact Info"];
        const primaryEmail =
            `${candidate?.email || interviews?.[0]?.email || ""}`.trim();

        let parsedContactInfo: Record<string, unknown> = {};
        if (typeof rawContactInfo === "string" && rawContactInfo.trim().length > 0) {
            try {
                parsedContactInfo = JSON.parse(rawContactInfo);
            } catch {
                parsedContactInfo = {};
            }
        }

        const contactEmail =
            typeof parsedContactInfo?.email === "string"
                ? parsedContactInfo.email.trim()
                : "";

        if (contactEmail || !primaryEmail) {
            return rawContactInfo;
        }

        return JSON.stringify({
            ...parsedContactInfo,
            email: primaryEmail,
        });
    }, [candidate?.email, interviews, sectionValues]);
    const downloadCVData = useMemo(() => {
        const baseDigitalCV = Array.isArray(cvData) ? cvData : [];
        if (selectedVersionId) {
            return normalizeLegacyDigitalCVSections(baseDigitalCV);
        }
        if (!Array.isArray(orgCandidateSkills)) return baseDigitalCV;
        return applyOrgSkillsToDigitalCV(baseDigitalCV, orgCandidateSkills);
    }, [cvData, orgCandidateSkills, selectedVersionId]);
    const hasDownloadableCV = useMemo(
        () =>
            downloadCVData.some(
                (section) =>
                    typeof section?.content === "string" &&
                    section.content.trim().length > 0
            ),
        [downloadCVData]
    );
    const selectedVersion = useMemo(
        () => versions.find((item) => item._id === selectedVersionId) || null,
        [selectedVersionId, versions]
    );
    const isOriginalCVSelected = !selectedVersionId;
    const versionLabel = selectedVersion?.label || "Original CV";
    const downloadFileName = useMemo(() => {
        const candidateName = sanitizeFileNamePart(interviews?.[0]?.name || candidate?.name || "Candidate");
        const cvVersionName = sanitizeFileNamePart(versionLabel || "Original CV");
        return `${candidateName}-${cvVersionName}-CV.pdf`;
    }, [candidate?.name, interviews, versionLabel]);

    return (<>
    {(includeEvaluationCard || showPreScreeningAnswers) && (
        <div className={styles.cvAnalysisContainer}>
            {includeEvaluationCard && (
                <div className="layered-card-outer">
                    <div className="layered-card-middle" style={{ padding: 10 }}>
                        <div className={styles.evaluationHeader}>
                            <div className={styles.evaluationTitle}>
                                <img
                                    src="/jia-dashboard-logo.png"
                                    alt="Jia"
                                    style={{ width: 24, height: 24, borderRadius: 999, flexShrink: 0 }}
                                />
                                <span style={{ fontSize: 16, lineHeight: "24px", fontWeight: 700, color: "#181D27" }}>
                                    Evaluation by Jia
                                </span>
                            </div>
                            <Button
                                disabled={regenerateLoading || activeInterviews?.length === 0}
                                icon="/redo.svg"
                                label="Regenerate"
                                onClick={regenerateCV}
                                variant="secondary"
                            />
                        </div>

                        <div className={`layered-card-content ${styles.evaluationContent}`}>
                            {regenerateLoading ? (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 20 }}>
                                    <i className="la la-circle-notch spin" style={{ fontSize: 24, color: "#414651" }} />
                                    <span style={{ color: "#6B7280", fontSize: 14 }}>Regenerating CV Analysis...</span>
                                </div>
                            ) : activeInterviews?.length > 0 ? (
                                <>
                                    {activeInterviews.map((interview: any) => (
                                        <div key={interview._id || interview.id || interview.interviewID}>
                                            <div className={styles.interviewItem}>
                                                {interview.cvStatus && (
                                                    <>
                                                        <CareerFit
                                                            fit={interview.cvStatus}
                                                            assessment={interview.cvScreeningReason}
                                                            candidateDetails={interview}
                                                            evaluatorName="Jia"
                                                        />
                                                        <span style={{ fontSize: 12, fontWeight: 500, color: "#717680", lineHeight: "1" }}>
                                                            for
                                                        </span>
                                                    </>
                                                )}
                                                <span style={{ fontSize: 12, fontWeight: 700, color: "#181D27", lineHeight: "1" }}>
                                                    {interview.jobTitle}
                                                </span>
                                                {interview.currentStep === "Applied" && (
                                                    <div className={styles.noCVBadge}>
                                                        <i className="la la-exclamation-triangle" style={{ fontSize: 12, color: "#414651" }} />
                                                        <span>No CV Uploaded</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 16, color: "#414651", fontWeight: 500 }}>
                                                <p
                                                    className="markdown-content"
                                                    dangerouslySetInnerHTML={{
                                                        __html: interview.cvScreeningReason || "No CV Analysis available",
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <Tooltip className="career-fit-tooltip fade-in" id="career-fit-tooltip" clickable={true} />
                                </>
                            ) : (
                                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 220 }}>
                                    <span style={{ color: "#667085", fontSize: 14 }}>No Active Applications</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showPreScreeningAnswers && (
                <div className={styles.preScreeningCard}>
                    <div className="layered-card-outer">
                        <div className="layered-card-middle" style={thinShellStyle}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
                                <span className={styles.sectionTitle}>Pre-screening Answers</span>
                            </div>
                            <div className={`layered-card-content ${styles.evaluationContent}`}>
                                {interviews?.[0]?.preScreeningQuestions?.map((question: any, index: number) => (
                                    <div
                                        key={question.id || index}
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "flex-start",
                                            marginBottom: index === interviews[0].preScreeningQuestions.length - 1 ? 0 : 14,
                                            paddingBottom: index === interviews[0].preScreeningQuestions.length - 1 ? 0 : 14,
                                            borderBottom: index === interviews[0].preScreeningQuestions.length - 1 ? "none" : "1px solid #EAECF0",
                                        }}
                                    >
                                        <span style={{ fontSize: 16, color: "#344054", fontWeight: 500 }}>{question.questionType}</span>
                                        <span style={{ fontSize: 14, color: "#667085", fontWeight: 500 }}>
                                            {question.question}
                                        </span>
                                        <span style={{ fontSize: 14, color: "#667085", fontWeight: 500 }}>
                                            Answer: <span style={{ color: "#344054", fontWeight: 600 }}>{question.selectedAnswers?.map((answer: any) => decodeHtmlEntities(answer.value || "")).join(", ")}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )}

    <div className={styles.cvHeader}>
        <div ref={versionDropdownRef} className={styles.cvHeaderLeft}>
            <span style={{ fontSize: 20, lineHeight: "32px", color: "#181D27", fontWeight: 500 }}>Candidate CV</span>
            <button
                type="button"
                onClick={() => setShowVersionDropdown((prev) => !prev)}
                style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 14,
                    color: "#667085",
                    cursor: "pointer",
                    width: "fit-content",
                }}
            >
                Version: <span style={{ color: "#475467", fontWeight: 600 }}>{versionLabel}</span>
                <i className={`la ${showVersionDropdown ? "la-angle-up" : "la-angle-down"}`} style={{ marginLeft: 4 }} />
            </button>

            {showVersionDropdown && (
                <div className={styles.versionDropdown}>
                    <div style={{ padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#344054" }}>
                        Versions:
                    </div>
                    <div style={{ borderTop: "1px solid #EAECF0", padding: 8 }}>
                        <div>
                            <div
                                onClick={handleSelectOriginalCV}
                                style={{
                                    background: !selectedVersionId ? "#F8F9FC" : "transparent",
                                    borderRadius: 8,
                                    padding: "10px 12px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 10,
                                    cursor: "pointer",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 14, color: "#344054", fontWeight: 500 }}>Original CV</span>
                                </div>
                                {!selectedVersionId && (
                                    <i className="la la-check" style={{ fontSize: 20, color: "#3F5BD8" }} />
                                )}
                            </div>
                        </div>

                        {versions.map((version) => (
                            <div key={version._id}>
                                <div style={{ borderTop: "1px solid #EAECF0", margin: "8px -8px" }} />
                                <div
                                    onClick={() => handleSelectVersion(version._id)}
                                    className={`${styles.versionItem} ${selectedVersionId === version._id ? styles.selected : ""}`}
                                >
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: 14, color: "#344054", fontWeight: 500 }}>{version.label}</span>
                                            <span style={{ fontSize: 12, color: "#6C727F" }}>
                                                {formatVersionDate(version.updatedAt || version.createdAt)}
                                            </span>
                                        </div>
                                        {(version.createdBy?.name || version.createdBy?.email) && (
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                                {version.createdBy?.image ? (
                                                    <img
                                                        src={version.createdBy.image}
                                                        alt={getCreatorDisplayName(version)}
                                                        style={{
                                                            width: 24,
                                                            height: 24,
                                                            borderRadius: "50%",
                                                            objectFit: "cover",
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                ) : (
                                                    <div
                                                        style={{
                                                            width: 24,
                                                            height: 24,
                                                            borderRadius: "50%",
                                                            background: "#EEF2FF",
                                                            color: "#3F5BD8",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            fontSize: 11,
                                                            fontWeight: 700,
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        {getCreatorInitials(getCreatorDisplayName(version))}
                                                    </div>
                                                )}
                                                <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                                                    <span
                                                        style={{
                                                            fontSize: 12,
                                                            color: "#344054",
                                                            fontWeight: 500,
                                                            lineHeight: 1.3,
                                                            whiteSpace: "nowrap",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                        }}
                                                    >
                                                        {getCreatorDisplayName(version)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        {selectedVersionId === version._id && (
                                            <i className="la la-check" style={{ fontSize: 20, color: "#3F5BD8" }} />
                                        )}
                                        <i
                                            className="la la-trash"
                                            style={{
                                                fontSize: 20,
                                                color: deletingVersionId === version._id ? "#D0D5DD" : "#98A2B3",
                                                cursor: deletingVersionId ? "not-allowed" : "pointer",
                                            }}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                if (deletingVersionId) return;
                                                void handleDeleteVersion(version);
                                            }}
                                        />
                                        <i
                                            className="la la-pen"
                                            style={{
                                                fontSize: 20,
                                                color: deletingVersionId === version._id ? "#D0D5DD" : "#98A2B3",
                                                cursor: deletingVersionId ? "not-allowed" : "pointer",
                                            }}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                if (deletingVersionId) return;
                                                const query = new URLSearchParams();
                                                query.set("versionId", version._id);
                                                if (orgID) query.set("orgID", orgID);
                                                if (candidate?.email) query.set("candidateEmail", candidate.email);
                                                router.push(`${pathname}/cv-editor?${query.toString()}`);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
        <div className={styles.cvHeaderRight}>
            <button
                type="button"
                onClick={() => {
                    setShowVersionDropdown(false);
                    setShowNewVersionModal(true);
                }}
                disabled={createVersionLoading || versionLoading}
                className={styles.newVersionButton}
            >
                <i className="la la-plus" style={{ marginRight: 6 }} />
                New CV Version
            </button>
            <div className={styles.downloadButtonWrapper}>
                {hasDownloadableCV ? (
                    <PDFDownloadLink
                        key={new Date().toISOString()}
                        document={
                            <CandidateCVDocument
                                candidate={interviews?.[0]}
                                cvData={downloadCVData}
                                candidateSkills={
                                    isOriginalCVSelected && Array.isArray(orgCandidateSkills)
                                        ? orgCandidateSkills
                                        : []
                                }
                                includeCVAnalysis={false}
                            />
                        }
                        fileName={downloadFileName}
                        className={styles.downloadButton}
                    >
                        <i className="la la-cloud-download-alt" />
                        Download CV
                    </PDFDownloadLink>
                ) : (
                    <button
                        type="button"
                        disabled
                        className={styles.downloadButton}
                    >
                        <i className="la la-cloud-download-alt" />
                        Download CV
                    </button>
                )}
            </div>
        </div>
    </div>
        {isLoading ? (
            <div className={styles.cvContentGridLoading}>
                <div className={styles.mainColumn}>
                    {[...Array(6)].map((_, index) => (
                        <div key={index} className="layered-card-middle" style={thinShellStyle}>
                            <div className="skeleton-bar" style={{ width: "30%", height: "20px", marginBottom: 8 }}></div>
                            <div className="skeleton-bar" style={{ width: "100%", height: "20px" }}></div>
                        </div>
                    ))}
                </div>
                <div className={styles.sideColumn}>
                    <div className="layered-card-middle" style={thinShellStyle}>
                        <div className="skeleton-bar" style={{ width: "30%", height: "20px", marginBottom: 8 }}></div>
                        <div className="skeleton-bar" style={{ width: "100%", height: "20px" }}></div>
                    </div>
                </div>
            </div>
        ) : hasCVContent ? (
            <div className={styles.cvContentGrid}>
                <div className={styles.mainColumn}>
                    {hasSectionContent.introduction && (
                        <div className="layered-card-middle" style={thinShellStyle}>
                            <span className={styles.sectionTitle}>Introduction</span>
                            <div className="layered-card-content">
                                <IntroductionSectionContent
                                    buildingCV={false}
                                    loading={false}
                                    value={sectionValues["Introduction"]}
                                />
                            </div>
                        </div>
                    )}

                    {hasSectionContent.experience && (
                        <div className="layered-card-middle" style={thinShellStyle}>
                            <span className={styles.sectionTitle}>Experience</span>
                            <div className="layered-card-content">
                                <ExperienceSectionContent
                                    buildingCV={false}
                                    loading={false}
                                    value={sectionValues["Experience"]}
                                    defaultExperienceData={[]}
                                    onEditExperienceItem={() => {}}
                                    showEditIcon={false}
                                />
                            </div>
                        </div>
                    )}

                    {hasSectionContent.education && (
                        <div className="layered-card-middle" style={thinShellStyle}>
                            <span className={styles.sectionTitle}>Education</span>
                            <div className="layered-card-content">
                                <EducationSectionContent
                                    buildingCV={false}
                                    loading={false}
                                    value={sectionValues["Education"]}
                                    defaultEducationData={[]}
                                    onEditEducationItem={() => {}}
                                    showEditIcon={false}
                                />
                            </div>
                        </div>
                    )}

                    {hasSectionContent.certifications && (
                        <div className="layered-card-middle" style={thinShellStyle}>
                            <span className={styles.sectionTitle}>Certifications</span>
                            <div className="layered-card-content">
                                <CertificationsSectionContent
                                    value={sectionValues["Certifications"]}
                                    defaultCertificationsData={[]}
                                    onEditCertificationItem={() => {}}
                                    showEditIcon={false}
                                />
                            </div>
                        </div>
                    )}

                    {hasSectionContent.projects && (
                        <div className="layered-card-middle" style={thinShellStyle}>
                            <span className={styles.sectionTitle}>Projects</span>
                            <div className="layered-card-content">
                                <ProjectsSectionContent
                                    value={sectionValues["Projects"]}
                                    defaultProjectsData={[]}
                                    onEditProjectItem={() => {}}
                                    showEditIcon={false}
                                />
                            </div>
                        </div>
                    )}

                    {hasSectionContent.awards && (
                        <div className="layered-card-middle" style={thinShellStyle}>
                            <span className={styles.sectionTitle}>Awards</span>
                            <div className="layered-card-content">
                                <AwardsSectionContent
                                    value={sectionValues["Awards"]}
                                    defaultAwardsData={[]}
                                    onEditAwardItem={() => {}}
                                    showEditIcon={false}
                                />
                            </div>
                        </div>
                    )}
                </div>
                <div className={styles.sideColumn}>
                    {hasSectionContent.contactInfo && (
                        <div className="layered-card-middle" style={thinShellStyle}>
                            <span className={styles.sectionTitle}>Contact Information</span>
                            <div className="layered-card-content" style={{ overflowX: "auto" }}>
                                <ContactInfoSectionContent
                                    buildingCV={false}
                                    loading={false}
                                    value={contactInfoDisplayValue}
                                    defaultContactInfo={{
                                        email: "",
                                        phone: "",
                                        countryCode: "",
                                        address: "",
                                        linkedin: "",
                                        websites: [],
                                    }}
                                    isInterviewAnalysis={true}
                                    showPrimaryBadge={true}
                                    showCopyButton={true}
                                    showPhoneVerifiedBadge={contactInfoIsPhoneVerified}
                                />
                            </div>
                        </div>
                    )}
                    {hasSectionContent.skills && (
                        <div className="layered-card-middle" style={thinShellStyle}>
                            {isOriginalCVSelected ? (
                                <CandidateSkillsSection
                                    candidate={candidate}
                                    cvData={cvData}
                                    setCvData={setCvData}
                                    onSkillsUpdated={setOrgCandidateSkills}
                                />
                            ) : (
                                <>
                                    <span className={styles.sectionTitle} style={{ display: "block" }}>
                                        Skills
                                    </span>
                                    <div className="layered-card-content">
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                            {selectedVersionSkills.map((skill, index) => (
                                                <span
                                                    key={`${skill}-${index}`}
                                                    style={{
                                                        border: "1px solid #D0D5DD",
                                                        borderRadius: 999,
                                                        padding: "4px 10px",
                                                        fontSize: 13,
                                                        lineHeight: 1.4,
                                                        color: "#344054",
                                                        background: "#F8F9FC",
                                                    }}
                                                >
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        ) : (
            <div className={styles.emptyState}>
                <h3>Applicant has no uploaded CV</h3>
            </div>
        )}
        <Modal
            opened={showNewVersionModal}
            onClose={() => {
                setShowNewVersionModal(false);
                setNewVersionName("");
                setNewVersionNameError("");
            }}
            withCloseButton={false}
            closeOnClickOutside={!createVersionLoading}
            closeOnEscape={!createVersionLoading}
            lockScroll
            centered={false}
            size={680}
            radius={18}
            overlayProps={{
                opacity: 0.45,
            }}
            zIndex={1100}
        >
            <div style={{ margin: -20 }}>
                <div
                    style={{
                        overflowY: "auto",
                        height: "fit-content",
                        maxHeight: "85vh",
                        width: "100%",
                        maxWidth: 680,
                        background: "#fff",
                        border: "1px solid #E9EAEB",
                        borderRadius: 18,
                        boxShadow: "0 12px 24px rgba(16, 24, 40, 0.14)",
                        padding: 0,
                        boxSizing: "border-box",
                    }}
                >
                    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                        <div style={{ display: "flex", gap: 16 }}>
                            <div
                                style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 12,
                                    border: "1px solid #D0D5DD",
                                    boxShadow: "0 1px 2px rgba(16,24,40,0.08)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}
                            >
                                <i className="la la-sync-alt" style={{ fontSize: 26, color: "#344054" }} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <span style={{ fontSize: 20, color: "#101828", fontWeight: 600, lineHeight: 1.2 }}>
                                    Create new CV version
                                </span>
                                <span style={{ fontSize: 12, color: "#667085", lineHeight: 1.5 }}>
                                    Create an editable copy of this candidate&apos;s CV.
                                    <br />
                                    The original version uploaded by the candidate won&apos;t be changed.
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setShowNewVersionModal(false);
                                setNewVersionName("");
                                setNewVersionNameError("");
                            }}
                            style={{
                                border: "none",
                                background: "transparent",
                                color: "#98A2B3",
                                fontSize: 24,
                                lineHeight: 1,
                                cursor: "pointer",
                                padding: 0,
                            }}
                        >
                            <i className="la la-times" />
                        </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#344054" }}>
                            Version name <span style={{ color: "#F04438" }}>*</span>
                        </span>
                        <Field
                            value={newVersionName}
                            onChange={(e) => {
                                const nextValue = e.target.value;
                                setNewVersionName(nextValue);
                                if (nextValue.trim() && hasDuplicateVersionLabel(nextValue)) {
                                    setNewVersionNameError("Version name already exists. Please use a different name.");
                                    return;
                                }
                                setNewVersionNameError("");
                            }}
                            placeholder="e.g. Client A — UI/UX Designer"
                            error={newVersionNameError || undefined}
                            inputStyle={{
                                height: 48,
                                borderRadius: 10,
                                fontSize: 14,
                                color: "#101828",
                            }}
                        />
                        <span style={{ fontSize: 12, color: "#667085" }}>
                            Use a name that helps you identify where this CV will be used.
                        </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 2 }}>
                        <button
                            type="button"
                            onClick={() => {
                                setShowNewVersionModal(false);
                                setNewVersionName("");
                                setNewVersionNameError("");
                            }}
                            style={{
                                height: 44,
                                minWidth: 120,
                                border: "1px solid #D0D5DD",
                                borderRadius: 10,
                                background: "#FFFFFF",
                                color: "#344054",
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleCreateVersion}
                            disabled={createVersionLoading || Boolean(newVersionNameError)}
                            style={{
                                height: 44,
                                minWidth: 156,
                                border: "1px solid #101828",
                                borderRadius: 10,
                                background: "#101828",
                                color: "#FFFFFF",
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: createVersionLoading || Boolean(newVersionNameError) ? "not-allowed" : "pointer",
                                opacity: createVersionLoading || Boolean(newVersionNameError) ? 0.7 : 1,
                            }}
                        >
                            {createVersionLoading ? "Creating..." : "Create version"}
                        </button>
                    </div>
                    </div>
                </div>
            </div>
        </Modal>
    </>)
}
