"use client";

import React, { useEffect, useState } from "react";
import Markdown from "react-markdown";
import Swal from "sweetalert2";
import { api } from "@/lib/utils/apiClient";
import { errorToast, getCVSection } from "@/lib/Utils";
import { AddSkillsModal } from "./AddSkillsModal";
import { RemoveSkillConfirmModal } from "./RemoveSkillConfirmModal";
import { SkillActionModal } from "./SkillActionModal";
import { SkillsAddedSuccessModal } from "./SkillAddedSuccessModal";

import { SkillEndorsementTooltip } from "./SkillEndorsementTooltip";
import { SkillTag } from "./SkillTag";
import { Button } from "../ui";

interface CandidateSkillsSectionProps {
    candidate: any;
    cvData: any[];
    setCvData: React.Dispatch<React.SetStateAction<any[]>>;
    onSkillsUpdated?: (skills: string[]) => void;
}

export const CandidateSkillsSection: React.FC<CandidateSkillsSectionProps> = ({
    candidate,
    cvData,
    setCvData,
    onSkillsUpdated,
}) => {
    const [showSkillsModal, setShowSkillsModal] = useState(false);
    const [candidateSkills, setCandidateSkills] = useState<string[]>([]);
    const [draftSkills, setDraftSkills] = useState<string[] | null>(null);
    const [showSkillActionModal, setShowSkillActionModal] = useState(false);
    const [selectedSkill, setSelectedSkill] = useState<string>("");
    const [skillEndorsements, setSkillEndorsements] = useState<any[]>([]);
    const [hasCurrentUserEndorsedSelectedSkill, setHasCurrentUserEndorsedSelectedSkill] = useState(false);
    const [showRemoveConfirmModal, setShowRemoveConfirmModal] = useState(false);
    const [showSkillsAddedModal, setShowSkillsAddedModal] = useState(false);
    const [allSkillsEndorsements, setAllSkillsEndorsements] = useState<{ [key: string]: any[] }>({});
    const [hoveredSkillIndex, setHoveredSkillIndex] = useState<number | null>(null);
    const [endorsementsReady, setEndorsementsReady] = useState(false);
    const [savingSkills, setSavingSkills] = useState(false);
    const [removingSkill, setRemovingSkill] = useState(false);
    const [endorsingSkill, setEndorsingSkill] = useState(false);
    const [selectedSkillSource, setSelectedSkillSource] = useState<"candidate" | "employer">("candidate");
    const MAX_SKILLS = 60;

    const getActiveOrgID = (): string | null => {
        if (typeof window === "undefined") {
            return null;
        }

        try {
            const stored = window.localStorage.getItem("activeOrg");
            if (!stored) return null;

            const parsed = JSON.parse(stored);
            return parsed?._id || null;
        } catch {
            return null;
        }
    };

    const parseSkillsFromMarkdown = (markdownContent: string): string[] => {
        if (!markdownContent) return [];

        const cleaned = markdownContent
            .replace(/^[-*+]\s+/gm, "")
            .replace(/^\d+\.\s+/gm, "")
            .replace(/[#*_~`]/g, "")
            .replace(/^>\s+/gm, "")
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

        const skills = cleaned
            .split(/[\n,]/)
            .map((skill) => skill.trim())
            .filter((skill) => {
                if (skill.length < 2) return false;
                if (/^[^a-zA-Z0-9]+$/.test(skill)) return false;
                return true;
            });

        return skills;
    };

    const convertSkillsToMarkdown = (skillsList: string[]): string => {
        return skillsList.map((skill) => `- ${skill}`).join("\n");
    };

    const handleSkillsChange = (newSkills: string[]) => {
        const limitedSkills = newSkills.slice(0, MAX_SKILLS);
        setDraftSkills(limitedSkills);
    };

    const fetchSkillEndorsements = async (skillName: string) => {
        try {
            const orgID = getActiveOrgID();

            let url = `/api/get-endorse-skill?candidateEmail=${encodeURIComponent(
                candidate?.email || "",
            )}&skillName=${encodeURIComponent(skillName)}`;
            if (orgID) {
                url += `&orgID=${encodeURIComponent(orgID)}`;
            }

            const response = await api.get(url);

            const endorsements = response?.data?.endorsements || [];
            setSkillEndorsements(endorsements);

            let hasEndorsed = false;

            if (endorsements.length > 0 && typeof window !== "undefined" && (window as any).localStorage?.user) {
                try {
                    const currentUser = JSON.parse(window.localStorage.user);
                    const currentUserEmail = currentUser?.email;
                    const currentUserName = currentUser?.name;

                    hasEndorsed = endorsements.some((endorsement: any) => {
                        if (endorsement.endorserEmail && currentUserEmail && endorsement.endorserEmail === currentUserEmail) {
                            return true;
                        }

                        if (!endorsement.endorserEmail && currentUserName && currentUserName === endorsement.endorserName) {
                            return true;
                        }

                        return false;
                    });
                } catch (e) {
                    hasEndorsed = false;
                }
            }

            setHasCurrentUserEndorsedSelectedSkill(hasEndorsed);
        } catch (error) {
            console.error("Error fetching endorsements:", error);
            setSkillEndorsements([]);
            setHasCurrentUserEndorsedSelectedSkill(false);
        }
    };

    const fetchAllSkillsEndorsements = async (skills: string[]) => {
        try {
            setEndorsementsReady(false);
            if (!candidate?.email || skills.length === 0) {
                setAllSkillsEndorsements({});
                setEndorsementsReady(true);
                return;
            }

            const orgID = getActiveOrgID();

            let url = `/api/get-endorse-skill?candidateEmail=${encodeURIComponent(candidate.email)}`;
            if (orgID) {
                url += `&orgID=${encodeURIComponent(orgID)}`;
            }

            const response = await api.get(url);

            const allEndorsements = response?.data?.endorsements || [];
            const endorsementsMap: { [key: string]: any[] } = {};

            for (const endorsement of allEndorsements) {
                const skillName = endorsement.skillName;
                if (!skillName) continue;

                // Only keep endorsements for skills currently in the list
                if (!skills.includes(skillName)) continue;

                if (!endorsementsMap[skillName]) {
                    endorsementsMap[skillName] = [];
                }
                endorsementsMap[skillName].push(endorsement);
            }

            setAllSkillsEndorsements(endorsementsMap);
            setEndorsementsReady(true);
        } catch (error) {
            console.error("Error fetching all skills endorsements:", error);
            setAllSkillsEndorsements({});
            setEndorsementsReady(true);
        }
    };

    const fetchSkillSource = async (skillName: string) => {
        try {
            if (!candidate?.email) {
                setSelectedSkillSource("candidate");
                return;
            }

            const orgID = getActiveOrgID();
            if (!orgID) {
                setSelectedSkillSource("candidate");
                return;
            }

            const response = await api.get(
                `/api/get-org-candidate-skills?candidateEmail=${encodeURIComponent(
                    candidate.email,
                )}&orgID=${encodeURIComponent(orgID)}&skillName=${encodeURIComponent(skillName)}`,
            );

            const source = response?.data?.items?.[0]?.source;

            if (source === "employer") {
                setSelectedSkillSource("employer");
            } else {
                setSelectedSkillSource("candidate");
            }
        } catch (error) {
            console.error("Error fetching skill source:", error);
            setSelectedSkillSource("candidate");
        }
    };

    const handleSkillClick = async (skill: string) => {
        setSelectedSkill(skill);
        setHasCurrentUserEndorsedSelectedSkill(false);
        setSelectedSkillSource("candidate");

        await Promise.all([fetchSkillEndorsements(skill), fetchSkillSource(skill)]);

        setShowSkillActionModal(true);
    };

    const showRemoveConfirmation = () => {
        setShowRemoveConfirmModal(true);
    };

    const handleRemoveSkill = async () => {
        try {
            setRemovingSkill(true);

            const updatedSkills = candidateSkills.filter((skill) => skill !== selectedSkill);
            setCandidateSkills(updatedSkills);
            onSkillsUpdated?.(updatedSkills);

            try {
                await api.delete(
                    `/api/delete-skill?candidateEmail=${encodeURIComponent(
                        candidate?.email,
                    )}&skillName=${encodeURIComponent(selectedSkill)}`,
                );

                setAllSkillsEndorsements((prev) => {
                    const updated = { ...prev };
                    delete updated[selectedSkill];
                    return updated;
                });

                setSkillEndorsements([]);
            } catch (endorsementError) {
                console.error("Error removing skill endorsements:", endorsementError);
            }

            setShowSkillActionModal(false);
            setShowRemoveConfirmModal(false);

            Swal.fire({
                icon: "success",
                title: "Skill Removed",
                text: `${selectedSkill} has been removed successfully.`,
                timer: 2000,
                showConfirmButton: false,
            });
        } catch (error) {
            console.error("Error removing skill:", error);
            errorToast("Failed to remove skill", 1300);
        } finally {
            setRemovingSkill(false);
        }
    };

    const handleEndorseSkill = async () => {
        try {
            setEndorsingSkill(true);

            const orgID = getActiveOrgID();

            const response = await api.post("/api/endorse-skill", {
                candidateEmail: candidate?.email,
                skillName: selectedSkill,
                orgID,
            });

            const createdEndorsement = response?.data?.endorsement ?? null;

            if (createdEndorsement) {
                const updatedEndorsements = [createdEndorsement, ...skillEndorsements];
                setSkillEndorsements(updatedEndorsements);
            } else {
                // Fallback: refresh endorsements from the server
                await fetchSkillEndorsements(selectedSkill);
            }

            setHasCurrentUserEndorsedSelectedSkill(true);

            if (candidateSkills.length > 0) {
                await fetchAllSkillsEndorsements(candidateSkills);
            }

            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("skill-endorsement-updated", {
                        detail: {
                            candidateEmail: candidate?.email,
                            skillName: selectedSkill,
                        },
                    }),
                );
            }
        } catch (error: any) {
            console.error("Error endorsing skill:", error);

            if (error?.response?.status === 409) {
                errorToast(`You have already endorsed ${selectedSkill} for this candidate.`, 2000);
            } else {
                errorToast("Failed to endorse skill", 1300);
            }
        } finally {
            setEndorsingSkill(false);
        }
    };

    const saveSkillsChanges = async () => {
        try {
            setSavingSkills(true);

            const skillsToSave = (draftSkills ?? candidateSkills).slice(0, MAX_SKILLS);

            const newSkills = skillsToSave.filter((skill) => !candidateSkills.includes(skill));

            if (newSkills.length > 0 && candidate?.email) {
                try {
                    const orgID = getActiveOrgID();
                    if (orgID) {
                        await api.post("/api/sync-org-candidate-skills", {
                            candidateEmail: candidate.email,
                            orgID,
                            addedSkills: newSkills,
                            removedSkills: [],
                            source: "employer",
                        });
                    }
                } catch (metaError) {
                    console.error("Error saving candidate skill:", metaError);
                }
            }

            setCandidateSkills(skillsToSave);
            onSkillsUpdated?.(skillsToSave);
            setDraftSkills(null);
            setShowSkillsModal(false);
            setShowSkillsAddedModal(true);

            if (skillsToSave.length > 0) {
                fetchAllSkillsEndorsements(skillsToSave);
            }
        } catch (error) {
            console.error("Error saving skills:", error);
            errorToast("Failed to save skills", 1300);
        } finally {
            setSavingSkills(false);
        }
    };

    const loadSkillsFromMetadata = async () => {
        try {
            if (!candidate?.email) {
                setCandidateSkills([]);
                onSkillsUpdated?.([]);
                setDraftSkills(null);
                setEndorsementsReady(true);
                return;
            }

            const orgID = getActiveOrgID();
            if (!orgID) {
                setCandidateSkills([]);
                onSkillsUpdated?.([]);
                setDraftSkills(null);
                setEndorsementsReady(true);
                return;
            }

            setEndorsementsReady(false);

            const response = await api.get(
                `/api/get-org-candidate-skills?candidateEmail=${encodeURIComponent(
                    candidate.email,
                )}&orgID=${encodeURIComponent(orgID)}`,
            );

            const items = response?.data?.items || [];
            const skillsFromMeta = items
                .map((item: any) => item.skillName)
                .filter((skill: string) => !!skill)
                .slice(0, MAX_SKILLS);

            setCandidateSkills(skillsFromMeta);
            onSkillsUpdated?.(skillsFromMeta);
            setDraftSkills(null);

            if (skillsFromMeta.length > 0) {
                await fetchAllSkillsEndorsements(skillsFromMeta);
            } else {
                setEndorsementsReady(true);
            }
        } catch (error) {
            console.error("Error loading org candidate skills metadata:", error);
            setCandidateSkills([]);
            onSkillsUpdated?.([]);
            setDraftSkills(null);
            setEndorsementsReady(true);
        }
    };

    useEffect(() => {
        loadSkillsFromMetadata();
    }, [candidate?.email]);

    const hasSkillsSection = candidateSkills.length > 0;

    return (
        <>
            <div
                style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    marginBottom: 8,
                }}
            >
                <span style={{ fontSize: 16, color: "#181D27", fontWeight: 500, margin: "6px 0 6px 16px" }}>Skills</span>
                <Button
                    onClick={() => {
                        setDraftSkills(candidateSkills);
                        setShowSkillsModal(true);
                    }}
                    variant="secondary"
                    label="Add skills"
                    icon="/plus-black.svg"
                >
                </Button>
            </div>
            {hasSkillsSection ? (
                <div className="layered-card-content">
                    {(() => {
                        const skills = candidateSkills;

                        if (skills.length > 0 && !endorsementsReady) {
                            const skeletonTagWidths = [72, 88, 104, 96, 120, 84, 112, 92];

                            return (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                    {skills.slice(0, 14).map((_, index) => {
                                        const width = skeletonTagWidths[index % skeletonTagWidths.length];

                                        return (
                                            <span
                                                key={index}
                                                className="blink-2"
                                                style={{
                                                    padding: "4px 10px",
                                                    borderRadius: "999px",
                                                    backgroundColor: "#F3F4F6",
                                                    border: "1px solid #E5E7EB",
                                                    minWidth: `${width}px`,
                                                    height: "28px",
                                                }}
                                            ></span>
                                        );
                                    })}
                                </div>
                            );
                        }

                        const skillsWithEndorsements = skills.filter((skill) => {
                            const endorsements = allSkillsEndorsements[skill] || [];
                            return endorsements.length > 0;
                        });

                        const skillsWithoutEndorsements = skills.filter((skill) => {
                            const endorsements = allSkillsEndorsements[skill] || [];
                            return endorsements.length === 0;
                        });

                        const orderedSkills = [...skillsWithEndorsements, ...skillsWithoutEndorsements];

                        return orderedSkills.length > 0 ? (
                            <div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                    {orderedSkills.map((skill, index) => {
                                        const endorsements = allSkillsEndorsements[skill] || [];
                                        const hasEndorsements = endorsements.length > 0;

                                        return (
                                            <SkillTag
                                                key={index}
                                                label={skill}
                                                isHighlighted={hasEndorsements}
                                                showThumb={hasEndorsements}
                                                onClick={() => handleSkillClick(skill)}
                                                onMouseEnter={() => {
                                                    if (hasEndorsements) {
                                                        setHoveredSkillIndex(index);
                                                    }
                                                }}
                                                onMouseLeave={() => setHoveredSkillIndex(null)}
                                            >
                                                {hasEndorsements && hoveredSkillIndex === index && (
                                                    <SkillEndorsementTooltip count={endorsements.length} />
                                                )}
                                            </SkillTag>
                                        );
                                    })}
                                </div>
                                <p
                                    style={{
                                        marginTop: 18,
                                        fontSize: 16,
                                        lineHeight: 1.5,
                                        color: "#667085",
                                    }}
                                >
                                    Jia automatically extracts skill tags from uploaded CVs. You may add more
                                    skills to improve candidate search.
                                </p>
                            </div>
                        ) : (
                            <p
                                style={{
                                    fontSize: 14,
                                    lineHeight: 1.5,
                                    color: "#667085",
                                }}
                            >
                                No skills have been added yet. Use the "Add skills" button to add relevant skills
                                for this candidate.
                            </p>
                        );
                    })()}
                </div>
            ) : (
                <div className="layered-card-content">
                    <p
                        style={{
                            fontSize: 14,
                            lineHeight: 1.5,
                            color: "#667085",
                        }}
                    >
                        No skills have been added yet. Use the "Add skills" button to add relevant skills for this
                        candidate.
                    </p>
                </div>
            )}

            {showSkillsModal && (
                <AddSkillsModal
                    candidateSkills={draftSkills ?? candidateSkills}
                    skillsEndorsementsMap={allSkillsEndorsements}
                    isSaving={savingSkills}
                    onClose={() => {
                        setShowSkillsModal(false);
                        setDraftSkills(null);
                    }}
                    onSave={saveSkillsChanges}
                    onSkillsChange={handleSkillsChange}
                />
            )}

            {showSkillActionModal && (
                <SkillActionModal
                    selectedSkill={selectedSkill}
                    skillEndorsements={skillEndorsements}
                    hasCurrentUserEndorsed={hasCurrentUserEndorsedSelectedSkill}
                    onClose={() => setShowSkillActionModal(false)}
                    onRemoveClick={showRemoveConfirmation}
                    onEndorse={handleEndorseSkill}
                    isEndorsing={endorsingSkill}
                    addedBy={selectedSkillSource}
                />
            )}

            {showRemoveConfirmModal && (
                <RemoveSkillConfirmModal
                    onCancel={() => setShowRemoveConfirmModal(false)}
                    onConfirm={handleRemoveSkill}
                    isRemoving={removingSkill}
                />
            )}

            {showSkillsAddedModal && (
                <SkillsAddedSuccessModal
                    onClose={() => setShowSkillsAddedModal(false)}
                    onAddMore={() => {
                        setShowSkillsAddedModal(false);
                        setShowSkillsModal(true);
                    }}
                />
            )}
        </>
    );
};
