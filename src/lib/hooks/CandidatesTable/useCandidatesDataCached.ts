import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/utils/apiClient";
import Swal from "sweetalert2";
import { Candidate, getExperienceYears, getCandidateLocationForDisplay, getCurrentPosition } from "@/lib/utils/candidateHelpers";

interface UseCandidatesDataCachedParams {
    orgID: string | null;
    filterStatus: string;
    sortBy: string;
    onFiltersChange?: () => void;
}

interface UseCandidatesDataCachedReturn {
    allCandidates: Candidate[];
    totalCount: number;
    isLoading: boolean;
    isRefreshing: boolean;
    refreshCache: () => Promise<void>;
    cacheTimestamp: number | null;
}

// Module-level cache to persist across component remounts
const candidateCache = new Map<string, {
    candidates: Candidate[];
    totalCount: number;
    timestamp: number;
    lastActiveTimestamp: number; // When user was last on the page
}>();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

const getCacheKey = (orgID: string | null, filterStatus: string, sortBy: string): string => {
    return `${orgID || 'no-org'}-${filterStatus}-${sortBy}`;
};

const isCacheValid = (timestamp: number, lastActiveTimestamp: number): boolean => {
    // Cache is valid if:
    // 1. User is currently on the page (lastActiveTimestamp is recent)
    // 2. OR cache hasn't expired since user left the page
    const timeSinceLastActive = Date.now() - lastActiveTimestamp;
    return timeSinceLastActive < CACHE_DURATION;
};

// Helper function to sort candidates
const sortCandidates = (candidates: Candidate[], sortBy: string): Candidate[] => {
    const sorted = [...candidates];
    if (sortBy === "Recent Activity") {
        sorted.sort((a, b) => {
            const aTime = new Date(a.activeAt || 0).getTime();
            const bTime = new Date(b.activeAt || 0).getTime();
            return bTime - aTime; // Descending
        });
    } else if (sortBy === "Experience: Low to High") {
        sorted.sort((a, b) => {
            const aExp = getExperienceYears(a) ?? -1;
            const bExp = getExperienceYears(b) ?? -1;
            return aExp - bExp; // Ascending
        });
    } else if (sortBy === "Experience: High to Low") {
        sorted.sort((a, b) => {
            const aExp = getExperienceYears(a) ?? -1;
            const bExp = getExperienceYears(b) ?? -1;
            return bExp - aExp; // Descending
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
            return bTime - aTime; // Descending (newest first)
        });
    } else if (sortBy === "Last Active: Oldest") {
        sorted.sort((a, b) => {
            const aTime = new Date(a.activeAt || 0).getTime();
            const bTime = new Date(b.activeAt || 0).getTime();
            return aTime - bTime; // Ascending (oldest first)
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
};

export const useCandidatesDataCached = ({
    orgID,
    filterStatus,
    sortBy,
    onFiltersChange,
}: UseCandidatesDataCachedParams): UseCandidatesDataCachedReturn => {
    const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
    const isLoadingRef = useRef(false);
    const cacheKey = getCacheKey(orgID, filterStatus, sortBy);
    const isMountedRef = useRef(true);

    const fetchAllCandidates = async (isRefresh = false) => {
        if (!orgID) {
            setIsLoading(false);
            return;
        }

        // Check cache first
        const cached = candidateCache.get(cacheKey);
        if (cached && isCacheValid(cached.timestamp, cached.lastActiveTimestamp) && !isRefresh) {
            // Update lastActiveTimestamp since user is accessing the cache
            cached.lastActiveTimestamp = Date.now();
            // Ensure cached candidates are sorted correctly (in case sortBy changed)
            const sortedCachedCandidates = sortCandidates(cached.candidates, sortBy);
            setAllCandidates(sortedCachedCandidates);
            setTotalCount(cached.totalCount);
            setCacheTimestamp(cached.timestamp);
            setIsLoading(false);
            return;
        }

        // Prevent multiple simultaneous requests
        if (isLoadingRef.current) return;
        isLoadingRef.current = true;

        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }

        try {
            // Fetch ALL candidates (no pagination, no search filter)
            // We'll fetch in batches to avoid overwhelming the server
            let allFetchedCandidates: Candidate[] = [];
            let currentPage = 1;
            const PAGE_SIZE = 100; // Fetch 100 at a time
            let hasMore = true;
            let total = 0;

            while (hasMore) {
                const response = await api.get("/api/get-candidates", {
                    params: {
                        orgID,
                        filterStatus,
                        search: "", // No search filter - get all
                        sortBy,
                        limit: PAGE_SIZE,
                        page: currentPage,
                    },
                });

                const candidates = response.data.candidates || [];
                total = response.data.totalCount || 0;

                allFetchedCandidates = [...allFetchedCandidates, ...candidates];

                // Check if we've fetched all candidates
                if (candidates.length < PAGE_SIZE || allFetchedCandidates.length >= total) {
                    hasMore = false;
                } else {
                    currentPage++;
                }
            }

            // Apply client-side sorting for all sort options (API only supports a few)
            const sortedCandidates = sortCandidates(allFetchedCandidates, sortBy);

            // Update cache
            const timestamp = Date.now();
            candidateCache.set(cacheKey, {
                candidates: sortedCandidates,
                totalCount: total,
                timestamp,
                lastActiveTimestamp: timestamp, // Set to now when cache is created/refreshed
            });

            setAllCandidates(sortedCandidates);
            setTotalCount(total);
            setCacheTimestamp(timestamp);

            if (onFiltersChange) {
                onFiltersChange();
            }
        } catch (error) {
            console.error("Error fetching candidates:", error);
            Swal.fire({
                icon: "error",
                title: "Something went wrong",
                text: "Failed to fetch candidates",
            });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
            isLoadingRef.current = false;
        }
    };

    // Track when component mounts/unmounts and page visibility
    useEffect(() => {
        isMountedRef.current = true;
        
        // Update lastActiveTimestamp when component mounts or becomes visible
        const updateLastActive = () => {
            const cached = candidateCache.get(cacheKey);
            if (cached) {
                cached.lastActiveTimestamp = Date.now();
            }
        };

        // Update when page becomes visible
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible" && isMountedRef.current) {
                updateLastActive();
            }
        };

        // Initial update when component mounts
        updateLastActive();

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            isMountedRef.current = false;
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [cacheKey]);

    // Listen for cache update events
    useEffect(() => {
        const handleCacheUpdate = (event: CustomEvent) => {
            const { orgID: eventOrgID } = event.detail;
            // Only refresh if the event is for the current orgID
            if (eventOrgID === orgID) {
                const cached = candidateCache.get(cacheKey);
                if (cached) {
                    // Ensure candidates are sorted correctly
                    const sortedCachedCandidates = sortCandidates(cached.candidates, sortBy);
                    // Update state with latest cache data
                    setAllCandidates(sortedCachedCandidates);
                    setTotalCount(cached.totalCount);
                    setCacheTimestamp(cached.timestamp);
                }
            }
        };

        window.addEventListener('candidateCacheUpdated', handleCacheUpdate as EventListener);
        return () => {
            window.removeEventListener('candidateCacheUpdated', handleCacheUpdate as EventListener);
        };
    }, [orgID, cacheKey]);

    // Initial load or when cache key changes
    useEffect(() => {
        // Check if cache exists and is still valid
        const cached = candidateCache.get(cacheKey);
        if (cached && isCacheValid(cached.timestamp, cached.lastActiveTimestamp)) {
            // Cache is valid, update lastActiveTimestamp and use cached data
            cached.lastActiveTimestamp = Date.now();
            // Apply sorting to cached candidates
            const sortedCachedCandidates = sortCandidates(cached.candidates, sortBy);
            setAllCandidates(sortedCachedCandidates);
            setTotalCount(cached.totalCount);
            setCacheTimestamp(cached.timestamp);
            setIsLoading(false);
        } else {
            // Cache expired or doesn't exist, fetch fresh data
            fetchAllCandidates();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgID, filterStatus, sortBy]);

    // Re-sort candidates when sortBy changes (if we already have candidates loaded)
    // This handles cases where sortBy changes but we don't need to refetch
    useEffect(() => {
        if (allCandidates.length > 0 && !isLoading) {
            const sorted = sortCandidates([...allCandidates], sortBy);
            setAllCandidates(sorted);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortBy]);

    const refreshCache = async () => {
        await fetchAllCandidates(true);
    };

    return {
        allCandidates,
        totalCount,
        isLoading,
        isRefreshing,
        refreshCache,
        cacheTimestamp,
    };
};

/**
 * Adds a newly imported candidate to the cache immediately.
 * Uses the candidate data provided directly (no API call needed).
 * 
 * @param orgID - Organization ID
 * @param candidate - The candidate object to add to cache
 */
export const addCandidateToCache = (
    orgID: string | null,
    candidate: Candidate
): void => {
    if (!orgID || !candidate || !candidate.email) return;

    try {
        const newCandidate = candidate;

        // Get all cache keys for this orgID
        const cacheKeys: string[] = [];
        candidateCache.forEach((_, key) => {
            if (key.startsWith(`${orgID}-`)) {
                cacheKeys.push(key);
            }
        });

        // Add the candidate to all cache entries
        cacheKeys.forEach(cacheKey => {
            const cached = candidateCache.get(cacheKey);
            if (cached) {
                // Check if candidate already exists in cache (avoid duplicates)
                const exists = cached.candidates.some(
                    c => (c.email === candidate.email || c._id === newCandidate._id || c.id === newCandidate.id)
                );
                
                if (!exists) {
                    // Parse filterStatus and sortBy from cache key
                    // Cache key format: `${orgID}-${filterStatus}-${sortBy}`
                    const keyWithoutOrg = cacheKey.replace(`${orgID}-`, '');
                    
                    // Try to find sortBy at the end (it's one of the known sort options)
                    const sortByOptions = ["Recent Activity", "Oldest Activity", "Alphabetical (A-Z)", "Alphabetical (Z-A)"];
                    let sortBy = "";
                    let filterStatus = "";
                    
                    for (const sortOption of sortByOptions) {
                        if (keyWithoutOrg.endsWith(`-${sortOption}`)) {
                            sortBy = sortOption;
                            filterStatus = keyWithoutOrg.slice(0, -(sortOption.length + 1)); // Remove "-sortBy"
                            break;
                        }
                    }
                    
                    // Fallback: if we can't parse, assume "All Application Statuses" and "Recent Activity"
                    if (!sortBy) {
                        filterStatus = keyWithoutOrg.includes('-') ? keyWithoutOrg.split('-').slice(0, -1).join('-') : keyWithoutOrg;
                        sortBy = "Recent Activity";
                    }

                    // Check if candidate matches the filterStatus
                    let shouldAdd = true;
                    if (filterStatus && filterStatus !== "All Application Statuses") {
                        // Check if candidate has an interview with matching status
                        const hasMatchingStatus = newCandidate.interviews?.some(
                            (interview: any) => interview.applicationStatus === filterStatus
                        );
                        // Also check candidateStatus directly
                        const candidateStatusMatches = newCandidate.candidateStatus === filterStatus;
                        if (!hasMatchingStatus && !candidateStatusMatches) {
                            shouldAdd = false;
                        }
                    }
                    
                    if (shouldAdd) {
                        // Add candidate to the array
                        const updatedCandidates = [...cached.candidates, newCandidate];
                        
                        // Sort according to sortBy
                        const sortedCandidates = sortCandidates(updatedCandidates, sortBy);
                        
                        // Update cache
                        candidateCache.set(cacheKey, {
                            candidates: sortedCandidates,
                            totalCount: cached.totalCount + 1,
                            timestamp: cached.timestamp, // Keep original timestamp
                            lastActiveTimestamp: cached.lastActiveTimestamp, // Keep original timestamp
                        });
                    }
                }
            }
        });

        // Dispatch custom event to notify components using the cache
        window.dispatchEvent(new CustomEvent('candidateCacheUpdated', {
            detail: { orgID, candidateEmail: candidate.email }
        }));
    } catch (error) {
        console.error("Error adding candidate to cache:", error);
    }
};

// Utility function to clear cache for a specific org
export const clearCandidateCache = (orgID: string | null, filterStatus?: string, sortBy?: string) => {
    if (orgID) {
        if (filterStatus && sortBy) {
            const key = getCacheKey(orgID, filterStatus, sortBy);
            candidateCache.delete(key);
        } else {
            // Clear all caches for this org
            const keysToDelete: string[] = [];
            candidateCache.forEach((_, key) => {
                if (key.startsWith(`${orgID}-`)) {
                    keysToDelete.push(key);
                }
            });
            keysToDelete.forEach(key => candidateCache.delete(key));
        }
    }
};
