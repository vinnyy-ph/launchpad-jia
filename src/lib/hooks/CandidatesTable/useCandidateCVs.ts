import { useState, useEffect, useRef, useMemo } from "react";
import { api } from "@/lib/utils/apiClient";
import { Candidate } from "@/lib/utils/candidateHelpers";

interface CVData {
    _id?: string;
    email: string;
    name?: string;
    digitalCV?: Array<{ name: string; content: string }>;
    errorRemarks?: string | null;
    updatedAt?: number;
    fileInfo?: {
        name: string;
        size: number;
        type: string;
    };
}

interface UseCandidateCVsParams {
    candidates: Candidate[];
    orgID: string;
    enabled?: boolean;
}

interface UseCandidateCVsReturn {
    cvDataMap: Record<string, CVData>;
    isLoading: boolean;
    refreshCVs: () => Promise<void>;
}

// Module-level cache for CV data
const cvCache = new Map<string, CVData>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

const isCacheValid = (timestamp: number): boolean => {
    return Date.now() - timestamp < CACHE_DURATION;
};

export const useCandidateCVs = ({
    candidates,
    orgID,
    enabled = true,
}: UseCandidateCVsParams): UseCandidateCVsReturn => {
    const [cvDataMap, setCvDataMap] = useState<Record<string, CVData>>({});
    const [isLoading, setIsLoading] = useState(false);
    const isLoadingRef = useRef(false);
    const cacheTimestamps = useRef<Record<string, number>>({});

    // Extract unique emails from candidates
    const candidateEmails = useMemo(() => {
        if (!enabled || !candidates || candidates.length === 0) {
            return [];
        }
        return [...new Set(candidates.map(c => c.email).filter(Boolean))];
    }, [candidates, enabled]);

    // Check cache and fetch missing CVs
    const fetchCVs = async (emails: string[]) => {
        if (emails.length === 0 || isLoadingRef.current) {
            return;
        }

        isLoadingRef.current = true;
        setIsLoading(true);

        try {
            // Separate emails into cached and uncached
            const cachedCVs: Record<string, CVData> = {};
            const emailsToFetch: string[] = [];

            emails.forEach(email => {
                const cached = cvCache.get(email);
                const timestamp = cacheTimestamps.current[email];
                
                if (cached && timestamp && isCacheValid(timestamp)) {
                    cachedCVs[email] = cached;
                } else {
                    emailsToFetch.push(email);
                }
            });

            // Update state with cached CVs immediately
            if (Object.keys(cachedCVs).length > 0) {
                setCvDataMap(prev => ({ ...prev, ...cachedCVs }));
            }

            // Fetch uncached CVs in batches
            if (emailsToFetch.length > 0) {
                const BATCH_SIZE = 50; // Fetch 50 CVs at a time
                const batches: string[][] = [];
                
                for (let i = 0; i < emailsToFetch.length; i += BATCH_SIZE) {
                    batches.push(emailsToFetch.slice(i, i + BATCH_SIZE));
                }

                const fetchedCVs: Record<string, CVData> = { ...cachedCVs };

                // Fetch all batches in parallel
                const batchPromises = batches.map(async (batch) => {
                    try {
                        const response = await api.post("/api/bulk-load-cvs", {
                            emails: batch,
                            orgID,
                        });

                        if (response.data?.cvs) {
                            return response.data.cvs as Record<string, CVData>;
                        }
                        return {};
                    } catch (error) {
                        console.error(`Error fetching CVs for batch:`, error);
                        return {};
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                
                // Merge all batch results
                batchResults.forEach(batchCVs => {
                    Object.entries(batchCVs).forEach(([email, cvData]) => {
                        fetchedCVs[email] = cvData;
                        // Update cache
                        cvCache.set(email, cvData);
                        cacheTimestamps.current[email] = Date.now();
                    });
                });

                setCvDataMap(fetchedCVs);
            }
        } catch (error) {
            console.error("Error fetching CVs:", error);
        } finally {
            setIsLoading(false);
            isLoadingRef.current = false;
        }
    };

    // Fetch CVs when candidate emails change
    useEffect(() => {
        if (enabled && candidateEmails.length > 0) {
            fetchCVs(candidateEmails);
        }
    }, [candidateEmails.join(","), enabled]); // Use join to create stable dependency

    const refreshCVs = async () => {
        // Clear cache for these emails
        candidateEmails.forEach(email => {
            cvCache.delete(email);
            delete cacheTimestamps.current[email];
        });
        
        // Fetch fresh data
        await fetchCVs(candidateEmails);
    };

    return {
        cvDataMap,
        isLoading,
        refreshCVs,
    };
};

