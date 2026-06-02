/**
 * Filter emails by tab type (inbox, sent, drafts)
 * @param userEmail - Current user's email address (required for sent/drafts filtering)
 */
export const filterByTab = (emails: any[], tab: string, userEmail?: string): any[] => {

    switch (tab) {

        case "inbox": {
            return emails.filter((email: any) => {
                const labels = email.labelIds || [];
                const hasInbox = labels.includes("INBOX") || email.isInbox === true;
                const isSentOnly = (email.isSent === true || labels.includes("SENT")) && !hasInbox;
                return hasInbox && !isSentOnly;
            });
        }

        case "sent": {
            return emails.filter((email: any) => {
                if (email.isSent !== true || email.isDraft === true) return false;
                return true;
            });
        }

        case "drafts": {
            return emails.filter((email: any) => {
                if (email.isDraft !== true || email.isSent === true) return false;

                const allDrafts = false;
                if (allDrafts) {
                    return true;
                } else {
                    //? Return only current user's drafts
                    if (!userEmail) return false;
                    const current = userEmail.toLowerCase();
                    const senderEmail = email.emailContent?.messages?.[0]?.sender?.email?.toLowerCase();
                    const recruiterEmail = email.recruiterEmail?.toLowerCase();
                    return recruiterEmail === current || senderEmail === current;
                }

            });
        }

        default:
            return emails;
    }
};

/**
 * Filter emails by read status
 */
export const filterByReadStatus = (emails: any[], readFilter: string): any[] => {
    if (readFilter !== "Unread Only") return emails;

    return emails.filter((email: any) => {
        const labels = email.labelIds || [];
        return labels.includes("UNREAD");
    });
};

// const NO_REPLY_EMAILS = ["no-reply@hirejia.ai", "hr@whitecloak.com"];

/**
 * Check if an email is automated
 * Emails are considered automated if:
 * - type is "automated"
 * - sender is a no-reply address (from NO_REPLY_EMAILS list)
 * - isNoreply flag is true
 */
const isAutomatedEmail = (email: any): boolean => {
    const type = email.emailContent?.messages?.[0]?.type;
    if (type === "automated") return true;

    // Check if email is from no-reply address
    const senderEmail = email.emailContent?.messages?.[0]?.sender?.email?.toLowerCase();
    // if (senderEmail && NO_REPLY_EMAILS.includes(senderEmail)) return true;

    // Check isNoreply flag
    if (email.isNoreply === true) return true;

    return false;
};

/**
 * Filter emails by type (Manual / Automated)
 * Applies to inbox and sent tabs, but not drafts
 */
export const filterByType = (emails: any[], typeFilter: string, tab: string): any[] => {
    // Skip filtering for drafts
    if (tab === "drafts") return emails;

    // Return all emails if no specific type filter is selected
    if (typeFilter === "Type" || !typeFilter) return emails;

    if (typeFilter === "Manual") {
        return emails.filter((email: any) => !isAutomatedEmail(email));
    }

    if (typeFilter === "Automated") {
        return emails.filter((email: any) => isAutomatedEmail(email));
    }

    return emails;
};

/**
 * Filter emails by job role (career)
 * Applies to all tabs
 */
export const filterByRole = (
    emails: any[],
    roleFilter: string,
    candidateCareerMap: Map<string, string[]>,
    tab: string
): any[] => {
    if (tab === "drafts") return emails;
    if (roleFilter === "Role" || !roleFilter) return emails;

    return emails.filter((email: any) => {
        const emailJobRole = email.CareerId;
        if (!emailJobRole) return false;

        return String(emailJobRole) === String(roleFilter);
    });
};


// !! Filter emails by career ID (job role)
export const filterByCareerId = (emails: any[], tab: string, careerId: string | null | undefined, candidateCareerMap: Map<string, string[]>): any[] => {
    if (tab !== "inbox" && tab !== "sent") return emails;
    if (!careerId) return emails;

    return emails.filter((email: any) => {
        // Filter emails where CareerId matches the careerId
        const emailJobRole = email.CareerId;
        if (!emailJobRole) return false;

        return String(emailJobRole) === String(careerId);
    });
};

// !! Filter emails connected to a specific email address
export const filterBySpecificEmail = (emails: any[], tab: string, targetEmail: string | null): any[] => {
    // Only apply to inbox and sent tabs
    if (tab !== "inbox" && tab !== "sent") return emails;

    if (!targetEmail) return emails;

    const targetEmailLower = targetEmail.toLowerCase();

    return emails.filter((email: any) => {
        // Check all messages in the email thread
        const messages = email.emailContent?.messages || [];

        // If no messages, check direct email properties
        if (messages.length === 0) {
            const sender = email.sender?.email?.toLowerCase();
            const recipient = email.recipient?.email?.toLowerCase();
            return sender === targetEmailLower || recipient === targetEmailLower;
        }

        // Check each message in the thread
        for (const message of messages) {
            const senderEmail = message.sender?.email?.toLowerCase();
            const recipientEmail = message.recipient?.email?.toLowerCase();

            if (senderEmail === targetEmailLower || recipientEmail === targetEmailLower) {
                return true;
            }
        }

        return false;
    });
};

/**
 * Applies all filters to emails and sorts by timestamp
 * Deduplicates emails by id or threadId to prevent duplicates
 */
export const getFilteredEmails = (
    emails: any[],
    tab: string,
    readFilter: string,
    typeFilter: string,
    roleFilter: string,
    candidateCareerMap: Map<string, string[]>,
    userEmail?: string,
    careerId?: string | null | undefined
): any[] => {
    let filtered = filterByTab(emails, tab, userEmail);
    filtered = filterByReadStatus(filtered, readFilter);
    filtered = filterByType(filtered, typeFilter, tab);
    filtered = filterByRole(filtered, roleFilter, candidateCareerMap, tab);
    // Filter emails connected to the email(inbox and sent tabs only)
    // const viewingCandidateEmail = typeof window !== "undefined"
    //     ? sessionStorage.getItem("viewingCandidateEmail")
    //     : null;
    // filtered = filterBySpecificEmail(filtered, tab, viewingCandidateEmail);

    const viewingCandidateEmail =
        typeof window !== "undefined"
            ? sessionStorage.getItem("viewingCandidateEmail")
            : null;
    if (!careerId) {
        filtered = filterBySpecificEmail(filtered, tab, viewingCandidateEmail);
    }
    // Filter emails by careerId if provided
    filtered = filterByCareerId(filtered, tab, careerId, candidateCareerMap);

    // Deduplicate emails by id (prefer threadId if available, otherwise use id)
    const seenIds = new Set<string>();
    filtered = filtered.filter((email: any) => {
        const emailId = email.threadId || email.id || email.messageId;
        if (!emailId || seenIds.has(emailId)) {
            return false;
        }
        seenIds.add(emailId);
        return true;
    });

    filtered.sort((a: any, b: any) => (b.emailTimestamp || 0) - (a.emailTimestamp || 0));

    return filtered;
};

/**
 * Calculate tab statistics
 */
export const getTabStats = (
    allEmails: any[],
    tab: string,
    readFilter: string,
    typeFilter: string,
    roleFilter: string,
    candidateCareerMap: Map<string, string[]>,
    userEmail?: string,
    careerId?: string | null | undefined
) => {
    const filtered = getFilteredEmails(
        allEmails, tab, readFilter, typeFilter, roleFilter, candidateCareerMap, userEmail, careerId
    );

    return {
        unread: filtered.filter((e: any) => (e.labelIds || []).includes("UNREAD")).length,
        total: filtered.length,
        automated: filtered.filter((e: any) => isAutomatedEmail(e)).length,
        direct: filtered.filter((e: any) => !isAutomatedEmail(e)).length,
    };
};
