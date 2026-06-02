"use client";

import React from "react";
import EmailFilterButtons from "../EmailFilterButtons";
import EmailList from "./EmailList";
import styles from "@/lib/styles/components/AllEmailsModule.module.scss";

interface EmailSidebarProps {
    selectedTab: string;
    searchQuery: string;
    emails: any[];
    selectedEmailId: string | null;
    isLoading: boolean;
    readFilter: string;
    typeFilter: string;
    roleFilter: string;
    careers: any[];
    inboxStats: { unread: number; total: number };
    draftsStats: { total: number };
    onTabChange: (tab: string) => void;
    onSearchChange: (query: string) => void;
    onReadFilterChange: (filter: string) => void;
    onTypeFilterChange: (filter: string) => void;
    onRoleFilterChange: (filter: string) => void;
    onEmailSelect: (email: any) => void;
    onMarkAsRead: (email: any) => void;
}

export default function EmailSidebar({
    selectedTab,
    searchQuery,
    emails,
    selectedEmailId,
    isLoading,
    readFilter,
    typeFilter,
    roleFilter,
    careers,
    inboxStats,
    draftsStats,
    onTabChange,
    onSearchChange,
    onReadFilterChange,
    onTypeFilterChange,
    onRoleFilterChange,
    onEmailSelect,
    onMarkAsRead,
}: EmailSidebarProps) {
    return (
        <div className={styles.sidebar}>

            <div className={styles.sidebarContentheader}>
                {/* Search Bar */}
                <div className={styles.searchContainer}>
                    <div className={styles.searchInputWrapper}>
                        <svg className={styles.searchIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search emails"
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>
                </div>

                {/* Primary Navigation Tabs */}
                <div className={styles.tabContainer}>
                    <button
                        onClick={() => onTabChange("inbox")}
                        className={`${styles.tabButton} ${selectedTab === "inbox" ? styles.tabButtonActive : ""}`}
                    ><i className="la la-inbox la-lg"></i>
                        Inbox
                        {inboxStats.unread > 0 && <span className={styles.badge}>{inboxStats.unread}</span>}
                    </button>
                    <button
                        onClick={() => onTabChange("sent")}
                        className={`${styles.tabButton} ${selectedTab === "sent" ? styles.tabButtonActive : ""}`}
                    >
                        <svg className={styles.tabIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                            />
                        </svg>
                        Sent
                    </button>
                    <button
                        onClick={() => onTabChange("drafts")}
                        className={`${styles.tabButton} ${selectedTab === "drafts" ? styles.tabButtonActive : ""}`}
                    >
                        <svg className={styles.tabIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                        </svg>
                        Drafts
                        {draftsStats.total > 0 && <span className={styles.badge}>{draftsStats.total}</span>}
                    </button>

                </div>
                {/* Filter Dropdowns */}
                <EmailFilterButtons
                    readFilter={readFilter}
                    typeFilter={typeFilter}
                    roleFilter={roleFilter}
                    careers={careers}
                    onReadFilterChange={onReadFilterChange}
                    onTypeFilterChange={onTypeFilterChange}
                    onRoleFilterChange={onRoleFilterChange}
                />
            </div>

            {/* Email List */}
            <EmailList
                emails={emails}
                selectedEmailId={selectedEmailId}
                searchQuery={searchQuery}
                isLoading={isLoading}
                selectedTab={selectedTab}
                onEmailSelect={onEmailSelect}
                onMarkAsRead={onMarkAsRead}
            />
        </div>
    );
}
