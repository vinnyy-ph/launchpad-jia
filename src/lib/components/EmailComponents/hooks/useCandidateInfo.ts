import { useState, useEffect } from "react";
import { api } from "@/lib/utils/apiClient";
import { extractCandidateEmail } from "../utils/emailUtils";

interface UseCandidateInfoReturn {
    viewingCandidate: any;
    viewingCandidateEmail: string | null;
    candidateCareerMap: Map<string, string[]>;
    candidateEmails: string[];
    careers: any[];
    fetchCandidateInfo: (email: string) => Promise<void>;
    buildCandidateCareerMap: (emails: any[]) => Promise<void>;
}

export function useCandidateInfo(
    orgID: string | null,
    userEmail: string | undefined,
    emailThreads: any[],
    selectedEmail: string | null,
    selectedTab: string
): UseCandidateInfoReturn {
    const [candidateEmails, setCandidateEmails] = useState<string[]>([]);
    const [candidateCareerMap, setCandidateCareerMap] = useState<Map<string, string[]>>(new Map());
    const [viewingCandidate, setViewingCandidate] = useState<any>(null);
    const [viewingCandidateEmail, setViewingCandidateEmail] = useState<string | null>(() => {
        // Load from sessionStorage on initial mount
        if (typeof window !== "undefined") {
            const stored = sessionStorage.getItem("viewingCandidateEmail");
            return stored ? stored.toLowerCase() : null;
        }
        return null;
    });
    const [careers, setCareers] = useState<any[]>([]);

    // Fetch candidate emails from database
    const fetchCandidateEmails = async () => {
        if (!orgID) return;

        try {
            const response = await api.get("/api/get-candidate-emails", {
                params: {
                    orgID,
                    userEmail,
                },
            });

            if (response.data?.success) {
                setCandidateEmails(response.data.emails || []);
                // setCandidateEmails([]);
            }
        } catch (error) {
            // Silently fail - will show all emails if candidate emails can't be fetched
        }
    };

    // Fetch careers from database
    const fetchCareers = async () => {
        if (!orgID) return;

        try {
            const response = await api.get("/api/get-careers", {
                params: { orgID, limit: 1000 },
            });

            if (response.data?.careers) {
                const allCareers = response.data.careers
                    .filter((career: any) => career.jobTitle)
                    .map((career: any) => ({
                        title: career.jobTitle,
                        id: career.id || career._id?.toString() || "",
                    }))
                    .filter((career: any) => career.title && career.id);

                const uniqueCareers = Array.from(
                    new Map(allCareers.map((c: any) => [c.title, c])).values()
                );

                setCareers(uniqueCareers);
            }
        } catch (error) {
            console.error("Failed to fetch careers:", error);
        }
    };

    // Build candidate career map from all emails
    const buildCandidateCareerMap = async (emails: any[]) => {
        if (!orgID) return;

        const uniqueCandidateEmails = new Set<string>();

        emails.forEach((email: any) => {
            if (email.emailContent?.messages) {
                email.emailContent.messages.forEach((message: any) => {
                    const senderEmail = message.sender?.email?.toLowerCase();
                    const recipientEmail = message.recipient?.email?.toLowerCase();

                    if (senderEmail && candidateEmails.includes(senderEmail)) {
                        uniqueCandidateEmails.add(senderEmail);
                    }
                    if (recipientEmail && candidateEmails.includes(recipientEmail)) {
                        uniqueCandidateEmails.add(recipientEmail);
                    }
                });
            }
        });

        const emailsToFetch = Array.from(uniqueCandidateEmails).slice(0, 20);
        const candidatePromises = emailsToFetch.map((email) =>
            api.get("/api/get-candidate-by-email", {
                params: { email, orgID },
            }).catch(() => null)
        );

        const responses = await Promise.all(candidatePromises);

        const newMap = new Map<string, string[]>();
        responses.forEach((response) => {
            if (response?.data?.success && response.data.candidate) {
                const candidate = response.data.candidate;
                const email = candidate.email?.toLowerCase();
                if (email && candidate.activeApplications && candidate.activeApplications.length > 0) {
                    const careerTitles = candidate.activeApplications.map((app: any) => app.jobTitle);
                    newMap.set(email, careerTitles);
                }
            }
        });

        setCandidateCareerMap((prev) => {
            const merged = new Map(prev);
            newMap.forEach((careers, email) => {
                merged.set(email, careers);
            });
            return merged;
        });
    };

    // Fetch candidate information
    const fetchCandidateInfo = async (email: string) => {
        if (!orgID || !email) return;
console.log("fetching candidate info for email:", email);
        try {
            const response = await api.get("/api/get-candidate-by-email", {
                params: { email, orgID },
            });

            if (response.data?.success && response.data.candidate) {
                const candidate = response.data.candidate;
                setViewingCandidate(candidate);
                setViewingCandidateEmail(email.toLowerCase());

                if (candidate.activeApplications && candidate.activeApplications.length > 0) {
                    const careerTitles = candidate.activeApplications.map((app: any) => app.jobTitle);
                    setCandidateCareerMap((prev) => {
                        const newMap = new Map(prev);
                        newMap.set(email.toLowerCase(), careerTitles);
                        return newMap;
                    });
                }
            } else {
                setViewingCandidate(null);
                setViewingCandidateEmail(null);
            }
        } catch (error) {
            setViewingCandidate(null);
            setViewingCandidateEmail(null);
        }
    };

    // Save viewingCandidateEmail to sessionStorage whenever it changes
    useEffect(() => {
        if (typeof window !== "undefined") {
            if (viewingCandidateEmail) {
                // sessionStorage.setItem("viewingCandidateEmail", viewingCandidateEmail.toLowerCase());
            } else {
                sessionStorage.removeItem("viewingCandidateEmail");
            }
        }
    }, [viewingCandidateEmail]);

    // Fetch candidate emails and careers when orgID is available
    useEffect(() => {
        if (orgID) {
            fetchCandidateEmails();
            fetchCareers();
        }
    }, [orgID]);

    // Fetch candidate info based on viewingCandidateEmail from sessionStorage (NOT from selectedEmail)
    useEffect(() => {
        if (orgID && candidateEmails.length > 0) {
            // Always use viewingCandidateEmail from sessionStorage - don't change it when clicking emails
            const storedCandidateEmail =
                viewingCandidateEmail ||
                (typeof window !== "undefined"
                    ? sessionStorage.getItem("viewingCandidateEmail")?.toLowerCase() || null
                    : null);

            if (storedCandidateEmail && candidateEmails.includes(storedCandidateEmail.toLowerCase())) {
                // Set viewingCandidateEmail if not already set
                if (!viewingCandidateEmail) {
                    setViewingCandidateEmail(storedCandidateEmail);
                }

                // Fetch candidate info if not already loaded or if candidate changed
                if (!viewingCandidate || viewingCandidate.email?.toLowerCase() !== storedCandidateEmail) {
                    fetchCandidateInfo(storedCandidateEmail);
                }
            } else if (storedCandidateEmail) {
                // Stored email exists but not in candidateEmails - clear it
                setViewingCandidate(null);
                setViewingCandidateEmail(null);
                if (typeof window !== "undefined") {
                    sessionStorage.removeItem("viewingCandidateEmail");
                }
            } else {
                // No stored candidate email - clear state
                setViewingCandidate(null);
                if (viewingCandidateEmail) {
                    setViewingCandidateEmail(null);
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgID, candidateEmails]); // Removed selectedEmail and emailThreads - only update when orgID or candidateEmails change

    return {
        viewingCandidate,
        viewingCandidateEmail,
        candidateCareerMap,
        candidateEmails,
        careers,
        fetchCandidateInfo,
        buildCandidateCareerMap,
    };
}
