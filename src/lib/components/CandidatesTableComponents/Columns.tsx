import React, { useMemo, useRef, useCallback } from "react";
import { ColumnDef } from "@tanstack/react-table";
import AvatarImage from "../AvatarImage/AvatarImage";
import CandidateAvatarWithTooltip from "../CandidateComponents/CandidateAvatarWithTooltip";
import SkillsCell from "./SkillsCell";
import ActionsCell from "./ActionsCell";
import CareerFit from "../CareerComponents/CareerFit";
import CandidatesTableTooltip from "./CandidatesTableTooltip";
import {
    getCandidateLocationForDisplay,
    getCurrentPosition,
    getExperience,
    formatRelativeTime,
    getSkills,
} from "@/lib/utils/candidateHelpers";
import { Tag } from "./ResponsiveTagList";
import { useInviteCandidate } from "@/lib/hooks/CandidatesTable/useInviteCandidate";

// Spinner component for loading state
const LoadingSpinner = ({ color, borderColor }: { color: string; borderColor: string }) => (
    <div 
        style={{ 
            width: 14, 
            height: 14, 
            borderRadius: "50%", 
            border: `2px solid ${borderColor}`, 
            borderTopColor: color, 
            borderRightColor: "transparent",
            borderBottomColor: "transparent",
            borderLeftColor: "transparent",
            animation: "spin 0.8s linear infinite",
            flexShrink: 0,
        }} 
    />
);

// Module-level cache for skill tags
const skillTagsCache = new Map<string, Tag[]>();

// Clear cache when needed (can be called from parent component)
export const clearSkillTagsCache = () => {
    skillTagsCache.clear();
};

// Fitness status styling map (similar to FIT_STATUS_MAP but for candidates table)
const getFitnessStatusStyle = (grade: string) => {
    const lowerGrade = grade.toLowerCase();
    
    if (lowerGrade.includes("strong fit")) {
        return {
            bgColor: "rgba(236, 253, 243, 1)",
            borderColor: "rgba(166, 244, 197, 1)",
            textColor: "rgba(2, 121, 72, 1)",
        };
    }
    if (lowerGrade.includes("good fit")) {
        return {
            bgColor: "rgba(239, 248, 255, 1)",
            borderColor: "rgba(178, 221, 255, 1)",
            textColor: "rgba(23, 92, 211, 1)",
        };
    }
    if (lowerGrade.includes("maybe fit")) {
        return {
            bgColor: "rgba(248, 249, 252, 1)",
            borderColor: "rgba(213, 217, 235, 1)",
            textColor: "rgba(54, 63, 114, 1)",
        };
    }
    if (lowerGrade.includes("bad fit") || lowerGrade.includes("not fit")) {
        return {
            bgColor: "rgba(254, 243, 242, 1)",
            borderColor: "rgba(254, 205, 202, 1)",
            textColor: "rgba(179, 35, 24, 1)",
        };
    }
    // Default for "Insufficient Data" and other cases
    return {
        bgColor: "rgba(248, 249, 252, 1)",
        borderColor: "rgba(213, 217, 235, 1)",
        textColor: "rgba(113, 118, 128, 1)",
    };
};

// Get skill tags for a candidate
export const getSkillTags = (candidate: any, selectedFilters: Array<{ type: string; name: string; questionId?: string }> = []): Tag[] => {
    const candidateId = candidate._id || candidate.id || candidate.email || 'unknown';
    const skills = getSkills(candidate);
    
    if (skills.length === 0) {
        return [];
    }
    
    // Get skill filters (case-insensitive matching)
    const skillFilters = selectedFilters
        .filter(f => f.type === "Skills")
        .map(f => f.name.toLowerCase());
    
    // Create a stable key based on candidate ID, skills, and selected filters
    const skillsKey = skills.join('|');
    const filtersKey = skillFilters.join('|');
    const cacheKey = `${candidateId}-${skillsKey}-${filtersKey}`;
    
    // Check cache first
    if (skillTagsCache.has(cacheKey)) {
        return skillTagsCache.get(cacheKey)!;
    }
    
    // Create new tags with isFiltered flag
    const skillTags: Tag[] = skills.map((skill: string, index: number) => {
        const isFiltered = skillFilters.some(filterName => 
            skill.toLowerCase() === filterName
        );
        return {
            id: `skill-${candidateId}-${index}`,
            label: skill,
            isFiltered,
        };
    });
    
    // Sort: filtered skills first, then others
    skillTags.sort((a, b) => {
        const aFiltered = (a as any).isFiltered ? 0 : 1;
        const bFiltered = (b as any).isFiltered ? 0 : 1;
        return aFiltered - bFiltered;
    });
    
    // Cache the tags
    skillTagsCache.set(cacheKey, skillTags);
    
    // Limit cache size to prevent memory leaks
    if (skillTagsCache.size > 1000) {
        const firstKey = skillTagsCache.keys().next().value;
        skillTagsCache.delete(firstKey);
    }
    
    return skillTags;
};

// Menu handlers - no-ops since ActionsCell manages its own state
export const handleMenuToggle = (rowId: string, candidate: any, event: React.MouseEvent) => {
    // ActionsCell manages its own state, but we keep this for compatibility
    // No-op since ActionsCell handles state internally
};

export const handleMenuClose = () => {
    // ActionsCell manages its own state, but we keep this for compatibility
    // No-op since ActionsCell handles state internally
};

interface ColumnHelpers {
    orgID: string | null;
    setSelectedCandidate: (candidate: any) => void;
    setShowCandidateModal: (show: boolean) => void;
    onAddComment?: (candidate: any) => void;
    onInviteToJob?: (candidate: any) => void;
    selectedFilters?: Array<{ type: string; name: string; questionId?: string }>;
    showAiFitness?: boolean;
    showSelectionColumn?: boolean;
    getAiFitness?: (candidate: any) => { grade: string; reason: string; score: number; hasAiExplanation?: boolean; isLoadingExplanation?: boolean } | null | undefined;
    onFetchAiExplanation?: (candidate: any) => void;
    aiSearchPrompt?: string;
}

const getStatusStyles = (status: string) => {
    switch (status) {
        case "Ongoing":
            return {
                background: "var(--Colors-Secondary_Colors-Indigo-50, #EEF4FF)",
                border: "1px solid var(--Colors-Secondary_Colors-Indigo-200, #C7D7FE)",
                textColor: "var(--Colors-Secondary_Colors-Indigo-700, #3538CD)",
                dotColor: "var(--Colors-Secondary_Colors-Indigo-500, #6172F3)",
            };
        case "Dropped":
        case "Cancelled":
            return {
                background: "var(--Colors-Primary_Colors-Error-50, #FEF3F2)",
                border: "1px solid var(--Colors-Primary_Colors-Error-200, #FECDCA)",
                textColor: "var(--Colors-Primary_Colors-Error-700, #B32318)",
                dotColor: "var(--Colors-Primary_Colors-Error-500, #F04438)",
            };
        case "Hired":
            return {
                background: "var(--Colors-Primary_Colors-Success-50, #ECFDF3)",
                border: "1px solid var(--Colors-Primary_Colors-Success-200, #A6F4C5)",
                textColor: "var(--Colors-Primary_Colors-Success-700, #027948)",
                dotColor: "var(--Colors-Primary_Colors-Success-500, #12B76A)",
            };
        case "Inactive":
            return {
                background: "var(--Colors-Primary_Colors-Neutrals-100, #F5F5F5)",
                border: "1px solid var(--Colors-Primary_Colors-Neutrals-200, #E9EAEB)",
                textColor: "var(--Colors-Primary_Colors-Neutrals-700, #414651)",
                dotColor: "var(--Colors-Primary_Colors-Neutrals-500, #717680)",
            };
        default:
            return {
                background: "var(--Colors-Primary_Colors-Neutrals-100, #F5F5F5)",
                border: "1px solid var(--Colors-Primary_Colors-Neutrals-200, #E9EAEB)",
                textColor: "var(--Colors-Primary_Colors-Neutrals-700, #414651)",
                dotColor: "var(--Colors-Primary_Colors-Neutrals-500, #717680)",
            };
    }
};

// Hook to create candidate table columns with all handlers
export const useCandidateTableColumns = (helpers: ColumnHelpers): ColumnDef<any>[] => {
    const { 
        orgID,
        setSelectedCandidate,
        setShowCandidateModal,
        onAddComment,
        onInviteToJob,
        selectedFilters = [],
        showAiFitness = false,
        showSelectionColumn = false,
        getAiFitness,
        onFetchAiExplanation,
        aiSearchPrompt = ""
    } = helpers;

    // Get invite candidate handler from hook
    const handleInviteCandidate = useInviteCandidate({ orgID });

    return useMemo(() => {
        const selectColumn: ColumnDef<any> = {
            id: "select",
            header: ({ table }) => (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", maxWidth: 40, minWidth: 0, boxSizing: "border-box" }}>
                    <input
                        type="checkbox"
                        aria-label="Select all candidates"
                        checked={table.getIsAllPageRowsSelected()}
                        ref={(el) => {
                            if (!el) return;
                            el.indeterminate = table.getIsSomePageRowsSelected();
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onChange={table.getToggleAllPageRowsSelectedHandler()}
                    />
                </div>
            ),
            meta: { width: 40, weight: 3 },
            cell: ({ row }) => (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", maxWidth: 40, minWidth: 0, boxSizing: "border-box" }}>
                    <input
                        type="checkbox"
                        aria-label="Select candidate"
                        checked={row.getIsSelected()}
                        onClick={(e) => e.stopPropagation()}
                        onChange={row.getToggleSelectedHandler()}
                    />
                </div>
            ),
        };
        return [
            ...(showSelectionColumn ? [selectColumn] : []),
            {
            accessorKey: "candidate",
            header: "Candidates",
            meta: { width: 192, weight: 15 },
            cell: ({ row }) => {
                const candidate = row.original;
                return (
                    <div className="d-flex align-items-center" style={{ gap: "10px", minWidth: 0, width: "100%", maxWidth: "100%" }}>
                        <CandidateAvatarWithTooltip candidate={candidate} orgID={orgID || ""}>
                            {candidate?.image ? (
                                <AvatarImage src={candidate.image} alt="Candidate" style={{ width: "32px", height: "32px", border: "none" }} />
                            ) : (
                                <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#F8F9FC", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <span className="candidates-table-avatar-initials">
                                        {candidate?.name?.split(" ").map((name: string) => name[0]).join("")}
                                    </span>
                                </div>
                            )}
                        </CandidateAvatarWithTooltip>
                        <div style={{ display: "flex", flexDirection: "column", gap: 0, minWidth: 0, flex: 1, overflow: "hidden" }}>
                            <a 
                            href={`/recruiter-dashboard/candidates?candidate=${candidate.email}&orgID=${orgID}`} 
                            style={{ color: "inherit", textDecoration: "none" }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedCandidate(candidate);
                                setShowCandidateModal(true);
                            }}
                            >
                            <span className="candidates-table-candidate-name">{candidate?.name || ""}</span>
                            </a>
                            <span className="candidates-table-candidate-email">{candidate.email}</span>
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "skills",
            header: "Skills",
            meta: { width: 320, weight: showAiFitness ? 22 : 26 },
            cell: ({ row }) => {
                const candidate = row.original;
                return <SkillsCell candidate={candidate} getSkillTags={getSkillTags} selectedFilters={selectedFilters} />;
            },
        },
        ...(showAiFitness ? [{
            id: "fitnessScore",
            header: "Fitness Score",
            meta: { width: 120, weight: 12 },
            cell: ({ row }: { row: any }) => {
                const candidate = row.original;
                const fitness = getAiFitness ? getAiFitness(candidate) : null;
                const grade = fitness?.grade || "Insufficient Data";
                const reason = fitness?.reason || "No assessment available";
                const hasAiExplanation = fitness?.hasAiExplanation || false;
                const isLoadingExplanation = fitness?.isLoadingExplanation || false;
                const { bgColor, borderColor, textColor } = getFitnessStatusStyle(grade);
                
                // Build tooltip content with optional "Get Assessment" button
                const tooltipContent = (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {/* Show AI explanation if available */}
                        {hasAiExplanation && reason && (
                            <div style={{ whiteSpace: "pre-wrap" }}>{reason}</div>
                        )}
                        {/* Show "Get AI Assessment" button if no explanation yet */}
                        {onFetchAiExplanation && !hasAiExplanation && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isLoadingExplanation) {
                                        onFetchAiExplanation(candidate);
                                    }
                                }}
                                disabled={isLoadingExplanation}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                    padding: "6px 12px",
                                    borderRadius: 6,
                                    border: "1px solid var(--Border-primary, #E9EAEB)",
                                    background: isLoadingExplanation ? "#f5f5f5" : "#fff",
                                    cursor: isLoadingExplanation ? "default" : "pointer",
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: "var(--Text-text-secondary, #414651)",
                                    width: "100%",
                                }}
                            >
                                {isLoadingExplanation ? (
                                    <>
                                        <LoadingSpinner 
                                            color="var(--Text-text-secondary, #414651)" 
                                            borderColor="var(--Border-primary, #E9EAEB)" 
                                        />
                                        <span>Loading...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M7 0C3.13 0 0 3.13 0 7C0 10.87 3.13 14 7 14C10.87 14 14 10.87 14 7C14 3.13 10.87 0 7 0ZM7.7 10.5H6.3V6.3H7.7V10.5ZM7.7 4.9H6.3V3.5H7.7V4.9Z" fill="#6172F3"/>
                                        </svg>
                                        <span>Get AI Assessment</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                );
                
                // Skeleton loading state - uses same styles as table skeleton
                if (isLoadingExplanation) {
                    return (
                        <div 
                            className="skeleton-bar blink-2" 
                            style={{ 
                                width: 80, 
                                height: 22, 
                                borderRadius: 999 
                            }}
                        />
                    );
                }
                
                return (
                    <CandidatesTableTooltip title="Assessment" content={tooltipContent}>
                        <span
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                                width: "fit-content",
                                background: bgColor,
                                border: `1px solid ${borderColor}`,
                                color: textColor,
                                borderRadius: 999,
                                padding: "2px 8px",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                // Add glow effect when AI assessment is available
                                boxShadow: hasAiExplanation ? `0 0 8px 2px ${borderColor}` : "none",
                            }}
                        >
                            {grade.includes("Strong Fit") && (
                                <img
                                    src="/iconsV3/star-green.svg"
                                    alt="Strong fit"
                                    style={{ width: 12, height: 12, display: "block" }}
                                />
                            )}
                            {grade}
                        </span>
                    </CandidatesTableTooltip>
                );
            },
        }] : []),
        {
            accessorKey: "experience",
            header: "Experience",
            meta: { width: 120, weight: 8 },
            cell: ({ row }) => {
                const candidate = row.original;
                const experience = getExperience(candidate);
                return (
                    <span className="candidates-table-cell-text candidates-table-cell-text-ellipsis">
                        {experience}
                    </span>
                );
            },
        },
        {
            accessorKey: "currentPosition",
            header: "Current Position",
            meta: { width: 170, weight: 12 },
            cell: ({ row }) => {
                const candidate = row.original;
                const position = getCurrentPosition(candidate);
                return (
                    <span className="candidates-table-cell-text candidates-table-cell-text-ellipsis">
                        {position}
                    </span>
                );
            },
        },
        {
            accessorKey: "location",
            header: "Location",
            meta: { width: 120, weight: 8 },
            cell: ({ row }) => {
                const candidate = row.original;
                const location = getCandidateLocationForDisplay(candidate);
                return (
                    <span className="candidates-table-cell-text candidates-table-cell-text-ellipsis">
                        {location}
                    </span>
                );
            },
        },
        {
            accessorKey: "lastActive",
            header: "Last Active",
            meta: { width: 120, weight: 8 },
            cell: ({ row }) => {
                const candidate = row.original;
                if (candidate.candidateStatus === "Inactive" || !candidate.activeAt) {
                    return <span className="candidates-table-cell-text candidates-table-cell-text-ellipsis">-</span>;
                }
                return (
                    <span className="candidates-table-cell-text candidates-table-cell-text-ellipsis">
                        {formatRelativeTime(candidate.activeAt)}
                    </span>
                );
            },
        },
        {
            accessorKey: "applicationStatus",
            header: "Application",
            meta: { width: 130, weight: 10 },
            cell: ({ row }) => {
                const candidate = row.original;
                const status = candidate.candidateStatus;
                const statusStyles = getStatusStyles(status);
                
                return (
                    <div style={{ borderRadius: "16px", border: statusStyles.border, backgroundColor: statusStyles.background, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", maxWidth: "100%", paddingTop: "2px", paddingRight: "8px", paddingBottom: "2px", paddingLeft: "8px", overflow: "hidden" }}>
                        <div style={{ width: "8px", height: "8px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: statusStyles.dotColor }} />
                        </div>
                        <span style={{ fontWeight: 700, fontStyle: "Bold", fontSize: "12px", lineHeight: "18px", letterSpacing: "0%", textAlign: "center", color: statusStyles.textColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {status}
                        </span>
                    </div>
                );
            },
        },
        {
            id: "actions",
            header: "",
            meta: { width: 48, weight: 4 },
            cell: ({ row }) => {
                const candidate = row.original;
                const rowId = row.id;
                return (
                    <ActionsCell
                        candidate={candidate}
                        rowId={rowId}
                        onMenuToggle={handleMenuToggle}
                        onMenuClose={handleMenuClose}
                        onInviteCandidate={handleInviteCandidate}
                        onViewCV={() => {
                            setSelectedCandidate(candidate);
                            setShowCandidateModal(true);
                        }}
                        onAddComment={onAddComment || (() => {})}
                        onInviteToJob={onInviteToJob || (() => {})}
                    />
                );
            },
        },
        ];
    }, [handleInviteCandidate, setSelectedCandidate, setShowCandidateModal, onAddComment, onInviteToJob, selectedFilters, showAiFitness, showSelectionColumn, getAiFitness]);
};

