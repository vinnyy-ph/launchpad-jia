import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/utils/apiClient";
import { getFilteredEmails } from "../utils/emailFilters";

interface UseEmailDataProps {
    userEmail: string | undefined;
    user?: any; // User object with name, image, etc.
    orgID: string | null;
    hasGmailToken: boolean;
    candidateEmails: string[];
    selectedTab: string;
    readFilter: string;
    typeFilter: string;
    roleFilter: string;
    candidateCareerMap: Map<string, string[]>;
    buildCandidateCareerMap: (emails: any[]) => Promise<void>;
    viewingCandidate?: any; // Current viewing candidate for email sent enhancement
    viewingCandidateEmail?: string | null; // Current viewing candidate email from sessionStorage
    careerId?: string;
}

interface UseEmailDataReturn {
    allEmails: any[];
    emailThreads: any[];
    isLoadingEmails: boolean;
    lastSyncTime: Date | null;
    fetchAllEmails: () => Promise<void>;
    handleEmailSent: (sentEmailData: {
        messageId: string;
        threadId: string;
        to: string;
        subject: string;
        message: string;
        sentAt: string;
    }) => void;
    handleMarkAsRead: (email: any) => Promise<void>;
}

/**
 * Helper function to filter candidate-related emails
 */
const filterCandidateEmails = (
    emails: any[],
    candidateEmails: string[],
    orgID: string | null
): any[] => {
    if (!orgID) return emails;

    return emails.filter((email: any) => {
        // Always include drafts
        if (email.isDraft === true) return true;

        // Get sender and recipient emails
        const sender = email.emailContent?.messages?.[0]?.sender?.email?.toLowerCase();
        const recipient = email.emailContent?.messages?.[0]?.recipient?.email?.toLowerCase();

        // Include SENT emails from *any recruiter* that are sent TO candidates
        // This allows recruiters to see all emails sent to candidates, including those sent by other recruiters
        if (email.isSent === true) {
            if (recipient && candidateEmails.includes(recipient)) return true;
        }

        // Keep inbox emails from candidates
        if (sender && candidateEmails.includes(sender)) return true;

        // Keep emails sent to candidates (for other cases)
        if (recipient && candidateEmails.includes(recipient)) return true;

        return false;
    });
};


export function useEmailData({
    userEmail,
    user,
    orgID,
    hasGmailToken,
    candidateEmails,
    selectedTab,
    readFilter,
    typeFilter,
    roleFilter,
    candidateCareerMap,
    buildCandidateCareerMap,
    viewingCandidate,
    viewingCandidateEmail,
    careerId,
}: UseEmailDataProps): UseEmailDataReturn {
    const [allEmails, setAllEmails] = useState<any[]>([]);
    const [emailThreads, setEmailThreads] = useState<any[]>([]);
    const [isLoadingEmails, setIsLoadingEmails] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const isInitialLoadRef = useRef(true);

    /**
     * Fetches emails from ALL recruiters in the organization
     * Provides organization-wide visibility of candidate emails
     */
    const fetchAllEmails = async () => {
        if (!orgID) return;

        setIsLoadingEmails(true);
        try {
            const gmailResponse = await api.post("/api/email-module/gm-fetch-org-emails", {
                orgID,
                maxResults: 50,
                careerId: careerId || undefined,
                // candidateEmail: viewingCandidateEmail || undefined, // Filter by viewingCandidateEmail from sessionStorage
            });
            
            if (gmailResponse.data?.success && gmailResponse.data.threads) {
                const allEmailsData = gmailResponse.data.threads.map((email: any) => {
                    const labelIds = email.labelIds || [];
                    return {
                        ...email,
                        isSent: labelIds.includes("SENT") || email.isSent || false,
                        isDraft: labelIds.includes("DRAFT") || email.isDraft || false,
                        isInbox: labelIds.includes("INBOX") || email.isInbox || false,
                    };
                });

                // Filter to candidate-related emails
                const filteredUniqueEmails = filterCandidateEmails(allEmailsData, candidateEmails, orgID);

                // Build candidate career map
                if (orgID && candidateEmails.length > 0) {
                    buildCandidateCareerMap(filteredUniqueEmails);
                }

                // Filter emails by tab and all active filters
                const fullyFilteredEmails = getFilteredEmails(
                    filteredUniqueEmails,
                    selectedTab,
                    readFilter,
                    typeFilter,
                    roleFilter,
                    candidateCareerMap,
                    userEmail,
                    careerId
                );
                setEmailThreads(fullyFilteredEmails);

                isInitialLoadRef.current = true;
                setAllEmails(filteredUniqueEmails);
                setLastSyncTime(new Date());

                setTimeout(() => {
                    isInitialLoadRef.current = false;
                }, 100);
            }
        } catch (error) {
            console.error("Error fetching emails:", error);
        } finally {
            setIsLoadingEmails(false);
        }
    };

    /**
     * Polls for new emails from ALL recruiters in the organization
     * Runs every 30 seconds to keep emails up-to-date
     */
    const checkForNewEmails = async () => {
        if (!orgID || isLoadingEmails) return;

        try {
            const gmailResponse = await api.post("/api/email-module/gm-fetch-org-emails", {
                orgID,
                maxResults: 10,
                label: "INBOX",
                careerId: careerId || undefined,
                // candidateEmail: viewingCandidateEmail || undefined, // Filter by viewingCandidateEmail from sessionStorage
            });

            if (gmailResponse.data?.success && gmailResponse.data.threads) {
                const allEmailsData = gmailResponse.data.threads.map((email: any) => {
                    const labelIds = email.labelIds || [];
                    return {
                        ...email,
                        isSent: labelIds.includes("SENT") || email.isSent || false,
                        isDraft: labelIds.includes("DRAFT") || email.isDraft || false,
                        isInbox: labelIds.includes("INBOX") || email.isInbox || false,
                    };
                });

                const filteredNewEmails = filterCandidateEmails(allEmailsData, candidateEmails, orgID);

                setAllEmails((prevEmails) => {
                    const existingIds = new Set(prevEmails.map((e: any) => e.id));
                    const trulyNewEmails = filteredNewEmails.filter((email: any) => !existingIds.has(email.id));

                    if (trulyNewEmails.length === 0) {
                        return prevEmails;
                    }

                    if (orgID && candidateEmails.length > 0 && trulyNewEmails.length > 0) {
                        buildCandidateCareerMap(trulyNewEmails);
                    }

                    // Merge and deduplicate emails
                    const existingMap = new Map(prevEmails.map((e: any) => [e.id, e]));
                    filteredNewEmails.forEach((email: any) => existingMap.set(email.id, email));
                    let updated = Array.from(existingMap.values());

                    // Maintain sort order (newest first)
                    updated.sort((a: any, b: any) => (b.emailTimestamp || 0) - (a.emailTimestamp || 0));

                    const filtered = getFilteredEmails(
                        updated,
                        selectedTab,
                        readFilter,
                        typeFilter,
                        roleFilter,
                        candidateCareerMap,
                        userEmail,
                        careerId
                    );
                    setEmailThreads(filtered);

                    return updated;
                });

                if (filteredNewEmails.length > 0) {
                    setLastSyncTime(new Date());
                }
            }
        } catch (error) {
            console.error("Error checking for new emails:", error);
        }
    };

    /**
     * Set up polling for new emails every 30 seconds
     * Initial delay of 5 seconds to avoid overwhelming the API
     */
    useEffect(() => {
        if (!hasGmailToken || !orgID) return;

        const POLL_INTERVAL_MS = 30000;
        const INITIAL_DELAY_MS = 5000;

        let interval: NodeJS.Timeout | null = null;

        const initialDelay = setTimeout(() => {
            // checkForNewEmails();
            interval = setInterval(checkForNewEmails, POLL_INTERVAL_MS);
        }, INITIAL_DELAY_MS);

        return () => {
            clearTimeout(initialDelay);
            if (interval) clearInterval(interval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasGmailToken, orgID, candidateEmails.length]);

    // Update filtered emails when filters change
    useEffect(() => {
        if (isInitialLoadRef.current) {
            return;
        }

        if (allEmails.length > 0) {
            const filtered = getFilteredEmails(
                allEmails,
                selectedTab,
                readFilter,
                typeFilter,
                roleFilter,
                candidateCareerMap,
                userEmail,
                careerId
            );
            setEmailThreads(filtered);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTab, readFilter, typeFilter, roleFilter, candidateCareerMap]);

    // Fetch emails when Gmail integration is available or when viewingCandidateEmail changes
    useEffect(() => {
        if (hasGmailToken && orgID && candidateEmails.length >= 0) {
            fetchAllEmails();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasGmailToken, orgID, candidateEmails.length, viewingCandidateEmail]);

    // Handle adding sent email to state
    const handleEmailSent = (sentEmailData: {
        messageId: string;
        threadId: string;
        to: string;
        subject: string;
        message: string;
        sentAt: string;
    }) => {
        const recipientEmail = sentEmailData.to.toLowerCase();
        let displayName = sentEmailData.to.split("@")[0] || sentEmailData.to;

        // Check if recipient is a candidate to get their name
        if (
            candidateEmails.includes(recipientEmail) &&
            viewingCandidate?.email?.toLowerCase() === recipientEmail
        ) {
            displayName = viewingCandidate.name || displayName;
        }

        const newEmail: any = {
            id: sentEmailData.messageId,
            threadId: sentEmailData.threadId,
            labelIds: ["SENT"],
            isSent: true,
            isDraft: false,
            isInbox: false,
            name: displayName,
            avatar: viewingCandidate?.image || null,
            role: viewingCandidate?.role || null,
            subject: sentEmailData.subject,
            snippet: sentEmailData.message.substring(0, 100) + (sentEmailData.message.length > 100 ? "..." : ""),
            timeAgo: "Just now",
            isNew: false,
            unreadCount: 0,
            messageCount: 1,
            hasAttachment: false,
            stage: "Direct",
            emailContent: {
                subject: sentEmailData.subject,
                messages: [
                    {
                        id: sentEmailData.messageId,
                        sender: {
                            name: user?.name || userEmail || "You",
                            email: userEmail || "",
                            avatar: user?.image || null,
                        },
                        recipient: {
                            name: displayName,
                            email: recipientEmail,
                        },
                        timestamp: new Date(sentEmailData.sentAt).toLocaleString(),
                        type: "direct",
                        content: sentEmailData.message,
                        signature: {
                            name: user?.name || userEmail || "You",
                            title: "",
                            contact: userEmail || "",
                        },
                    },
                ],
            },
        };

        setAllEmails((prevEmails) => {
            const exists = prevEmails.find((e) => e.id === newEmail.id);
            if (exists) {
                return prevEmails;
            }
            const updated = [newEmail, ...prevEmails];
            const filtered = getFilteredEmails(
                updated,
                selectedTab,
                readFilter,
                typeFilter,
                roleFilter,
                candidateCareerMap,
                userEmail,
                careerId
            );
            setEmailThreads(filtered);
            return updated;
        });
    };

    /**
     * Extracts messageId and threadId from email object
     * Handles both standalone emails and grouped threads
     */
    const extractEmailIds = (email: any): { messageId: string | null; threadId: string | null } => {
        let messageId: string | null = null;
        let threadId: string | null = email.threadId || null;

        // Priority 1: Get messageId from first message (most reliable for threads)
        if (email.emailContent?.messages?.length > 0) {
            const firstMessage = email.emailContent.messages[0];
            if (firstMessage.id) {
                messageId = firstMessage.id;
            }
        }

        // Priority 2: Check if email.id is a messageId (for standalone emails)
        if (!messageId && email.id) {
            // If email.id doesn't match threadId, it's likely a messageId
            if (email.id !== threadId) {
                messageId = email.id;
            }
        }

        // Priority 3: Check for messageId property directly
        if (!messageId && email.messageId) {
            messageId = email.messageId;
        }

        // Determine threadId if not already set
        if (!threadId && email.id && email.emailContent?.messages?.length > 0) {
            const messageIds = email.emailContent.messages
                .map((m: any) => m.id)
                .filter(Boolean);
            
            // If email.id doesn't match any message ID, it's likely a threadId
            if (!messageIds.includes(email.id)) {
                threadId = email.id;
            }
        }

        return { messageId, threadId };
    };

    /**
     * Marks an email as read in Gmail
     * Uses the correct recruiter's Gmail account for authentication
     */
    const handleMarkAsRead = async (email: any) => {
        const labelIds = email.labelIds || [];
        const isUnread = labelIds.includes("UNREAD");

        if (!isUnread || !userEmail) return;

        try {
            // Extract messageId and threadId from email object
            const { messageId, threadId } = extractEmailIds(email);

            if (!messageId) {
                console.error("No valid messageId found for email:", {
                    id: email.id,
                    threadId: email.threadId,
                    hasMessages: !!email.emailContent?.messages,
                    messageCount: email.emailContent?.messages?.length,
                });
                return;
            }

            // Use the original recipient's email for authentication
            const emailToUse = email.recruiterEmail || userEmail;
            
            await api.post("/api/email-module/gm-mark-read", {
                email: emailToUse,
                messageId,
                threadId,
                orgID,
            });

            // Update UI state
            const removeUnreadLabel = (emails: any[]) =>
                emails.map((e) =>
                    e.id === email.id
                        ? { ...e, labelIds: (e.labelIds || []).filter((id: string) => id !== "UNREAD") }
                        : e
                );

            setAllEmails(removeUnreadLabel);
            setEmailThreads(removeUnreadLabel);
        } catch (error) {
            console.error("Error marking email as read:", error);
        }
    };

    return {
        allEmails,
        emailThreads,
        isLoadingEmails,
        lastSyncTime,
        fetchAllEmails,
        handleEmailSent,
        handleMarkAsRead,
    };
}
