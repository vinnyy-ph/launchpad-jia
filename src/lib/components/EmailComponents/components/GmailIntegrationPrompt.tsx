"use client";

import React from "react";
import styles from "@/lib/styles/components/AllEmailsModule.module.scss";

interface GmailIntegrationPromptProps {
    isLoading: boolean;
    isEnablingGmail: boolean;
    onEnableGmail: () => void;
}

export default function GmailIntegrationPrompt({
    isLoading,
    isEnablingGmail,
    onEnableGmail,
}: GmailIntegrationPromptProps) {
    if (isLoading) {
        return (
            <div className={styles.loading}>
                <div className={styles.loadingContent}>
                    <div className={styles.loadingSpinner}></div>
                    <h3 className={styles.loadingTitle}>Loading All Emails</h3>
                    <p className={styles.loadingText}>Checking Gmail integration...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.gmailIntegration}>
            <div className={styles.gmailIntegrationContent}>
                <i className={`la la-envelope ${styles.gmailIntegrationIcon}`}></i>
                <h2 className={styles.gmailIntegrationTitle}>Gmail Integration Required</h2>
                <p className={styles.gmailIntegrationText}>
                    To access all your emails, you need to enable Gmail integration. This allows us to securely connect
                    to your Gmail account and display your emails.
                </p>
                <button
                    className="btn btn-default"
                    onClick={onEnableGmail}
                    disabled={isEnablingGmail}
                >
                    {isEnablingGmail ? (
                        <>
                            <i className={`la la-spinner la-spin ${styles.enablingSpinner}`}></i>
                            Enabling...
                        </>
                    ) : (
                        "Enable Gmail Integration"
                    )}
                </button>
            </div>
        </div>
    );
}
