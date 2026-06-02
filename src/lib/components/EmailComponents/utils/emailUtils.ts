/**
 * Format a date to show time ago (e.g., "5 minutes ago", "2 hours ago")
 */
export const formatTimeAgo = (date: Date, currentTime: Date): string => {
    const diffInSeconds = Math.floor((currentTime.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    }
    if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    }
    if (diffInSeconds < 2592000) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} day${days !== 1 ? "s" : ""} ago`;
    }
    return date.toLocaleDateString();
};

/**
 * Format a date with full date/time and time ago in parentheses
 * Example: "Mon, Jul 22, 2025, 10:53 AM (5 days ago)"
 */
export const formatDateWithTimeAgo = (date: Date | string, currentTime: Date = new Date()): string => {
    // Convert string to Date if needed
    const dateObj = typeof date === "string" ? new Date(date) : date;
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
        return "Invalid date";
    }

    // Format the full date/time
    const formattedDate = dateObj.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
    });

    // Calculate time ago
    const diffInSeconds = Math.floor((currentTime.getTime() - dateObj.getTime()) / 1000);
    let timeAgo = "";

    if (diffInSeconds < 60) {
        timeAgo = "Just now";
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        timeAgo = `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        timeAgo = `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    } else if (diffInSeconds < 2592000) {
        const days = Math.floor(diffInSeconds / 86400);
        timeAgo = `${days} day${days !== 1 ? "s" : ""} ago`;
    } else {
        // For dates older than 30 days, just return the formatted date
        return formattedDate;
    }

    return `${formattedDate} (${timeAgo})`;
};

/**
 * Check if an email is unread based on labelIds
 */
export const isEmailUnread = (email: any): boolean => {
    const labelIds = email.labelIds || [];
    return labelIds.includes("UNREAD");
};

/**
 * Extract candidate email from email thread messages
 */
export const extractCandidateEmail = (
    emailData: any,
    candidateEmails: string[],
    selectedTab: string
): string | null => {
    if (!emailData?.emailContent?.messages) return null;

    // Check all messages in the thread to find candidate email
    for (const message of emailData.emailContent.messages) {
        const senderEmail = message.sender?.email?.toLowerCase();
        const recipientEmail = message.recipient?.email?.toLowerCase();

        // Check if sender is a candidate
        if (senderEmail && candidateEmails.includes(senderEmail)) {
            return senderEmail;
        }
        // Check if recipient is a candidate
        if (recipientEmail && candidateEmails.includes(recipientEmail)) {
            return recipientEmail;
        }
    }

    // Fallback logic using first message
    if (emailData.emailContent.messages.length > 0) {
        const firstMessage = emailData.emailContent.messages[0];
        const senderEmail = firstMessage.sender?.email?.toLowerCase();
        const recipientEmail = firstMessage.recipient?.email?.toLowerCase();

        // For inbox: sender is usually the candidate
        // For sent/drafts: recipient is usually the candidate
        if (selectedTab === "inbox" && senderEmail) {
            return senderEmail;
        } else if ((selectedTab === "sent" || selectedTab === "drafts") && recipientEmail) {
            return recipientEmail;
        } else if (senderEmail) {
            return senderEmail;
        } else if (recipientEmail) {
            return recipientEmail;
        }
    }

    return null;
};
