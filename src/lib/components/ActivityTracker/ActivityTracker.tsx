"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import styles from "./activityTracker.module.scss";
import ActivityPreview from "./ActivityPreview";
import SkeletonActivityPreview from "./SkeletonActivityPreview";
import { api } from "@/lib/utils/apiClient";
import { Button } from "../ui";

interface ActivityTrackerProps {
  orgID?: string;
  candidate?: {
    email?: string;
    name?: string;
    id?: string;
    _id?: string;
    candidateId?: string;
    interviewUID?: string;
  } | null;
  career?:
    | {
        _id?: string;
        id?: string;
        jobTitle?: string;
        title?: string;
        name?: string;
      }
    | Array<{
        _id?: string;
        id?: string;
        jobTitle?: string;
        title?: string;
        name?: string;
      }>
    | null;
}

interface ActivityItem {
  _id: string;
  orgID: string;
  careerId?: string;
  candidateId?: string;
  interviewUID?: string;
  action: string;
  source?: string;
  actor?: {
    type?: string;
    id?: string;
    email?: string;
    name?: string;
  };
  metadata?: Record<string, any>;
  occurredAt?: string | Date;
  createdAt?: string | Date;
}

export default function ActivityTracker({
  career,
  candidate,
  orgID,
}: ActivityTrackerProps) {
  const [candidateCareerLabels, setCandidateCareerLabels] = useState<string[]>(
    [],
  );
  const [candidateCareerIdMap, setCandidateCareerIdMap] = useState<
    Record<string, string[]>
  >({});
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSyncing, setIsSyncing] = useState(false);
  const itemsPerPage = 10;

  const passedCareers = useMemo(
    () =>
      Array.isArray(career) ? career.filter(Boolean) : career ? [career] : [],
    [career],
  );

  const careerLabels = useMemo(
    () =>
      passedCareers
        .map((item) => item?.jobTitle || item?.title || item?.name)
        .filter(Boolean) as string[],
    [passedCareers],
  );

  const careerIds = useMemo(
    () =>
      passedCareers
        .map((item) =>
          item?._id != null ? String(item._id) : item?.id
        )
        .filter(Boolean) as string[],
    [passedCareers],
  );

  const allCareerIds = useMemo(
    () =>
      Array.from(
        new Set(
          passedCareers
            .flatMap((item) => [item?.id, item?._id])
            .filter(Boolean)
        )
      ) as string[],
    [passedCareers],
  );

  const uniqueCareerLabels = useMemo(
    () => Array.from(new Set(careerLabels)),
    [careerLabels],
  );

  const uniqueCandidateCareerLabels = useMemo(
    () => Array.from(new Set(candidateCareerLabels)),
    [candidateCareerLabels],
  );

  const resolvedCandidateFilterId = useMemo(() => {
    if (!candidate) {
      return undefined;
    }

    const asString = (value?: string) =>
      typeof value === "string" ? value.trim() : "";

    // Prefer actual interview/applicant identifiers over `id` (which is often career id in interview objects)
    const preferred =
      asString(candidate.candidateId) ||
      asString(candidate._id) ||
      asString(candidate.interviewUID);

    if (preferred) {
      return preferred;
    }

    const fallbackId = asString(candidate.id);
    if (!fallbackId) {
      return undefined;
    }

    // Guard: if fallback id equals the current career id, it is not a candidate id
    if (careerIds.includes(fallbackId)) {
      return undefined;
    }

    return fallbackId;
  }, [candidate, careerIds]);

  const shouldUseCandidateCareers = uniqueCandidateCareerLabels.length > 0;

  const filterOptions = useMemo(() => {
    if (shouldUseCandidateCareers) {
      return ["All careers", ...uniqueCandidateCareerLabels];
    }

    if (uniqueCareerLabels.length > 1) {
      return ["All careers", ...uniqueCareerLabels];
    }

    if (uniqueCareerLabels.length === 1) {
      return [uniqueCareerLabels[0]];
    }

    return ["All careers"];
  }, [
    shouldUseCandidateCareers,
    uniqueCandidateCareerLabels,
    uniqueCareerLabels,
  ]);

  const shouldShowDropdown =
    shouldUseCandidateCareers || uniqueCareerLabels.length !== 1;

  const hasSingleCareer = careerLabels.length === 1;

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState("All careers");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch candidate's applied careers
  useEffect(() => {
    const fetchCandidateCareers = async () => {
      if (!candidate?.email || !orgID) {
        setCandidateCareerLabels([]);
        setCandidateCareerIdMap({});
        return;
      }

      try {
        const response = await api.get("/api/get-candidate-interviews", {
          params: {
            candidateEmail: candidate.email,
            orgID,
          },
        });

        const interviews = Array.isArray(response?.data) ? response.data : [];
        const idMap: Record<string, Set<string>> = {};

        interviews.forEach((interview: any) => {
          const label =
            interview?.jobTitle || interview?.careerTitle || interview?.title;
          if (!label || typeof label !== "string") {
            return;
          }

          if (!idMap[label]) {
            idMap[label] = new Set<string>();
          }

          const possibleIds = [
            interview?.careerId,
            interview?.careerID,
            interview?.career?._id,
            interview?.career?.id,
            interview?.id,
          ];

          possibleIds.forEach((value) => {
            if (typeof value === "string" && value.trim()) {
              idMap[label].add(value.trim());
            }
          });
        });

        const normalizedMap = Object.fromEntries(
          Object.entries(idMap).map(([label, ids]) => [label, Array.from(ids)]),
        );

        setCandidateCareerIdMap(normalizedMap);
        setCandidateCareerLabels(Object.keys(normalizedMap));
      } catch (error) {
        setCandidateCareerLabels([]);
        setCandidateCareerIdMap({});
      }
    };

    fetchCandidateCareers();
  }, [candidate?.email, orgID]);

  // Fetch activities whenever orgID, career, or candidate changes
  const fetchActivities = async () => {
    if (!orgID) {
      setActivities([]);
      setIsLoadingActivities(false);
      return;
    }

    setIsLoadingActivities(true);
    try {
      const params: any = {
        orgID,
        limit: 50,
      };

      // Candidate views should include all activities for the candidate across applications.
      // Prefer email scope, fallback to candidateId when email is unavailable.
      if (candidate?.email) {
        params.candidateEmail = candidate.email;
      } else if (resolvedCandidateFilterId) {
        params.candidateId = resolvedCandidateFilterId;
      }

      // Add career filter only when candidate filter is not present.
      // Candidate views (modal/interview-analysis) may pass a different career identifier format,
      // and candidateId alone is the most reliable scope for activity history.
      if (
        !candidate?.email &&
        !resolvedCandidateFilterId &&
        careerIds.length === 1
      ) {
        params.careerId = careerIds[0];
      }

      const response = await api.get("/api/activity-history", { params });
      const items = response?.data?.items;

      if (Array.isArray(items)) {
        setActivities(items);
        setCurrentPage(1);
      } else {
        setActivities([]);
      }
    } catch (error) {
      console.error("Error fetching activities:", error);
      setActivities([]);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    await fetchActivities();
    setIsSyncing(false);
  };

  // Fetch activities whenever orgID, career, or candidate changes
  const activityFetchDeps = [
    orgID,
    careerIds.join(","),
    resolvedCandidateFilterId,
    candidate?.email,
  ];

  useEffect(() => {
    fetchActivities();
  }, [orgID, careerIds, resolvedCandidateFilterId, candidate?.email]);

  useEffect(() => {
    if (!shouldShowDropdown && hasSingleCareer) {
      setSelectedOption(uniqueCareerLabels[0]);
      return;
    }

    if (
      shouldShowDropdown &&
      selectedOption !== "All careers" &&
      filterOptions.length === 1 &&
      filterOptions[0] === "All careers"
    ) {
      setSelectedOption("All careers");
      return;
    }

    if (!filterOptions.includes(selectedOption)) {
      setSelectedOption("All careers");
    }
  }, [
    shouldShowDropdown,
    hasSingleCareer,
    uniqueCareerLabels,
    filterOptions,
    selectedOption,
  ]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleOptionClick = (option: string) => {
    setSelectedOption(option);
    setIsDropdownOpen(false);
  };

  const selectedCareerId = useMemo(() => {
    if (!selectedOption || selectedOption === "All careers") {
      return undefined;
    }

    const selectedCareer = passedCareers.find((item) => {
      const label = item?.jobTitle || item?.title || item?.name;
      return label === selectedOption;
    });

    return selectedCareer?.id || selectedCareer?._id;
  }, [selectedOption, passedCareers]);

  const selectedCandidateCareerIds = useMemo(() => {
    if (!selectedOption || selectedOption === "All careers") {
      return [] as string[];
    }

    return (candidateCareerIdMap[selectedOption] || [])
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter(Boolean);
  }, [selectedOption, candidateCareerIdMap]);

  const resolveActivityType = (
    activity: ActivityItem,
  ): "default" | "trigger" | "comment" | "file" => {
    const action = String(activity?.action || "").toLowerCase();
    const source = String(activity?.source || "").toLowerCase();

    if (
      action.includes("endorse") ||
      action.includes("drop") ||
      action.includes("reconsider") ||
      action.includes("reset") ||
      source === "automation"
    ) {
      return "trigger";
    }

    return "default";
  };

  const displayedActivities = useMemo(() => {
    if (selectedOption === "All careers") {
      return activities;
    }

    const normalizedSelected = selectedOption.toLowerCase().trim();

    return activities.filter((activity) => {
      const activityCareerId =
        typeof activity.careerId === "string" ? activity.careerId.trim() : "";
      const activityCareerLabel =
        activity.metadata?.jobTitle || activity.metadata?.careerTitle || "";
      const metadataCareerId =
        activity.metadata?.careerId ||
        activity.metadata?.careerID ||
        activity.metadata?.career?._id ||
        activity.metadata?.career?.id ||
        "";
      const normalizedActivityCareerId =
        typeof activityCareerId === "string" ? activityCareerId.trim() : "";

      if (
        selectedCareerId &&
        normalizedActivityCareerId &&
        allCareerIds.includes(normalizedActivityCareerId)
      ) {
        return true;
      }

      if (selectedCandidateCareerIds.length > 0) {
        if (
          normalizedActivityCareerId &&
          selectedCandidateCareerIds.includes(normalizedActivityCareerId)
        ) {
          return true;
        }

        if (
          typeof metadataCareerId === "string" &&
          metadataCareerId.trim() &&
          selectedCandidateCareerIds.includes(metadataCareerId.trim())
        ) {
          return true;
        }
      }

      if (
        typeof activityCareerLabel === "string" &&
        activityCareerLabel.trim()
      ) {
        return activityCareerLabel.toLowerCase().trim() === normalizedSelected;
      }

      return false;
    });
  }, [
    activities,
    selectedOption,
    selectedCareerId,
    selectedCandidateCareerIds,
    allCareerIds,
  ]);

  const totalPages = Math.ceil(displayedActivities.length / itemsPerPage);
  const paginatedActivities = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    return displayedActivities.slice(startIdx, endIdx);
  }, [displayedActivities, currentPage, itemsPerPage]);

  return (
    <div className={styles.trackerContainer}>
      {/* Header */}
      <div className={styles.trackerHeader}>
        <span className={styles.trackerTitle}>Activities</span>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Button
            variant="secondary"
            label={isSyncing ? "Syncing..." : "Sync"}
            onClick={handleSync}
          />

          {!shouldShowDropdown && hasSingleCareer ? (
            <div className={`${styles.trackerFilter} ${styles.staticFilter}`}>
              <span>Show activities on: {uniqueCareerLabels[0]}</span>
            </div>
          ) : (
            <div className={styles.filterWrapper} ref={dropdownRef}>
              <div
                className={styles.trackerFilter}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span>Show activities on: {selectedOption}</span>
                <img
                  src="/icons/chevron-down.svg"
                  alt="dropdown"
                  style={{
                    transform: isDropdownOpen
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                  }}
                />
              </div>

              {isDropdownOpen && (
                <div className={styles.dropdownPopup}>
                  {filterOptions.map((option) => (
                    <div
                      key={option}
                      className={`${styles.dropdownOption} ${selectedOption === option ? styles.selected : ""}`}
                      onClick={() => handleOptionClick(option)}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={styles.trackerContent}>
        {isLoadingActivities ? (
          <>
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonActivityPreview
                key={`skeleton-${index}`}
                isLast={index === 4}
              />
            ))}
          </>
        ) : paginatedActivities.length > 0 ? (
          <>
            {paginatedActivities.map((activity, index) => (
              <ActivityPreview
                key={activity._id}
                activity={activity}
                activityType={resolveActivityType(activity)}
                isLast={index === paginatedActivities.length - 1}
                career={
                  selectedOption !== "All careers"
                    ? selectedOption
                    : activity.metadata?.jobTitle || careerLabels[0] || undefined
                }
                candidate={
                  candidate
                    ? selectedOption !== "All careers"
                      ? selectedOption
                      : activity.metadata?.jobTitle || careerLabels[0] || "Application"
                    : undefined
                }
              />
            ))}
          </>
        ) : (
          <div style={{ padding: "20px", textAlign: "center", color: "#999" }}>
            No activities yet
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {displayedActivities.length > itemsPerPage && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <Button
            variant="secondary"
            label="Previous"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          />
          <span style={{ fontSize: "13px", color: "#666" }}>
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="secondary"
            label="Next"
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
          />
        </div>
      )}
    </div>
  );
}
