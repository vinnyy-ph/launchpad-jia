"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppContext } from "@/lib/context/AppContext";
import { api } from "@/lib/utils/apiClient";
import styles from "@/lib/styles/components/invite-to-job-modal.module.scss";
import { successToast, errorToast } from "@/lib/Utils";
import Button from "@/lib/components/ui/button/Button";
import BulkCandidateActionModal from "./BulkCandidateActionModal";

interface Candidate {
  email: string;
  name?: string;
  image?: string;
}

interface InviteCandidatesToJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  career: {
    _id: string;
    id: string;
    jobTitle: string;
  };
  onInviteComplete?: (
    candidates: Candidate[],
    automationIdsToUse: string[]
  ) => void;
}

export default function InviteCandidatesToJobModal({
  isOpen,
  onClose,
  career,
  onInviteComplete,
}: InviteCandidatesToJobModalProps) {
  const { orgID, user } = useAppContext();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidatesMap, setSelectedCandidatesMap] = useState<Map<string, Candidate>>(new Map());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);

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

  const fetchCandidates = useCallback(async (currentPage: number, isLoadMore = false) => {
    if (!orgID || !user?.email || !career?.id) return;

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
        excludeCareerIds: career.id,
        includeCvData: "0",
        includeInterviews: "0",
      });

      if (debouncedSearch) {
        const filters = {
          candidateNames: [debouncedSearch]
        };
        params.set("filters", encodeURIComponent(JSON.stringify(filters)));
      }

      const response = await api.get(`/api/get-candidates?${params.toString()}`);

      if (response.status === 200) {
        const fetchedCandidates = response.data.candidates || [];
        if (isLoadMore) {
          setCandidates((prev) => [...prev, ...fetchedCandidates]);
        } else {
          setCandidates(fetchedCandidates);
        }
        setTotalPages(response.data.totalPages || 1);
      }
    } catch (error) {
      console.error("Failed to fetch candidates:", error);
      errorToast("Failed to load candidates", 1300);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [orgID, user?.email, debouncedSearch, career?.id]);

  useEffect(() => {
    if (isOpen) {
      fetchCandidates(page, page > 1);
    }
  }, [isOpen, debouncedSearch, page, fetchCandidates]);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setDebouncedSearch("");
      setPage(1);
      setCandidates([]);
      setSelectedCandidatesMap(new Map());
      setLoading(true);
    }
  }, [isOpen]);

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      setPage((prev) => prev + 1);
    }
  };

  const toggleCandidateSelection = (candidate: Candidate) => {
    setSelectedCandidatesMap((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(candidate.email)) {
        newMap.delete(candidate.email);
      } else {
        newMap.set(candidate.email, candidate);
      }
      return newMap;
    });
  };

  const selectedCandidates = Array.from(selectedCandidatesMap.values());
  const selectedEmails = Array.from(selectedCandidatesMap.keys());

  const handleNext = () => {
    if (selectedCandidates.length === 0 || !user) return;
    setShowActionModal(true);
  };

  const handleActionComplete = (
    action: string,
    data: { automationIdsToUse: string[] }
  ) => {
    setShowActionModal(false);
    if (action === "invite" && onInviteComplete) {
      onInviteComplete(selectedCandidates, data.automationIdsToUse);
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
                <i className="la la-user-plus"></i>
                            </div>
              <div className={styles.headerText}>
                <h3 className={styles.headerTitle}>Invite Candidates</h3>
                <p className={styles.headerSubtitle}>
                  {career.jobTitle}
                </p>
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
              placeholder="Search for candidates..."
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
            ) : candidates.length === 0 && selectedCandidates.length === 0 ? (
              <div className={styles.emptyState}>
                <i className="la la-users"></i>
                <p>
                  {debouncedSearch
                    ? "No candidates found"
                    : "No available candidates"}
                </p>
              </div>
            ) : (
              <ul className={styles.careersListInner}>
                {selectedCandidates.length > 0 && (
                  <>
                    <li className={styles.sectionHeader}>
                      Selected ({selectedCandidates.length})
                    </li>
                    {selectedCandidates.map((candidate) => (
                      <li
                        key={`selected-${candidate.email}`}
                        className={`${styles.careerItem} ${styles.careerItemSelected}`}
                        onClick={() => toggleCandidateSelection(candidate)}
                      >
                        <div className={styles.careerItemLeft}>
                          <div className={`${styles.checkbox} ${styles.checkboxSelected}`}>
                            <i className="la la-check" />
                          </div>
                          <div className={styles.careerInfo}>
                            <p className={styles.careerTitle}>
                              {candidate.name || candidate.email}
                            </p>
                            <div className={styles.careerMeta}>
                              <span className={styles.careerProgress}>
                                {candidate.email}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          className={styles.removeButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCandidateSelection(candidate);
                          }}
                        >
                          <i className="la la-times" />
                        </button>
                      </li>
                    ))}
                        {candidates.filter((c) => !selectedEmails.includes(c.email)).length > 0 && (
                          <li className={styles.sectionHeader}>
                            Available Candidates
                          </li>
                        )}
                      </>
                    )}
                    {candidates.filter((c) => !selectedEmails.includes(c.email)).map((candidate) => {
                      const isSelected = selectedEmails.includes(candidate.email);

                      const itemClasses = [
                        styles.careerItem,
                        isSelected && styles.careerItemSelected,
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
                          key={candidate.email}
                          className={itemClasses}
                          onClick={() => toggleCandidateSelection(candidate)}
                        >
                          <div className={styles.careerItemLeft}>
                            <div className={checkboxClasses}>
                              {isSelected && (
                                <i className="la la-check" />
                              )}
                            </div>
                            <div className={styles.careerInfo}>
                              <p className={styles.careerTitle}>
                                {candidate.name || candidate.email}
                              </p>
                              <div className={styles.careerMeta}>
                                <span className={styles.careerProgress}>
                                  {candidate.email}
                                </span>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
            )}

            {!loading && page < totalPages && (
              <div className={styles.loadMoreContainer}>
                <Button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  label={loadingMore ? "Loading..." : "Load more"}
                  variant="secondary"
                />
              </div>
            )}
          </div>

          <div className={styles.footer}>
            <Button
              onClick={onClose}
              label="Cancel"
              variant="secondary"
            />
            <Button
              onClick={handleNext}
              disabled={selectedCandidates.length === 0}
              label={selectedCandidates.length > 0 ? `Next (${selectedCandidates.length})` : "Next"}
              variant="primary"
            />
          </div>
        </div>
      </div>

      {/* Bulk Action Modal - Stacked on top */}
      <BulkCandidateActionModal
        isOpen={showActionModal}
        onClose={() => setShowActionModal(false)}
        candidates={selectedCandidates}
        career={career}
        onAction={handleActionComplete}
        orgID={orgID || ""}
        user={user}
      />
    </div>
  );
}
