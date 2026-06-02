import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { api } from "@/lib/utils/apiClient";
import Swal from "sweetalert2";
import { Candidate } from "@/lib/utils/candidateHelpers";

interface Filter {
    type: string;
    name: string;
    questionId?: string;
}

interface UseCandidatesDataParams {
    orgID: string | null;
    filterStatus: string;
    sortBy: string;
    selectedFilters: Filter[];
    minYears: string;
    maxYears: string;
    minSalary: string;
    maxSalary: string;
    preScreeningAnswers: Record<string, any>;
    page?: number;
    limit?: number;
}

interface UseCandidatesDataReturn {
    candidates: Candidate[];
    totalCount: number;
    isLoading: boolean;
    isLoadingMore: boolean;
    hasMore: boolean;
    refetch: () => Promise<void>;
    loadMore: () => Promise<void>;
}

export const useCandidatesData = ({
    orgID,
    filterStatus,
    sortBy,
    selectedFilters,
    minYears,
    maxYears,
    minSalary,
    maxSalary,
    preScreeningAnswers,
    page = 1,
    limit = 20, // Facebook-style: small initial batch
}: UseCandidatesDataParams): UseCandidatesDataReturn => {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const isLoadingRef = useRef(false);
    const isLoadingMoreRef = useRef(false);
    const requestSeqRef = useRef(0);
    const abortControllerRef = useRef<AbortController | null>(null);

    const buildFilters = () => {
        const filters: any = {
            skills: [],
            locations: [],
            currentPositions: [],
            candidateNames: [],
            preScreening: [],
        };

        // Group filters by type
        const filtersByType = selectedFilters.reduce((acc, filter) => {
            if (!acc[filter.type]) {
                acc[filter.type] = [];
            }
            acc[filter.type].push(filter);
            return acc;
        }, {} as Record<string, Filter[]>);

        // Process standard filters
        if (filtersByType["Skills"]) {
            filters.skills = filtersByType["Skills"].map(f => f.name);
        }
        if (filtersByType["Location"]) {
            filters.locations = filtersByType["Location"].map(f => f.name);
        }
        if (filtersByType["Current Position"]) {
            filters.currentPositions = filtersByType["Current Position"].map(f => f.name);
        }
        if (filtersByType["Candidates"]) {
            filters.candidateNames = filtersByType["Candidates"].map(f => f.name);
        }
        if (filtersByType["Availability"]) {
            filters.availability = filtersByType["Availability"].map(f => f.name);
        }
        if (filtersByType["Work Setup"]) {
            filters.workSetup = filtersByType["Work Setup"].map(f => f.name);
        }

        // Add experience filter
        if (minYears.trim() || maxYears.trim()) {
            if (minYears.trim()) {
                filters.minYears = minYears.trim();
            }
            if (maxYears.trim()) {
                filters.maxYears = maxYears.trim();
            }
        }

        // Add salary filter
        if (minSalary.trim() || maxSalary.trim()) {
            if (minSalary.trim()) {
                filters.minSalary = minSalary.trim();
            }
            if (maxSalary.trim()) {
                filters.maxSalary = maxSalary.trim();
            }
        }

        // Process pre-screening filters
        const preScreeningFilters = selectedFilters.filter(f => f.questionId);
        if (preScreeningFilters.length > 0) {
            filters.preScreening = preScreeningFilters.map(filter => {
                // Get the filter value(s) from preScreeningAnswers
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
            }).filter(ps => ps.values.length > 0);
        }

        return filters;
    };

    const fetchCandidates = useCallback(async (pageNum: number = 1, append: boolean = false) => {
        if (!orgID) {
            setIsLoading(false);
            return;
        }

        // Prevent multiple simultaneous requests
        if (append && isLoadingMoreRef.current) return;
        // For filter changes, always prefer the latest request:
        // cancel any in-flight request so "Experience AND other filters" is applied consistently.
        if (!append) {
            try {
                abortControllerRef.current?.abort();
            } catch {}
            abortControllerRef.current = new AbortController();
        }
        const reqId = ++requestSeqRef.current;
        
        if (append) {
            isLoadingMoreRef.current = true;
            setIsLoadingMore(true);
        } else {
            isLoadingRef.current = true;
            setIsLoading(true);
        }

        try {
            const filters = buildFilters();
            const filtersParam = encodeURIComponent(JSON.stringify(filters));

            const response = await api.get("/api/candidates", {
                params: {
                    orgID,
                    filterStatus,
                    search: "", // Search is handled via candidateNames filter
                    sortBy,
                    page: pageNum,
                    limit,
                    filters: filtersParam,
                },
                ...(append ? {} : { signal: abortControllerRef.current?.signal }),
            });

            // Ignore stale responses (older request finishing after a newer one)
            if (!append && reqId !== requestSeqRef.current) {
                return;
            }

            const newCandidates = response.data.candidates || [];
            const newTotalCount = response.data.totalCount || 0;

            if (append) {
                // Facebook-style: append new results to existing ones
                setCandidates(prev => [...prev, ...newCandidates]);
            } else {
                // Initial load: replace all candidates
                setCandidates(newCandidates);
                setCurrentPage(1);
            }
            
            setTotalCount(newTotalCount);
            setCurrentPage(pageNum);
        } catch (error: any) {
            // Ignore aborted requests
            if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") {
                return;
            }
            console.error("Error fetching candidates:", error);
            if (!append) {
                Swal.fire({
                    icon: "error",
                    title: "Something went wrong",
                    text: "Failed to fetch candidates",
                });
                setCandidates([]);
                setTotalCount(0);
            }
        } finally {
            if (append) {
                setIsLoadingMore(false);
                isLoadingMoreRef.current = false;
            } else {
                // Only clear loading if this is still the latest request
                if (reqId === requestSeqRef.current) {
                    setIsLoading(false);
                    isLoadingRef.current = false;
                }
            }
        }
    }, [orgID, filterStatus, sortBy, selectedFilters, minYears, maxYears, minSalary, maxSalary, preScreeningAnswers, limit]);

    const hasMore = useMemo(() => {
        return candidates.length < totalCount;
    }, [candidates.length, totalCount]);

    const loadMore = useCallback(async () => {
        if (isLoadingMoreRef.current || !hasMore) {
            return;
        }
        const nextPage = currentPage + 1;
        await fetchCandidates(nextPage, true);
    }, [hasMore, currentPage, fetchCandidates]);

    useEffect(() => {
        // Reset and fetch first page when filters change
        setCandidates([]);
        setCurrentPage(1);
        fetchCandidates(1, false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgID, filterStatus, sortBy, selectedFilters, minYears, maxYears, minSalary, maxSalary, preScreeningAnswers]);

    const refetch = async () => {
        setCandidates([]);
        setCurrentPage(1);
        await fetchCandidates(1, false);
    };

    return {
        candidates,
        totalCount,
        isLoading,
        isLoadingMore,
        hasMore,
        refetch,
        loadMore,
    };
};


