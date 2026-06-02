"use client";

import React, { useState } from "react";
import EmailMessage from "./EmailMessage";
import ReplyForwardModule from "../ReplyForwardModule";
import ReplyForwardModuleModal from "../ReplyForwardModuleModal";
import styles from "@/lib/styles/components/AllEmailsModule.module.scss";

interface EmailViewerProps {
    selectedEmailData: any;
    onReply: (emailData: any) => void;
    onForward?: (emailData: any) => void;
    isLoadingThread?: boolean;
    replyForwardData?: {
        replyData?: any;
        forwardData?: any;
    };
    isReplyForwardOpen?: boolean;
    onCloseReplyForward?: () => void;
    onEmailSent?: (emailData: {
        messageId: string;
        threadId: string;
        to: string;
        subject: string;
        message: string;
        sentAt: string;
    }) => void;
}

const EmailViewer = React.memo(function EmailViewer({
    selectedEmailData,
    onReply,
    onForward,
    isLoadingThread = false,
    replyForwardData,
    isReplyForwardOpen = false,
    onCloseReplyForward,
    onEmailSent
}: EmailViewerProps) {
    const [showPopupModal, setShowPopupModal] = useState(false);
    const [popupModalData, setPopupModalData] = useState<{
        replyData?: any;
        forwardData?: any;
    } | null>(null);
    if (!selectedEmailData) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyStateContent}>
                    <div className={styles.emptyStateIcon}>
                        <i className="la la-envelope la-3x"></i>
                    </div>
                    <h3 className={styles.emptyStateTitle}>Select an email to view the conversation</h3>
                    <p className={styles.emptyStateText}>
                        {/* Choose an email from the list to read the full conversation */}
                    </p>
                </div>
            </div>
        );
    }

    if (isLoadingThread) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyStateContent}>
                    <div className={styles.emptyStateIcon}>
                        <i className="la la-spinner la-spin la-3x"></i>
                    </div>
                    <h3 className={styles.emptyStateTitle}>Loading conversation...</h3>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Email Content Header */}
            <div className={styles.emailContentHeader}>
                <div className={styles.emailSubject}>{selectedEmailData.emailContent.subject}</div>
                <div className={styles.emailActions}>
                    <button className={styles.actionButton}>
                        <svg className={styles.actionIcon} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                        </svg>
                    </button>
                    <button className={styles.actionButton}>
                        <svg className={styles.actionIcon} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Email Thread */}
            <div className={styles.emailThread}>
                {selectedEmailData.emailContent.messages.map((message: any) => (
                    <EmailMessage 
                        key={message.id} 
                        message={message} 
                        parentEmail={selectedEmailData}
                    />
                ))}

                {isReplyForwardOpen && replyForwardData && (
                    <ReplyForwardModule
                        isOpen={isReplyForwardOpen}
                        onClose={onCloseReplyForward || (() => { })}
                        replyData={replyForwardData.replyData}
                        forwardData={replyForwardData.forwardData}
                        onEmailSent={onEmailSent}
                        onPopupModal={(data) => {
                            setPopupModalData(data);
                            setShowPopupModal(true);
                        }}
                    />
                )}

                {/* Popup Modal */}
                {showPopupModal && popupModalData && (
                    <ReplyForwardModuleModal
                        isOpen={showPopupModal}
                        onClose={() => {
                            setShowPopupModal(false);
                            setPopupModalData(null);
                        }}
                        replyData={popupModalData.replyData}
                        forwardData={popupModalData.forwardData}
                        onEmailSent={(emailData) => {
                            if (onEmailSent) {
                                onEmailSent(emailData);
                            }
                            setShowPopupModal(false);
                            setPopupModalData(null);
                        }}
                    />
                )}

                {/* Reply and Forward Buttons */}
                <div className={styles.replyButtonContainer}>
                    <button className={styles.replyButton} onClick={() => onReply(selectedEmailData)}>
                        <i className="la la-reply"></i>
                        Reply
                    </button>
                    {onForward && (
                        <button className={styles.replyButton} onClick={() => onForward(selectedEmailData)}>
                            <i className="la la-share"></i>
                            Forward
                        </button>
                    )}
                </div>
            </div>
        </>
    );
});

export default EmailViewer;
