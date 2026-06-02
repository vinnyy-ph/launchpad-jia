"use client";

import React from "react";
import AvatarImage from "../../AvatarImage/AvatarImage";
import { isEmailUnread } from "../utils/emailUtils";
import styles from "@/lib/styles/components/AllEmailsModule.module.scss";

interface EmailListItemProps {
    email: any;
    isSelected: boolean;
    selectedTab?: string;
    onSelect: (email: any) => void;
    onMarkAsRead: (email: any) => void;
}

// Helper function to strip HTML tags and decode entities for plain text display
const stripHTMLAndDecode = (html: string): string => {
    if (!html) return '';

    // First decode HTML entities
    let text = html
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#160;/g, ' ');

    // Strip complete HTML tags
    text = text.replace(/<[^>]*>/g, '');
    text = text.replace(/<[^>]*$/g, '');

    // Remove any remaining incomplete HTML entities
    text = text.replace(/&[^;]*$/g, '');

    // Clean up extra whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
};

export default function EmailListItem({ email, isSelected, selectedTab, onSelect, onMarkAsRead }: EmailListItemProps) {
    const unread = isEmailUnread(email);

    // Clean the snippet for display
    const cleanSnippet = React.useMemo(() => {
        return stripHTMLAndDecode(email.snippet || '');
    }, [email.snippet]);

    const handleClick = () => {
        onSelect(email);
        // Only mark as read if email is unread
        if (unread) {
            onMarkAsRead(email);
        }
    };

    const renderNewBadge = () => {
        if (email.timeAgo === "Just now") {
            return <span className={styles.newBadge}>New</span>;
        }
        const minuteMatch = email.timeAgo?.match(/(\d+)\s+minute/);
        if (minuteMatch) {
            const minutes = parseInt(minuteMatch[1], 10);
            if (minutes < 2) {
                return <span className={styles.newBadge}>New</span>;
            }
        }
        return null;
    };

    return (
        <div
            key={email.id}
            onClick={handleClick}
            className={`${styles.emailItem} ${isSelected ? styles.selected : ""}`}
        >
            <div className={`${styles.emailContent} ${isSelected ? styles.selected : ""}`}>
                <AvatarImage
                    src={email.avatar}
                    className={`rounded-circle ${styles.emailAvatar}`}
                    alt={email.name}
                />
                <div className={styles.emailInfo}>
                    <div className={styles.emailHeader}>
                        <div className={styles.emailHeaderLeft}>
                            <span className={styles.emailName} style={{ fontWeight: unread ? 700 : 400 }}>
                                {selectedTab === "sent" ? `To: ${email.name}` : email.name}
                            </span>
                            {renderNewBadge()}
                        </div>
                        <span className={styles.time}>{email.timeAgo}</span>
                    </div>
                    {/* <div className={styles.role} style={{ fontWeight: unread ? 600 : 400 }}>
                        {email.role}
                    </div> */}
                    <div
                        className={styles.subject}
                        style={{
                            fontWeight: selectedTab === "sent" ? 400 : (unread ? 600 : 400),
                            color: selectedTab === "sent" ? '#414651' : (unread ? '#007bff' : '#414651')
                        }}
                    >
                        {unread && selectedTab !== "sent" && <span style={{ color: '#007bff' }}>•</span>} {email.subject}
                    </div>
                    <div className={styles.snippet} style={{ fontWeight: unread ? 500 : 400 }}>
                        {cleanSnippet}
                    </div>
                    <div className={styles.tagsContainer}>
                        {/* {email.stage && <span className={styles.tag}>{email.stage}</span>} */}
                        <span className={styles.tag}>{email.messageCount} messages</span>
                        {email.hasAttachment && (
                            <span
                                className={styles.tag}
                                style={{
                                    backgroundColor: 'transparent',
                                    // color: '#EF4444',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    borderRadius: '50px',
                                    padding: '2px 8px',
                                    border: '1px solid #E9EAEB'
                                }}
                            >
                                {email.attachments?.length || 1} attachment{(email.attachments?.length || 1) > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
