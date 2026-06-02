"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAppContext } from "@/lib/context/AppContext";
import { api } from "@/lib/utils/apiClient";
import { Career } from "@/lib/types/projects";
import styles from "@/lib/styles/components/invite-to-job-modal.module.scss";
import { CareerHierarchyInfo, isChildCareer } from "@/lib/utils/careerHierarchy";
import CareerStatusBadges from "@/lib/components/CareerComponents/CareerStatusBadge";

interface CandidateInterview {
    _id: string;
    id: string;
    jobTitle: string;
}

interface InviteToJobModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidate: {
        name?: string;
        email?: string;
        image?: string;
        _id?: string;
    } | null;
    excludedCareerIds?: string[];
    sourceCareer?: CareerHierarchyInfo | null;
    /** When true, sourceCareer is the definitive source (e.g., from Application Timeline) - skips hierarchy blocking and "From:" selection */
    sourceCareerIsImplicit?: boolean;
    onOk?: (payload: { selectedCareers: Career[]; sourceCareerIdOverride?: string; sourceInterviewIdOverride?: string; forceTransfer?: boolean }) => void;
}

export default function InviteToJobModal({
    isOpen,
    onClose,
    candidate,
    excludedCareerIds = [],
    sourceCareer = null,
    sourceCareerIsImplicit = false,
    onOk,
}: InviteToJobModalProps) {
    const { orgID, user } = useAppContext();

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [careers, setCareers] = useState<Career[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCareersMap, setSelectedCareersMap] = useState<Map<string, Career>>(new Map());
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    
    // Parent-child hierarchy state
    const [candidateInterviews, setCandidateInterviews] = useState<CandidateInterview[]>([]);
    const [selectedFromCareerId, setSelectedFromCareerId] = useState<string | null>(null);
    const [selectedFromInterviewId, setSelectedFromInterviewId] = useState<string | null>(null);
    const [selectedFromCareerTitle, setSelectedFromCareerTitle] = useState<string | null>(null);
    const [loadingInterviews, setLoadingInterviews] = useState(false);
    const [fromSearch, setFromSearch] = useState("");

    const limit = 20;
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [search]);

    const fetchCareers = useCallback(async (currentPage: number, isLoadMore = false) => {
        if (!orgID || !user?.email) return;

        try {
            if (isLoadMore) {
                setLoadingMore(true);
            } else {
                setLoading(true);
            }

            const params = new URLSearchParams({
                orgID,
                userEmail: user.email,
                page: currentPage.toString(),
                limit: limit.toString(),
            });

            if (debouncedSearch) {
                params.set("search", debouncedSearch);
            }

            const response = await api.get(`/api/get-careers?${params.toString()}`);

            if (response.status === 200) {
                const fetchedCareers = response.data.careers || [];
                if (isLoadMore) {
                    setCareers((prev) => [...prev, ...fetchedCareers]);
                } else {
                    setCareers(fetchedCareers);
                }
                setTotalPages(response.data.totalPages || 1);
            }
        } catch (error) {
            console.error("Failed to fetch careers:", error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [orgID, user?.email, debouncedSearch]);

    useEffect(() => {
        if (isOpen) {
            fetchCareers(page, page > 1);
        }
    }, [isOpen, debouncedSearch, page, fetchCareers]);

    useEffect(() => {
        if (isOpen) {
            setSearch("");
            setDebouncedSearch("");
            setPage(1);
            setCareers([]);
            setSelectedCareersMap(new Map());
            setLoading(true);
            setSelectedFromCareerId(null);
            setSelectedFromInterviewId(null);
            setSelectedFromCareerTitle(null);
            setCandidateInterviews([]);
            setFromSearch("");
        }
    }, [isOpen]);

    // Fetch candidate interviews for "From:" dropdown
    useEffect(() => {
        const fetchCandidateInterviews = async () => {
            if (!isOpen || !candidate?.email || !orgID) return;
            
            setLoadingInterviews(true);
            try {
                const response = await api.get(
                    `/api/get-candidate-interviews?candidateEmail=${encodeURIComponent(candidate.email)}&orgID=${orgID}`
                );
                if (response.status === 200 && Array.isArray(response.data)) {
                    // Map interviews to the required format
                    const interviews = response.data.map((interview: any) => ({
                        _id: interview._id,
                        id: interview.id,
                        jobTitle: interview.jobTitle,
                    }));
                    setCandidateInterviews(interviews);
                }
            } catch (error) {
                console.error("Failed to fetch candidate interviews:", error);
            } finally {
                setLoadingInterviews(false);
            }
        };

        fetchCandidateInterviews();
    }, [isOpen, candidate?.email, orgID]);

    const handleLoadMore = () => {
        if (page < totalPages && !loadingMore) {
            setPage((prev) => prev + 1);
        }
    };

    const isCareerExcluded = (career: any) => {
        return excludedCareerIds.includes(career._id) || excludedCareerIds.includes(career.id);
    };

    const toggleCareerSelection = (career: Career) => {
        setSelectedCareersMap((prev) => {
            const newMap = new Map(prev);
            if (newMap.has(career._id)) {
                newMap.delete(career._id);
            } else {
                newMap.set(career._id, career);
            }
            return newMap;
        });
    };

    const selectedCareers = Array.from(selectedCareersMap.values());
    const selectedCareerIds = Array.from(selectedCareersMap.keys());

    // Check if any selected career is a child (needs "From:" selection)
    const selectedChildCareers = useMemo(() => {
        return selectedCareers.filter((c: any) => isChildCareer(c));
    }, [selectedCareers]);

    const hasChildTargets = selectedChildCareers.length > 0;

    // Get available "From:" options - all interviews where candidate has an entry
    const fromOptions = useMemo(() => {
        if (!hasChildTargets || candidateInterviews.length === 0) return [];
        return candidateInterviews;
    }, [hasChildTargets, candidateInterviews]);

    // Filter from options by search and limit to 3
    const filteredFromOptions = useMemo(() => {
        let filtered = fromOptions;
        if (fromSearch.trim()) {
            const searchLower = fromSearch.toLowerCase();
            filtered = fromOptions.filter((opt) =>
                opt.jobTitle.toLowerCase().includes(searchLower)
            );
        }
        return filtered.slice(0, 3);
    }, [fromOptions, fromSearch]);

    const handleSelectFrom = (interview: CandidateInterview) => {
        setSelectedFromCareerId(interview.id);
        setSelectedFromInterviewId(interview._id);
        setSelectedFromCareerTitle(interview.jobTitle);
    };

    // "From:" is required when there are child targets, no source career was provided, and source is not implicit
    const needsFromSelection = !sourceCareerIsImplicit && hasChildTargets && !sourceCareer;
    const isFromValid = !needsFromSelection || (needsFromSelection && selectedFromCareerId);

    const isOkEnabled = selectedCareers.length > 0 && 
        selectedCareers.every((c) => !isCareerExcluded(c)) &&
        isFromValid;

    const handleOk = () => {
        if (isOkEnabled && onOk) {
            onOk({ 
                selectedCareers,
                sourceCareerIdOverride: selectedFromCareerId || undefined,
                sourceInterviewIdOverride: selectedFromInterviewId || undefined,
                forceTransfer: sourceCareerIsImplicit || undefined,
            });
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="modal-background fade-in-bottom"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="modal-container">
                <div className={styles.modalContent}>
                    <div className={styles.header}>
                        <div className={styles.headerLeft}>
                            <div className={styles.headerIcon}>
                                <i className="la la-briefcase"></i>
                            </div>
                            <div className={styles.headerText}>
                                <h3 className={styles.headerTitle}>Invite to a Job</h3>
                                {candidate && (
                                    <p className={styles.headerSubtitle}>
                                        {candidate.name || candidate.email}
                                    </p>
                                )}
                            </div>
                        </div>
                        <button onClick={onClose} className={styles.closeButton}>
                            <i className="la la-times"></i>
                        </button>
                    </div>

                    <div className={`table-search-bar ${styles.searchBar}`}>
                        <div className="icon mr-2">
                            <i className="la la-search"></i>
                        </div>
                        <input
                            type="search"
                            className="form-control ml-auto search-input"
                            placeholder="Search for a job..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className={styles.careersList}>
                        {loading ? (
                            <div className={styles.loadingContainer}>
                                {[...Array(5)].map((_, i) => (
                                    <div
                                        key={i}
                                        className={`skeleton-bar ${styles.skeletonItem}`}
                                    />
                                ))}
                            </div>
                        ) : careers.length === 0 && selectedCareers.length === 0 ? (
                            <div className={styles.emptyState}>
                                <i className="la la-briefcase"></i>
                                <p>
                                    {debouncedSearch
                                        ? "No jobs found"
                                        : "No available jobs"}
                                </p>
                            </div>
                        ) : (
                            <ul className={styles.careersListInner}>
                                {selectedCareers.length > 0 && (
                                    <>
                                        <li className={styles.sectionHeader}>
                                            Selected ({selectedCareers.length})
                                        </li>
                                        {selectedCareers.map((career) => {
                                            const isExcluded = isCareerExcluded(career);

                                            const itemClasses = [
                                                styles.careerItem,
                                                styles.careerItemSelected,
                                                isExcluded && styles.careerItemExcluded,
                                            ]
                                                .filter(Boolean)
                                                .join(" ");

                                            return (
                                                <li
                                                    key={`selected-${career._id}`}
                                                    className={itemClasses}
                                                    onClick={() => {
                                                        if (!isExcluded) {
                                                            toggleCareerSelection(career);
                                                        }
                                                    }}
                                                >
                                                    <div className={styles.careerItemLeft}>
                                                        <div className={`${styles.checkbox} ${styles.checkboxSelected}`}>
                                                            <i className="la la-check" />
                                                        </div>
                                                        <div className={styles.careerInfo}>
                                                            <p className={styles.careerTitle}>
                                                                {career.jobTitle}
                                                            </p>
                                                            <div className={styles.careerMeta}>
                                                                {(career as any).projectName && (
                                                                    <span className={styles.projectName}>
                                                                        {(career as any).projectName}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <CareerStatusBadges career={career} exclude={["Subscription Plan"]} />
                                                    <button
                                                        className={styles.removeButton}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleCareerSelection(career);
                                                        }}
                                                    >
                                                        <i className="la la-times" />
                                                    </button>
                                                </li>
                                            );
                                        })}
                                        {careers.filter((c) => !selectedCareerIds.includes(c._id)).length > 0 && (
                                            <li className={styles.sectionHeader}>
                                                Available Jobs
                                            </li>
                                        )}
                                    </>
                                )}
                                {careers.filter((c) => !selectedCareerIds.includes(c._id)).map((career) => {
                                    const isExcluded = isCareerExcluded(career);
                                    const isSelected = selectedCareerIds.includes(career._id);

                                    const itemClasses = [
                                        styles.careerItem,
                                        isSelected && styles.careerItemSelected,
                                        isExcluded && styles.careerItemExcluded,
                                    ]
                                        .filter(Boolean)
                                        .join(" ");

                                    const checkboxClasses = [
                                        styles.checkbox,
                                        isSelected && styles.checkboxSelected,
                                    ]
                                        .filter(Boolean)
                                        .join(" ");

                                    return (
                                        <li
                                            key={career._id}
                                            className={itemClasses}
                                            onClick={() => {
                                                if (!isExcluded) {
                                                    toggleCareerSelection(career);
                                                }
                                            }}
                                        >
                                            <div className={styles.careerItemLeft}>
                                                <div className={checkboxClasses}>
                                                    {isSelected && (
                                                        <i className="la la-check" />
                                                    )}
                                                </div>
                                                <div className={styles.careerInfo}>
                                                    <p className={styles.careerTitle}>
                                                        {career.jobTitle}
                                                    </p>
                                                    <div className={styles.careerMeta}>
                                                        {(career as any).projectName && (
                                                            <span className={styles.projectName}>
                                                                {(career as any).projectName}
                                                            </span>
                                                        )}
                                                        {career.interviewsInProgress !==
                                                            undefined && (
                                                            <span className={styles.careerProgress}>
                                                                {career.interviewsInProgress} in
                                                                progress
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={styles.careerItemRight}>
                                                <CareerStatusBadges career={career} exclude={["Subscription Plan"]} />
                                                {isExcluded && (
                                                    <span className={styles.excludedBadge}>
                                                        Already applied
                                                    </span>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        {!loading && page < totalPages && (
                            <div className={styles.loadMoreContainer}>
                                <button
                                    onClick={handleLoadMore}
                                    disabled={loadingMore}
                                    className={styles.loadMoreButton}
                                >
                                    {loadingMore ? "Loading..." : "Load more"}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* "From:" selection for child career targets */}
                    {needsFromSelection && selectedCareers.length > 0 && (
                        <div className={styles.fromSection}>
                            <div className={styles.fromHeader}>
                                <div className={styles.fromLabel}>
                                    <span>Transfer data from:</span>
                                    <span className={styles.required}>*</span>
                                </div>
                                <p className={styles.fromHelperText}>
									                You are inviting an applicant to a child post.{" "}
                                  CV Screening and AI Interview results will be copied from the selected career post.
                                </p>
                            </div>
                            {loadingInterviews ? (
                                <div className={styles.fromLoading}>
                                    <i className="la la-spinner la-spin" /> Loading...
                                </div>
                            ) : fromOptions.length === 0 ? (
                                <div className={styles.fromEmpty}>
                                    No existing applications found. The candidate must have an application in another job to transfer data from.
                                </div>
                            ) : (
                                <>
                                    {/* Selected from career */}
                                    {selectedFromCareerId && (
                                        <div className={styles.fromSelected}>
                                            <div className={styles.fromSelectedInfo}>
                                                <div className={styles.fromSelectedRadio}>
                                                    <div className={styles.fromSelectedRadioInner} />
                                                </div>
                                                <span>{selectedFromCareerTitle}</span>
                                            </div>
                                            <button
                                                type="button"
                                                className={styles.fromClearButton}
                                                onClick={() => {
                                                    setSelectedFromCareerId(null);
                                                    setSelectedFromInterviewId(null);
                                                    setSelectedFromCareerTitle(null);
                                                }}
                                            >
                                                <i className="la la-times" />
                                            </button>
                                        </div>
                                    )}
                                    
                                    {/* Search and list */}
                                    {!selectedFromCareerId && (
                                        <>
                                            <div className={styles.fromSearchBar}>
                                                <i className="la la-search" />
                                                <input
                                                    type="text"
                                                    placeholder="Search for a job..."
                                                    value={fromSearch}
                                                    onChange={(e) => setFromSearch(e.target.value)}
                                                />
                                            </div>
                                            <ul className={styles.fromList}>
                                                {filteredFromOptions.length === 0 ? (
                                                    <li className={styles.fromListEmpty}>
                                                        No matching jobs found
                                                    </li>
                                                ) : (
                                                    filteredFromOptions.map((interview) => (
                                                        <li
                                                            key={interview._id}
                                                            className={styles.fromListItem}
                                                            onClick={() => handleSelectFrom(interview)}
                                                        >
                                                            <div className={styles.fromRadio} />
                                                            <span>{interview.jobTitle}</span>
                                                        </li>
                                                    ))
                                                )}
                                            </ul>
                                            {fromOptions.length > 3 && !fromSearch && (
                                                <p className={styles.fromMoreHint}>
                                                    Showing 3 of {fromOptions.length} jobs. Search to find more.
                                                </p>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    <div className={styles.footer}>
                        <button onClick={onClose} className={styles.cancelButton}>
                            Cancel
                        </button>
                        <button
                            onClick={handleOk}
                            disabled={!isOkEnabled}
                            className={styles.okButton}
                        >
                            {selectedCareers.length > 0
                                ? `OK (${selectedCareers.length} selected)`
                                : "OK"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
