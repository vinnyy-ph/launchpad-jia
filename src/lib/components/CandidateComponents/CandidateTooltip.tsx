// Candidate tooltip

"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { SkillTag } from "./SkillTag";
import { SkillEndorsementTooltip } from "./SkillEndorsementTooltip";
import { api } from "@/lib/utils/apiClient";
import AvatarImage from "../AvatarImage/AvatarImage";
import { useAppContext } from "@/lib/context/AppContext"; // For user info
import CandidateToolTipComment from "./CandidateToolTipComment"; // Extracted comments component
import {
  triggerLazyExtraction,
  type TooltipData,
} from "./candidateTooltipDataCache";
import { errorToast } from "@/lib/Utils";

// Skeleton loader component
const Skeleton = ({
  width,
  height = 20,
  borderRadius = 4,
  style = {},
}: {
  width: string | number;
  height?: number;
  borderRadius?: number;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      width,
      height,
      borderRadius,
      background:
        "linear-gradient(90deg, #E5E7EB 25%, #F3F4F6 50%, #E5E7EB 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s ease-in-out infinite",
      ...style,
    }}
  />
);

// Inject keyframes for shimmer animation
if (
  typeof document !== "undefined" &&
  !document.getElementById("tooltip-skeleton-styles")
) {
  const style = document.createElement("style");
  style.id = "tooltip-skeleton-styles";
  style.textContent = `@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`;
  document.head.appendChild(style);
}

// Skeleton pill for contact details
const SkeletonPill = () => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 12px",
      borderRadius: "20px",
      backgroundColor: "#F3F4F6",
      border: "1px solid #E5E7EB",
    }}
  >
    <Skeleton width={16} height={16} borderRadius={4} />
    <Skeleton width={80} height={14} borderRadius={4} />
  </div>
);

// Skeleton for skill tags
const SkeletonSkillTag = ({ width }: { width: number }) => (
  <Skeleton width={width} height={28} borderRadius={14} />
);

// Skeleton for application item
const SkeletonApplicationItem = () => (
  <div style={{ padding: "8px 0" }}>
    <Skeleton
      width="60%"
      height={16}
      borderRadius={4}
      style={{ marginBottom: 8 }}
    />
    <div style={{ display: "flex", gap: 12 }}>
      <Skeleton width={60} height={12} borderRadius={4} />
      <Skeleton width={70} height={12} borderRadius={4} />
    </div>
  </div>
);

interface CandidateTooltipProps {
  candidateInfo: any;
  candidate: any;
  candidateProfile?: any;
  otherApplications?: any[];
  orgID: string;
  currentUser?: { email?: string; name?: string; image?: string }; // Added currentUser prop
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onEmailClick?: () => void;
  prefetchedData?: TooltipData | null;
  onLockChange?: (locked: boolean) => void; // Lock tooltip open when comments are shown
  onClose?: () => void; // Close the entire tooltip
}

export default function CandidateTooltip({
  candidateInfo,
  candidate,
  candidateProfile: externalCandidateProfile,
  otherApplications: externalOtherApplications,
  orgID,
  currentUser, // Accept currentUser as prop
  onMouseEnter,
  onMouseLeave,
  onEmailClick,
  prefetchedData,
  onLockChange,
  onClose,
}: CandidateTooltipProps) {
  const appCtx = useAppContext?.() as any; // Get user from context if not provided
  const contextUser =
    appCtx?.user || appCtx?.currentUser || appCtx?.session?.user || null; // Fallback to context user
  const [skillsEndorsements, setSkillsEndorsements] = useState<{
    [key: string]: any[];
  }>(prefetchedData?.endorsements || {});
  const [internalCandidateProfile, setInternalCandidateProfile] = useState<any>(
    externalCandidateProfile || prefetchedData?.profile || null
  );
  const [internalOtherApplications, setInternalOtherApplications] = useState<
    any[]
  >(externalOtherApplications || prefetchedData?.otherApplications || []);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingEndorsements, setIsLoadingEndorsements] = useState(false);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [orgCandidateSkills, setOrgCandidateSkills] = useState<string[] | null>(
    prefetchedData?.orgSkills || null
  );

  // Use prefetched data when available
  const hasPrefetchedData = prefetchedData?.ready === true;
  // Data is ready if prefetched OR if internal profile was loaded (for direct usage without prefetch)
  const isDataReady =
    hasPrefetchedData ||
    (internalCandidateProfile !== null && !isLoadingProfile);
  const [endorsementRefreshToken, setEndorsementRefreshToken] = useState(0);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false); // Controls comments section visibility

  // Notify parent when comments are opened/closed to lock tooltip
  useEffect(() => {
    onLockChange?.(isCommentsOpen);
  }, [isCommentsOpen, onLockChange]);
  const [selectedApplicationId, setSelectedApplicationId] = useState<
    string | null
  >(null); // Selected application for comments
  const [commentViewFilter, setCommentViewFilter] = useState<string>("all"); // 'all' or application id
  const [newCommentCount, setNewCommentCount] = useState<number>(0); // New (unread) comments
  const [totalCommentCount, setTotalCommentCount] = useState<number>(0);
  const [hoveredSkillIndex, setHoveredSkillIndex] = useState<number | null>(
    null
  );

  const candidateProfile =
    internalCandidateProfile || externalCandidateProfile || {};
  const otherApplications =
    externalOtherApplications !== undefined
      ? externalOtherApplications
      : internalOtherApplications;

  useEffect(() => {
    if (!prefetchedData?.ready) return;
    setSkillsEndorsements(prefetchedData?.endorsements || {});
    if (!externalCandidateProfile) {
      setInternalCandidateProfile(prefetchedData?.profile || null);
    }
    if (externalOtherApplications === undefined) {
      setInternalOtherApplications(prefetchedData?.otherApplications || []);
    }
    setOrgCandidateSkills(prefetchedData?.orgSkills || null);
  }, [prefetchedData, externalCandidateProfile, externalOtherApplications]);

  // Poll for skills when empty but candidate has CV (AI extraction in progress)
  useEffect(() => {
    const profile = internalCandidateProfile || externalCandidateProfile;
    const hasCV = profile?.hasCV;
    const skillsEmpty = !orgCandidateSkills || orgCandidateSkills.length === 0;
    const email = candidateInfo?.email || candidate?.email;

    if (!isDataReady || !hasCV || !skillsEmpty || !email || !orgID) {
      return;
    }

    // Poll for skills every 2 seconds, up to 5 times
    let pollCount = 0;
    const maxPolls = 5;

    const pollForSkills = async () => {
      try {
        const response = await api.get(
          `/api/get-org-candidate-skills?candidateEmail=${encodeURIComponent(
            email
          )}&orgID=${encodeURIComponent(orgID)}`
        );
        const items = response?.data?.items || [];
        const skills = items
          .map((item: any) => item.skillName)
          .filter((s: string) => !!s);

        if (skills.length > 0) {
          setOrgCandidateSkills(skills);
          return true; // Stop polling
        }
      } catch (err) {
        console.debug("Error polling for skills:", err);
      }
      return false;
    };

    const intervalId = setInterval(async () => {
      pollCount++;
      const found = await pollForSkills();
      if (found || pollCount >= maxPolls) {
        clearInterval(intervalId);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [
    isDataReady,
    orgCandidateSkills,
    internalCandidateProfile,
    externalCandidateProfile,
    candidateInfo?.email,
    candidate?.email,
    orgID,
  ]);

  // Compute candidateEmail early for effects below
  const candidateEmail =
    candidateInfo?.email || candidateProfile?.email || candidate?.email;

  // Compute application options for comment filtering/composer
  const applicationOptions = useMemo(() => {
    const currentId =
      candidate?.id ||
      candidate?.careerId ||
      candidate?.interviewCareerID ||
      null;
    const currentInterviewID = candidate?.interviewID || null;
    const currentLabel =
      candidate?.jobTitle || candidateInfo?.jobTitle || "Current Application";
    const base: any[] = [];
    // Always include a candidate-level option for comments not tied to any application
    const candidateOption = {
      id: "candidate",
      interviewID: null,
      label: "Candidate",
    } as any;
    if (currentId && currentInterviewID) {
      base.push({
        id: currentId,
        interviewID: currentInterviewID,
        label: currentLabel,
      });
    }
    const extras = Array.isArray(otherApplications)
      ? otherApplications.map((a: any) => ({
          id: a.id,
          interviewID: a.interviewID,
          label: a.jobTitle,
        }))
      : [];
    const merged = [candidateOption, ...base, ...extras];
    // Deduplicate entries by id (or interviewID / label fallback) to avoid duplicate dropdown options
    const seen = new Set<string>();
    const unique = merged.filter((opt) => {
      const key = String(opt?.id ?? opt?.interviewID ?? opt?.label ?? "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return unique;
  }, [candidate, candidateInfo, otherApplications]);

  // Effect: keep selectedApplicationId in sync with available options
  useEffect(() => {
    // Ensure selection stays in sync with available options
    const ids = applicationOptions.map((o) => o.id);
    // Don't override selection when the user has chosen to view 'all' comments or candidate-level
    if (commentViewFilter === "all" || commentViewFilter === "candidate")
      return;
    if (!selectedApplicationId && applicationOptions.length > 0) {
      setSelectedApplicationId(applicationOptions[0].id);
      return;
    }
    if (selectedApplicationId && !ids.includes(selectedApplicationId)) {
      setSelectedApplicationId(applicationOptions[0]?.id || null);
    }
  }, [applicationOptions, selectedApplicationId]);

  // Fetch new comment count for the current application only
  const fetchCommentCount = useCallback(async () => {
    try {
      if (!orgID || !candidateEmail) {
        setNewCommentCount(0);
        return;
      }

      // Only count comments for the current application
      const currentInterviewID = candidate?.interviewID;

      if (!currentInterviewID) {
        setNewCommentCount(0);
        return;
      }

      // Use the new API that tracks read/unread state
      const response = await api.get("/api/applicants/comments/count-new", {
        params: {
          applicantEmail: candidateEmail,
          interviewIDs: currentInterviewID,
          orgID,
        },
      });

      const data = response?.data;
      setNewCommentCount(data?.newCount || 0);
      setTotalCommentCount(data?.totalCount || 0);
    } catch (error) {
      errorToast("Error fetching comment counts.", 2000);
      setNewCommentCount(0);
      setTotalCommentCount(0);
    }
  }, [orgID, candidateEmail, candidate?.interviewID]);

  // Initial fetch of comment count
  useEffect(() => {
    let aborted = false;
    fetchCommentCount();
    return () => {
      aborted = true;
    };
  }, [fetchCommentCount]);

  // Live updates: listen for comment mutations and refresh count
  useEffect(() => {
    function handleCommentsUpdated() {
      fetchCommentCount();
    }
    if (typeof window !== "undefined") {
      window.addEventListener(
        "candidate-comments-updated",
        handleCommentsUpdated as EventListener
      );
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "candidate-comments-updated",
          handleCommentsUpdated as EventListener
        );
      }
    };
  }, [fetchCommentCount]);

  // Listen for comments being viewed in the interview analysis page
  useEffect(() => {
    function handleCommentsViewed() {
      fetchCommentCount();
    }
    if (typeof window !== "undefined") {
      window.addEventListener(
        "candidate-comments-viewed",
        handleCommentsViewed as EventListener
      );
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "candidate-comments-viewed",
          handleCommentsViewed as EventListener
        );
      }
    };
  }, [fetchCommentCount]);

  // Mark comments as viewed when tooltip opens
  useEffect(() => {
    const markCommentsAsViewed = async () => {
      if (!isCommentsOpen || !candidateEmail) return;

      const currentInterviewID = candidate?.interviewID;
      if (!currentInterviewID) return;

      try {
        // Mark comments for the current application as viewed
        await api.post("/api/applicants/comments/mark-viewed", {
          applicantEmail: candidateEmail,
          interviewIDs: [currentInterviewID],
          orgID,
        });

        // Dispatch event to update badge counts elsewhere
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("candidate-comments-viewed"));
        }

        // Refresh counts to update badge
        await fetchCommentCount();
      } catch (error) {
        errorToast("Error marking comments as viewed.", 2000);
      }
    };

    markCommentsAsViewed();
  }, [isCommentsOpen, candidateEmail, fetchCommentCount, candidate?.interviewID]);

  const isSelfFetchingProfile = !externalCandidateProfile && !hasPrefetchedData;
  const isSelfFetchingApplications =
    externalOtherApplications === undefined && !hasPrefetchedData;

  useEffect(() => {
    if (externalCandidateProfile) {
      setInternalCandidateProfile(externalCandidateProfile);
    }
  }, [externalCandidateProfile]);

  useEffect(() => {
    if (externalOtherApplications) {
      setInternalOtherApplications(externalOtherApplications);
    }
  }, [externalOtherApplications]);

  // If parent didn't supply other applications, fetch interviews to populate them
  useEffect(() => {
    if (hasPrefetchedData) return; // data already prefetched
    if (externalOtherApplications !== undefined) return; // parent provided them
    if (!orgID || !candidateEmail) return;

    const controller = new AbortController();
    let mounted = true;

    const fetchInterviews = async () => {
      try {
        setIsLoadingApplications(true);
        const res = await api.get(`/api/get-candidate-interviews`, {
          params: { candidateEmail: candidateEmail, orgID },
          signal: controller.signal,
        });
        const interviews = res?.data || [];
        if (!mounted) return;
        const mapped = (Array.isArray(interviews) ? interviews : []).map(
          (it: any) => {
            const title = it.jobTitle || it.title || "Application";
            return {
              id: it.id || it.careerID || null,
              interviewID: it.interviewID,
              // Keep both `label` and `jobTitle` for compatibility with callers
              label: title,
              jobTitle: title,
              currentStatus:
                it.status || it.applicationStatus || it.currentStep || "",
              daysAgo: it.updatedAt
                ? Math.max(
                    0,
                    Math.floor(
                      (Date.now() - new Date(it.updatedAt).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  )
                : 0,
            };
          }
        );
        setInternalOtherApplications(mapped);
      } catch (err) {
        if (
          (err as any)?.name === "CanceledError" ||
          (err as any)?.name === "AbortError"
        )
          return;
        console.error("Failed to fetch candidate interviews for tooltip:", err);
        setInternalOtherApplications([]);
      } finally {
        if (mounted) setIsLoadingApplications(false);
      }
    };

    fetchInterviews();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [orgID, candidateEmail, externalOtherApplications, hasPrefetchedData]);

  useEffect(() => {
    if (hasPrefetchedData) return; // data already prefetched
    const fetchOrgCandidateSkills = async () => {
      if (!candidateEmail || !orgID) {
        setOrgCandidateSkills(null);
        return;
      }

      try {
        const response = await api.get(
          `/api/get-org-candidate-skills?candidateEmail=${encodeURIComponent(
            candidateEmail
          )}&orgID=${encodeURIComponent(orgID)}`
        );

        const items = response?.data?.items || [];
        const skillsFromMeta = items
          .map((item: any) => item.skillName)
          .filter((skill: string) => !!skill);

        setOrgCandidateSkills(skillsFromMeta);
      } catch (error) {
        console.error("Error loading org candidate skills for tooltip:", error);
        setOrgCandidateSkills(null);
      }
    };
    fetchOrgCandidateSkills();
  }, [candidateEmail, orgID, hasPrefetchedData]);

  // Trigger lazy extraction when self-fetching and skills/contact fields are missing
  useEffect(() => {
    // Only trigger if not using prefetched data (self-fetching mode)
    if (hasPrefetchedData) return;

    // Wait until profile is loaded
    const profile = internalCandidateProfile;
    if (!profile || isLoadingProfile) return;

    // Need orgID and candidateEmail
    if (!orgID || !candidateEmail) return;

    // Check if extraction is needed
    const hasMissingContactFields =
      !profile.phone ||
      !profile.location ||
      !profile.jobTitle ||
      !profile.company;

    const hasMissingSkills =
      !orgCandidateSkills || orgCandidateSkills.length === 0;

    // Trigger extraction if candidate has CV and fields/skills are missing
    if ((hasMissingContactFields || hasMissingSkills) && profile.hasCV) {
      triggerLazyExtraction(candidateEmail, orgID);
    }
  }, [
    hasPrefetchedData,
    internalCandidateProfile,
    isLoadingProfile,
    orgID,
    candidateEmail,
    orgCandidateSkills,
  ]);

  useEffect(() => {
    const handleEndorsementUpdated = (event: Event) => {
      try {
        const customEvent = event as CustomEvent<any>;
        const detail = customEvent.detail || {};

        setEndorsementRefreshToken((prev) => prev + 1);
      } catch {
        setEndorsementRefreshToken((prev) => prev + 1);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener(
        "skill-endorsement-updated",
        handleEndorsementUpdated as EventListener
      );
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "skill-endorsement-updated",
          handleEndorsementUpdated as EventListener
        );
      }
    };
  }, [candidateEmail]);

  useEffect(() => {
    // Skip initial fetch if we have prefetched data, but still allow refresh on endorsementRefreshToken change
    if (hasPrefetchedData && endorsementRefreshToken === 0) return;

    const fetchAllSkillsEndorsements = async () => {
      if (!candidateEmail) {
        setIsLoadingEndorsements(false);
        setSkillsEndorsements({});
        return;
      }

      try {
        setIsLoadingEndorsements(true);

        let url = `/api/get-endorse-skill?candidateEmail=${encodeURIComponent(
          candidateEmail
        )}`;
        if (orgID) {
          url += `&orgID=${encodeURIComponent(orgID)}`;
        }

        const response = await api.get(url);

        const allEndorsements = response?.data?.endorsements || [];
        const endorsementsMap: { [key: string]: any[] } = {};

        for (const endorsement of allEndorsements) {
          const skill = endorsement.skillName;
          if (!skill) continue;

          if (!endorsementsMap[skill]) {
            endorsementsMap[skill] = [];
          }
          endorsementsMap[skill].push(endorsement);
        }

        setSkillsEndorsements(endorsementsMap);
      } catch (error) {
        console.error(
          "Error fetching all skills endorsements for tooltip:",
          error
        );
      } finally {
        setIsLoadingEndorsements(false);
      }
    };

    fetchAllSkillsEndorsements();
  }, [candidateEmail, orgID, endorsementRefreshToken, hasPrefetchedData]);

  useEffect(() => {
    if (hasPrefetchedData) return; // data already prefetched
    const fetchCandidateProfile = async () => {
      if (!candidateEmail || !orgID) return;
      if (externalCandidateProfile || internalCandidateProfile) return;

      try {
        setIsLoadingProfile(true);
        const cvResponse = await api.post(`/api/load-user-cv`, {
          email: candidateEmail,
        });

        const cvData = cvResponse?.data || null;

        // Use database fields directly - no markdown parsing
        const finalPhone = (cvData as any)?.phone || candidate?.phone || null;
        let finalLocation =
          (cvData as any)?.location || candidate?.location || null;
        const finalJobTitle =
          (cvData as any)?.currentPosition || candidate?.jobTitle || null;
        const finalCompany =
          (cvData as any)?.company || candidate?.company || null;

        // Skills are fetched from org-candidate-skills, not parsed from markdown

        // Safety: never show LinkedIn/URL-like location
        if (
          finalLocation &&
          /linkedin|http[s]?:\/\/|www\./i.test(finalLocation)
        ) {
          finalLocation = null;
        }

        setInternalCandidateProfile({
          ...cvData,
          phone: finalPhone,
          location: finalLocation,
          skills: [], // Skills come from org-candidate-skills
          hasCV: !!cvData,
          jobTitle: finalJobTitle,
          company: finalCompany,
        });
      } catch (error) {
        console.error("Error fetching candidate profile for tooltip:", error);
        setInternalCandidateProfile({
          hasCV: false,
          phone: candidate?.phone || null,
          location: candidate?.location || null,
          skills: [],
          jobTitle: candidate?.jobTitle || null,
          company: candidate?.company || null,
        });
      } finally {
        setIsLoadingProfile(false);
      }
    };
    fetchCandidateProfile();
  }, [
    candidateEmail,
    orgID,
    externalCandidateProfile,
    internalCandidateProfile,
    candidate,
    hasPrefetchedData,
  ]);

  useEffect(() => {
    if (hasPrefetchedData) return; // data already prefetched
    const fetchOtherApplications = async () => {
      if (!candidateEmail || !orgID) return;
      if (externalOtherApplications || internalOtherApplications.length > 0)
        return;

      try {
        setIsLoadingApplications(true);
        const response = await api.get(`/api/get-candidate-interviews`, {
          params: {
            candidateEmail,
            orgID,
          },
        });

        const interviews = response?.data || [];

        const apps = interviews
          .filter(
            (int: any) =>
              int.interviewID !== candidate?.interviewID &&
              (int.applicationStatus === "Ongoing" || !int.applicationStatus)
          )
          .map((int: any) => ({
            jobTitle: int.jobTitle,
            currentStatus: int.status || int.currentStep || "Applied",
            daysAgo: Math.floor(
              (new Date().getTime() - new Date(int.createdAt).getTime()) /
                (1000 * 60 * 60 * 24)
            ),
            interviewID: int.interviewID,
            id: int.id,
          }))
          .slice(0, 3);

        setInternalOtherApplications(apps);
      } catch (error) {
        console.error(
          "Error fetching other active applications for tooltip:",
          error
        );
      } finally {
        setIsLoadingApplications(false);
      }
    };

    fetchOtherApplications();
  }, [
    candidateEmail,
    orgID,
    externalOtherApplications,
    internalOtherApplications.length,
    candidate?.interviewID,
    hasPrefetchedData,
  ]);

  const currentPositionLabel =
    candidateProfile?.jobTitle ||
    candidate?.jobTitle ||
    candidateInfo?.jobTitle ||
    "";

  const currentCompanyLabel =
    candidateProfile?.company || candidate?.company || "";

  const subtitleText =
    currentPositionLabel && currentCompanyLabel
      ? `${currentPositionLabel} | ${currentCompanyLabel}`
      : currentPositionLabel || currentCompanyLabel || "No Job Title";

  const rawLocationForDisplay =
    candidateProfile?.location || candidate?.location || "";
  let safeLocationForDisplay = rawLocationForDisplay;
  if (
    safeLocationForDisplay &&
    /linkedin|http[s]?:\/\/|www\./i.test(safeLocationForDisplay)
  ) {
    safeLocationForDisplay = "";
  }
  const locationLabel = safeLocationForDisplay || "N/A";

  // Skeletons removed - tooltip only shows after data is ready via prefetchedData

  return (
    <div
      className="candidate-tooltip"
      style={{
        position: isCommentsOpen ? "fixed" : "absolute",
        top: isCommentsOpen ? "50%" : "55px",
        left: isCommentsOpen ? "50%" : "0",
        transform: isCommentsOpen ? "translate(-50%, -50%)" : "translateY(0)",
        // Responsive sizing: scale to viewport with sensible bounds
        width: isCommentsOpen
          ? "clamp(340px, 92vw, 1280px)"
          : "clamp(320px, 50vw, 520px)",
        height: isCommentsOpen ? "clamp(420px, 88vh, 900px)" : "auto",
        backgroundColor: "#fff",
        borderRadius: "16px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
        border: "1px solid #E5E7EB",
        padding: "24px",
        zIndex: 1001,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        pointerEvents: "auto",
        overflow: "hidden",
        // When comments are open, use flex layout so the comments area can take remaining height
        display: isCommentsOpen ? "flex" : "block",
        flexDirection: isCommentsOpen ? "column" : undefined,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: "20px",
          flexShrink: 0,
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}
        >
          {candidateInfo?.image ? (
            <AvatarImage
              alt={candidateInfo?.name}
              src={candidateInfo?.image}
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "#E0E0E0",
                border: "none",
                outline: "none",
              }}
            />
          ) : (
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                backgroundColor: "#F8F9FC",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{ fontSize: "22px", color: "#3E4784", fontWeight: 600 }}
              >
                {candidateInfo?.name
                  ?.split(" ")
                  .map((name: string) => name[0])
                  .join("")}
              </span>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <h3
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 600,
                color: "#111827",
                lineHeight: "24px",
              }}
            >
              {candidateInfo?.name}
            </h3>
            {!isDataReady ? (
              <Skeleton
                width="70%"
                height={16}
                borderRadius={4}
                style={{ marginTop: 4 }}
              />
            ) : (
              <p
                title={subtitleText}
                style={{
                  margin: "2px 0 0 0",
                  fontSize: "14px",
                  color: "#6B7280",
                  lineHeight: "20px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {subtitleText}
              </p>
            )}
            {candidate?.company && !currentCompanyLabel && (
              <p
                style={{
                  margin: "2px 0 0 0",
                  fontSize: "14px",
                  color: "#9CA3AF",
                  lineHeight: "20px",
                }}
              >
                {candidate.company}
              </p>
            )}
          </div>
        </div>

        {/* Added comment button */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {candidateEmail && (
            <button
              type="button"
              style={{
                width: 40,
                height: 40,
                minWidth: 40,
                minHeight: 40,
                borderRadius: "999px",
                border: "1px solid #E5E7EB",
                backgroundColor: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
              aria-label="Email candidate"
              onClick={(e) => {
                e.stopPropagation();
                onEmailClick?.();
              }}
            >
              <i
                className="la la-envelope"
                style={{ fontSize: "18px", color: "#4B5563" }}
              ></i>
            </button>
          )}

          <button
            type="button"
            style={{
              width: 40,
              height: 40,
              minWidth: 40,
              minHeight: 40,
              borderRadius: "999px",
              border: "1px solid #E5E7EB",
              backgroundColor: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              position: "relative",
            }}
            aria-label="Comments"
            onClick={(e) => {
              e.stopPropagation();
              if (isCommentsOpen) {
                // Close entire tooltip when X is clicked in comment mode
                setIsCommentsOpen(false);
                onClose?.();
              } else {
                // Lock immediately before state change to prevent race condition
                // where tooltip repositioning triggers mouseLeave before lock is set
                onLockChange?.(true);
                setIsCommentsOpen(true);
              }
            }}
          >
            {isCommentsOpen ? (
              <i
                className="la la-times"
                style={{ fontSize: "18px", color: "#4B5563" }}
              ></i>
            ) : (
              <>
                <i
                  className="las la-comment"
                  style={{ fontSize: "18px", color: "#4B5563" }}
                ></i>
                {(newCommentCount > 0 || totalCommentCount > 0) && (
                  <span
                    aria-label={newCommentCount > 0 ? "New comment count" : "Total comment count"}
                    title={
                      newCommentCount > 0
                        ? `${newCommentCount} new comment${newCommentCount !== 1 ? 's' : ''}`
                        : `${totalCommentCount} comment${totalCommentCount !== 1 ? 's' : ''}`
                    }
                    style={{
                      position: "absolute",
                      right: -4,
                      top: -4,
                      background: newCommentCount > 0 ? "#EF4444" : "#374151",
                      color: "#fff",
                      borderRadius: "999px",
                      fontSize: 11,
                      fontWeight: 700,
                      minWidth: 18,
                      height: 18,
                      padding: "0 6px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 0 0 2px #fff",
                    }}
                  >
                    {newCommentCount > 0 ? newCommentCount : totalCommentCount}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>

      <div
        style={{
          // In comments-open mode, allow the body to participate in flex sizing
          flex: isCommentsOpen ? 1 : undefined,
          minHeight: isCommentsOpen ? 0 : undefined,
          display: isCommentsOpen ? "flex" : "block",
          flexDirection: isCommentsOpen ? "column" : undefined,
          overflow: "hidden",
        }}
      >
        <div style={{ marginBottom: "20px", flexShrink: 0 }}>
          <h4
            style={{
              margin: "0 0 12px 0",
              fontSize: "14px",
              fontWeight: 600,
              color: "#374151",
            }}
          >
            Contact Details
          </h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {!isDataReady ? (
              <>
                <SkeletonPill />
                <SkeletonPill />
                <SkeletonPill />
              </>
            ) : (
              <>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    borderRadius: "20px",
                    backgroundColor: "#F3F4F6",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <i
                    className="la la-envelope"
                    style={{
                      color: "#6B7280",
                      fontSize: "16px",
                      width: "16px",
                    }}
                  ></i>
                  <span
                    style={{
                      fontSize: "14px",
                      color: "#374151",
                      fontWeight: 500,
                    }}
                  >
                    {candidateInfo?.email || candidateEmail || "N/A"}
                  </span>
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    borderRadius: "20px",
                    backgroundColor: "#F3F4F6",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <i
                    className="la la-phone"
                    style={{
                      color: "#6B7280",
                      fontSize: "16px",
                      width: "16px",
                    }}
                  ></i>
                  <span
                    style={{
                      fontSize: "14px",
                      color: "#374151",
                      fontWeight: 500,
                    }}
                  >
                    {candidateProfile?.phone || candidate?.phone || "N/A"}
                  </span>
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    borderRadius: "20px",
                    backgroundColor: "#F3F4F6",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  <i
                    className="la la-map-marker"
                    style={{
                      color: "#6B7280",
                      fontSize: "16px",
                      width: "16px",
                    }}
                  ></i>
                  <span
                    style={{
                      fontSize: "14px",
                      color: "#374151",
                      fontWeight: 500,
                    }}
                  >
                    {locationLabel}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <h4
            style={{
              margin: "0 0 12px 0",
              fontSize: "14px",
              fontWeight: 600,
              color: "#374151",
            }}
          >
            Skills
          </h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {!isDataReady ? (
              <>
                <SkeletonSkillTag width={70} />
                <SkeletonSkillTag width={90} />
                <SkeletonSkillTag width={60} />
                <SkeletonSkillTag width={80} />
                <SkeletonSkillTag width={75} />
              </>
            ) : (
              (() => {
                const candidateSkills =
                  orgCandidateSkills && orgCandidateSkills.length > 0
                    ? orgCandidateSkills
                    : candidateProfile?.skills &&
                      candidateProfile.skills.length > 0
                    ? candidateProfile.skills
                    : [];

                if (candidateSkills.length === 0) {
                  // Show loading skeleton if candidate has CV (AI extraction may be in progress)
                  if (candidateProfile?.hasCV) {
                    return (
                      <>
                        <SkeletonSkillTag width={70} />
                        <SkeletonSkillTag width={90} />
                        <SkeletonSkillTag width={60} />
                        <SkeletonSkillTag width={80} />
                        <SkeletonSkillTag width={75} />
                      </>
                    );
                  }
                  return (
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#6B7280",
                      }}
                    >
                      No skills listed.
                    </span>
                  );
                }

                const skillsWithEndorsements = candidateSkills.filter(
                  (skill: string) => {
                    const endorsements = skillsEndorsements[skill] || [];
                    return endorsements.length > 0;
                  }
                );

                const skillsWithoutEndorsements = candidateSkills.filter(
                  (skill: string) => {
                    const endorsements = skillsEndorsements[skill] || [];
                    return endorsements.length === 0;
                  }
                );

                const orderedSkills = [
                  ...skillsWithEndorsements,
                  ...skillsWithoutEndorsements,
                ];

                const MAX_SKILLS_TO_SHOW = 40;
                const visibleSkills = orderedSkills.slice(
                  0,
                  MAX_SKILLS_TO_SHOW
                );
                const extraCount = orderedSkills.length - visibleSkills.length;

                return (
                  <>
                    {visibleSkills.map((skill: string, index: number) => {
                      const endorsements = skillsEndorsements[skill] || [];
                      const hasEndorsements = endorsements.length > 0;

                      return (
                        <SkillTag
                          key={index}
                          label={skill}
                          isHighlighted={hasEndorsements}
                          showThumb={hasEndorsements}
                          onMouseEnter={() => {
                            if (hasEndorsements) {
                              setHoveredSkillIndex(index);
                            }
                          }}
                          onMouseLeave={() => setHoveredSkillIndex(null)}
                        >
                          {hasEndorsements && hoveredSkillIndex === index && (
                            <SkillEndorsementTooltip
                              count={endorsements.length}
                            />
                          )}
                        </SkillTag>
                      );
                    })}
                    {extraCount > 0 && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          border: "1px dashed #E5E7EB",
                          backgroundColor: "#F9FAFB",
                          fontSize: "12px",
                          color: "#6B7280",
                        }}
                      >
                        {extraCount} more
                      </span>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </div>

        <div>
          <h4
            style={{
              margin: "0 0 12px 0",
              fontSize: "14px",
              fontWeight: 600,
              color: "#374151",
            }}
          >
            Other Active Applications
          </h4>
          {!isDataReady ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <SkeletonApplicationItem />
              <SkeletonApplicationItem />
            </div>
          ) : otherApplications && otherApplications.length > 0 ? (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {otherApplications.map((app: any, index: number) => (
                <div
                  key={index}
                  style={{
                    padding: "8px 0",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    window.location.href = `/recruiter-dashboard/careers/manage/${app.id}/interview-analysis/${app.interviewID}?orgID=${orgID}`;
                  }}
                  onMouseEnter={(e) => {
                    const titleSpan = e.currentTarget.querySelector(
                      '[data-role="job-title"]'
                    ) as HTMLElement | null;
                    if (titleSpan) {
                      titleSpan.style.textDecoration = "underline";
                    }
                  }}
                  onMouseLeave={(e) => {
                    const titleSpan = e.currentTarget.querySelector(
                      '[data-role="job-title"]'
                    ) as HTMLElement | null;
                    if (titleSpan) {
                      titleSpan.style.textDecoration = "none";
                    }
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: "4px",
                    }}
                  >
                    <span
                      style={{
                        color: "#2563EB",
                        fontSize: "14px",
                        fontWeight: 500,
                        textDecoration: "none",
                      }}
                      data-role="job-title"
                    >
                      {app.jobTitle}
                    </span>
                    <i
                      className="la la-external-link"
                      style={{ color: "#2563EB", fontSize: "12px" }}
                    ></i>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>
                      {app.currentStatus}
                    </span>
                    <span style={{ fontSize: "12px", color: "#9CA3AF" }}>
                      •
                    </span>
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>
                      {app.daysAgo === 0
                        ? "Today"
                        : app.daysAgo === 1
                        ? "1 day ago"
                        : `${app.daysAgo} days ago`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "12px", color: "#6B7280", margin: 0 }}>
              No other active applications.
            </p>
          )}
        </div>

        {/* Comments — expanded section per Figma */}
        <div
          style={{
            marginTop: 10,
            // Avoid nested scrolling; the inner comments list will handle scrolling
            overflow: "hidden",
            transition: "max-height 0.3s ease, opacity 0.3s ease",
            // Let the comments section take remaining space in the tooltip when open
            flex: isCommentsOpen ? 1 : undefined,
            minHeight: isCommentsOpen ? 0 : undefined,
            maxHeight: isCommentsOpen ? "100%" : 0,
            opacity: isCommentsOpen ? 1 : 0,
            width: "100%",
            position: "relative",
            zIndex: 1,
            pointerEvents: isCommentsOpen ? "auto" : "none",
            display: isCommentsOpen ? "flex" : "block",
            flexDirection: "column",
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <hr
            style={{ margin: "12px 0", borderColor: "#EAECF5", flexShrink: 0 }}
          />
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <CandidateToolTipComment
              orgID={orgID}
              candidateEmail={candidateEmail}
              applicationOptions={applicationOptions}
              commentViewFilter={commentViewFilter}
              setCommentViewFilter={setCommentViewFilter}
              selectedApplicationId={selectedApplicationId}
              setSelectedApplicationId={setSelectedApplicationId}
              currentUser={currentUser || contextUser}
            />
          </div>
        </div>
        {isCommentsOpen && <CommentsBackdrop open={true} />}
      </div>
    </div>
  );
}
// Page backdrop when comments are open
export const CommentsBackdrop: React.FC<{ open: boolean }> = ({ open }) => {
  if (!open || typeof window === "undefined") return null as any;
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17,24,39,0.25)",
        zIndex: 900,
        pointerEvents: "none",
        transition: "opacity 220ms ease-in-out",
      }}
    ></div>,
    document.body
  );
};
