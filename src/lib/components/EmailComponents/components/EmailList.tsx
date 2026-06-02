"use client";

import React, { useState, useMemo } from "react";
import EmailListItem from "./EmailListItem";
import styles from "@/lib/styles/components/AllEmailsModule.module.scss";

interface EmailListProps {
    emails: any[];
    selectedEmailId: string | null;
    searchQuery: string;
    isLoading: boolean;
    selectedTab: string;
    onEmailSelect: (email: any) => void;
    onMarkAsRead: (email: any) => void;
}

const ITEMS_PER_PAGE = 9;

export default function EmailList({
    emails,
    selectedEmailId,
    searchQuery,
    isLoading,
    selectedTab,
    onEmailSelect,
    onMarkAsRead,
}: EmailListProps) {
    const [currentPage, setCurrentPage] = useState(1);

    // Filter emails by search query
    const filteredEmails = useMemo(() => {
        if (!searchQuery) return emails;
        const query = searchQuery.toLowerCase();
        return emails.filter(
            (email: any) =>
                email.name?.toLowerCase().includes(query) ||
                email.subject?.toLowerCase().includes(query) ||
                email.snippet?.toLowerCase().includes(query)
        );
    }, [emails, searchQuery]);

    // Reset page when search or tab changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedTab]);

    // Paginate emails
    const paginatedEmails = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredEmails.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredEmails, currentPage]);

    const totalFiltered = filteredEmails.length;
    const totalPages = Math.ceil(totalFiltered / ITEMS_PER_PAGE);

    if (emails.length === 0) {
        return (
            <div className={styles.emailList}>
                <div className={styles.emptyStateInList}>
                    <i className={`la la-inbox la-2x ${styles.emptyStateIconInList}`}></i>
                    <div>
                        {selectedTab === "sent"
                            ? "No sent emails found"
                            : selectedTab === "drafts"
                                ? "No drafts found"
                                : "No emails found"}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className={styles.emailList}>
                {paginatedEmails.map((email: any) => (
                    <EmailListItem
                        key={email.id}
                        email={email}
                        isSelected={selectedEmailId === email.id}
                        selectedTab={selectedTab}
                        onSelect={onEmailSelect}
                        onMarkAsRead={onMarkAsRead}
                    />
                ))}
            </div>

            {/* Pagination - only show if there are more than ITEMS_PER_PAGE emails */}
            {/* {totalFiltered > ITEMS_PER_PAGE && ( */}
                <div className={styles.pagination}>
                    <button
                        className={styles.paginationButton}
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </button>
                    <span className={styles.paginationInfo}>
                        {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalFiltered)}{" "}
                        of {totalFiltered}
                    </span>
                    <button
                        className={styles.paginationButton}
                        onClick={() => setCurrentPage((prev) => prev + 1)}
                        disabled={currentPage >= totalPages}
                    >
                        Next
                    </button>
                </div>
            {/* )} */}
        </>
    );
}
