/**
 * Cache and fetcher for candidate tooltip data.
 * Provides per-candidate+org memoization, request deduplication, and cancellation.
 */

import { api } from "@/lib/utils/apiClient";

// Track emails that have pending lazy extraction to avoid duplicate calls
const pendingLazyExtractions = new Set<string>();

/**
 * Trigger lazy extraction of missing CV contact fields.
 * Fire-and-forget: does not block, invalidates cache after completion.
 */
export function triggerLazyExtraction(candidateEmail: string, orgID: string): void {
    // Skip if already pending
    if (pendingLazyExtractions.has(candidateEmail)) {
        return;
    }

    pendingLazyExtractions.add(candidateEmail);

    api.post("/api/extract-cv-contact-fields", { email: candidateEmail, orgID })
        .then(() => {
            // Invalidate cache so next hover picks up extracted data
            invalidateTooltipCache(candidateEmail, orgID);
        })
        .catch((err) => {
            // Silently ignore errors - this is a background enhancement
            console.debug("Lazy CV extraction failed:", err?.message || err);
        })
        .finally(() => {
            pendingLazyExtractions.delete(candidateEmail);
        });
}

export interface TooltipCandidateProfile {
    phone: string | null;
    location: string | null;
    skills: string[];
    hasCV: boolean;
    jobTitle: string | null;
    company: string | null;
}

export interface TooltipOtherApplication {
    id: string | null;
    interviewID: string;
    jobTitle: string;
    currentStatus: string;
    daysAgo: number;
    label?: string;
}

export interface TooltipData {
    profile: TooltipCandidateProfile | null;
    orgSkills: string[];
    endorsements: { [key: string]: any[] };
    otherApplications: TooltipOtherApplication[];
    ready: boolean;
    error: boolean;
}

interface CacheEntry {
    data: TooltipData;
    timestamp: number;
    inFlightPromise?: Promise<TooltipData>;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

function getCacheKey(candidateEmail: string, orgID: string): string {
    return `${candidateEmail}::${orgID}`;
}

function isCacheValid(entry: CacheEntry | undefined): boolean {
    if (!entry) return false;
    if (!entry.data.ready) return false;
    return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

async function fetchProfileData(
    candidateEmail: string,
    candidate: any,
    signal?: AbortSignal
): Promise<TooltipCandidateProfile> {
    try {
        const cvResponse = await api.post(`/api/load-user-cv`, { email: candidateEmail }, { signal });
        const cvData = cvResponse?.data || null;

        // Use database fields directly - no markdown parsing
        const finalPhone = cvData?.phone || candidate?.phone || null;
        let finalLocation = cvData?.location || candidate?.location || null;
        const finalJobTitle = cvData?.currentPosition || candidate?.jobTitle || null;
        const finalCompany = cvData?.company || candidate?.company || null;

        // Skills are fetched from org-candidate-skills via fetchOrgSkills, not parsed here

        // Safety: never show LinkedIn/URL-like location
        if (finalLocation && /linkedin|http[s]?:\/\/|www\./i.test(finalLocation)) {
            finalLocation = null;
        }

        return {
            phone: finalPhone,
            location: finalLocation,
            skills: [], // Skills come from orgSkills (org-candidate-skills collection)
            hasCV: !!cvData,
            jobTitle: finalJobTitle,
            company: finalCompany,
        };
    } catch (error: any) {
        if (error?.name === "CanceledError" || error?.name === "AbortError") throw error;
        return {
            phone: candidate?.phone || null,
            location: candidate?.location || null,
            skills: [],
            hasCV: false,
            jobTitle: candidate?.jobTitle || null,
            company: candidate?.company || null,
        };
    }
}

async function fetchOrgSkills(
    candidateEmail: string,
    orgID: string,
    signal?: AbortSignal
): Promise<string[]> {
    try {
        const response = await api.get(
            `/api/get-org-candidate-skills?candidateEmail=${encodeURIComponent(candidateEmail)}&orgID=${encodeURIComponent(orgID)}`,
            { signal }
        );
        const items = response?.data?.items || [];
        return items.map((item: any) => item.skillName).filter((skill: string) => !!skill);
    } catch (error: any) {
        if (error?.name === "CanceledError" || error?.name === "AbortError") throw error;
        return [];
    }
}

async function fetchEndorsements(
    candidateEmail: string,
    orgID: string,
    signal?: AbortSignal
): Promise<{ [key: string]: any[] }> {
    try {
        let url = `/api/get-endorse-skill?candidateEmail=${encodeURIComponent(candidateEmail)}`;
        if (orgID) {
            url += `&orgID=${encodeURIComponent(orgID)}`;
        }
        const response = await api.get(url, { signal });
        const allEndorsements = response?.data?.endorsements || [];
        const endorsementsMap: { [key: string]: any[] } = {};

        for (const endorsement of allEndorsements) {
            const skill = endorsement.skillName;
            if (!skill) continue;
            if (!endorsementsMap[skill]) {
                endorsementsMap[skill] = [];
            }
            endorsementsMap[skill].push(endorsement);
        }

        return endorsementsMap;
    } catch (error: any) {
        if (error?.name === "CanceledError" || error?.name === "AbortError") throw error;
        return {};
    }
}

async function fetchOtherApplications(
    candidateEmail: string,
    orgID: string,
    currentInterviewID: string | undefined,
    signal?: AbortSignal
): Promise<TooltipOtherApplication[]> {
    try {
        const response = await api.get(`/api/get-candidate-interviews`, {
            params: { candidateEmail, orgID },
            signal,
        });
        const interviews = response?.data || [];

        return interviews
            .filter(
                (int: any) =>
                    int.interviewID !== currentInterviewID &&
                    (int.applicationStatus === "Ongoing" || !int.applicationStatus)
            )
            .map((int: any) => {
                const title = int.jobTitle || int.title || "Application";
                const rawTimestamp = int.createdAt ?? int.updatedAt;
                const parsedTime = rawTimestamp ? new Date(rawTimestamp).getTime() : NaN;
                const safeDaysAgo = Number.isFinite(parsedTime)
                    ? Math.max(0, Math.floor((Date.now() - parsedTime) / (1000 * 60 * 60 * 24)))
                    : 0;
                return {
                    id: int.id || int.careerID || null,
                    interviewID: int.interviewID,
                    label: title,
                    jobTitle: title,
                    currentStatus: int.status || int.currentStep || "Applied",
                    daysAgo: safeDaysAgo,
                };
            })
            .slice(0, 3);
    } catch (error: any) {
        if (error?.name === "CanceledError" || error?.name === "AbortError") throw error;
        return [];
    }
}

export async function fetchTooltipData(
    candidateEmail: string,
    orgID: string,
    candidate: any,
    signal?: AbortSignal
): Promise<TooltipData> {
    const key = getCacheKey(candidateEmail, orgID);
    const existing = cache.get(key);

    // Return cached data if valid
    if (isCacheValid(existing)) {
        return existing!.data;
    }

    // If there's an in-flight request, wait for it
    if (existing?.inFlightPromise) {
        return existing.inFlightPromise;
    }

    // Create new fetch promise
    const fetchPromise = (async (): Promise<TooltipData> => {
        try {
            const [profile, orgSkills, endorsements, otherApplications] = await Promise.all([
                fetchProfileData(candidateEmail, candidate, signal),
                fetchOrgSkills(candidateEmail, orgID, signal),
                fetchEndorsements(candidateEmail, orgID, signal),
                fetchOtherApplications(candidateEmail, orgID, candidate?.interviewID, signal),
            ]);

            const data: TooltipData = {
                profile,
                orgSkills,
                endorsements,
                otherApplications,
                ready: true,
                error: false,
            };

            // Update cache with resolved data
            cache.set(key, { data, timestamp: Date.now() });

            // Trigger lazy extraction if any contact fields or skills are missing
            if (profile) {
                const hasMissingContactFields =
                    !profile.phone ||
                    !profile.location ||
                    !profile.jobTitle ||
                    !profile.company;

                const hasMissingSkills = orgSkills.length === 0;

                if ((hasMissingContactFields || hasMissingSkills) && profile.hasCV) {
                    triggerLazyExtraction(candidateEmail, orgID);
                }
            }

            return data;
        } catch (error: any) {
            // Remove in-flight promise on error
            const entry = cache.get(key);
            if (entry) {
                delete entry.inFlightPromise;
            }

            if (error?.name === "CanceledError" || error?.name === "AbortError") {
                throw error;
            }

            // Return error state
            return {
                profile: null,
                orgSkills: [],
                endorsements: {},
                otherApplications: [],
                ready: true,
                error: true,
            };
        }
    })();

    // Store in-flight promise
    cache.set(key, {
        data: { profile: null, orgSkills: [], endorsements: {}, otherApplications: [], ready: false, error: false },
        timestamp: Date.now(),
        inFlightPromise: fetchPromise,
    });

    return fetchPromise;
}

export function invalidateTooltipCache(candidateEmail: string, orgID: string): void {
    const key = getCacheKey(candidateEmail, orgID);
    cache.delete(key);
}

export function clearAllTooltipCache(): void {
    cache.clear();
}
