"use client";

import React, { useState } from "react";
import AvatarImage from "../../AvatarImage/AvatarImage";
import { formatDateWithTimeAgo } from "../utils/emailUtils";
import { useAppContext } from "@/lib/context/AppContext";
import { api } from "@/lib/utils/apiClient";
import styles from "@/lib/styles/components/AllEmailsModule.module.scss";

interface EmailMessageProps {
    message: any;
    parentEmail?: any;
}

const EmailMessage = React.memo(function EmailMessage({ message, parentEmail }: EmailMessageProps) {
    console.log("message", message);

    const { user } = useAppContext();
    const [loadingAttachments, setLoadingAttachments] = useState<Record<string, boolean>>({});

    // Treat no‑reply style senders as automated for display purposes
    const senderEmail = message?.sender?.email?.toLowerCase?.() || "";
    const isNoReplySender =
        senderEmail.includes("noreply@") ||
        senderEmail.includes("no-reply@") ||
        senderEmail.includes("no_reply@");

    const isAutomatedForDisplay = message.type === "automated" || isNoReplySender;

    const handleDownloadAttachment = async (attachment: any, event: React.MouseEvent) => {
        event.preventDefault();

        try {
            // Show loading state
            setLoadingAttachments(prev => ({ ...prev, [attachment.attachmentId]: true }));

            // Determine the correct message ID and user email
            const messageId = message.id || parentEmail?.messageId || parentEmail?.id;
            const userEmail = user?.email;

            if (!messageId || !userEmail) {
                throw new Error('Missing required information for download');
            }

            // Fetch attachment from Gmail via our API
            const response = await api.post('/api/email-module/download-attachment', {
                messageId: messageId,
                attachmentId: attachment.attachmentId,
                filename: attachment.filename,
                mimeType: attachment.mimeType,
                recruiterEmail: userEmail,
            }, {
                responseType: 'blob'
            });

            // Get the file as blob
            const blob = response.data;

            // Create download link and trigger download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = attachment.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error downloading attachment:', error);
            alert('Failed to download attachment. Please try again.');
        } finally {
            setLoadingAttachments(prev => ({ ...prev, [attachment.attachmentId]: false }));
        }
    };

    return (
        <div className={styles.emailMessage}>
            <div className={styles.messageHeader}>
                <AvatarImage
                    src={message.sender.avatar}
                    className={`rounded-circle ${styles.messageAvatar}`}
                    alt={message.sender.name}
                />
                <div className={styles.messageInfo}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div>
                            <div className={styles.senderInfo}>
                                <span className={styles.senderName}>{message.sender.name}</span>
                                <span className={styles.senderEmail}>&lt;{message.sender.email}&gt;</span>
                            </div>
                        </div>
                        <div className={styles.timestampWrapper}>
                            <div className={styles.timestamp}>
                                {formatDateWithTimeAgo(message.timestamp)}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div className={styles.recipientInfo}>
                            to {message.recipient.name} &lt;{message.recipient.email}&gt;
                        </div>
                        <div
                            //  className={`${styles.messageTag} ${message.type === "automated" ? styles.automated : styles.direct
                            //  }`}
                            className={`${styles.messageTag} ${isAutomatedForDisplay ? styles.automated : styles.direct}`}
                        >
                            {/* {message.type === "automated" ? ( */}
                            {isAutomatedForDisplay ? (
                                <>
                                    <svg className={styles.tagIcon} fill="currentColor" viewBox="0 0 20 20">
                                        <path
                                            fillRule="evenodd"
                                            d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                                            clipRule="evenodd"
                                        />
                                    </svg>
                                    Automated
                                </>
                            ) : (
                                <div>
                                    <i className="las la-user" style={{ fontSize: "16px", color: "#F79009" }}></i>
                                    Manual
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.messageContent} dangerouslySetInnerHTML={{ __html: message.content }}></div>

            {/* Display attachments if present */}
            {message.attachments && message.attachments.length > 0 && (
                <div className={styles.attachmentsContainer}>
                    <div className={styles.attachmentsHeader}>
                        <svg className={styles.attachmentIcon} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                        </svg>
                        <span style={{ color: "#414651", fontSize: "14px", fontWeight: 700 }}>
                            {message.attachments.length} Attachment{message.attachments.length > 1 ? "s" : ""}
                        </span>
                    </div>

                    <div className={styles.attachmentsList}>
                        {message.attachments.map((attachment: any) => (
                            <div
                                key={attachment.attachmentId}
                                className={styles.attachmentItem}
                                onClick={(e) => handleDownloadAttachment(attachment, e)}
                                style={{ cursor: "pointer" }}
                            >
                                <div className={styles.attachmentIcon}>
                                    <i className="las la-file" style={{ fontSize: "24px", color: "" }}></i>
                                </div>
                                <div className={styles.attachmentInfo}>
                                    <div className={styles.attachmentName}>{attachment.filename}</div>
                                    <div className={styles.attachmentSize}>
                                        {formatFileSize(attachment.size)}
                                    </div>
                                </div>
                                <div className={styles.attachmentDownload}>
                                    <i className="las la-cloud-download-alt" style={{ fontSize: "24px", }}></i>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}


            {/* {message.signature && (
                <div className={styles.signature}>
                    <div className={styles.signatureName}>{message.signature.name}</div>
                    <div className={styles.signatureTitle}>{message.signature.title}</div>
                    <div className={styles.signatureContact}>{message.signature.contact}</div>
                    {message.signature.logo && <div className={styles.signatureLogo}>{message.signature.logo}</div>}
                </div>
            )} */}
        </div>
    );
});

// Helper function to format file sizes
function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export default EmailMessage;
