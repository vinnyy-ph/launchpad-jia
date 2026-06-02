"use client";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useReactTable, getCoreRowModel, flexRender, ColumnDef } from "@tanstack/react-table";
import { useSearchParams } from "next/navigation";
import CandidateModal from "../CandidateComponents/CandidateModal";
import CommentModal from "../CandidateComponents/CandidateCommentModal";
import AdvancedFiltersPanel from "../CandidatesTableComponents/AdvancedFiltersPanel";
import AdvancedFiltersButton from "../CandidatesTableComponents/AdvancedFiltersButton";
import AiSearchModal from "../CandidatesTableComponents/AiSearchModal";
import AiSearchButton from "../CandidatesTableComponents/AiSearchButton";
import BulkEmailPanel from "../CandidatesTableComponents/BulkEmailPanel";
import { Tooltip } from "react-tooltip";
import { useUpload } from "@/lib/context/UploadContext";
import { useAppContext } from "@/lib/context/AppContext";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { useCandidatesData } from "@/lib/hooks/CandidatesTable/useCandidatesData";
import { usePreScreeningQuestions } from "@/lib/hooks/CandidatesTable/usePreScreeningQuestions";
import { useCandidateCVs } from "@/lib/hooks/CandidatesTable/useCandidateCVs";
import { useClickOutside } from "@/lib/hooks/CandidatesTable/useClickOutside";
import { useAdvancedFiltersHandler } from "@/lib/hooks/CandidatesTable/useAdvancedFiltersHandler";
import { useFilterHandlers } from "@/lib/hooks/CandidatesTable/useFilterHandlers";
import { useItemSelectHandler } from "@/lib/hooks/CandidatesTable/useItemSelectHandler";
import { useSearchDropdownData } from "@/lib/hooks/CandidatesTable/useSearchDropdownData";
import { useSearchSuggestions } from "@/lib/hooks/CandidatesTable/useSearchSuggestions";
import { useLocationDropdownData } from "@/lib/hooks/CandidatesTable/useLocationDropdownData";
import { getCandidateLocationForDisplay, getExperience, getSkills, getCurrentPosition, getExperienceYears } from "@/lib/utils/candidateHelpers";
import { getCVSection, errorToast, successToast } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient";
import { getColumnStyle } from "@/lib/utils/CandidatesTable/tableStyleHelpers";
import Header from "../CandidatesTableComponents/Header";
import FilterTags from "../CandidatesTableComponents/FilterTags";
import SkeletonLoading from "../CandidatesTableComponents/SkeletonLoading";
import { useCandidateTableColumns, clearSkillTagsCache } from "../CandidatesTableComponents/Columns";
import SearchDropdown from "../Dropdown/CandidatesTable/SearchDropdown";
import InviteToJobModal from "../CandidateComponents/InviteToJobModal";
import CandidateActionModal from "../CandidateComponents/CandidateActionModal";
import Button from "@/lib/components/ui/button/Button";

// ============================================================================
// Constants
// ============================================================================
const INITIAL_DISPLAY_COUNT = 20;
const ITEMS_PER_PAGE = 20;
const SKELETON_LOADING_COUNT = 10;
const INFINITE_SCROLL_SKELETON_COUNT = 3;
const SEARCH_PLACEHOLDER = "Search for candidates, skills, current position";
// Removed AI_FETCH_PAGE_SIZE - now fetching all candidates at once

export default function CandidatesTableV2() {
    // ============================================================================
    // URL Params & Context
    // ============================================================================
    const searchParams = useSearchParams();
    const orgID = searchParams.get("orgID");
    const { user } = useAppContext();
    const { setUploadModalOpen } = useUpload();
    const [activeOrg] = useLocalStorage("activeOrg", null);
    const currentOrgRole =
        activeOrg && orgID != null && String(activeOrg._id) === String(orgID)
            ? activeOrg.role
            : null;
    const canSelectCandidates =
        currentOrgRole === "admin" || currentOrgRole === "super_admin";
    const activeCandidate = searchParams.get("candidate");

    // ============================================================================
    // State - Search & Location UI
    // ============================================================================
    const [searchInput, setSearchInput] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchWrapperRef = useRef<HTMLDivElement>(null);
    const searchDropdownRef = useRef<HTMLDivElement>(null);
    const [isSearchDropdownVisible, setIsSearchDropdownVisible] = useState(false);

    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    const [isSortDropdownVisible, setIsSortDropdownVisible] = useState(false);
    const sortDropdownRef = useRef<HTMLDivElement>(null);
    const sortWrapperRef = useRef<HTMLDivElement>(null);
    const sortButtonRef = useRef<HTMLDivElement>(null);

    // ============================================================================
    // State - Modal & Selection
    // ============================================================================
    const [showCandidateModal, setShowCandidateModal] = useState(false);
    const [showCommentModal, setShowCommentModal] = useState(false);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [isInviteToJobOpen, setIsInviteToJobOpen] = useState(false);
    const [inviteCandidate, setInviteCandidate] = useState<any>(null);
    const [showCandidateActionModal, setShowCandidateActionModal] = useState("");
    const [actionModalCandidate, setActionModalCandidate] = useState<any>(null);
    const [rowSelection, setRowSelection] = useState({});
    const selectedCount = useMemo(() => Object.keys(rowSelection).length, [rowSelection]);
    const [showBulkEmailPanel, setShowBulkEmailPanel] = useState(false);

    // ============================================================================
    // State - Filters
    // ============================================================================
    const [filterStatus, setFilterStatus] = useState("All Application Statuses");
    const [sortBy, setSortBy] = useState("Recent Activity");
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [selectedFilters, setSelectedFilters] = useState<Array<{ type: string; name: string; questionId?: string }>>([]);
    const [minYears, setMinYears] = useState<string>("");
    const [maxYears, setMaxYears] = useState<string>("");
    const [minSalary, setMinSalary] = useState<string>("");
    const [maxSalary, setMaxSalary] = useState<string>("");
    const [preScreeningAnswers, setPreScreeningAnswers] = useState<Record<string, any>>({});
    const [aiPromptInput, setAiPromptInput] = useState("");
    const [aiModeActive, setAiModeActive] = useState(false);
    // ATS grades for all candidates (determined by semantic matching)
    const [atsGradesMap, setAtsGradesMap] = useState<Record<string, { grade: string; reason: string; score: number; percentageMatch: number }>>({});
    // AI explanations (optional, fetched on-demand when user clicks icon)
    const [aiExplanationsMap, setAiExplanationsMap] = useState<Record<string, { reason: string; isLoading: boolean }>>({});
    // Store the search prompt used for AI search (needed for on-demand AI explanations)
    const [aiSearchPrompt, setAiSearchPrompt] = useState<string>("");
    // Cache for embeddings to avoid redundant API calls
    const embeddingsCacheRef = useRef<Record<string, number[]>>({});
    const [aiIsLoading, setAiIsLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [showAiSearchModal, setShowAiSearchModal] = useState(false);
    const [aiEvaluationProgress, setAiEvaluationProgress] = useState<{ phase?: "fetching" | "evaluating"; current: number; total: number }>({ phase: "fetching", current: 0, total: 0 });
    const [aiEvaluationCancelled, setAiEvaluationCancelled] = useState(false);
    const aiEvaluationCancelRef = useRef(false);
    // Track when AI loading started to provide a rough ETA
    const aiLoadingStartRef = useRef<number | null>(null);
    // Full candidate pool fetched from MongoDB for AI search (includes candidates not yet loaded via infinite scroll)
    const [aiCandidatePool, setAiCandidatePool] = useState<any[]>([]);
    // Snapshot of the filter state that produced the current AI pool. If filters change, the pool becomes stale.
    const [aiPoolFiltersKey, setAiPoolFiltersKey] = useState<string | null>(null);
    // CVs fetched on-demand (to avoid bulk-loading CVs for the full AI pool)
    const [onDemandCvMap, setOnDemandCvMap] = useState<Record<string, any>>({});
    // AI mode still paginates the UI (do not render the full candidate pool at once)
    const [aiDisplayedCount, setAiDisplayedCount] = useState(INITIAL_DISPLAY_COUNT);
    const [aiIsLoadingMore, setAiIsLoadingMore] = useState(false);
    const aiIsLoadingMoreRef = useRef(false);
    // Ref to store the latest fetchAllCandidatesFromMongo function (to avoid stale closures in effects)
    const fetchAllCandidatesFromMongoRef = useRef<() => Promise<{ candidates: any[]; totalCount: number }>>(() => Promise.resolve({ candidates: [], totalCount: 0 }));
    // Ref to track if filter re-fetch is in progress (prevents duplicate requests)
    const aiFilterRefetchInProgressRef = useRef(false);

    const refetchedCandidatesRef = useRef<boolean>(true);

    // Current filter key (used to determine whether an existing AI pool is still valid)
    const aiCurrentFiltersKey = useMemo(() => {
        const normalizedSelected = [...(selectedFilters || [])]
            .map(f => ({ type: f.type, name: f.name, questionId: f.questionId || "" }))
            .sort((a, b) => `${a.type}|${a.name}|${a.questionId}`.localeCompare(`${b.type}|${b.name}|${b.questionId}`));

        const pre = preScreeningAnswers || {};
        const preKeys = Object.keys(pre).sort();
        const normalizedPre: Record<string, any> = {};
        preKeys.forEach(k => { normalizedPre[k] = pre[k]; });

        return JSON.stringify({
            orgID,
            filterStatus,
            selectedFilters: normalizedSelected,
            minYears,
            maxYears,
            minSalary,
            maxSalary,
            preScreeningAnswers: normalizedPre,
        });
    }, [orgID, filterStatus, selectedFilters, minYears, maxYears, minSalary, maxSalary, preScreeningAnswers]);

    // ============================================================================
    // State - Pagination (Facebook-style: handled by hook)
    // ============================================================================
    const skeletonTriggerRef = useRef<HTMLTableRowElement>(null);

    // ============================================================================
    // Data Fetching Hooks
    // ============================================================================
    // Fetch candidates with filters applied at database level (Facebook-style incremental loading)
    const {
        candidates: filteredCandidates,
        totalCount,
        isLoading,
        isLoadingMore,
        hasMore,
        refetch,
        loadMore
    } = useCandidatesData({
        orgID,
        filterStatus,
        sortBy,
        selectedFilters,
        minYears,
        maxYears,
        minSalary,
        maxSalary,
        preScreeningAnswers,
        limit: 20, // Facebook-style: small batches (20 items per page)
    });
    const { preScreeningQuestions } = usePreScreeningQuestions({ orgID });
    const { cvDataMap, isLoading: isLoadingCVs } = useCandidateCVs({ candidates: filteredCandidates, orgID: orgID || "", enabled: true });

    // Reset AI UI pagination whenever the pool changes (new search, new filters, etc.)
    useEffect(() => {
        setAiDisplayedCount(INITIAL_DISPLAY_COUNT);
    }, [aiCandidatePool.length]);

    // Refetch candidates ONLY when finished and no duplicates
    const { processedFiles, isProcessing, fileQueue } = useUpload();

    useEffect(() => {
        if (fileQueue.length > 0) {
            refetchedCandidatesRef.current = false;
        }
    }, [fileQueue]);

    useEffect(() => {
        const hasNewImports = processedFiles.some((file: any) => file.status === "Imported" && !file.currentCV);
        const duplicateProcessing = processedFiles.filter(file => file.status === "Duplicate").length;
        if (hasNewImports && !isProcessing && duplicateProcessing === 0 && !refetchedCandidatesRef.current) {
            refetchedCandidatesRef.current = true;
            // Small delay to ensure database is updated
            setTimeout(() => {
                refetch();
            }, 1000);
        }
    }, [processedFiles, refetch, isProcessing]);

    // ============================================================================
    // Computed Values
    // ============================================================================
    const getCandidateId = useCallback((candidate: any) => candidate.email || candidate._id || candidate.id || candidate?.candidate_id || "", []);

    // Get ATS grade for candidate (always available after AI search)
    const getAtsGradeForCandidate = useCallback((candidate: any) => {
        const id = getCandidateId(candidate);
        if (!id) return undefined;

        const normalizedId = String(id).trim();
        if (atsGradesMap[normalizedId]) {
            return atsGradesMap[normalizedId];
        }

        // Try to find by email if ID doesn't match
        const candidateEmail = candidate?.email;
        if (candidateEmail) {
            const emailMatch = Object.keys(atsGradesMap).find(key =>
                String(key).trim().toLowerCase() === String(candidateEmail).trim().toLowerCase()
            );
            if (emailMatch) {
                return atsGradesMap[emailMatch];
            }
        }

        return undefined;
    }, [atsGradesMap, getCandidateId]);

    // Get AI explanation for candidate (optional, fetched on-demand)
    const getAiExplanationForCandidate = useCallback((candidate: any) => {
        const id = getCandidateId(candidate);
        if (!id) return undefined;

        const normalizedId = String(id).trim();
        return aiExplanationsMap[normalizedId];
    }, [aiExplanationsMap, getCandidateId]);

    // Combined fitness data (ATS grade + optional AI explanation)
    const getAiFitnessForCandidate = useCallback((candidate: any) => {
        const atsGrade = getAtsGradeForCandidate(candidate);
        if (!atsGrade) return undefined;

        const aiExplanation = getAiExplanationForCandidate(candidate);

        return {
            grade: atsGrade.grade,
            score: atsGrade.score,
            percentageMatch: atsGrade.percentageMatch, // Include percentage for sorting
            reason: aiExplanation?.reason || atsGrade.reason, // Use AI explanation if available, otherwise ATS default
            hasAiExplanation: !!aiExplanation?.reason,
            isLoadingExplanation: aiExplanation?.isLoading || false,
        };
    }, [getAtsGradeForCandidate, getAiExplanationForCandidate]);

    // Track previous filter key to detect filter changes
    const prevFiltersKeyRef = useRef<string | null>(null);
    const [isFilterChanging, setIsFilterChanging] = useState(false);

    // Detect when filters change to show loading state immediately
    useEffect(() => {
        if (prevFiltersKeyRef.current !== null && prevFiltersKeyRef.current !== aiCurrentFiltersKey) {
            // Filters changed - show loading immediately to prevent showing stale data
            setIsFilterChanging(true);
        }
        prevFiltersKeyRef.current = aiCurrentFiltersKey;
    }, [aiCurrentFiltersKey]);

    // Clear filter changing state when data is loaded and we have candidates
    // Also clear if we get an empty result (legitimate no results, not a transition)
    useEffect(() => {
        if (isFilterChanging) {
            // Wait for loading to complete and we have either candidates or confirmed empty result
            if (!isLoading && !aiIsLoading) {
                // Small delay to ensure state has settled
                const timer = setTimeout(() => {
                    setIsFilterChanging(false);
                }, 100);
                return () => clearTimeout(timer);
            }
        }
    }, [isLoading, aiIsLoading, isFilterChanging]);

    // Candidate source for AI mode:
    // - Normal mode: uses the incrementally loaded candidates from the hook
    // - AI mode: uses the FULL filtered dataset fetched from MongoDB
    // - During re-fetch (when filters change): keep using the old pool until new data is ready
    const aiCandidateSource = useMemo(() => {
        const isPoolCompatible = aiPoolFiltersKey != null && aiPoolFiltersKey === aiCurrentFiltersKey;
        if (aiModeActive && aiCandidatePool.length > 0 && isPoolCompatible) {
            return aiCandidatePool;
        }
        // During AI re-fetch (loading new filtered data), keep using old pool to avoid
        // falling back to paginated data which breaks fitness sorting
        if (aiModeActive && aiIsLoading && aiCandidatePool.length > 0) {
            return aiCandidatePool;
        }
        // If filters changed but we're not loading yet, use filteredCandidates from hook
        // (which has filters applied, but only 20 candidates - will be replaced when re-fetch completes)
        return filteredCandidates;
    }, [aiModeActive, aiCandidatePool, filteredCandidates, aiPoolFiltersKey, aiCurrentFiltersKey, aiIsLoading]);

    // IMPORTANT: Must be declared before any hooks that reference it (dependency arrays are evaluated immediately)
    // Include loading state so we stay in AI pool mode during re-fetch (when filters change)
    const isAiPoolMode = aiModeActive && aiCandidatePool.length > 0 && (
        (aiPoolFiltersKey != null && aiPoolFiltersKey === aiCurrentFiltersKey) ||
        aiIsLoading // Keep pool mode during re-fetch
    );

    // Track if we have fitness grades to determine behavior when filters change
    const hasAtsGrades = Object.keys(atsGradesMap).length > 0;

    // When filters change after an AI search with fitness grades, re-fetch all candidates
    // matching the new filters and apply the existing fitness grades.
    // This ensures sorting (especially fitness sorting) works correctly with filters.
    useEffect(() => {
        if (!aiModeActive) return;
        if (!hasAtsGrades) return; // No fitness grades, nothing special needed
        if (!aiPoolFiltersKey) return; // Pool never initialized (first AI search hasn't completed yet)
        if (aiPoolFiltersKey === aiCurrentFiltersKey) return; // Filters unchanged
        if (aiFilterRefetchInProgressRef.current) return; // Already fetching

        aiFilterRefetchInProgressRef.current = true;
        let cancelled = false;

        const refetchWithNewFilters = async () => {
            setAiIsLoading(true);
            setAiDisplayedCount(INITIAL_DISPLAY_COUNT);
            setOnDemandCvMap({});

            try {
                // Re-fetch all candidates matching the new filters
                // Use ref to always get the latest function (avoids stale closure with old filters)
                const { candidates } = await fetchAllCandidatesFromMongoRef.current();

                if (cancelled) return;

                // Update pool with new filtered candidates (fitness grades from atsGradesMap still apply)
                setAiCandidatePool(candidates);
                setAiPoolFiltersKey(aiCurrentFiltersKey);
            } catch (err) {
                if (cancelled) return;
                console.error("Failed to re-fetch candidates after filter change:", err);
                // Clear pool on error (falls back to paginated loading)
                setAiCandidatePool([]);
                setAiPoolFiltersKey(null);
            } finally {
                if (!cancelled) {
                    setAiIsLoading(false);
                    aiFilterRefetchInProgressRef.current = false;
                }
            }
        };

        refetchWithNewFilters();

        return () => {
            cancelled = true;
            aiFilterRefetchInProgressRef.current = false;
        };
    }, [aiModeActive, hasAtsGrades, aiPoolFiltersKey, aiCurrentFiltersKey]);

    // Augment candidates with fitness data (without sorting - sorting will be applied based on sortBy)
    const aiAugmentedCandidates = useMemo(() => {
        if (!aiModeActive || Object.keys(atsGradesMap).length === 0) {
            return aiCandidateSource;
        }
        return aiCandidateSource.map(candidate => {
            const fitness = getAiFitnessForCandidate(candidate);
            return { ...candidate, __aiFitness: fitness };
        });
    }, [aiModeActive, atsGradesMap, aiCandidateSource, getAiFitnessForCandidate]);

    // Apply Fitness Score sorting if selected (only when AI mode is active)
    const sortedCandidatesWithFitness = useMemo(() => {
        if (!aiModeActive || Object.keys(atsGradesMap).length === 0) {
            return aiCandidateSource;
        }

        if (sortBy === "Fitness Score: High to Low" || sortBy === "Fitness Score: Low to High") {
            const candidatesWithFitness = aiCandidateSource.map(candidate => {
                const fitness = getAiFitnessForCandidate(candidate);
                return { ...candidate, __aiFitness: fitness };
            });

            if (sortBy === "Fitness Score: High to Low") {
                return candidatesWithFitness.sort((a, b) => {
                    const fitnessA = (a as any).__aiFitness;
                    const fitnessB = (b as any).__aiFitness;

                    if (!fitnessA && !fitnessB) return 0;
                    if (!fitnessA) return 1; // A goes to bottom
                    if (!fitnessB) return -1; // B goes to bottom

                    // Sort by percentage match (higher = better)
                    const percentA = fitnessA.percentageMatch ?? 0;
                    const percentB = fitnessB.percentageMatch ?? 0;

                    return percentB - percentA; // Higher percentage first
                });
            } else {
                return candidatesWithFitness.sort((a, b) => {
                    const fitnessA = (a as any).__aiFitness;
                    const fitnessB = (b as any).__aiFitness;

                    if (!fitnessA && !fitnessB) return 0;
                    if (!fitnessA) return -1; // A goes to top (no data = lowest)
                    if (!fitnessB) return 1; // B goes to top (no data = lowest)

                    // Sort by percentage match (lower = first for low to high)
                    const percentA = fitnessA.percentageMatch ?? 0;
                    const percentB = fitnessB.percentageMatch ?? 0;

                    return percentA - percentB; // Lower percentage first
                });
            }
        }

        return aiCandidateSource;
    }, [sortBy, aiModeActive, atsGradesMap, aiCandidateSource, getAiFitnessForCandidate]);

    // Apply regular sorting to candidates when AI mode is active but non-fitness sort is selected
    const sortedCandidatesWithRegularSort = useMemo(() => {
        if (!aiModeActive || Object.keys(atsGradesMap).length === 0) {
            return aiCandidateSource;
        }

        // If fitness score sort is selected, don't apply regular sort (handled by sortedCandidatesWithFitness)
        if (sortBy === "Fitness Score: High to Low" || sortBy === "Fitness Score: Low to High") {
            return aiAugmentedCandidates;
        }

        // Apply regular sorting to candidates with fitness data
        const sorted = [...aiAugmentedCandidates];
        if (sortBy === "Recent Activity") {
            sorted.sort((a, b) => {
                const aTime = new Date(a.activeAt || 0).getTime();
                const bTime = new Date(b.activeAt || 0).getTime();
                return bTime - aTime;
            });
        } else if (sortBy === "Experience: Low to High") {
            sorted.sort((a, b) => {
                const aExp = getExperienceYears(a) ?? -1;
                const bExp = getExperienceYears(b) ?? -1;
                return aExp - bExp;
            });
        } else if (sortBy === "Experience: High to Low") {
            sorted.sort((a, b) => {
                const aExp = getExperienceYears(a) ?? -1;
                const bExp = getExperienceYears(b) ?? -1;
                return bExp - aExp;
            });
        } else if (sortBy === "Name: A-Z") {
            sorted.sort((a, b) => {
                const aName = (a.name || a.email || "").toLowerCase();
                const bName = (b.name || b.email || "").toLowerCase();
                return aName.localeCompare(bName);
            });
        } else if (sortBy === "Name: Z-A") {
            sorted.sort((a, b) => {
                const aName = (a.name || a.email || "").toLowerCase();
                const bName = (b.name || b.email || "").toLowerCase();
                return bName.localeCompare(aName);
            });
        } else if (sortBy === "Last Active: Newest") {
            sorted.sort((a, b) => {
                const aTime = new Date(a.activeAt || 0).getTime();
                const bTime = new Date(b.activeAt || 0).getTime();
                return bTime - aTime;
            });
        } else if (sortBy === "Last Active: Oldest") {
            sorted.sort((a, b) => {
                const aTime = new Date(a.activeAt || 0).getTime();
                const bTime = new Date(b.activeAt || 0).getTime();
                return aTime - bTime;
            });
        } else if (sortBy === "Current Position: A-Z") {
            sorted.sort((a, b) => {
                const aPos = (getCurrentPosition(a) || "").toLowerCase();
                const bPos = (getCurrentPosition(b) || "").toLowerCase();
                return aPos.localeCompare(bPos);
            });
        } else if (sortBy === "Current Position: Z-A") {
            sorted.sort((a, b) => {
                const aPos = (getCurrentPosition(a) || "").toLowerCase();
                const bPos = (getCurrentPosition(b) || "").toLowerCase();
                return bPos.localeCompare(aPos);
            });
        } else if (sortBy === "Location: A-Z") {
            sorted.sort((a, b) => {
                const aLoc = (getCandidateLocationForDisplay(a) || "").toLowerCase();
                const bLoc = (getCandidateLocationForDisplay(b) || "").toLowerCase();
                return aLoc.localeCompare(bLoc);
            });
        } else if (sortBy === "Location: Z-A") {
            sorted.sort((a, b) => {
                const aLoc = (getCandidateLocationForDisplay(a) || "").toLowerCase();
                const bLoc = (getCandidateLocationForDisplay(b) || "").toLowerCase();
                return bLoc.localeCompare(aLoc);
            });
        }
        return sorted;
    }, [sortBy, aiModeActive, atsGradesMap, aiAugmentedCandidates, aiCandidateSource]);

    // Client-side sorting for normal mode (fallback if database sorting fails)
    // This ensures sorting always works correctly even if the API doesn't sort properly
    const sortedNormalModeCandidates = useMemo(() => {
        // Only apply client-side sorting in normal mode (not AI mode)
        if (aiModeActive) {
            return filteredCandidates;
        }

        // Apply client-side sorting based on sortBy
        const sorted = [...filteredCandidates];

        if (sortBy === "Recent Activity" || sortBy === "Last Active: Newest") {
            sorted.sort((a, b) => {
                const aTime = new Date(a.activeAt || 0).getTime();
                const bTime = new Date(b.activeAt || 0).getTime();
                return bTime - aTime;
            });
        } else if (sortBy === "Last Active: Oldest") {
            sorted.sort((a, b) => {
                const aTime = new Date(a.activeAt || 0).getTime();
                const bTime = new Date(b.activeAt || 0).getTime();
                return aTime - bTime;
            });
        } else if (sortBy === "Experience: Low to High") {
            sorted.sort((a, b) => {
                const aExp = getExperienceYears(a) ?? -1;
                const bExp = getExperienceYears(b) ?? -1;
                return aExp - bExp;
            });
        } else if (sortBy === "Experience: High to Low") {
            sorted.sort((a, b) => {
                const aExp = getExperienceYears(a) ?? -1;
                const bExp = getExperienceYears(b) ?? -1;
                return bExp - aExp;
            });
        } else if (sortBy === "Name: A-Z") {
            sorted.sort((a, b) => {
                const aName = (a.name || a.email || "").toLowerCase();
                const bName = (b.name || b.email || "").toLowerCase();
                return aName.localeCompare(bName);
            });
        } else if (sortBy === "Name: Z-A") {
            sorted.sort((a, b) => {
                const aName = (a.name || a.email || "").toLowerCase();
                const bName = (b.name || b.email || "").toLowerCase();
                return bName.localeCompare(aName);
            });
        } else if (sortBy === "Current Position: A-Z") {
            sorted.sort((a, b) => {
                const aPos = (getCurrentPosition(a) || "").toLowerCase();
                const bPos = (getCurrentPosition(b) || "").toLowerCase();
                return aPos.localeCompare(bPos);
            });
        } else if (sortBy === "Current Position: Z-A") {
            sorted.sort((a, b) => {
                const aPos = (getCurrentPosition(a) || "").toLowerCase();
                const bPos = (getCurrentPosition(b) || "").toLowerCase();
                return bPos.localeCompare(aPos);
            });
        } else if (sortBy === "Location: A-Z") {
            sorted.sort((a, b) => {
                const aLoc = (getCandidateLocationForDisplay(a) || "").toLowerCase();
                const bLoc = (getCandidateLocationForDisplay(b) || "").toLowerCase();
                return aLoc.localeCompare(bLoc);
            });
        } else if (sortBy === "Location: Z-A") {
            sorted.sort((a, b) => {
                const aLoc = (getCandidateLocationForDisplay(a) || "").toLowerCase();
                const bLoc = (getCandidateLocationForDisplay(b) || "").toLowerCase();
                return bLoc.localeCompare(aLoc);
            });
        }

        return sorted;
    }, [filteredCandidates, sortBy, aiModeActive]);

    // Facebook-style: Display candidates incrementally.
    // - Normal mode: candidates are incrementally fetched from API via `useCandidatesData`
    // - AI mode: we still paginate UI client-side to avoid rendering the full pool at once
    const displayedCandidates = useMemo(() => {
        if (isAiPoolMode) {
            // If Fitness Score sorting is selected, slice the fully sorted list
            if (sortBy === "Fitness Score: High to Low" || sortBy === "Fitness Score: Low to High") {
                return sortedCandidatesWithFitness.slice(0, aiDisplayedCount);
            }
            // If AI mode is active but regular sort is selected, slice the fully sorted list
            if (Object.keys(atsGradesMap).length > 0) {
                return sortedCandidatesWithRegularSort.slice(0, aiDisplayedCount);
            }
            // If AI is fetching/evaluating and we don't yet have scores, still avoid rendering the full pool
            return aiCandidateSource.slice(0, aiDisplayedCount);
        }

        // Non AI-pool mode: use original behavior (API pagination / hook-driven incremental fetch)
        if (aiModeActive && (sortBy === "Fitness Score: High to Low" || sortBy === "Fitness Score: Low to High")) {
            return sortedCandidatesWithFitness;
        }
        if (aiModeActive && Object.keys(atsGradesMap).length > 0) {
            return sortedCandidatesWithRegularSort;
        }
        // Normal mode: use client-side sorted candidates (fallback if API sorting fails)
        if (!aiModeActive) {
            return sortedNormalModeCandidates;
        }
        return aiCandidateSource;
    }, [aiModeActive, atsGradesMap, aiCandidateSource, sortBy, sortedCandidatesWithFitness, sortedCandidatesWithRegularSort, isAiPoolMode, aiDisplayedCount, sortedNormalModeCandidates]);

    // Use hasMore from hook (Facebook-style: based on API pagination)
    // Note: For AI mode with custom sorting, we still need to check if there are more in the sorted arrays
    const hasMoreCandidates = useMemo(() => {
        // In AI pool mode, "load more" means revealing more rows client-side.
        if (isAiPoolMode) {
            const fullLen = (sortBy === "Fitness Score: High to Low" || sortBy === "Fitness Score: Low to High")
                ? sortedCandidatesWithFitness.length
                : (aiModeActive && Object.keys(atsGradesMap).length > 0
                    ? sortedCandidatesWithRegularSort.length
                    : aiCandidateSource.length);
            return aiDisplayedCount < fullLen;
        }
        if (aiModeActive && (sortBy === "Fitness Score: High to Low" || sortBy === "Fitness Score: Low to High")) {
            // For AI fitness sorting, check if we have more in the sorted array
            return sortedCandidatesWithFitness.length < totalCount;
        }
        if (aiModeActive && Object.keys(atsGradesMap).length > 0) {
            return sortedCandidatesWithRegularSort.length < totalCount;
        }
        // Use hook's hasMore for regular flow
        return hasMore;
    }, [hasMore, aiModeActive, isAiPoolMode, aiDisplayedCount, aiCandidateSource.length, sortBy, sortedCandidatesWithFitness.length, sortedCandidatesWithRegularSort.length, totalCount, atsGradesMap]);

    // In AI pool mode, we don't have rich CV-derived fields for the whole pool (we fetched a lightweight payload).
    // To keep Experience / Current Position / Location populated, we prefetch CVs for the currently visible rows only
    // and attach `cvData` so the existing helpers can parse.
    useEffect(() => {
        if (!isAiPoolMode) return;
        const visibleEmails = displayedCandidates
            .map((c: any) => c?.email)
            .filter((e: any): e is string => Boolean(e));
        const missing = visibleEmails.filter(email => !onDemandCvMap[email]);
        if (missing.length === 0) return;

        let cancelled = false;
        (async () => {
            try {
                const resp = await api.post("/api/bulk-load-cvs", {
                    emails: missing.slice(0, 50),
                    orgID: orgID || ""
                });
                if (cancelled) return;
                const cvs = resp.data?.cvs || {};
                if (cvs && typeof cvs === "object") {
                    setOnDemandCvMap(prev => ({ ...prev, ...cvs }));
                }
            } catch (err) {
                console.error("Failed to prefetch CVs for AI rows:", err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isAiPoolMode, displayedCandidates, onDemandCvMap]);

    const tableCandidates = useMemo(() => {
        if (!isAiPoolMode) return displayedCandidates;
        return displayedCandidates.map((candidate: any) => {
            const email = candidate?.email;
            const cv = email ? onDemandCvMap[email] : undefined;
            if (!cv) return candidate;

            // Attach digitalCV so helpers like getExperience/getCurrentPosition/getCandidateLocationForDisplay can parse.
            const digitalCV = (cv as any).digitalCV;
            return {
                ...candidate,
                cvData: candidate?.cvData ?? digitalCV ?? candidate?.cvData,
            };
        });
    }, [displayedCandidates, isAiPoolMode, onDemandCvMap]);

    // Fetch search suggestions from MongoDB when user types (with counts from all candidates)
    const { data: searchSuggestions, isLoading: isLoadingSuggestions } = useSearchSuggestions(
        orgID,
        searchInput,
        300 // 300ms debounce
    );

    // Merge local search data (from loaded candidates) with MongoDB suggestions (from all candidates)
    const localSearchData = useSearchDropdownData(filteredCandidates);
    const searchDropdownData = useMemo(() => {
        // When user is typing (searchInput has value), use MongoDB suggestions with counts
        // This processes all data in MongoDB for the organization, just like Skills filter
        // Otherwise, use local data from loaded candidates
        if (searchInput.trim().length >= 2) {
            return {
                candidates: searchSuggestions.candidates.map(c => ({ name: c.name, email: c.email, count: c.count })),
                skills: searchSuggestions.skills.map(s => ({ name: s.name, count: s.count })),
                positions: searchSuggestions.positions.map(p => ({ name: p.name, count: p.count }))
            };
        }
        return localSearchData;
    }, [searchInput, searchSuggestions, localSearchData]);

    const locationDropdownData = useLocationDropdownData(filteredCandidates);

    // Calculate search filter count (Candidates, Skills, Current Position)
    const searchFilterCount = useMemo(() => {
        return selectedFilters.filter(
            filter => filter.type === "Candidates" || filter.type === "Skills" || filter.type === "Current Position"
        ).length;
    }, [selectedFilters]);

    // AI search loading progress and ETA
    // Track the maximum progress reached to preserve 100% after completion
    const aiProgressPercentRef = useRef<number>(0);
    // Track if fetching phase completed (reached 100%)
    const fetchingCompletedRef = useRef<boolean>(false);

    const aiProgressPercent = useMemo(() => {
        // Fetching phase: 0-90%, Evaluation phase: 90-100%
        if (aiEvaluationProgress.total > 0) {
            let finalPct: number;

            if (aiEvaluationProgress.phase === "fetching") {
                // Fetching phase: map to 0-90%
                const fetchRatio = aiEvaluationProgress.current / aiEvaluationProgress.total;
                finalPct = fetchRatio * 90; // Scale to 0-90%
                finalPct = Math.min(90, Math.max(0, finalPct));

                // Track if fetching phase reached 100% (which means we're at 90% overall)
                if (fetchRatio >= 1.0) {
                    fetchingCompletedRef.current = true;
                    finalPct = 90; // Ensure it's exactly 90% when fetching completes
                }
            } else if (aiEvaluationProgress.phase === "evaluating") {
                // Evaluation phase: map to 90-100%
                const evalRatio = aiEvaluationProgress.current / aiEvaluationProgress.total;
                finalPct = 90 + (evalRatio * 10); // Scale to 90-100%
                finalPct = Math.min(100, Math.max(90, finalPct));
            } else {
                // Fallback: calculate normally
                const pct = Math.round((aiEvaluationProgress.current / aiEvaluationProgress.total) * 100);
                finalPct = Math.min(100, Math.max(0, pct));
            }

            // Update ref to track maximum progress
            if (finalPct > aiProgressPercentRef.current) {
                aiProgressPercentRef.current = finalPct;
            }
            return Math.round(finalPct);
        }
        // If we've reached 100% before, keep showing it even after loading completes
        if (aiProgressPercentRef.current === 100) {
            return 100;
        }
        return aiIsLoading ? 5 : 0; // Small placeholder while totals are unknown
    }, [aiEvaluationProgress, aiIsLoading]);

    const aiEstimatedMinutes = useMemo(() => {
        if (!aiIsLoading || aiProgressPercent <= 0) return null;
        const startedAt = aiLoadingStartRef.current;
        if (!startedAt) return null;
        const elapsedSeconds = (Date.now() - startedAt) / 1000;
        if (!isFinite(elapsedSeconds) || elapsedSeconds <= 0) return null;
        const remainingSeconds = elapsedSeconds * (100 / aiProgressPercent - 1);
        if (!isFinite(remainingSeconds) || remainingSeconds < 0) return null;
        return Math.max(0, Math.round(remainingSeconds / 60));
    }, [aiIsLoading, aiProgressPercent, aiEvaluationProgress]);

    // Calculate advanced filter count (everything except search filters)
    // Include experience/salary which are stored in separate state (ANDed with other filters).
    const advancedFilterCount = useMemo(() => {
        const baseCount = selectedFilters.filter(
            filter => filter.type !== "Candidates" && filter.type !== "Skills" && filter.type !== "Current Position"
        ).length;

        const experienceCount = (minYears.trim() || maxYears.trim()) ? 1 : 0;
        const salaryCount = (minSalary.trim() || maxSalary.trim()) ? 1 : 0;

        return baseCount + experienceCount + salaryCount;
    }, [selectedFilters, minYears, maxYears, minSalary, maxSalary]);

    // ============================================================================
    // Callbacks - Search & Location Handlers
    // ============================================================================
    const handleItemSelect = useItemSelectHandler({
        setSelectedFilters,
        setIsSearchDropdownVisible,
        setIsLocationDropdownVisible: () => { }, // No-op: location dropdown removed from main view
        setFocusedInput,
        setSearchInput,
        setLocationInput: () => { }, // No-op: location dropdown removed from main view
        searchInputRef,
        locationInputRef: { current: null } // No-op: location dropdown removed from main view
    });

    const handleSearchSubmit = useCallback(() => {
        const query = searchInput.trim();
        if (query) {
            // If the user hits Enter, we add a generic "Candidates" filter
            // which handles searching by name, email, skills, and current position on the backend.
            handleItemSelect("Candidates", query);
        }
        setIsSearchDropdownVisible(false);
        setFocusedInput(null);
        if (searchInputRef.current) {
            searchInputRef.current.blur();
        }
    }, [searchInput, handleItemSelect]);

    // Build the same filter payload used by `/api/get-candidates` so AI search can fetch the FULL filtered dataset from MongoDB.
    const buildMongoFiltersForCandidateFetch = useCallback(() => {
        const filters: any = {
            skills: [],
            locations: [],
            currentPositions: [],
            candidateNames: [],
            preScreening: [],
        };

        // Group filters by type
        const filtersByType = selectedFilters.reduce((acc, filter) => {
            if (!acc[filter.type]) acc[filter.type] = [];
            acc[filter.type].push(filter);
            return acc;
        }, {} as Record<string, Array<{ type: string; name: string; questionId?: string }>>);

        if (filtersByType["Skills"]) filters.skills = filtersByType["Skills"].map(f => f.name);
        if (filtersByType["Location"]) filters.locations = filtersByType["Location"].map(f => f.name);
        if (filtersByType["Current Position"]) filters.currentPositions = filtersByType["Current Position"].map(f => f.name);
        if (filtersByType["Candidates"]) filters.candidateNames = filtersByType["Candidates"].map(f => f.name);
        if (filtersByType["Availability"]) filters.availability = filtersByType["Availability"].map(f => f.name);
        if (filtersByType["Work Setup"]) filters.workSetup = filtersByType["Work Setup"].map(f => f.name);

        // Experience filter
        if (minYears.trim() || maxYears.trim()) {
            if (minYears.trim()) filters.minYears = minYears.trim();
            if (maxYears.trim()) filters.maxYears = maxYears.trim();
        }

        // Salary filter
        if (minSalary.trim() || maxSalary.trim()) {
            if (minSalary.trim()) filters.minSalary = minSalary.trim();
            if (maxSalary.trim()) filters.maxSalary = maxSalary.trim();
        }

        // Pre-screening filters
        const preScreeningFilters = selectedFilters.filter(f => f.questionId);
        if (preScreeningFilters.length > 0) {
            filters.preScreening = preScreeningFilters
                .map(filter => {
                    let filterValue = preScreeningAnswers[filter.questionId!];
                    if (!filterValue) {
                        // Try composite key (questionId|questionText)
                        const compositeKey = Object.keys(preScreeningAnswers).find(key =>
                            key.startsWith(`${filter.questionId}|`)
                        );
                        if (compositeKey) {
                            filterValue = preScreeningAnswers[compositeKey];
                        }
                    }
                    return {
                        questionId: filter.questionId,
                        questionText: (filter as any)?.questionText || "",
                        values: Array.isArray(filterValue) ? filterValue : [filterValue].filter(Boolean),
                    };
                })
                .filter(ps => ps.values.length > 0);
        }

        return filters;
    }, [selectedFilters, minYears, maxYears, minSalary, maxSalary, preScreeningAnswers]);

    // Fetch ALL candidates from MongoDB that match the current filters (not just the candidates loaded via infinite scroll).
    // Fetch in chunks to avoid massive single responses that can time out when candidate counts grow (e.g., 3k+).
    const fetchAllCandidatesFromMongo = useCallback(async (): Promise<{ candidates: any[]; totalCount: number }> => {
        if (!orgID) return { candidates: [], totalCount: 0 };

        const filters = buildMongoFiltersForCandidateFetch();
        const filtersParam = encodeURIComponent(JSON.stringify(filters));
        const effectiveSortBy = sortBy.startsWith("Fitness Score") ? "Recent Activity" : sortBy;

        const PAGE_SIZE = 500;
        let page = 1;
        let allCandidates: any[] = [];
        let totalCount = 0;
        let hasMore = true;

        while (hasMore) {
            const response = await api.get("/api/candidates", {
                params: {
                    orgID,
                    filterStatus,
                    search: "", // Search is handled via candidateNames filter
                    sortBy: effectiveSortBy,
                    page,
                    limit: PAGE_SIZE,
                    filters: filtersParam,
                    includeCvData: "1", // Include CV data for position/location/experience extraction
                    includeInterviews: "1", // Include interviews for jobTitle (current position) and location
                },
            });

            const batchCandidates = response.data?.candidates || [];
            if (page === 1) {
                totalCount = response.data?.totalCount ?? batchCandidates.length;
            }

            allCandidates = allCandidates.concat(batchCandidates);

            // Update progress as we accumulate batches
            setAiEvaluationProgress({
                phase: "fetching",
                current: allCandidates.length,
                total: totalCount || allCandidates.length,
            });

            const receivedFullPage = batchCandidates.length === PAGE_SIZE;
            const reachedTotal = totalCount > 0 && allCandidates.length >= totalCount;
            hasMore = receivedFullPage && !reachedTotal;
            page += 1;
        }

        if (totalCount === 0) {
            totalCount = allCandidates.length;
        }

        return { candidates: allCandidates, totalCount };
    }, [orgID, filterStatus, sortBy, buildMongoFiltersForCandidateFetch]);

    // Keep ref updated so effects always use the latest version (avoids stale closures)
    fetchAllCandidatesFromMongoRef.current = fetchAllCandidatesFromMongo;

    const loadMoreAi = useCallback(() => {
        if (!isAiPoolMode) return;
        if (aiIsLoadingMoreRef.current) return;

        aiIsLoadingMoreRef.current = true;
        setAiIsLoadingMore(true);

        setAiDisplayedCount(prev => Math.min(prev + ITEMS_PER_PAGE, aiCandidatePool.length));

        // Small delay prevents rapid repeated triggers from the observer
        setTimeout(() => {
            aiIsLoadingMoreRef.current = false;
            setAiIsLoadingMore(false);
        }, 200);
    }, [isAiPoolMode, aiCandidatePool.length]);

    // Cosine similarity utility function
    const cosineSimilarity = useCallback((vecA: number[], vecB: number[]): number => {
        if (vecA.length !== vecB.length) {
            throw new Error("Vectors must have the same length");
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        if (denominator === 0) return 0;

        return dotProduct / denominator;
    }, []);

    // Get or create embedding for a text (with caching)
    const getEmbedding = useCallback(async (text: string): Promise<number[]> => {
        const cacheKey = text.trim().toLowerCase();

        // Check cache first
        if (embeddingsCacheRef.current[cacheKey]) {
            return embeddingsCacheRef.current[cacheKey];
        }

        try {
            const response = await api.post("/api/get-embeddings", {
                texts: [text]
            });

            const embeddings = response.data?.embeddings?.[0];
            if (!embeddings || !Array.isArray(embeddings)) {
                throw new Error("Invalid embedding response");
            }

            // Cache the embedding
            embeddingsCacheRef.current[cacheKey] = embeddings;
            return embeddings;
        } catch (error) {
            console.error("Error getting embedding:", error);
            throw error;
        }
    }, []);

    // Semantic relevance scoring using embeddings (more advanced, understands context)
    const semanticRelevanceScore = useCallback(async (promptText: string, candidate: any, promptEmbedding?: number[]): Promise<number> => {
        try {
            // Get prompt embedding if not provided
            let promptEmbed: number[];
            if (promptEmbedding) {
                promptEmbed = promptEmbedding;
            } else {
                promptEmbed = await getEmbedding(promptText);
            }

            // Build candidate text from key fields (weighted by importance)
            const candidateSkills = getSkills(candidate);
            // Extract position - use helper function which checks multiple sources
            let position = getCurrentPosition(candidate);
            if (!position || position === "-" || position.trim() === "") {
                // Fallback to direct fields if helper returns empty
                position = candidate?.currentPosition || candidate?.jobTitle || "";
            }
            // Filter out placeholder values
            if (position === "-" || position.trim() === "") {
                position = "";
            }
            const summary = candidate?.summary || "";
            // Extract location - use helper function which checks multiple sources
            let location = getCandidateLocationForDisplay(candidate);
            if (!location || location === "-" || location.trim() === "") {
                // Fallback to direct field if helper returns empty
                location = candidate?.location || "";
            }
            // Filter out placeholder values
            if (location === "-" || location.trim() === "") {
                location = "";
            }

            // Create weighted candidate text (skills and position are most important)
            const candidateText = [
                ...candidateSkills.map((s: string) => `skill: ${s}`), // Skills repeated for emphasis
                position ? `position: ${position}` : "",
                summary ? `summary: ${summary}` : "",
                location ? `location: ${location}` : "",
            ]
                .filter(Boolean)
                .join(". ");

            if (!candidateText.trim()) {
                return 0;
            }

            // Get candidate embedding
            const candidateEmbed = await getEmbedding(candidateText);

            // Calculate cosine similarity (returns value between -1 and 1, typically 0 to 1 for normalized embeddings)
            const similarity = cosineSimilarity(promptEmbed, candidateEmbed);

            // Convert similarity (0-1) to score (0-25 scale to match previous scoring system)
            // Similarity of 0.8+ = very strong match, 0.6-0.8 = good match, etc.
            const score = similarity * 25;

            return Math.max(0, score); // Ensure non-negative
        } catch (error) {
            console.error("Error in semantic relevance scoring:", error);
            // Fallback to 0 if embedding fails
            return 0;
        }
    }, [getEmbedding, cosineSimilarity]);


    // RAG-based semantic search: Process all candidates using pure semantic similarity
    // Returns candidates ranked by percentage match (0-100%) with detailed assessment information
    const batchVectorSearch = useCallback(async (promptText: string, candidates: any[]): Promise<Array<{ candidate: any; similarity: number; percentageMatch: number; score: number; assessmentDetails: { profileData: any; dataCompleteness: any } }>> => {
        try {
            if (!candidates || candidates.length === 0) {
                return [];
            }

            // Build comprehensive candidate texts for RAG (Retrieval-Augmented Generation)
            // Include all relevant candidate information for better semantic matching
            const candidateData: Array<{ candidate: any; text: string }> = [];

            candidates.forEach((candidate) => {
                const candidateSkills = getSkills(candidate);

                // Extract position - EXACTLY as table columns do (line 365 in Columns.tsx)
                // Just call the helper function - it handles all fallbacks internally
                const position = getCurrentPosition(candidate);

                // Extract location - EXACTLY as table columns do (line 379 in Columns.tsx)
                // Just call the helper function - it handles all fallbacks internally
                const location = getCandidateLocationForDisplay(candidate);

                // Get experience information - SAME AS TABLE (uses getExperience as fallback)
                let experienceText = "";
                const expYears = getExperienceYears(candidate);
                if (expYears !== null) {
                    experienceText = `${expYears} years of experience`;
                } else {
                    // Fallback to getExperience (same as table column)
                    const expString = getExperience(candidate);
                    if (expString && expString !== "-") {
                        experienceText = expString;
                    }
                }

                // Build comprehensive candidate profile text for RAG
                // Use position and location values (filter out "-" placeholder)
                const positionForText = position === "-" ? "" : position;
                const locationForText = location === "-" ? "" : location;

                // Extract CV sections for richer semantic matching
                const cvData = candidate?.cvData;
                const cvExperience = cvData ? getCVSection(cvData, "Experience") : "";
                const cvEducation = cvData ? getCVSection(cvData, "Education") : "";
                const cvCertifications = cvData ? getCVSection(cvData, "Certifications") : "";

                const candidateText = [
                    candidate.name ? `Name: ${candidate.name}` : "",
                    positionForText ? `Current Position: ${positionForText}` : "",
                    experienceText ? experienceText : "",
                    candidateSkills.length > 0 ? `Skills: ${candidateSkills.join(", ")}` : "",
                    locationForText ? `Location: ${locationForText}` : "",
                    cvExperience ? `Work Experience: ${cvExperience}` : "",
                    cvEducation ? `Education: ${cvEducation}` : "",
                    cvCertifications ? `Certifications: ${cvCertifications}` : "",
                ]
                    .filter(Boolean)
                    .join(". ");

                candidateData.push({
                    candidate,
                    text: candidateText.trim() || ""
                });
            });

            // Filter candidates with valid text
            const candidatesWithText = candidateData.filter(item => item.text.length > 0);

            if (candidatesWithText.length === 0) {
                // If no candidates have text, return with 0% match (no semantic data available)
                return candidates.map((c) => {
                    const candidateSkills = getSkills(c);

                    // Extract position - EXACTLY as table columns do (line 365 in Columns.tsx)
                    const position = getCurrentPosition(c);

                    // Extract location - EXACTLY as table columns do (line 379 in Columns.tsx)
                    const location = getCandidateLocationForDisplay(c);

                    // Get experience - SAME AS TABLE (getExperience as fallback)
                    const experienceYearsNum = getExperienceYears(c);
                    const experienceDisplay = experienceYearsNum !== null
                        ? `${experienceYearsNum} years`
                        : (getExperience(c) !== "-" ? getExperience(c) : "Not provided");

                    // Extract CV sections for empty text candidates
                    const cvDataEmpty = c?.cvData;
                    const cvExpEmpty = cvDataEmpty ? getCVSection(cvDataEmpty, "Experience") : "";
                    const cvEduEmpty = cvDataEmpty ? getCVSection(cvDataEmpty, "Education") : "";
                    const cvCertEmpty = cvDataEmpty ? getCVSection(cvDataEmpty, "Certifications") : "";
                    const hasCvExpEmpty = !!cvExpEmpty;
                    const hasCvEduEmpty = !!cvEduEmpty;
                    const hasCvCertEmpty = !!cvCertEmpty;

                    return {
                        candidate: c,
                        similarity: 0,
                        percentageMatch: 0,
                        score: 0,
                        assessmentDetails: {
                            profileData: {
                                name: c.name || "Not provided",
                                email: c.email || "Not provided",
                                currentPosition: (position && position !== "-") ? position : "Not provided",
                                experienceYears: experienceDisplay,
                                skills: candidateSkills.length > 0 ? candidateSkills : ["Not provided"],
                                location: (location && location !== "-") ? location : "Not provided",
                                workExperience: cvExpEmpty || "Not provided",
                                education: cvEduEmpty || "Not provided",
                                certifications: cvCertEmpty || "Not provided",
                            },
                            dataCompleteness: {
                                hasName: !!c.name,
                                hasEmail: !!c.email,
                                hasPosition: position && position !== "-" && position.trim() !== "",
                                hasExperience: experienceDisplay !== "Not provided",
                                hasSkills: candidateSkills.length > 0,
                                hasLocation: location && location !== "-" && location.trim() !== "",
                                hasCvExperience: hasCvExpEmpty,
                                hasCvEducation: hasCvEduEmpty,
                                hasCvCertifications: hasCvCertEmpty,
                                totalFields: 9,
                                completedFields: [
                                    !!c.name,
                                    !!c.email,
                                    position && position !== "-" && position.trim() !== "",
                                    experienceDisplay !== "Not provided",
                                    candidateSkills.length > 0,
                                    location && location !== "-" && location.trim() !== "",
                                    hasCvExpEmpty,
                                    hasCvEduEmpty,
                                    hasCvCertEmpty
                                ].filter(Boolean).length,
                                completenessPercentage: Math.round(([
                                    !!c.name,
                                    !!c.email,
                                    position && position !== "-" && position.trim() !== "",
                                    experienceDisplay !== "Not provided",
                                    candidateSkills.length > 0,
                                    location && location !== "-" && location.trim() !== "",
                                    hasCvExpEmpty,
                                    hasCvEduEmpty,
                                    hasCvCertEmpty
                                ].filter(Boolean).length / 9) * 100)
                            }
                        }
                    };
                });
            }

            // Batch generate embeddings: prompt + all candidate texts in one API call
            const allTexts = [promptText, ...candidatesWithText.map(item => item.text)];

            setAiEvaluationProgress({ phase: "evaluating", current: 0, total: allTexts.length });

            const response = await api.post("/api/get-embeddings", {
                texts: allTexts
            });

            const embeddings = response.data?.embeddings || [];
            if (embeddings.length === 0 || embeddings.length < candidatesWithText.length + 1) {
                throw new Error("No embeddings returned or incomplete embeddings");
            }

            // First embedding is the prompt, rest are candidates
            const promptEmbedding = embeddings[0];
            const candidateEmbeddings = embeddings.slice(1);

            // Calculate cosine similarity for all candidates (RAG method)
            const results: Array<{ candidate: any; similarity: number; percentageMatch: number; score: number; assessmentDetails: { profileData: any; dataCompleteness: any } }> = [];

            // First pass: Calculate raw similarities for all candidates
            const rawSimilarities: number[] = [];
            candidatesWithText.forEach((item, index) => {
                const candidateEmbedding = candidateEmbeddings[index];
                const similarity = cosineSimilarity(promptEmbedding, candidateEmbedding);
                rawSimilarities.push(similarity);
            });

            // Find min and max for normalization (spread scores across 0-100%)
            const minSimilarity = Math.min(...rawSimilarities);
            const maxSimilarity = Math.max(...rawSimilarities);
            const range = maxSimilarity - minSimilarity;

            // Second pass: Process candidates with normalized scores
            candidatesWithText.forEach((item, index) => {
                const similarity = rawSimilarities[index];

                // NORMALIZED SEMANTIC SEARCH: Spread scores across 0-100% range
                // Min-max normalization: (value - min) / (max - min) * 100
                // This ensures the best candidate is near 100% and worst is near 0%
                let percentageMatch: number;
                if (range > 0) {
                    // Normalize to 0-100% range, but keep a floor of 20% for the lowest
                    // This prevents good candidates from getting 0% just because they're lowest in batch
                    const normalized = (similarity - minSimilarity) / range;
                    percentageMatch = 20 + (normalized * 80); // Scale to 20-100%
                } else {
                    // All candidates have same similarity, give them middle score
                    percentageMatch = similarity * 100;
                }
                percentageMatch = Math.max(0, Math.min(100, percentageMatch));

                // Score is based on percentage match (0-25 scale for compatibility with existing grading)
                const score = (percentageMatch / 100) * 25;

                // Build detailed assessment information
                const candidate = item.candidate;
                const candidateSkills = getSkills(candidate);

                // Extract position - EXACTLY as table columns do (line 365 in Columns.tsx)
                const position = getCurrentPosition(candidate);
                const positionForText = position === "-" ? "" : position;

                // Extract location - EXACTLY as table columns do (line 379 in Columns.tsx)
                const location = getCandidateLocationForDisplay(candidate);
                const locationForText = location === "-" ? "" : location;

                // Get experience - SAME AS TABLE (getExperience as fallback)
                const expYearsNum = getExperienceYears(candidate);
                const experienceDisplay = expYearsNum !== null
                    ? `${expYearsNum} years`
                    : (getExperience(candidate) !== "-" ? getExperience(candidate) : "Not provided");
                const hasExperience = experienceDisplay !== "Not provided";

                // Extract CV sections for profile data
                const cvDataForProfile = candidate?.cvData;
                const cvExperienceForProfile = cvDataForProfile ? getCVSection(cvDataForProfile, "Experience") : "";
                const cvEducationForProfile = cvDataForProfile ? getCVSection(cvDataForProfile, "Education") : "";
                const cvCertificationsForProfile = cvDataForProfile ? getCVSection(cvDataForProfile, "Certifications") : "";

                const profileData = {
                    name: candidate.name || "Not provided",
                    email: candidate.email || "Not provided",
                    currentPosition: (position && position !== "-") ? position : "Not provided",
                    experienceYears: experienceDisplay,
                    skills: candidateSkills.length > 0 ? candidateSkills : ["Not provided"],
                    location: (location && location !== "-") ? location : "Not provided",
                    workExperience: cvExperienceForProfile || "Not provided",
                    education: cvEducationForProfile || "Not provided",
                    certifications: cvCertificationsForProfile || "Not provided",
                };

                // Calculate data completeness - check if we have actual data (not "-" placeholder)
                const hasPosition = position && position !== "-" && position.trim() !== "";
                const hasLocation = location && location !== "-" && location.trim() !== "";
                const hasCvExperience = !!cvExperienceForProfile;
                const hasCvEducation = !!cvEducationForProfile;
                const hasCvCertifications = !!cvCertificationsForProfile;

                const dataCompleteness = {
                    hasName: !!candidate.name,
                    hasEmail: !!candidate.email,
                    hasPosition: hasPosition,
                    hasExperience: hasExperience,
                    hasSkills: candidateSkills.length > 0,
                    hasLocation: hasLocation,
                    hasCvExperience: hasCvExperience,
                    hasCvEducation: hasCvEducation,
                    hasCvCertifications: hasCvCertifications,
                    totalFields: 9,
                    completedFields: [
                        !!candidate.name,
                        !!candidate.email,
                        hasPosition,
                        hasExperience,
                        candidateSkills.length > 0,
                        hasLocation,
                        hasCvExperience,
                        hasCvEducation,
                        hasCvCertifications
                    ].filter(Boolean).length,
                    completenessPercentage: Math.round(([
                        !!candidate.name,
                        !!candidate.email,
                        hasPosition,
                        hasExperience,
                        candidateSkills.length > 0,
                        hasLocation,
                        hasCvExperience,
                        hasCvEducation,
                        hasCvCertifications
                    ].filter(Boolean).length / 9) * 100)
                };

                results.push({
                    candidate: item.candidate,
                    similarity,
                    percentageMatch,
                    score,
                    assessmentDetails: {
                        profileData,
                        dataCompleteness
                    }
                });
            });

            // Add candidates without text (still calculate keyword match for them)
            candidateData.forEach((item) => {
                if (!item.text || item.text.length === 0) {
                    const candidate = item.candidate;
                    const candidateSkills = getSkills(candidate);
                    // Extract position - use same helper function as table columns
                    let position = getCurrentPosition(candidate);
                    if (position === "-") {
                        position = "";
                    }

                    // Extract location - use same helper function as table columns
                    let location = getCandidateLocationForDisplay(candidate);
                    if (location === "-") {
                        location = "";
                    }

                    // Get experience - SAME AS TABLE (getExperience as fallback)
                    const expYearsNum = getExperienceYears(candidate);
                    const experienceDisplay = expYearsNum !== null
                        ? `${expYearsNum} years`
                        : (getExperience(candidate) !== "-" ? getExperience(candidate) : "Not provided");
                    const hasExperience = experienceDisplay !== "Not provided";

                    // Extract CV sections
                    const cvDataNoText = candidate?.cvData;
                    const cvExperienceNoText = cvDataNoText ? getCVSection(cvDataNoText, "Experience") : "";
                    const cvEducationNoText = cvDataNoText ? getCVSection(cvDataNoText, "Education") : "";
                    const cvCertificationsNoText = cvDataNoText ? getCVSection(cvDataNoText, "Certifications") : "";
                    const hasCvExpNoText = !!cvExperienceNoText;
                    const hasCvEduNoText = !!cvEducationNoText;
                    const hasCvCertNoText = !!cvCertificationsNoText;

                    // For candidates without text, no semantic search is possible (0% match)
                    const percentageMatch = 0;
                    const score = 0;

                    results.push({
                        candidate: item.candidate,
                        similarity: 0,
                        percentageMatch,
                        score,
                        assessmentDetails: {
                            profileData: {
                                name: candidate.name || "Not provided",
                                email: candidate.email || "Not provided",
                                currentPosition: (position && position !== "-") ? position : "Not provided",
                                experienceYears: experienceDisplay,
                                skills: candidateSkills.length > 0 ? candidateSkills : ["Not provided"],
                                location: (location && location !== "-") ? location : "Not provided",
                                workExperience: cvExperienceNoText || "Not provided",
                                education: cvEducationNoText || "Not provided",
                                certifications: cvCertificationsNoText || "Not provided",
                            },
                            dataCompleteness: {
                                hasName: !!candidate.name,
                                hasEmail: !!candidate.email,
                                hasPosition: position && position !== "-" && position.trim() !== "",
                                hasExperience: hasExperience,
                                hasSkills: candidateSkills.length > 0,
                                hasLocation: location && location !== "-" && location.trim() !== "",
                                hasCvExperience: hasCvExpNoText,
                                hasCvEducation: hasCvEduNoText,
                                hasCvCertifications: hasCvCertNoText,
                                totalFields: 9,
                                completedFields: [
                                    !!candidate.name,
                                    !!candidate.email,
                                    position && position !== "-" && position.trim() !== "",
                                    hasExperience,
                                    candidateSkills.length > 0,
                                    location && location !== "-" && location.trim() !== "",
                                    hasCvExpNoText,
                                    hasCvEduNoText,
                                    hasCvCertNoText
                                ].filter(Boolean).length,
                                completenessPercentage: Math.round(([
                                    !!candidate.name,
                                    !!candidate.email,
                                    position && position !== "-" && position.trim() !== "",
                                    hasExperience,
                                    candidateSkills.length > 0,
                                    location && location !== "-" && location.trim() !== "",
                                    hasCvExpNoText,
                                    hasCvEduNoText,
                                    hasCvCertNoText
                                ].filter(Boolean).length / 9) * 100)
                            }
                        }
                    });
                }
            });

            // Sort by percentage match (highest first) - RAG ranking
            results.sort((a, b) => b.percentageMatch - a.percentageMatch);

            return results;
        } catch (error) {
            console.error("Error in RAG-based semantic search:", error);
            // Fallback: return candidates with zero scores and minimal assessment details
            return candidates.map(c => {
                const candidateSkills = getSkills(c);

                // Extract position - use same helper function as table columns
                let position = getCurrentPosition(c);
                if (position === "-") {
                    position = "";
                }

                // Extract location - use same helper function as table columns
                let location = getCandidateLocationForDisplay(c);
                if (location === "-") {
                    location = "";
                }

                // Get experience - SAME AS TABLE (getExperience as fallback)
                const expYearsNum = getExperienceYears(c);
                const experienceDisplay = expYearsNum !== null
                    ? `${expYearsNum} years`
                    : (getExperience(c) !== "-" ? getExperience(c) : "Not provided");
                const hasExperience = experienceDisplay !== "Not provided";

                // Extract CV sections for fallback
                const cvDataFallback = c?.cvData;
                const cvExpFallback = cvDataFallback ? getCVSection(cvDataFallback, "Experience") : "";
                const cvEduFallback = cvDataFallback ? getCVSection(cvDataFallback, "Education") : "";
                const cvCertFallback = cvDataFallback ? getCVSection(cvDataFallback, "Certifications") : "";
                const hasCvExpFallback = !!cvExpFallback;
                const hasCvEduFallback = !!cvEduFallback;
                const hasCvCertFallback = !!cvCertFallback;

                return {
                    candidate: c,
                    similarity: 0,
                    percentageMatch: 0,
                    score: 0,
                    assessmentDetails: {
                        profileData: {
                            name: c.name || "Not provided",
                            email: c.email || "Not provided",
                            currentPosition: (position && position !== "-") ? position : "Not provided",
                            experienceYears: experienceDisplay,
                            skills: candidateSkills.length > 0 ? candidateSkills : ["Not provided"],
                            location: (location && location !== "-") ? location : "Not provided",
                            workExperience: cvExpFallback || "Not provided",
                            education: cvEduFallback || "Not provided",
                            certifications: cvCertFallback || "Not provided",
                        },
                        dataCompleteness: {
                            hasName: !!c.name,
                            hasEmail: !!c.email,
                            hasPosition: position && position !== "-" && position.trim() !== "",
                            hasExperience: hasExperience,
                            hasSkills: candidateSkills.length > 0,
                            hasLocation: location && location !== "-" && location.trim() !== "",
                            hasCvExperience: hasCvExpFallback,
                            hasCvEducation: hasCvEduFallback,
                            hasCvCertifications: hasCvCertFallback,
                            totalFields: 9,
                            completedFields: [
                                !!c.name,
                                !!c.email,
                                position && position !== "-" && position.trim() !== "",
                                hasExperience,
                                candidateSkills.length > 0,
                                location && location !== "-" && location.trim() !== "",
                                hasCvExpFallback,
                                hasCvEduFallback,
                                hasCvCertFallback
                            ].filter(Boolean).length,
                            completenessPercentage: Math.round(([
                                !!c.name,
                                !!c.email,
                                position && position !== "-" && position.trim() !== "",
                                hasExperience,
                                candidateSkills.length > 0,
                                location && location !== "-" && location.trim() !== "",
                                hasCvExpFallback,
                                hasCvEduFallback,
                                hasCvCertFallback
                            ].filter(Boolean).length / 9) * 100)
                        }
                    }
                };
            });
        }
    }, [cosineSimilarity, getExperienceYears, getExperience, getSkills, getCandidateLocationForDisplay]);

    // Legacy keyword-based scoring (kept as fallback)
    const quickRelevanceScore = useCallback((promptText: string, candidate: any) => {
        const keywords = Array.from(new Set((promptText.toLowerCase().match(/\b[a-z]{3,}\b/g) || []).map(k => k.trim()))).filter(Boolean);
        if (keywords.length === 0) return 0;

        const candidateSkills = getSkills(candidate);
        const normalizedSkills = candidateSkills.map((s: string) => s.toLowerCase());
        const position = (candidate?.currentPosition || candidate?.jobTitle || "").toLowerCase();
        const summaryText = (candidate?.summary || "").toLowerCase();
        const name = (candidate?.name || "").toLowerCase();
        const location = (getCandidateLocationForDisplay(candidate) || "").toLowerCase();

        let score = 0;
        const matched: string[] = [];

        keywords.forEach((kw) => {
            // Skills are most important (weight: 5)
            if (normalizedSkills.some(s => s.includes(kw))) {
                score += 5;
                matched.push(kw);
            }
            // Current position is very important (weight: 4)
            else if (position.includes(kw)) {
                score += 4;
                matched.push(kw);
            }
            // Summary contains relevant info (weight: 2)
            else if (summaryText.includes(kw)) {
                score += 2;
                matched.push(kw);
            }
            // Name match (weight: 1)
            else if (name.includes(kw)) {
                score += 1;
                matched.push(kw);
            }
            // Location match (weight: 1)
            else if (location.includes(kw)) {
                score += 1;
                matched.push(kw);
            }
        });

        // Bonus for multiple keyword matches
        const uniqueMatches = Array.from(new Set(matched)).length;
        if (uniqueMatches > 1) {
            score += uniqueMatches * 0.5;
        }

        return score;
    }, []);

    // Convert RAG semantic similarity percentage to fitness grade (No Fit to Strong Fit)
    // Simple grading - detailed assessment available on-demand via LLM reasoner
    const getGradeFromPercentage = useCallback((percentageMatch: number, hasData: boolean): { grade: string; score: number; reason: string } => {
        if (!hasData) {
            return {
                grade: "Insufficient Data",
                score: 0,
                reason: "Insufficient profile data for matching."
            };
        }

        // Determine grade based on percentage match
        // Thresholds: 90%+ Strong Fit, 85-89% Good Fit, 80-84% Maybe Fit, 75-79% Bad Fit, <75% No Fit
        let grade: string;
        let score: number;

        if (percentageMatch >= 90) {
            grade = "Strong Fit";
            score = 10;
        } else if (percentageMatch >= 85) {
            grade = "Good Fit";
            score = 8;
        } else if (percentageMatch >= 80) {
            grade = "Maybe Fit";
            score = 6;
        } else if (percentageMatch >= 75) {
            grade = "Bad Fit";
            score = 4;
        } else {
            grade = "No Fit";
            score = 0;
        }

        return {
            grade,
            score,
            reason: "" // Empty - detailed assessment available via AI button in tooltip
        };
    }, []);

    // Legacy function kept for backward compatibility (not used in new flow)
    const evaluateCandidateFitness = useCallback((promptText: string, candidate: any) => {
        const keywords = Array.from(new Set((promptText.toLowerCase().match(/\b[a-z]{3,}\b/g) || []).map(k => k.trim()))).filter(Boolean);
        const candidateSkills = getSkills(candidate);
        const normalizedSkills = candidateSkills.map((s: string) => s.toLowerCase());
        const position = (candidate?.currentPosition || candidate?.jobTitle || "").toLowerCase();
        const summaryText = (candidate?.summary || "").toLowerCase();

        let score = 0;
        const matched: string[] = [];

        keywords.forEach((kw) => {
            const inSkills = normalizedSkills.some(s => s.includes(kw));
            const inPosition = position.includes(kw);
            const inSummary = summaryText.includes(kw);
            if (inSkills) {
                score += 3;
                matched.push(kw);
            } else if (inPosition) {
                score += 2;
                matched.push(kw);
            } else if (inSummary) {
                score += 1;
                matched.push(kw);
            }
        });

        let grade = "Insufficient Data";
        if (score >= 7) grade = "Strong Fit";
        else if (score >= 5) grade = "Good Fit";
        else if (score >= 3) grade = "Maybe Fit";
        else if (score >= 1) grade = "Bad Fit";

        const reason = matched.length
            ? `Matched keywords: ${Array.from(new Set(matched)).join(", ")}`
            : "No strong matches found. Based on cached profile data only.";

        return { grade, reason, score };
    }, []);

    const handleAiSearch = useCallback(async (prompt?: string) => {
        const searchPrompt = prompt || aiPromptInput.trim();
        if (!searchPrompt) {
            setAiModeActive(false);
            setAtsGradesMap({});
            setAiExplanationsMap({});
            setAiCandidatePool([]);
            setAiPoolFiltersKey(null);
            setAiDisplayedCount(INITIAL_DISPLAY_COUNT);
            setShowAiSearchModal(false);
            aiProgressPercentRef.current = 0; // Reset progress tracking
            fetchingCompletedRef.current = false; // Reset fetching completion flag
            return;
        }

        // Reset cancellation flag
        aiEvaluationCancelRef.current = false;
        setAiEvaluationCancelled(false);
        aiLoadingStartRef.current = Date.now();
        aiProgressPercentRef.current = 0; // Reset progress tracking for new search
        fetchingCompletedRef.current = false; // Reset fetching completion flag for new search
        setAiIsLoading(true);
        setAiError(null);

        try {
            // Fetch the FULL filtered dataset from MongoDB (AI search should not be limited to the currently loaded page).
            // We reuse the same filters as the table API, but request a minimal payload for speed.
            setAiEvaluationProgress({ phase: "fetching", current: 0, total: 0 });
            const { candidates: mongoCandidates } = await fetchAllCandidatesFromMongo();

            // If user cancelled during MongoDB fetch, stop here (no evaluation).
            if (aiEvaluationCancelRef.current) {
                return;
            }

            if (!mongoCandidates || mongoCandidates.length === 0) {
                throw new Error("No candidates to evaluate");
            }

            // Store the full pool so the table can show ALL candidates in AI mode.
            setAiCandidatePool(mongoCandidates);
            setAiPoolFiltersKey(aiCurrentFiltersKey);
            setAiDisplayedCount(INITIAL_DISPLAY_COUNT);

            // ============================================================================
            // STAGE 1: Vector-Based Ranking (Batch processing for all candidates at once)
            // ============================================================================
            // Use batch vector search to process all candidates simultaneously
            // This provides semantic understanding and better matching than keyword-based approach
            setAiEvaluationProgress({ phase: "evaluating", current: 0, total: mongoCandidates.length });

            const filteredCandidates = mongoCandidates.filter((c: any) => Boolean(c?.email));

            // Attach cvData from onDemandCvMap to candidates (same as tableCandidates does)
            // This ensures helper functions like getCurrentPosition/getCandidateLocationForDisplay can access CV data
            const candidatesWithCvData = filteredCandidates.map((candidate: any) => {
                const email = candidate?.email;
                const cv = email ? onDemandCvMap[email] : undefined;
                if (!cv) return candidate;

                // Attach digitalCV so helpers like getExperience/getCurrentPosition/getCandidateLocationForDisplay can parse.
                // This matches exactly what tableCandidates does (line 540-554)
                const digitalCV = (cv as any).digitalCV;
                return {
                    ...candidate,
                    cvData: candidate?.cvData ?? digitalCV ?? candidate?.cvData,
                };
            });

            // RAG-based semantic search: process all candidates at once using semantic similarity
            const vectorResults = await batchVectorSearch(searchPrompt, candidatesWithCvData);

            // Convert RAG percentage match to ATS grades with detailed assessment
            const candidatesWithGrades = vectorResults.map((item) => {
                const hasData = Boolean(
                    item.candidate?.name ||
                    item.candidate?.email ||
                    getSkills(item.candidate).length > 0 ||
                    item.candidate?.currentPosition ||
                    item.candidate?.summary
                );

                // Use percentage match from RAG semantic search for grading
                const { grade, score, reason } = getGradeFromPercentage(
                    item.percentageMatch,
                    hasData
                );

                return {
                    candidate: item.candidate,
                    percentageMatch: item.percentageMatch,
                    similarity: item.similarity,
                    atsGrade: grade,
                    atsScore: score,
                    reason: reason,
                };
            })
                .sort((a, b) => {
                    // Sort by grade priority first (Strong Fit > Good Fit > Maybe Fit > Bad Fit > No Fit)
                    const gradePriority: Record<string, number> = {
                        "Strong Fit": 5,
                        "Good Fit": 4,
                        "Maybe Fit": 3,
                        "Bad Fit": 2,
                        "No Fit": 1,
                        "Insufficient Data": 0,
                    };
                    const priorityDiff = gradePriority[b.atsGrade] - gradePriority[a.atsGrade];
                    if (priorityDiff !== 0) return priorityDiff;

                    // If same grade, sort by percentage match (RAG ranking)
                    // This ensures candidates with higher semantic similarity rank higher
                    return b.percentageMatch - a.percentageMatch;
                });

            // Only get AI explanations for the top 20 candidates (grades already determined by ATS)
            // This allows us to handle thousands of candidates efficiently
            const MAX_CANDIDATES_TO_EVALUATE = 20; // Get AI explanations for top 20 candidates
            const candidatesToEvaluate = candidatesWithGrades
                .slice(0, MAX_CANDIDATES_TO_EVALUATE)
                .map(item => ({
                    candidate: item.candidate,
                    atsGrade: item.atsGrade,
                    atsScore: item.atsScore,
                }));

            // If no candidates have any match, still get explanations for a small sample
            const hasRelevantCandidates = candidatesWithGrades.some(item => item.percentageMatch > 0);
            const finalCandidatesToEvaluate = hasRelevantCandidates
                ? candidatesToEvaluate
                : candidatesWithGrades.slice(0, Math.min(20, candidatesWithGrades.length)).map(item => ({
                    candidate: item.candidate,
                    atsGrade: item.atsGrade,
                    atsScore: item.atsScore,
                }));

            if (finalCandidatesToEvaluate.length === 0) {
                throw new Error("No valid candidates to evaluate");
            }

            const totalCandidates = mongoCandidates.length;
            const allAtsGrades: Record<string, { grade: string; reason: string; score: number; percentageMatch: number }> = {};

            // Assign ATS grades to ALL candidates in the pool
            candidatesWithGrades.forEach((item: any) => {
                const candidateId = String(getCandidateId(item.candidate) || item.candidate?.email || "").trim();
                if (candidateId) {
                    allAtsGrades[candidateId] = {
                        grade: item.atsGrade,
                        reason: item.reason || `Candidate received "${item.atsGrade}" grade based on RAG semantic search (${item.percentageMatch.toFixed(1)}% match).`,
                        score: item.atsScore,
                        percentageMatch: item.percentageMatch, // Store percentage for sorting
                    };
                }
            });

            // Final update with all ATS grades
            if (!aiEvaluationCancelRef.current) {
                setAtsGradesMap(allAtsGrades);
                setAiSearchPrompt(searchPrompt); // Store search prompt for on-demand AI explanations
                console.log(`AI Search completed: ${Object.keys(allAtsGrades).length} candidates graded using RAG-based semantic search. Candidates ranked by percentage match (0-100%). AI explanations are optional - click the icon next to each grade to get detailed explanation.`);
                // Activate AI mode and update table immediately
                setAiModeActive(true);
                setSortBy("Fitness Score: High to Low");
                setAiDisplayedCount(INITIAL_DISPLAY_COUNT);
                // Close modal immediately
                setShowAiSearchModal(false);
            } else {
                // If cancelled, still set ATS grades if we have them
                if (Object.keys(allAtsGrades).length > 0) {
                    setAtsGradesMap(allAtsGrades);
                    setAiSearchPrompt(searchPrompt); // Store search prompt even if cancelled
                    setAiModeActive(true);
                    setSortBy("Fitness Score: High to Low");
                } else {
                    setAiModeActive(false);
                }
            }
        } catch (err: any) {
            console.error("AI search failed", err);

            // Provide more specific error messages
            const statusCode = err?.response?.status;
            let errorMessage = "AI search failed. Please try again.";

            if (statusCode === 500) {
                errorMessage = "Server error occurred. Please try again in a few moments.";
            } else if (statusCode === 503) {
                errorMessage = "Service temporarily unavailable. Please try again later.";
            } else if (statusCode === 429) {
                errorMessage = "Too many requests. Please wait a moment and try again.";
            } else if (statusCode === 400) {
                errorMessage = "Invalid request. Please check your search prompt and try again.";
            } else if (!statusCode && err?.code === "ECONNABORTED") {
                errorMessage = "Request timeout. Please try again with fewer candidates.";
            } else if (!statusCode && err?.code === "ERR_NETWORK") {
                errorMessage = "Network error. Please check your internet connection.";
            }

            setAiError(errorMessage);
            setAiModeActive(false);
            setAtsGradesMap({});
            setAiExplanationsMap({});
            setAiCandidatePool([]);
            setAiPoolFiltersKey(null);
            setAiDisplayedCount(INITIAL_DISPLAY_COUNT);
            setShowAiSearchModal(false);
        } finally {
            setAiIsLoading(false);
            setAiEvaluationProgress({ phase: "fetching", current: 0, total: 0 });
            aiLoadingStartRef.current = null;
        }
    }, [aiPromptInput, fetchAllCandidatesFromMongo, getCandidateId, aiCurrentFiltersKey, batchVectorSearch, getGradeFromPercentage]);

    // Fetch AI explanation on-demand when user clicks the icon
    const fetchAiExplanation = useCallback(async (candidate: any, searchPrompt: string) => {
        const candidateId = String(getCandidateId(candidate) || candidate?.email || "").trim();
        if (!candidateId) return;

        // Check if explanation already exists
        if (aiExplanationsMap[candidateId]?.reason) {
            return; // Already have explanation
        }

        // Check if currently loading
        if (aiExplanationsMap[candidateId]?.isLoading) {
            return; // Already loading
        }

        // Get ATS grade for this candidate
        const atsGrade = getAtsGradeForCandidate(candidate);
        if (!atsGrade) {
            console.warn("Cannot fetch AI explanation: candidate has no ATS grade");
            return;
        }

        // Set loading state
        setAiExplanationsMap(prev => ({
            ...prev,
            [candidateId]: { reason: "", isLoading: true }
        }));

        try {
            const email = candidate?.email;
            if (!email) return;

            // Fetch CV for this candidate
            let cvMap: Record<string, any> = {};
            try {
                const cvResp = await api.post("/api/bulk-load-cvs", {
                    emails: [email],
                    orgID: orgID || ""
                });
                cvMap = cvResp.data?.cvs || {};
            } catch (cvErr) {
                console.warn(`Failed to fetch CV for candidate ${email}; proceeding with base candidate data only.`, cvErr);
            }

            const cvDoc = cvMap[email];
            const numExpRaw = cvDoc?.numExperience;
            const numExpFromCv = Array.isArray(numExpRaw) ? Number(numExpRaw[0]) : Number(numExpRaw);
            const experienceYearsFromCv = Number.isFinite(numExpFromCv) && numExpFromCv > 0 ? numExpFromCv : undefined;

            const enrichedCandidate = cvDoc ? {
                ...candidate,
                cvData: candidate?.cvData ?? cvDoc?.digitalCV ?? candidate?.cvData,
                currentPosition: candidate?.currentPosition || cvDoc?.currentPosition || candidate?.jobTitle || "",
                location: candidate?.location || cvDoc?.location || "",
                experienceYears: (typeof candidate?.experienceYears === "number" && candidate.experienceYears > 0)
                    ? candidate.experienceYears
                    : experienceYearsFromCv,
            } : candidate;

            const skills = getSkills(enrichedCandidate);
            const experienceYears = getExperienceYears(enrichedCandidate);
            const experience = experienceYears ? `${experienceYears} years` : getExperience(enrichedCandidate);
            const currentPosition = getCurrentPosition(enrichedCandidate);
            const location = getCandidateLocationForDisplay(enrichedCandidate);

            // Extract CV sections for detailed LLM explanation
            const cvDataForLLM = enrichedCandidate?.cvData;
            const workExperience = cvDataForLLM ? getCVSection(cvDataForLLM, "Experience") : "";
            const education = cvDataForLLM ? getCVSection(cvDataForLLM, "Education") : "";
            const certifications = cvDataForLLM ? getCVSection(cvDataForLLM, "Certifications") : "";

            const candidatePayload = {
                id: candidateId,
                name: enrichedCandidate?.name,
                email,
                currentPosition,
                experience,
                experienceYears: experienceYears ?? null,
                location,
                skills,
                candidateStatus: enrichedCandidate?.candidateStatus,
                preScreeningAnswers: enrichedCandidate?.preScreeningAnswers || {},
                // CV sections for detailed analysis
                workExperience: workExperience || "Not available",
                education: education || "Not available",
                certifications: certifications || "Not available",
            };

            // Retry logic for API calls (max 2 retries for 500 errors)
            let response;
            let retryCount = 0;
            const maxRetries = 2;
            const retryDelay = 1000;

            while (retryCount <= maxRetries) {
                try {
                    response = await api.post("/api/llm-reasoner", {
                        corePrompt: `
                        You are an expert recruiter providing an explanation for why a candidate received a "${atsGrade.grade}" grade.

                        The candidate's grade has already been determined by ATS (Applicant Tracking System) based on semantic matching against the search criteria: "${searchPrompt}"

                        Your task is to provide a detailed, professional explanation (40-80 words) explaining why this candidate received the "${atsGrade.grade}" grade.

                        The explanation should:
                        - Analyze the candidate's CV data (work experience, education, certifications) in relation to the search criteria
                        - Reference specific details from their work history, roles, companies, or achievements
                        - Highlight relevant education or certifications that match (or don't match) the requirements
                        - Explain how the candidate's overall profile aligns with the search criteria
                        - Be clear, concise, and professional
                        - Support the "${atsGrade.grade}" grade that was assigned

                        Grade Context:
                        - **Strong Fit**: Candidate's CV shows strong alignment with search criteria (relevant experience, matching skills, appropriate background)
                        - **Good Fit**: Candidate's CV shows good alignment with minor gaps
                        - **Maybe Fit**: Candidate's CV shows partial alignment with significant gaps
                        - **Bad Fit**: Candidate's CV shows limited alignment with search criteria
                        - **No Fit**: Candidate's CV does not align with search criteria
                        - **Insufficient Data**: Candidate has no CV data available

                        Return JSON object with:
                        - id: candidate id (MUST match exactly: "${candidateId}")
                        - reason: detailed explanation (40-80 words) analyzing the candidate's CV in relation to search criteria "${searchPrompt}"

                        REQUIREMENTS:
                        1. Return result for this candidate
                        2. id must match exactly: "${candidateId}"
                        3. Analyze the candidate's workExperience, education, and certifications fields
                        4. Reference specific details from their CV (job titles, companies, degrees, certifications)
                        5. Explain how their background aligns (or doesn't) with: "${searchPrompt}"
                        6. Keep explanation between 40-80 words

                        Return ONLY JSON object: {...}
                        Candidate:
                        ${JSON.stringify(candidatePayload)}
                        `.trim(),
                    });
                    break; // Success, exit retry loop
                } catch (apiError: any) {
                    const statusCode = apiError?.response?.status;
                    const isRetryable = statusCode === 500 || statusCode === 503 || statusCode === 429 || !statusCode;

                    if (isRetryable && retryCount < maxRetries) {
                        retryCount++;
                        const delay = retryDelay * Math.pow(2, retryCount - 1);
                        console.warn(`AI explanation fetch failed (attempt ${retryCount}/${maxRetries + 1}), retrying in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    } else {
                        throw apiError;
                    }
                }
            }

            // Parse response
            const raw = response.data?.result ?? response.data;
            let parsed: any;
            try {
                const cleaned = typeof raw === "string" ? raw.replace(/```json|```/g, "") : raw;
                parsed = typeof cleaned === "string" ? JSON.parse(cleaned) : cleaned;
            } catch (err) {
                console.error("Failed to parse AI explanation response:", err);
                throw new Error("Failed to parse AI response");
            }

            // Process result
            let resultItem = parsed;
            if (Array.isArray(parsed) && parsed.length > 0) {
                resultItem = parsed[0];
            }

            if (resultItem?.id && resultItem?.reason) {
                const resultId = String(resultItem.id).trim();
                setAiExplanationsMap(prev => ({
                    ...prev,
                    [resultId]: { reason: resultItem.reason, isLoading: false }
                }));
            } else {
                throw new Error("AI did not return valid explanation");
            }

        } catch (err: any) {
            console.error("Failed to fetch AI explanation:", err);
            setAiExplanationsMap(prev => ({
                ...prev,
                [candidateId]: {
                    reason: `Failed to generate AI explanation. Grade determined by ATS keyword matching.`,
                    isLoading: false
                }
            }));
        }
    }, [getCandidateId, getAtsGradeForCandidate, aiExplanationsMap]);

    const handleCancelAiSearch = useCallback(() => {
        aiEvaluationCancelRef.current = true;
        setAiEvaluationCancelled(true);
        setAiIsLoading(false);
        setShowAiSearchModal(false);
        aiLoadingStartRef.current = null;

        // Cancel evaluation - ATS grades are already set if search was in progress
        // Keep AI mode active if we have any grades
        if (Object.keys(atsGradesMap).length > 0) {
            setAiModeActive(true);
        } else {
            setAiModeActive(false);
        }
    }, [atsGradesMap]);

    const handleClearAiSearch = useCallback(() => {
        aiEvaluationCancelRef.current = true;
        setAiPromptInput("");
        setAiModeActive(false);
        setAtsGradesMap({});
        setAiExplanationsMap({});
        setAiSearchPrompt(""); // Clear stored search prompt
        setAiCandidatePool([]);
        setAiPoolFiltersKey(null);
        setAiDisplayedCount(INITIAL_DISPLAY_COUNT);
        setAiError(null);
        setAiIsLoading(false);
        setAiEvaluationCancelled(false);
        setShowAiSearchModal(false);
        setAiEvaluationProgress({ phase: "fetching", current: 0, total: 0 });
        setOnDemandCvMap({});
        // Clear embeddings cache
        embeddingsCacheRef.current = {};
        aiLoadingStartRef.current = null;
        aiProgressPercentRef.current = 0; // Reset progress tracking
        fetchingCompletedRef.current = false; // Reset fetching completion flag
        // Reset sortBy if it's a Fitness Score sort option
        if (sortBy === "Fitness Score: High to Low" || sortBy === "Fitness Score: Low to High") {
            setSortBy("Recent Activity");
        }
    }, [sortBy]);

    // ============================================================================
    // Callbacks - Filter Handlers
    // ============================================================================
    const { handleRemoveFilter, handleClearAllFilters } = useFilterHandlers({ setSelectedFilters, setMinYears, setMaxYears, setMinSalary, setMaxSalary, setPreScreeningAnswers });
    const handleApplyFilters = useAdvancedFiltersHandler({ setSelectedFilters, setMinYears, setMaxYears, setMinSalary, setMaxSalary, setPreScreeningAnswers, preScreeningQuestions });

    // ============================================================================
    // Callbacks - Candidate Handlers
    // ============================================================================
    const handleCandidateClick = async (candidate: any) => {
        const email = candidate?.email;
        let candidateCV = email ? (cvDataMap[email] || onDemandCvMap[email]) : undefined;

        // Avoid bulk-loading CVs for the entire AI pool; fetch CV only when the user opens a candidate.
        if (email && !candidateCV) {
            try {
                const response = await api.post("/api/bulk-load-cvs", {
                    emails: [email],
                    orgID: orgID || ""
                });
                const fetched = response.data?.cvs?.[email];
                if (fetched) {
                    setOnDemandCvMap(prev => ({ ...prev, [email]: fetched }));
                    candidateCV = fetched;
                }
            } catch (err) {
                console.error("Failed to load CV on demand:", err);
            }
        }

        setSelectedCandidate({ ...candidate, cvData: candidateCV });
        setShowCandidateModal(true);
    };

    // ============================================================================
    // Effects - Filter Updates
    // ============================================================================
    // NOTE: We intentionally do NOT store Experience/Salary as `selectedFilters`.
    // They are already passed as separate state (minYears/maxYears/minSalary/maxSalary),
    // and must behave as AND with other filters. Keeping them out of `selectedFilters`
    // avoids extra refetches/races where only partial filter state is applied.

    // Clear skill tags cache when filters change
    // Note: searchInput is excluded because it's only used for dropdown suggestions, not actual filtering
    useEffect(() => { clearSkillTagsCache(); }, [filterStatus, sortBy, selectedFilters]);

    // ============================================================================
    // Effects - Pagination Reset
    // ============================================================================
    // Filters change will trigger refetch in useCandidatesData hook (no need to reset displayedCount)

    // ============================================================================
    // Effects - Infinite Scroll (Facebook-style)
    // ============================================================================
    // Intersection Observer for infinite scrolling - fetches next batch from API
    useEffect(() => {
        const effectiveIsLoadingMore = isAiPoolMode ? aiIsLoadingMore : isLoadingMore;
        if (isLoading || !hasMoreCandidates || effectiveIsLoadingMore) {
            return;
        }

        const observer = new IntersectionObserver(
            entries => {
                const entry = entries[0];
                if (entry.isIntersecting && hasMoreCandidates && !effectiveIsLoadingMore) {
                    // Normal mode: fetch next batch from API
                    // AI pool mode: reveal more candidates client-side
                    if (isAiPoolMode) {
                        loadMoreAi();
                    } else {
                        loadMore();
                    }
                }
            },
            {
                threshold: 0.1,
                rootMargin: '100px' // Start loading 100px before reaching the bottom
            }
        );

        const currentTarget = skeletonTriggerRef.current;
        if (currentTarget) {
            observer.observe(currentTarget);
        }

        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget);
            }
        };
    }, [hasMoreCandidates, isLoading, isLoadingMore, loadMore, isAiPoolMode, aiIsLoadingMore, loadMoreAi]);

    // ============================================================================
    // Effects - Click Outside Handlers
    // ============================================================================
    // Close search dropdown when clicking outside
    useClickOutside({
        isVisible: isSearchDropdownVisible,
        focusedInput,
        inputName: "search",
        wrapperRef: searchWrapperRef,
        dropdownRef: searchDropdownRef,
        inputRef: searchInputRef,
        onClose: () => {
            setIsSearchDropdownVisible(false);
            setFocusedInput(null);
        },
    });

    // Close sort dropdown when clicking outside
    useClickOutside({
        isVisible: isSortDropdownVisible,
        focusedInput,
        inputName: "sort",
        wrapperRef: sortWrapperRef,
        dropdownRef: sortDropdownRef,
        inputRef: sortButtonRef,
        onClose: () => {
            setIsSortDropdownVisible(false);
            setFocusedInput(null);
        },
    });

    // ============================================================================
    // Table Setup
    // ============================================================================
    // Define columns for TanStack Table
    const handleAddComment = useCallback((candidate: any) => {
        setSelectedCandidate(candidate);
        setShowCommentModal(true);
    }, [setSelectedCandidate]);

    const handleInviteToJob = useCallback((candidate: any) => {
        setInviteCandidate(candidate);
        setIsInviteToJobOpen(true);
    }, []);

    const columns = useCandidateTableColumns({
        orgID,
        setSelectedCandidate,
        setShowCandidateModal,
        onAddComment: handleAddComment,
        onInviteToJob: handleInviteToJob,
        selectedFilters,
        showAiFitness: aiModeActive,
        showSelectionColumn: canSelectCandidates,
        getAiFitness: getAiFitnessForCandidate,
        onFetchAiExplanation: (candidate: any) => fetchAiExplanation(candidate, aiSearchPrompt),
        aiSearchPrompt: aiSearchPrompt
    });

    // Initialize TanStack Table - use displayedCandidates instead of all filteredCandidates
    const table = useReactTable({
        data: tableCandidates,
        columns,
        getCoreRowModel: getCoreRowModel(),
        enableRowSelection: canSelectCandidates,
        onRowSelectionChange: setRowSelection,
        state: {
            rowSelection,
        },
        getRowId: (row, index) => {
            // Use a combination of candidate ID and index to ensure uniqueness
            const candidateId = row.email || row._id || row.id || `candidate-${index}`;
            return `${candidateId}-${index}`;
        },
    });
    const selectedRows = useMemo(
        () => table.getSelectedRowModel().rows.map(row => ({ id: row.id, candidate: row.original })),
        [table, rowSelection]
    );

    // Percentage width per column so table fits viewport without horizontal scroll
    const columnWidthPercents = useMemo(() => {
        const headerGroups = table.getHeaderGroups();
        const headers = headerGroups[0]?.headers ?? [];
        const getWeight = (h: { column: { id: string; columnDef: { meta?: { weight?: number } } } }) => {
            const meta = h.column.columnDef.meta;
            return h.column.id === "select" ? 3 : (meta?.weight ?? 0);
        };
        const totalWeight = headers.reduce((sum, h) => sum + getWeight(h), 0);
        if (totalWeight <= 0) return new Map<string, number>();
        const map = new Map<string, number>();
        headers.forEach((header) => {
            const pct = (getWeight(header) / totalWeight) * 100;
            map.set(header.column.id, pct);
        });
        return map;
    }, [table, columns]);


    useEffect(() => {
        const fetchCandidate = async () => {
            // Fetch candidate details and open candidate modal
            try {
                const response = await api.get(`/api/get-candidate-by-email`, {
                    params: {
                        email: activeCandidate,
                        orgID: orgID || ""
                    }
                });
                if (response.data.success && response.data.candidate) {
                    setSelectedCandidate(response.data.candidate);
                    setShowCandidateModal(true);
                }
            } catch (error) {
                console.error("Failed to fetch candidate:", error);
            }
        }
        if (activeCandidate && orgID) {
            fetchCandidate();
        }
    }, [activeCandidate, orgID]);

    // ============================================================================
    // Render
    // ============================================================================
    return (
        <div className="candidates-table-v2-wrapper">
            <Header onUploadClick={() => setUploadModalOpen(true)} />
            <div className="row" style={{ marginBottom: "50px" }}>
                <div className="col">
                    <div className="card shadow-none border-0" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {/* Card header */}
                        <div style={{ borderBottom: "1px solid var(--Border-primary, #E9EAEB)", paddingBottom: "var(--Padding-padding-md, 16px)" }}>
                            <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: "16px", overflow: "visible", width: "100%" }}>
                                <div className="candidates-input-container" style={{ width: "540px", flexShrink: 0 }}>
                                    <div
                                        ref={searchWrapperRef}
                                        className="candidates-input-wrapper"
                                        style={{
                                            boxShadow: "0px 1px 2px 0px #0A0D120D",
                                            border: "1px solid var(--Button-border-primary, #D5D7DA)",
                                            background: "var(--Input-bg-primary, #FFFFFF)",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px"
                                        }}
                                    >
                                        <div className="candidates-input-icon-wrapper">
                                            <img src="/iconsV3/search.svg" alt="Search icon" width={20} height={20} />
                                        </div>
                                        <input
                                            ref={searchInputRef}
                                            type="search"
                                            className="candidates-input-field"
                                            value={searchInput}
                                            onChange={(e) => {
                                                setSearchInput(e.target.value);
                                                setIsSearchDropdownVisible(true);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleSearchSubmit();
                                                }
                                            }}
                                            placeholder={SEARCH_PLACEHOLDER}
                                            onFocus={(e) => {
                                                e.target.placeholder = "";
                                                setFocusedInput("search");
                                                setIsSearchDropdownVisible(true);
                                            }}
                                            onBlur={(e) => {
                                                e.target.placeholder = SEARCH_PLACEHOLDER;
                                                // Don't close on blur - let click-outside handler manage it
                                            }}
                                        />
                                        {searchFilterCount > 0 && (
                                            <div
                                                className="candidates-input-search-filter-count"
                                                style={{
                                                    borderRadius: "16px",
                                                    borderWidth: "1px",
                                                    paddingTop: "2px",
                                                    paddingRight: "8px",
                                                    paddingBottom: "2px",
                                                    paddingLeft: "8px",
                                                    background: "var(--Colors-Secondary_Colors-Blue-gray-50, #F8F9FC)",
                                                    border: "1px solid var(--Colors-Secondary_Colors-Blue-gray-200, #D5D9EB)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        fontWeight: 700,
                                                        fontStyle: "normal",
                                                        fontSize: "12px",
                                                        lineHeight: "18px",
                                                        letterSpacing: "0%",
                                                        textAlign: "center",
                                                        color: "var(--Colors-Secondary_Colors-Blue-gray-700, #363F72)",
                                                    }}
                                                >
                                                    {searchFilterCount}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "8px" }}>
                                    {selectedCount > 0 && (
                                        <Button
                                            variant="primary"
                                            label="Send Email to All"
                                            icon="/iconsV3/mail.svg"
                                            onClick={() => {
                                                if (selectedCount > 100) {
                                                    errorToast("You can only send email to a maximum of 100 candidates at a time.", 3000);
                                                    return;
                                                }
                                                setShowBulkEmailPanel(true);
                                            }}
                                        />
                                    )}
                                    <AiSearchButton
                                        onClick={() => setShowAiSearchModal(true)}
                                        isActive={aiModeActive}
                                    />
                                    <AdvancedFiltersButton
                                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                        filterCount={advancedFilterCount}
                                    />
                                </div>
                            </div>
                            {/* Filter Tags Container */}
                            <FilterTags
                                selectedFilters={selectedFilters}
                                minYears={minYears}
                                maxYears={maxYears}
                                minSalary={minSalary}
                                maxSalary={maxSalary}
                                preScreeningAnswers={preScreeningAnswers}
                                preScreeningQuestions={preScreeningQuestions}
                                handleRemoveFilter={handleRemoveFilter}
                                handleClearAllFilters={handleClearAllFilters}
                            />
                            {aiError && (
                                <div style={{ marginTop: "6px", color: "#B32318", fontWeight: 600, fontSize: "12px" }}>
                                    {aiError}
                                </div>
                            )}
                        </div>
                        <SearchDropdown
                            isVisible={isSearchDropdownVisible || focusedInput === "search"}
                            wrapperRef={searchWrapperRef}
                            dropdownRef={searchDropdownRef}
                            searchQuery={searchInput}
                            searchData={searchDropdownData}
                            isLoading={isLoadingSuggestions}
                            onItemSelect={handleItemSelect}
                        />
                        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 500, fontStyle: "Medium", fontSize: "16px", lineHeight: "24px", letterSpacing: "0%", verticalAlign: "middle", color: "var(--Text-text-tertiary, #717680)" }}>{totalCount} {totalCount === 1 ? 'Candidate' : 'Candidates'}</span>
                            <div
                                ref={sortWrapperRef}
                                style={{ position: "relative", display: "flex", flexDirection: "row", alignItems: "center", gap: "8px", cursor: "pointer" }}
                                onClick={() => {
                                    setIsSortDropdownVisible(!isSortDropdownVisible);
                                    setFocusedInput("sort");
                                }}
                            >
                                <div ref={sortButtonRef} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontWeight: 700, fontStyle: "Bold", fontSize: "14px", lineHeight: "20px", letterSpacing: "0%", color: "var(--Colors-Primary_Colors-Neutrals-600, #535862)" }}>Sort by: {sortBy}</span>
                                    <div style={{ width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <img src="/iconsV3/chevron-down.svg" alt="Chevron down" width={12} height={7} style={{ transform: isSortDropdownVisible ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
                                    </div>
                                </div>
                                {isSortDropdownVisible && (
                                    <div
                                        ref={sortDropdownRef}
                                        style={{
                                            position: "absolute",
                                            top: "100%",
                                            right: 0,
                                            marginTop: "8px",
                                            minWidth: "280px",
                                            zIndex: 1000,
                                            boxSizing: "border-box",
                                            borderRadius: "8px",
                                            border: "1px solid #F5F5F5",
                                            background: "#FFFFFF",
                                            boxShadow: "0px 24px 48px -12px #0A0D122E",
                                            display: "flex",
                                            flexDirection: "column",
                                            padding: "8px",
                                            maxHeight: "400px",
                                            overflowY: "auto",
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {[
                                            "Recent Activity",
                                            "Experience: Low to High",
                                            "Experience: High to Low",
                                            "Name: A-Z",
                                            "Name: Z-A",
                                            "Last Active: Newest",
                                            "Last Active: Oldest",
                                            "Current Position: A-Z",
                                            "Current Position: Z-A",
                                            "Location: A-Z",
                                            "Location: Z-A",
                                            ...(aiModeActive && Object.keys(atsGradesMap).length > 0 ? [
                                                "Fitness Score: High to Low",
                                                "Fitness Score: Low to High",
                                            ] : []),
                                        ].map((option) => (
                                            <div
                                                key={option}
                                                onClick={() => {
                                                    setSortBy(option);
                                                    setIsSortDropdownVisible(false);
                                                    setFocusedInput(null);
                                                }}
                                                style={{
                                                    padding: "10px 12px",
                                                    borderRadius: "6px",
                                                    cursor: "pointer",
                                                    backgroundColor: sortBy === option ? "var(--Surface-dashboard-bg_light, #F8F9FC)" : "transparent",
                                                    color: sortBy === option ? "var(--Text-text-primary, #181D27)" : "var(--Text-text-secondary, #414651)",
                                                    fontWeight: sortBy === option ? 600 : 500,
                                                    fontSize: "14px",
                                                    lineHeight: "20px",
                                                    letterSpacing: "0%",
                                                    transition: "background-color 0.2s, color 0.2s",
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (sortBy !== option) {
                                                        e.currentTarget.style.backgroundColor = "var(--Surface-dashboard-bg_light, #F8F9FC)";
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (sortBy !== option) {
                                                        e.currentTarget.style.backgroundColor = "transparent";
                                                    }
                                                }}
                                            >
                                                {option}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="table-responsive" style={{ borderRadius: "16px", border: "1px solid var(--Border-primary, #E9EAEB)", boxShadow: "0px 1px 2px 0px #0A0D120D", overflow: "hidden" }}>
                            <table className="table align-items-center jia-candidates-table" style={{ margin: 0, borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", width: "100%" }}>
                                <colgroup>
                                    {(table.getHeaderGroups()[0]?.headers ?? []).map((header) => {
                                        const pct = columnWidthPercents.get(header.column.id);
                                        return (
                                            <col
                                                key={header.column.id}
                                                style={pct != null ? { width: `${pct}%`, minWidth: `${pct}%`, maxWidth: `${pct}%` } : undefined}
                                            />
                                        );
                                    })}
                                </colgroup>
                                <thead style={{ height: "42px", background: "var(--Surface-dashboard-bg_light, #F8F9FC)", borderBottom: "1px solid var(--Border-primary, #E9EAEB)", padding: 0 }}>
                                    {table.getHeaderGroups().map(headerGroup => (
                                        <tr key={headerGroup.id}>
                                            {headerGroup.headers.map(header => {
                                                const columnMeta = header.column.columnDef.meta as { width?: number; weight?: number; flexible?: boolean; fitContent?: boolean } | undefined;
                                                const widthPercent = columnWidthPercents.get(header.column.id);
                                                const headerStyle = getColumnStyle({
                                                    columnMeta,
                                                    columnId: header.column.id,
                                                    isHeader: true,
                                                    widthPercent,
                                                });
                                                return (
                                                    <th key={header.id} style={headerStyle} data-column-id={header.column.id}>
                                                        {header.isPlaceholder
                                                            ? null
                                                            : (
                                                                <span className="candidates-table-header">
                                                                    {flexRender(
                                                                        header.column.columnDef.header,
                                                                        header.getContext()
                                                                    )}
                                                                </span>
                                                            )}
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody className="list">
                                    {(isLoading || isFilterChanging || aiIsLoading) ? (
                                        <SkeletonLoading count={SKELETON_LOADING_COUNT} />
                                    ) : table.getRowModel().rows.length > 0 ? (
                                        table.getRowModel().rows.map((row) => (
                                            <tr key={row.id} style={{ border: "1px solid #E9EAEB", height: "64px" }} onClick={() => handleCandidateClick(row.original)}>
                                                {row.getVisibleCells().map(cell => {
                                                    const columnMeta = cell.column.columnDef.meta as { width?: number; weight?: number; flexible?: boolean; fitContent?: boolean } | undefined;
                                                    const widthPercent = columnWidthPercents.get(cell.column.id);
                                                    const cellStyle = getColumnStyle({
                                                        columnMeta,
                                                        columnId: cell.column.id,
                                                        isHeader: false,
                                                        widthPercent,
                                                    });
                                                    return (
                                                        <td key={cell.id} style={cellStyle} data-column-id={cell.column.id}>
                                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr style={{ cursor: "default", pointerEvents: "none" }}>
                                            <td colSpan={columns.length} className="text-center" style={{ paddingTop: "16px", paddingRight: "var(--Padding-padding-md, 16px)", paddingBottom: "16px", paddingLeft: "var(--Padding-padding-md, 16px)" }}>
                                                <span>No candidates found</span>
                                            </td>
                                        </tr>
                                    )}
                                    {/* Loading more skeleton rows - Facebook-style: show when there are more candidates to load */}
                                    {hasMoreCandidates && (
                                        <SkeletonLoading count={(isAiPoolMode ? aiIsLoadingMore : isLoadingMore) ? INFINITE_SCROLL_SKELETON_COUNT : 1} skeletonTriggerRef={skeletonTriggerRef} isInfiniteScroll={true} />
                                    )}
                                </tbody>
                            </table>
                            {showCandidateModal && <CandidateModal candidate={selectedCandidate} setShowCandidateModal={setShowCandidateModal} />}
                            {showCommentModal && selectedCandidate && orgID && (
                                <CommentModal
                                    open={showCommentModal}
                                    onClose={() => setShowCommentModal(false)}
                                    candidate={selectedCandidate}
                                    orgId={orgID}
                                    user={user}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <style jsx>{`
        :global(.candidates-table-v2-wrapper) {
          zoom: 1.1111111111111111; /* Counteracts the 0.9 zoom from html (1/0.9 = 1.111111). This prevents components having inaccurate height and width */
        } 

        :global(.candidates-table-v2-wrapper *),
        :global(.candidates-table-v2-wrapper *::before),
        :global(.candidates-table-v2-wrapper *::after) {
          box-sizing: border-box;
        }
        :global(.candidates-table-v2-wrapper .jia-candidates-table th) {
          font-size: inherit !important;
          text-transform: none !important;
          letter-spacing: 0 !important;
          font-family: inherit !important;
        }
        :global(.candidates-table-v2-wrapper .jia-candidates-table thead:hover),
        :global(.candidates-table-v2-wrapper .jia-candidates-table thead th:hover),
        :global(.candidates-table-v2-wrapper .jia-candidates-table thead tr:hover) {
          background: var(--Surface-dashboard-bg_light, #F8F9FC) !important;
        }
        :global(.candidates-table-v2-wrapper .jia-candidates-table thead),
        :global(.candidates-table-v2-wrapper .jia-candidates-table thead th),
        :global(.candidates-table-v2-wrapper .jia-candidates-table thead tr) {
          cursor: default !important;
        }
        :global(.candidates-table-v2-wrapper .jia-candidates-table tbody tr[style*="pointer-events: none"]) {
          cursor: default !important;
        }
        :global(.candidates-table-v2-wrapper .jia-candidates-table tbody tr[style*="pointer-events: none"]:hover) {
          background: transparent !important;
        }
        /* Keep select column fixed at 40px so it does not grow with many rows */
        :global(.candidates-table-v2-wrapper .jia-candidates-table th[data-column-id="select"]),
        :global(.candidates-table-v2-wrapper .jia-candidates-table td[data-column-id="select"]) {
          width: 40px !important;
          min-width: 40px !important;
          max-width: 40px !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
        }
        :global(.candidates-table-v2-wrapper .jia-candidates-table td div) {
          font-size: inherit !important;
          font-family: inherit !important;
        }
        :global(.candidates-table-v2-wrapper .jia-candidates-table td div span) {
          font-size: inherit !important;
          font-family: inherit !important;
        }
        /* Unified candidate column text styles - override global td div span */
        :global(.candidates-table-v2-wrapper .jia-candidates-table td .candidates-table-avatar-initials) {
          font-weight: 500 !important;
          font-size: 14px !important;
          line-height: 20px !important;
          letter-spacing: 0% !important;
          text-align: center !important;
          color: var(--Colors-Secondary_Colors-Blue-gray-600, #3E4784) !important;
          font-family: inherit !important;
        }
        :global(.candidates-table-v2-wrapper .jia-candidates-table td .candidates-table-candidate-name) {
          font-weight: 700 !important;
          font-size: 14px !important;
          line-height: 20px !important;
          letter-spacing: 0 !important;
          color: var(--Text-text-secondary, #414651) !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          font-family: inherit !important;
        }
        :global(.candidates-table-v2-wrapper .jia-candidates-table td .candidates-table-candidate-email) {
          font-weight: 500 !important;
          font-size: 12px !important;
          line-height: 18px !important;
          letter-spacing: 0 !important;
          color: var(--Text-text-tertiary, #717680) !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          font-family: inherit !important;
        }
        /* Unified input container styles */
        :global(.candidates-table-v2-wrapper .candidates-input-container) {
          display: flex;
          flex-direction: column;
          gap: 6px;
          overflow: visible;
        }
        :global(.candidates-table-v2-wrapper .candidates-input-label) {
          font-weight: 500;
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0;
          color: var(--Input-text-label, #414651);
        }
        :global(.candidates-table-v2-wrapper .candidates-input-wrapper) {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          border-radius: 8px;
          border: 1px solid var(--Input-border-primary, #E9EAEB);
          background: var(--Input-bg-primary, #FFFFFF);
          padding: 10px 14px;
          box-sizing: border-box;
          height: 44px;
          transition: box-shadow 0.3s;
        }
        :global(.candidates-table-v2-wrapper .candidates-input-wrapper:focus-within) {
          border: 1px solid var(--Input-border-primary, #E9EAEB) !important;
          box-shadow: 0px 0px 0px 4px #F5F5F5, 0px 1px 2px 0px #0A0D120D !important;
          outline: none !important;
        }
        :global(.candidates-table-v2-wrapper .candidates-input-icon-wrapper) {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        :global(.candidates-table-v2-wrapper .candidates-input-field) {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-weight: 500;
          font-size: 16px;
          line-height: 24px;
          letter-spacing: 0;
          color: var(--Input-text-placeholder-or-disabled, #717680);
          box-sizing: border-box;
        }
        :global(.candidates-table-v2-wrapper .candidates-input-field::placeholder) {
          color: var(--Input-text-placeholder-or-disabled, #717680);
        }
        :global(.candidates-table-v2-wrapper .candidates-input-field:focus) {
          border-color: var(--Input-border-primary, #E9EAEB) !important;
          box-shadow: none !important;
          outline: none !important;
        }
        :global(.candidates-table-v2-wrapper .candidates-input-field-years) {
          transition: box-shadow 0.3s;
        }
        :global(.candidates-table-v2-wrapper .candidates-input-field-years:focus) {
          border: 1px solid var(--Input-border-primary, #E9EAEB) !important;
          box-shadow: 0px 0px 0px 4px #F5F5F5, 0px 1px 2px 0px #0A0D120D !important;
          outline: none !important;
        }
        /* Filter Tags Container */
        :global(.candidates-table-v2-wrapper .candidates-filter-tags-container) {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding-top: 12px;
        }
        :global(.candidates-table-v2-wrapper .candidates-filter-tags-content) {
          display: flex;
          flex-direction: row;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          width: fit-content;
        }
        :global(.candidates-table-v2-wrapper .candidates-filter-tag) {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border-radius: 16px;
          padding-top: 2px;
          padding-right: 8px;
          padding-bottom: 2px;
          padding-left: 10px;
          border-width: 1px;
          border: 1px solid var(--Colors-Secondary_Colors-Blue-gray-200, #D5D9EB);
          background: var(--Colors-Secondary_Colors-Blue-gray-50, #F8F9FC);
          white-space: nowrap;
        }
        :global(.candidates-table-v2-wrapper .candidates-filter-tag-text) {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        :global(.candidates-table-v2-wrapper .candidates-filter-tag-label),
        :global(.candidates-table-v2-wrapper .candidates-filter-tag-name) {
          font-weight: 700;
          font-style: Bold;
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
          text-align: center;
          color: var(--Colors-Secondary_Colors-Blue-gray-700, #363F72);
        }
        :global(.candidates-table-v2-wrapper .candidates-filter-tag-remove:hover) {
          opacity: 0.7;
        }
        :global(.candidates-table-v2-wrapper .candidates-filter-tag-remove:focus),
        :global(.candidates-table-v2-wrapper .candidates-filter-tag-remove:active) {
          outline: none;
          border: none;
        }
        :global(.candidates-table-v2-wrapper .candidates-filter-tag-remove) {
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          padding: 0;
          margin: 0;
          cursor: pointer;
          width: 12px;
          height: 12px;
          flex-shrink: 0;
          outline: none;
        }
        :global(.candidates-table-v2-wrapper .candidates-filter-tag-remove img) {
          width: 7px;
          height: 7px;
        }
        :global(.candidates-table-v2-wrapper .candidates-filter-tags-divider) {
          width: 1px;
          height: 20px;
          border: 1px solid var(--Border-primary, #E9EAEB);
          flex-shrink: 0;
        }
        :global(.candidates-table-v2-wrapper .candidates-filter-tags-clear) {
          background: none;
          border: none;
          padding: 0;
          margin: 0;
          cursor: pointer;
          font-weight: 700;
          font-style: Bold;
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
          color: var(--Colors-Primary_Colors-Neutrals-600, #535862);
          white-space: nowrap;
          flex-shrink: 0;
        }
        /* Unified column header styles - override Argon's .table th styles */
        :global(.candidates-table-v2-wrapper .jia-candidates-table th .candidates-table-header) {
          font-weight: 700 !important;
          font-size: 12px !important;
          line-height: 18px !important;
          letter-spacing: 0 !important;
          color: var(--Text-text-tertiary, #717680) !important;
        }
        /* Unified table cell text styles - override Argon's .table td styles */
        :global(.candidates-table-v2-wrapper .jia-candidates-table td .candidates-table-cell-text) {
          font-weight: 500 !important;
          font-size: 14px !important;
          line-height: 20px !important;
          letter-spacing: 0 !important;
          color: var(--Text-text-tertiary, #717680) !important;
        }
        :global(.candidates-table-v2-wrapper .jia-candidates-table td .candidates-table-cell-text-ellipsis) {
          display: block !important;
          width: 100% !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        /* Unified skills tag styles - override global td div styles */
        :global(.candidates-table-v2-wrapper .jia-candidates-table td .candidates-table-skill-tag) {
          border-radius: 16px !important;
          border: 1px solid var(--Colors-Secondary_Colors-Blue-200, #B2DDFF) !important;
          padding: 2px 8px !important;
          background: var(--Colors-Secondary_Colors-Blue-50, #EFF8FF) !important;
          font-weight: 700 !important;
          font-size: 12px !important;
          line-height: 18px !important;
          text-align: center !important;
          color: var(--Colors-Secondary_Colors-Blue-700, #175CD3) !important;
          white-space: nowrap !important;
          flex-shrink: 0 !important;
          font-family: inherit !important;
        }
        /* Filtered skill tag styles - applied when skill matches a filter */
        :global(.candidates-table-v2-wrapper .jia-candidates-table td .candidates-table-skill-tag-filtered) {
          background: #ECFDF3 !important;
          border: 1px solid #A6F4C5 !important;
          color: #027948 !important;
        }
        /* Skill tags inside tooltip panel - prevent overflow and add ellipsis */
        :global(.responsive-tag-list-tooltip .candidates-table-skill-tag) {
          max-width: 100% !important;
          min-width: 0 !important;
          flex-shrink: 1 !important;
          overflow: hidden !important;
        }
        /* Ensure text content inside skill tags in tooltip can ellipsis */
        :global(.responsive-tag-list-tooltip .candidates-table-skill-tag > span) {
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          max-width: 100% !important;
          display: block !important;
        }
        :global(.candidates-table-v2-wrapper .jia-candidates-table td .candidates-table-skill-count) {
          border-radius: 16px !important;
          padding: 2px 8px !important;
          background: #F8F9FC !important;
          font-weight: 500 !important;
          font-size: 12px !important;
          line-height: 18px !important;
          text-align: center !important;
          color: #363F72 !important;
          white-space: nowrap !important;
          font-family: inherit !important;
        }
        /* Ensure skills container displays in a single row with no wrap */
        :global(.candidates-table-v2-wrapper .jia-candidates-table td .candidates-table-skills-container) {
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          width: fit-content !important;
          max-width: 100% !important;
          min-width: 0 !important;
        }
        /* Style for overflow indicator in skills column */
        :global(.candidates-table-v2-wrapper .jia-candidates-table td .candidates-table-skills-container [class*="overflowIndicator"]) {
          border-radius: 16px !important;
          padding: 2px 8px !important;
          background: #F8F9FC !important;
          border: 1px solid var(--Border-primary, #E9EAEB) !important;
          font-weight: 700 !important;
          font-size: 12px !important;
          line-height: 18px !important;
          text-align: center !important;
          color: var(--Colors-Secondary_Colors-Blue-gray-700, #363F72) !important;
          white-space: nowrap !important;
          font-family: inherit !important;
        }
      `}</style>
            <AdvancedFiltersPanel
                orgID={orgID}
                isOpen={showAdvancedFilters}
                onClose={() => setShowAdvancedFilters(false)}
                locationData={locationDropdownData}
                minYears={minYears}
                maxYears={maxYears}
                minSalary={minSalary}
                maxSalary={maxSalary}
                preScreeningQuestions={preScreeningQuestions}
                onApplyFilters={handleApplyFilters}
            />
            <BulkEmailPanel
                isOpen={showBulkEmailPanel}
                onClose={() => setShowBulkEmailPanel(false)}
                selectedRows={selectedRows}
                onRemoveCandidate={(rowId) => {
                    setRowSelection((prev: any) => {
                        const next = { ...prev };
                        delete next[rowId];
                        return next;
                    });
                }}
            />
            <AiSearchModal
                isOpen={showAiSearchModal}
                onClose={() => setShowAiSearchModal(false)}
                onSubmit={handleAiSearch}
                isLoading={aiIsLoading}
                aiEvaluationProgress={aiEvaluationProgress}
                aiProgressPercent={aiProgressPercent}
                aiEstimatedMinutes={aiEstimatedMinutes}
            />
            <InviteToJobModal
                isOpen={isInviteToJobOpen}
                onClose={() => {
                    setIsInviteToJobOpen(false);
                    setInviteCandidate(null);
                }}
                candidate={inviteCandidate}
                excludedCareerIds={inviteCandidate?.interviews?.map((i: any) => i.id) || []}
                onOk={({ selectedCareers, sourceCareerIdOverride, sourceInterviewIdOverride }) => {
                    setIsInviteToJobOpen(false);
                    if (selectedCareers && inviteCandidate) {
                        setActionModalCandidate({
                            ...inviteCandidate,
                            selectedCareers: selectedCareers,
                            sourceCareerIdOverride: sourceCareerIdOverride,
                            sourceInterviewIdOverride: sourceInterviewIdOverride,
                        });
                        setShowCandidateActionModal("invite");
                    }
                    setInviteCandidate(null);
                }}
            />
            {showCandidateActionModal && (
                <CandidateActionModal
                    candidate={actionModalCandidate}
                    onAction={async (action, data) => {
                        if (action === "invite") {
                            try {
                                const sourceInterviewId = actionModalCandidate.sourceInterviewIdOverride 
                                    || actionModalCandidate._id 
                                    || actionModalCandidate.interviews?.[0]?._id;

                                // For spreadsheet imports (no source interview), we allow invite but must pass orgID
                                // sourceInterviewId will be undefined/null in this case

                                // Extract automation IDs from modal state (passed via data parameter)
                                const automationIdsToUse = data?.automationIdsToUse;

                                const response = await api.post("/api/invite-candidate-to-career", {
                                    sourceInterviewId,
                                    targetCareerIds: actionModalCandidate.selectedCareers.map((c: any) => c._id),
                                    candidateEmail: actionModalCandidate.email,
                                    invitedBy: {
                                        name: user?.name,
                                        email: user?.email,
                                        image: user?.image,
                                    },
                                    sourceCareerIdOverride: actionModalCandidate.sourceCareerIdOverride,
                                    orgID: orgID, // Required when sourceInterviewId is missing
                                    automationIdsToUse, // Pass automation toggles from modal
                                });

                                const { created, skipped, blocked } = response.data;
                                if (created?.length > 0) {
                                    successToast(`${actionModalCandidate?.name} has been invited to ${created.length} job${created.length > 1 ? "s" : ""}.`, 2000);
                                }
                                if (blocked?.length > 0) {
                                    errorToast(`${blocked.length} job(s) blocked: ${blocked.map((b: any) => b.careerTitle).join(", ")}`, 3000);
                                }
                                if (skipped?.length > 0) {
                                    errorToast(`${skipped.length} job(s) skipped: ${skipped.map((s: any) => s.reason).join(", ")}`, 2000);
                                }
                            } catch (error) {
                                console.error("Error inviting candidate:", error);
                                errorToast("Failed to invite candidate", 1300);
                            }
                        }
                        setShowCandidateActionModal("");
                        setActionModalCandidate(null);
                    }}
                    action={showCandidateActionModal}
                    hideRecruiterEvaluation={true}
                />
            )}
        </div>
    )
}
