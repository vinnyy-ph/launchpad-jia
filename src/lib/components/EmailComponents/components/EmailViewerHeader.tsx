"use client";

import React, { useState } from "react";
import AvatarImage from "../../AvatarImage/AvatarImage";
import { formatTimeAgo } from "../utils/emailUtils";
import styles from "@/lib/styles/components/AllEmailsModule.module.scss";

interface EmailViewerHeaderProps {
    user: any;
    lastSyncTime: Date | null;
    currentTime: Date;
    isLoadingEmails: boolean;
    onRefresh: () => void;
    onComposeClick: () => void;
    careertab: boolean;
}

export default function EmailViewerHeader({
    user,
    lastSyncTime,
    currentTime,
    isLoadingEmails,
    onRefresh,
    onComposeClick,
    careertab,
}: EmailViewerHeaderProps) {
    const [open, setOpen] = useState(false);

    const toggleDropdown = () => setOpen(!open);
    const closeDropdown = () => setOpen(false);

    return (
        <div className={styles.header}>
            <div className={styles.headerContent}>
                <div className={styles.headerLeft}>
                    <div className={styles.userInfo}>
                        <button className={styles.settingsButton} title="Refresh" onClick={onRefresh}>
                            <i className="la la-cog" style={{ color: "#535862", fontSize: 19 }}></i>
                        </button>

                        {user?.image && (
                            <AvatarImage
                                src={user?.image}
                                className={`rounded-circle ${styles.userAvatar}`}
                                alt={user?.name}
                            />
                        )}
                        <div className={styles.userText}>
                            <div className={styles.userEmail}>{user?.email}</div>
                            <div className={styles.userStatus}>
                                Connected Gmail |{" "}
                                {isLoadingEmails
                                    ? "Syncing..."
                                    : `Last sync: ${lastSyncTime ? formatTimeAgo(lastSyncTime, currentTime) : "Never"}`}
                            </div>
                        </div>
                    </div>
                    {/* refresh button */}
                    {/* <button
                        className={styles.syncButton}
                        onClick={onRefresh}
                        disabled={isLoadingEmails}
                        title="Refresh emails"
                    >
                        <svg
                            className={`${styles.syncIcon} ${isLoadingEmails ? styles.spinning : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                    </button> */}
                </div>

                {careertab && (
                    <button
                        className={styles.composeButtonHeader}
                        style={{ width: "124px" }}
                        onClick={onComposeClick}
                    >
                        <i className="la la-plus la-lg"></i>
                        Compose
                    </button>
                )}
            </div>
        </div>
    );
}
