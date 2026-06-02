"use client";

import React from "react";
import { useRouter } from "next/navigation";
import AvatarImage from "../../AvatarImage/AvatarImage";
import styles from "@/lib/styles/components/AllEmailsModule.module.scss";

interface CandidateHeaderProps {
    viewingCandidate: any;
    orgID: string | null;
    onComposeClick: () => void;
}

export default function CandidateHeader({ viewingCandidate, orgID, onComposeClick }: CandidateHeaderProps) {
    const router = useRouter();

    if (!viewingCandidate) {
        return null;
    }

    return (
        <div className={styles.candidateHeader}>
            <div className={styles.candidateHeaderContent}>
                <div className={styles.candidateHeaderLeft}>
                    <AvatarImage
                        src={viewingCandidate.image}
                        className={`rounded-circle ${styles.candidateHeaderAvatar}`}
                        alt={viewingCandidate.name}
                    />
                    <div className={styles.candidateHeaderInfo}>
                        <div className={styles.candidateName}>{viewingCandidate.name}</div>
                        <div className={styles.candidateApplications}>
                            <span className={styles.applicationsLabel}>Active Applications:</span>
                            {viewingCandidate.activeApplications && viewingCandidate.activeApplications.length > 0 ? (
                                viewingCandidate.activeApplications.map((app: any, index: number) => (
                                    <React.Fragment key={app.interviewID || index}>
                                        <button
                                            onClick={() => {
                                                router.push(
                                                    `/recruiter-dashboard/careers/manage/${viewingCandidate.id}/interview-analysis/${app.interviewID}?orgID=${orgID}`
                                                );
                                            }}
                                            className={styles.applicationLink}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                padding: 0,
                                                cursor: "pointer",
                                                textDecoration: "none",
                                            }}
                                        >
                                            {app.jobTitle}
                                            <svg
                                                className={styles.externalLinkIcon}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                                />
                                            </svg>
                                        </button>
                                        {index < viewingCandidate.activeApplications.length - 1 && (
                                            <span className={styles.applicationSeparator}>, </span>
                                        )}
                                    </React.Fragment>
                                ))
                            ) : (
                                <span className={styles.noApplications}>No active applications</span>
                            )}
                        </div>
                    </div>
                </div>
                <button className={styles.composeButtonHeader} onClick={onComposeClick}>
                    <svg
                        className={styles.composeIconHeader}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                    </svg>
                    Compose Email
                </button>
            </div>
        </div>
    );
}
