"use client";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useAppContext } from "@/lib/context/AppContext";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { useRecruiterContext } from "@/lib/context/RecruiterContext";
// import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import CareerStageColumn from "@/lib/components/CareerComponents/CareerStage";
import JobDescription from "@/lib/components/CareerComponents/JobDescription";
import CareerDescriptionView from "@/lib/components/CareerComponents/CareerDescriptionView";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import CandidateMenu from "@/lib/components/CareerComponents/CandidateMenu";
import CandidateModal from "@/lib/components/CandidateComponents/CandidateModal";
import DroppedCandidates from "@/lib/components/CareerComponents/DroppedCandidates";
import CareerApplicantsTable from "@/lib/components/DataTables/CareerApplicantsTable";
import Swal from "sweetalert2";
import CandidateHistory from "@/lib/components/CareerComponents/CandidateHistory";
import { useCareerApplicants } from "@/lib/hooks/useCareerApplicants";
import CareerStatus from "@/lib/components/CareerComponents/CareerStatus";
import JobPostTypeBadge from "@/lib/components/CareerComponents/JobPostTypeBadge";
import CandidateActionModal from "@/lib/components/CandidateComponents/CandidateActionModal";
import {
  candidateActionToast,
  errorToast,
  getFirstEnabledStage,
  getCurrentPipelineStage,
  getNextPipelineStage,
  getStage,
  isStageEnabled,
  normalizePipeline,
} from "@/lib/Utils";
import { Tooltip } from "react-tooltip";
import {
  CREDIT_THRESHOLDS,
  DEFAULT_JOB_PIPELINE,
} from "../../../../../lib/utils/constants";
import EmailModule from "@/lib/components/MailgunComponents/EmailModuleV2";
import { useCreditBalance } from "@/lib/hooks/useCreditBalance";
import InviteToJobModal from "@/lib/components/CandidateComponents/InviteToJobModal";
import { CareerHierarchyInfo } from "@/lib/utils/careerHierarchy";
import {
  HIRING_MANAGER_ROLE,
  normalizeCareerTeamRole,
} from "@/lib/utils/careerTeamRole";
import { Button } from "@/lib/components/ui";
import CareerStatusBadges from "@/lib/components/CareerComponents/CareerStatusBadge";
import CareerStatusModal from "@/lib/components/CareerComponents/CareerStatusModal";
import ActivityTracker from "@/lib/components/ActivityTracker/ActivityTracker";
import { useLinkedCareerTimeline } from "@/lib/hooks/useLinkedCareerTimeline";
import LinkedCareerExpander from "@/lib/components/CareerComponents/LinkedCareers/LinkedCareerExpander";
import ExpandedBoardPanel from "@/lib/components/CareerComponents/LinkedCareers/ExpandedBoardPanel";
import ChildSelectionModal from "@/lib/components/CareerComponents/LinkedCareers/ChildSelectionModal";
import MissingParentModal from "@/lib/components/CareerComponents/LinkedCareers/MissingParentModal";
import CareerHierarchyBadge from "@/lib/components/CareerComponents/CareerHierarchyBadge";
import linkedStyles from "@/lib/components/CareerComponents/LinkedCareers/linked-careers.module.scss";

const CAREER_TAB_VALUES = [
  "application-timeline",
  "all-applicants",
  "career-settings",
  "emails",
  "activity-tracker",
] as const;

type CareerTabValue = (typeof CAREER_TAB_VALUES)[number];
const DEFAULT_CAREER_TAB: CareerTabValue = "application-timeline";

function isValidCareerTab(value: string | null): value is CareerTabValue {
  return value !== null && CAREER_TAB_VALUES.includes(value as CareerTabValue);
}

export default function ManageCareerPage() {
  const [emailAutomation, setEmailAutomation] = useState<boolean>(false);
  const [optionsDropdownOpen, setOptionsDropdownOpen] = useState(false);
  const optionsDropdownRef = useRef<HTMLDivElement>(null);
  const { slug } = useParams();
  const { orgID, user } = useAppContext();
  const [activeOrg] = useLocalStorage("activeOrg", null);
  const { refreshTabBadges, setActiveCareerUsageType } = useRecruiterContext();
  const {
    balance,
    isInsufficient,
    hasCreditBasedPlan,
    hasActiveCreditBasedPlan,
    hasActivePremiumPlan,
    hasAnyActivePlan,
    isExpired,
    isLoading: isCreditLoading,
  } = useCreditBalance();
  const [career, setCareer] = useState<any>(null);
  const {
    timelineStages,
    setAndSortCandidates,
    interviewsInProgress,
    setTimelineStages,
  } = useCareerApplicants([]);
  const [candidateMenuOpen, setCandidateMenuOpen] = useState<boolean>(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any>({});
  const [candidateCVOpen, setCandidateCVOpen] = useState<boolean>(false);
  const [selectedCandidateCV, setSelectedCandidateCV] = useState<any>({});
  const [droppedCandidatesOpen, setDroppedCandidatesOpen] =
    useState<boolean>(false);
  const [selectedDroppedCandidates, setSelectedDroppedCandidates] =
    useState<any>({});
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({
    _id: "",
    jobTitle: "",
    description: "",
    questions: [],
    status: "",
    screeningSetting: "",
    requireVideo: false,
    directInterviewLink: "",
    teamMembers: [], // Initialize as empty array instead of undefined,
    activityStatus: "",
    jobPostType: "",
    walkthroughLanguage: "english",
  });
  const [showCandidateHistory, setShowCandidateHistory] = useState(false);
  const [selectedCandidateHistory, setSelectedCandidateHistory] = useState<any>(
    {},
  );
  const [showCandidateActionModal, setShowCandidateActionModal] = useState("");
  const draggedCandidateRef = useRef<boolean>(false);
  const activeDragBoardRef = useRef<string | null>(null);
  const [isInviteToJobOpen, setIsInviteToJobOpen] = useState(false);
  const [inviteToJobCandidate, setInviteToJobCandidate] = useState<any>(null);
  const [hideRecruiterEvalForActionModal, setHideRecruiterEvalForActionModal] =
    useState(false);
  const [excludedCareerIdsForInvite, setExcludedCareerIdsForInvite] = useState<
    string[]
  >([]);
  const fetchingCareerRef = useRef<boolean>(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const tabFromUrl = searchParams.get("tab");
  const activeTab: CareerTabValue = isValidCareerTab(tabFromUrl)
    ? tabFromUrl
    : DEFAULT_CAREER_TAB;
  const [userMemberRole, setUserMemberRole] = useState<string | null>(null);
  const [invitedCandidates, setInvitedCandidates] = useState<any[]>([]);
  const [showCareerStatusModal, setShowCareerStatusModal] = useState(false);

  // Linked career expansion state
  const [emailAutomationCareerId, setEmailAutomationCareerId] = useState<string | undefined>(undefined);
  const [emailAutomationCareerName, setEmailAutomationCareerName] = useState<string | undefined>(undefined);
  const parentTimeline = useLinkedCareerTimeline();
  const childTimeline = useLinkedCareerTimeline();
  const [showChildModal, setShowChildModal] = useState(false);
  const [showMissingParentModal, setShowMissingParentModal] = useState(false);

  const handleTabChange = useCallback(
    (tabValue: CareerTabValue) => {
      const params = new URLSearchParams(searchParamsString);

      if (tabValue === DEFAULT_CAREER_TAB) {
        params.delete("tab");
      } else {
        params.set("tab", tabValue);
      }

      const currentUrl = searchParamsString
        ? `${pathname}?${searchParamsString}`
        : pathname;
      const nextQuery = params.toString();
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;

      if (nextUrl === currentUrl) {
        return;
      }

      router.push(nextUrl, { scroll: false });
    },
    [pathname, router, searchParamsString],
  );

  const handleOpenEditCareerPage = useCallback(() => {
    const careerId = formData?._id || career?._id || slug;
    if (!careerId || !orgID) {
      setShowMissingParentModal(false);
      return;
    }

    setShowMissingParentModal(false);
    router.push(
      `/recruiter-dashboard/careers/edit-career/${careerId}?orgID=${orgID}&step=0`,
    );
  }, [career?._id, formData?._id, orgID, router, slug]);

  useEffect(() => {
    if (!tabFromUrl || isValidCareerTab(tabFromUrl)) {
      return;
    }

    const params = new URLSearchParams(searchParamsString);
    params.delete("tab");
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParamsString, tabFromUrl]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Ignore clicks inside the toggle button or the menu itself
      if (
        target.closest(".safe-dropdown-toggle") ||
        target.closest(".safe-dropdown-menu")
      ) {
        return;
      }
      setActiveDropdown(null);
    };

    document.addEventListener("click", handleOutsideClick);
    return () => {
      document.removeEventListener("click", handleOutsideClick);
    };
  }, []);

  // Click outside to close Options dropdown
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        optionsDropdownRef.current &&
        !optionsDropdownRef.current.contains(event.target as Node)
      ) {
        setOptionsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Fetch user's member role from members collection
  useEffect(() => {
    const fetchUserMemberRole = async () => {
      if (!user?.email || !orgID) return;
      try {
        const response = await api.post("/api/get-org-members", { orgID });
        if (response.status === 200 && response.data?.members) {
          const member = response.data.members.find(
            (m: any) => m.email === user.email,
          );
          if (member) {
            setUserMemberRole(member.role);
          }
        }
      } catch (error) {
        console.error("Error fetching user member role:", error);
      }
    };
    fetchUserMemberRole();
  }, [user?.email, orgID]);

  // Fetch excluded career IDs when InviteToJobModal opens
  useEffect(() => {
    if (isInviteToJobOpen && inviteToJobCandidate?.email && orgID) {
      api
        .get(
          `/api/get-candidate-interviews?candidateEmail=${encodeURIComponent(inviteToJobCandidate.email)}&orgID=${orgID}`,
        )
        .then((res) => {
          const careerIds = res.data.map((interview: any) => interview.id);
          setExcludedCareerIdsForInvite(careerIds);
        })
        .catch(() => {
          setExcludedCareerIdsForInvite(career?.id ? [career.id] : []);
        });
    }
  }, [isInviteToJobOpen, inviteToJobCandidate?.email, orgID, career?.id]);

  // Email compose state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState<any>(null);
  const [mailgunAccounts, setMailgunAccounts] = useState<any[]>([]);
  const [mailgunRole, setMailgunRole] = useState<string | null>(null);
  const [selectedMailgunAccountId, setSelectedMailgunAccountId] = useState<
    string | null
  >(null);

  // Determine current user's role for permissions
  const currentUserRole = useMemo(() => {
    if (!user?.email) {
      return HIRING_MANAGER_ROLE;
    }

    // If teamMembers exists and is an array, check it first
    if (
      formData?.teamMembers &&
      Array.isArray(formData.teamMembers) &&
      formData.teamMembers.length > 0
    ) {
      const member = formData.teamMembers.find(
        (m: any) => m.email === user.email,
      );
      if (member?.role) {
        return normalizeCareerTeamRole(member.role) || member.role;
      }
    }

    // Fallback: For old careers without teamMembers, check if user is the creator
    // This handles legacy careers created before teamMembers was implemented
    if (formData?.createdBy?.email && formData.createdBy.email === user.email) {
      return "Job Owner";
    }

    return HIRING_MANAGER_ROLE;
  }, [user?.email, formData?.teamMembers, formData?.createdBy]);

  // Check if user can manage candidates
  // Allow: Job Owner, Contributor, admin, or hiring_manager roles
  const canManageCandidates = useMemo(() => {
    // Check team member role (career-specific)
    const isTeamMemberWithPermission =
      currentUserRole === "Job Owner" || currentUserRole === "Contributor";

    // Check org member role (org-wide permissions)
    const isOrgMemberWithPermission =
      userMemberRole === "admin" || userMemberRole === "hiring_manager";

    return isTeamMemberWithPermission || isOrgMemberWithPermission;
  }, [currentUserRole, userMemberRole]);

  const tabs: { label: string; value: CareerTabValue; icon: string }[] = [
    {
      label: "Application Timeline",
      value: "application-timeline",
      icon: "stream",
    },
    {
      label: "All Applicants",
      value: "all-applicants",
      icon: "users",
    },
    {
      label: "Career Settings",
      value: "career-settings",
      icon: "cog",
    },
    {
      label: "Emails",
      value: "emails",
      icon: "envelope",
    },
    {
      label: "Activity Tracker",
      value: "activity-tracker",
      icon: "history",
    },
  ];

  // Filter to only show enabled stages in the kanban
  const enabledTimelineStages = useMemo(() => {
    return timelineStages.filter(isStageEnabled);
  }, [timelineStages]);

  useEffect(() => {
    const fetchInterviews = async () => {
      if (!career?.id) return;

      const response = await api.get(
        `/api/get-career-interviews?careerID=${career.id}`,
      );
      const interviews = Array.isArray(response.data) ? response.data : [];
      const timelineTemplate =
        timelineStages?.length > 0
          ? timelineStages
          : career?.pipelineStages || DEFAULT_JOB_PIPELINE;
      let newTimelineStages = timelineTemplate.map((stage: any) => ({
        ...stage,
        droppedCandidates: [],
        substages: (stage?.substages || []).map((substage: any) => ({
          ...substage,
          candidates: [],
        })),
      }));
      const invited: any[] = [];
      const firstEnabledStage = getFirstEnabledStage(newTimelineStages);

      const resolveFirstEnabledStagePlacement = (
        interview: any,
      ): "matched" | "not-matched" | "unresolved" => {
        if (!firstEnabledStage) return "unresolved";

        const hasStageIds = Boolean(
          interview?.stageId && interview?.substageId,
        );

        if (hasStageIds) {
          const matchesById =
            interview.stageId === firstEnabledStage.stage.id &&
            interview.substageId === firstEnabledStage.substage.id;

          if (matchesById) {
            return "matched";
          }
        }

        const resolvedCurrentStage = getCurrentPipelineStage(
          newTimelineStages,
          {
            status: interview?.status,
            currentStep: interview?.currentStep,
          },
        );

        if (
          !resolvedCurrentStage?.stage?.id ||
          !resolvedCurrentStage?.substage?.id
        ) {
          return "unresolved";
        }

        return resolvedCurrentStage.stage.id === firstEnabledStage.stage.id &&
          resolvedCurrentStage.substage.id === firstEnabledStage.substage.id
          ? "matched"
          : "not-matched";
      };

      for (const interview of interviews) {
        const isDropped =
          interview.applicationStatus === "Dropped" ||
          interview.applicationStatus === "Cancelled";

        const isInviteOnlyCandidate =
          Boolean(interview?.invitedFrom) &&
          interview?.hasJiaAccount === false &&
          !isDropped;

        const firstEnabledPlacement = isInviteOnlyCandidate
          ? resolveFirstEnabledStagePlacement(interview)
          : "not-matched";

        const shouldShowInInvited =
          isInviteOnlyCandidate &&
          (firstEnabledPlacement === "matched" ||
            firstEnabledPlacement === "unresolved");

        if (shouldShowInInvited) {
          invited.push(interview);
          continue;
        }

        if (interview.stageId && interview.substageId) {
          const matchedStage = newTimelineStages.find((s: any) => s.id === interview.stageId);
          const matchedSubstage = matchedStage?.substages?.find((s: any) => s.id === interview.substageId);
          if (matchedStage && matchedSubstage) {
            const interviewWithStage = { ...interview, stage: matchedStage.name, substage: matchedSubstage.name };
            if (isDropped) {
              matchedStage.droppedCandidates.push(interviewWithStage);
            } else {
              matchedSubstage.candidates.push(interviewWithStage);
            }
            continue;
          }
        }

        if (interview.currentStep === "Applied") {
          const currentStage = {
            stage: "CV Screening",
            substage: "Waiting Submission",
          };
          const interviewWithStage = { ...interview, ...currentStage };
          if (isDropped) {
            newTimelineStages
              .find((stage) => stage.name === currentStage.stage)
              ?.droppedCandidates.push(interviewWithStage);
          } else {
            newTimelineStages
              .find((stage) => stage.name === currentStage.stage)
              ?.substages.find(
                (substage: any) => substage.name === currentStage.substage,
              )
              ?.candidates.push(interviewWithStage);
          }
          continue;
        }

        if (
          interview.currentStep === "AI Interview" ||
          !interview.currentStep ||
          (interview.currentStep === "CV Screening" &&
            interview.status === "For AI Interview")
        ) {
          if (
            interview.status === "For Interview" ||
            interview.status === "For AI Interview"
          ) {
            const currentStage = {
              stage: "AI Interview",
              substage: "Waiting Interview",
            };
            const interviewWithStage = { ...interview, ...currentStage };
            isDropped
              ? newTimelineStages
                  .find((stage) => stage.name === currentStage.stage)
                  ?.droppedCandidates.push(interviewWithStage)
              : newTimelineStages
                  .find((stage) => stage.name === currentStage.stage)
                  ?.substages.find(
                    (substage: any) => substage.name === currentStage.substage,
                  )
                  ?.candidates.push(interviewWithStage);
            continue;
          }

          isDropped
            ? newTimelineStages
                .find((stage) => stage.name === "AI Interview")
                ?.droppedCandidates.push({
                  ...interview,
                  stage: "AI Interview",
                  substage: "For Review",
                })
            : newTimelineStages
                .find((stage) => stage.name === "AI Interview")
                ?.substages.find(
                  (substage: any) => substage.name === "For Review",
                )
                ?.candidates.push({
                  ...interview,
                  stage: "AI Interview",
                  substage: "For Review",
                });
          continue;
        }

        if (interview.currentStep === "CV Screening") {
          const stage = { stage: "CV Screening", substage: "For Review" };
          const interviewWithStage = { ...interview, ...stage };
          if (isDropped) {
            newTimelineStages
              .find((stage) => stage.name === "CV Screening")
              ?.droppedCandidates.push(interviewWithStage);
          } else {
            newTimelineStages
              .find((stage) => stage.name === "CV Screening")
              ?.substages.find(
                (substage: any) => substage.name === "For Review",
              )
              ?.candidates.push(interviewWithStage);
          }
          continue;
        }

        if (
          interview.currentStep === "Human Interview" ||
          interview.currentStep === "Job Interview"
        ) {
          if (interview.status === "For Human Interview") {
            const stage = {
              stage: "Human Interview",
              substage: "Waiting Schedule",
            };
            const interviewWithStage = { ...interview, ...stage };
            isDropped
              ? newTimelineStages
                  .find((stage) => stage.name === "Human Interview")
                  ?.droppedCandidates.push(interviewWithStage)
              : newTimelineStages
                  .find((stage) => stage.name === "Human Interview")
                  ?.substages.find(
                    (substage: any) => substage.name === "Waiting Schedule",
                  )
                  ?.candidates.push(interviewWithStage);
            continue;
          }

          if (interview.status === "For Interview") {
            const stage = {
              stage: "Human Interview",
              substage: "Waiting Interview",
            };
            const interviewWithStage = { ...interview, ...stage };
            isDropped
              ? newTimelineStages
                  .find((stage) => stage.name === "Human Interview")
                  ?.droppedCandidates.push(interviewWithStage)
              : newTimelineStages
                  .find((stage) => stage.name === "Human Interview")
                  ?.substages.find(
                    (substage: any) => substage.name === "Waiting Interview",
                  )
                  ?.candidates.push(interviewWithStage);
            continue;
          }

          if (interview.status === "For Human Interview Review") {
            const stage = {
              stage: "Human Interview",
              substage: "For Review",
            };
            const interviewWithStage = { ...interview, ...stage };
            isDropped
              ? newTimelineStages
                  .find((stage) => stage.name === "Human Interview")
                  ?.droppedCandidates.push(interviewWithStage)
              : newTimelineStages
                  .find((stage) => stage.name === "Human Interview")
                  ?.substages.find(
                    (substage: any) => substage.name === "For Review",
                  )
                  ?.candidates.push(interviewWithStage);
            continue;
          }
        }

        if (interview.currentStep === "Job Offered") {
          const currentStage = {
            stage: "Job Offer",
            substage: "For Contract Signing",
          };
          const interviewWithStage = { ...interview, ...currentStage };
          isDropped
            ? newTimelineStages
                .find((stage) => stage.name === currentStage.stage)
                ?.droppedCandidates.push(interviewWithStage)
            : newTimelineStages
                .find((stage) => stage.name === currentStage.stage)
                ?.substages.find(
                  (substage: any) => substage.name === currentStage.substage,
                )
                ?.candidates.push(interviewWithStage);
          continue;
        }

        if (interview.currentStep === "Contract Signed") {
          const currentStage = { stage: "Job Offer", substage: "Hired" };
          const interviewWithStage = { ...interview, ...currentStage };
          isDropped
            ? newTimelineStages
                .find((stage) => stage.name === currentStage.stage)
                ?.droppedCandidates.push(interviewWithStage)
            : newTimelineStages
                .find((stage) => stage.name === currentStage.stage)
                ?.substages.find(
                  (substage: any) => substage.name === currentStage.substage,
                )
                ?.candidates.push(interviewWithStage);
          continue;
        }

        // Custom pipeline stages - use case-insensitive matching
        let pipelineStageStep = newTimelineStages.find(
          (stage) =>
            stage.name &&
            interview.currentStep &&
            stage.name.toLowerCase() === interview.currentStep.toLowerCase(),
        );

        // Fallback: Try strict ID matching if name matching failed (handles renamed stages)
        if (!pipelineStageStep && interview.stageId) {
          pipelineStageStep = newTimelineStages.find(
            (stage) => stage.id === interview.stageId,
          );
        }

        if (pipelineStageStep) {
          let substage = pipelineStageStep.substages.find(
            (substage: any) =>
              substage.status &&
              interview.status &&
              substage.status.toLowerCase() === interview.status.toLowerCase(),
          );

          // Fallback: Try ID matching for substage
          if (!substage && interview.substageId) {
            substage = pipelineStageStep.substages.find(
              (s: any) => s.id === interview.substageId,
            );
          }

          if (substage) {
            const stage = {
              stage: pipelineStageStep.name, // Use the actual stage name from pipeline
              substage: substage.name,
            };
            const interviewWithStage = { ...interview, ...stage };
            isDropped
              ? newTimelineStages
                  .find((stage) => stage.name === pipelineStageStep.name)
                  ?.droppedCandidates.push(interviewWithStage)
              : newTimelineStages
                  .find((stage) => stage.name === pipelineStageStep.name)
                  ?.substages.find(
                    (substage: any) => substage.name === stage.substage,
                  )
                  ?.candidates.push(interviewWithStage);
            continue;
          }
        }
      }

      setAndSortCandidates(newTimelineStages);
      setInvitedCandidates(invited);
    };

    fetchInterviews();
  }, [career?.id]);

  // Listen for comment viewing events and refresh candidate data to update badges
  useEffect(() => {
    let refreshTimeout: NodeJS.Timeout | null = null;

    const handleCandidateDataStale = async (event: CustomEvent) => {
      // Debounce to prevent excessive API calls if multiple events fire rapidly
      if (refreshTimeout) clearTimeout(refreshTimeout);

      refreshTimeout = setTimeout(async () => {
        try {
          const interviewsRes = await api.get("/api/get-career-interviews", {
            params: {
              careerID: career?.id,
              orgID: career.orgID || orgID,
            },
          });

          const updatedInterviews = interviewsRes?.data || [];

          // Update only the comment counts for each candidate in timeline stages
          setTimelineStages((prevStages) => {
            return prevStages.map((stage) => ({
              ...stage,
              substages: stage.substages.map((substage: any) => ({
                ...substage,
                candidates: substage.candidates.map((candidate: any) => {
                  // Find matching interview by _id or interviewID
                  const updated = updatedInterviews.find(
                    (interview: any) =>
                      interview._id === candidate._id ||
                      interview.interviewID === candidate.interviewID,
                  );
                  if (updated) {
                    // Update only comment counts, preserve all other data
                    return {
                      ...candidate,
                      commentCount: updated.commentCount || 0,
                      newCommentCount: updated.newCommentCount || 0,
                    };
                  }
                  return candidate;
                }),
              })),
              droppedCandidates: stage.droppedCandidates.map(
                (candidate: any) => {
                  const updated = updatedInterviews.find(
                    (interview: any) =>
                      interview._id === candidate._id ||
                      interview.interviewID === candidate.interviewID,
                  );
                  if (updated) {
                    return {
                      ...candidate,
                      commentCount: updated.commentCount || 0,
                      newCommentCount: updated.newCommentCount || 0,
                    };
                  }
                  return candidate;
                },
              ),
            }));
          });
        } catch (error) {
          console.error(
            "Failed to refresh candidate data after comment view:",
            error,
          );
        }
      }, 300);
    };

    if (typeof window !== "undefined") {
      window.addEventListener(
        "candidate-data-stale",
        handleCandidateDataStale as EventListener,
      );
    }

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "candidate-data-stale",
          handleCandidateDataStale as EventListener,
        );
      }
    };
  }, [career?.id, career?.orgID, orgID, setTimelineStages]);

  useEffect(() => {
    const fetchCareer = async () => {
      if (!slug && !orgID) return;
      if (fetchingCareerRef.current) return;
      fetchingCareerRef.current = true;
      try {
        const response = await api.post("/api/career-data", {
          id: slug,
          orgID,
          includeChildCareers: true,
        });

        const deepCopy = JSON.parse(
          JSON.stringify(response.data?.questions ?? []),
        );
        setFormData({
          _id: response.data?._id || "",
          jobTitle: response.data?.jobTitle || "",
          description: response.data?.description || "",
          questions: deepCopy,
          status: response.data?.status || "",
          screeningSetting: response.data?.screeningSetting || "",
          requireVideo:
            response.data?.requireVideo === null ||
            response.data?.requireVideo === undefined
              ? true
              : response.data?.requireVideo,
          directInterviewLink: response.data?.directInterviewLink || "",
          createdBy: response.data?.createdBy || {},
          minimumSalary: response.data?.minimumSalary || "",
          maximumSalary: response.data?.maximumSalary || "",
          province: response.data?.province || "",
          location: response.data?.location || "",
          salaryNegotiable: response.data?.salaryNegotiable || false,
          workSetup: response.data?.workSetup || "",
          workSetupRemarks: response.data?.workSetupRemarks || "",
          createdAt: response.data?.createdAt || "",
          updatedAt: response.data?.updatedAt || "",
          lastEditedBy: response.data?.lastEditedBy || {},
          employmentType: response.data?.employmentType || "Full-time",
          orgID: response.data?.orgID || "",
          preScreeningQuestions: response.data?.preScreeningQuestions || [],
          teamMembers: response.data?.teamMembers || [],
          pipelineStages: response.data?.pipelineStages || [],
          cvSecretPrompt: response.data?.cvSecretPrompt || "",
          interviewSecretPrompt: response.data?.interviewSecretPrompt || "",
          globalHiringEnabled: response.data?.globalHiringEnabled || false,
          salaryUnit: response.data?.salaryUnit || "Monthly",
          showSalaryToApplicants:
            response.data?.showSalaryToApplicants || false,
          currency: response.data?.currency || "PHP",
          organization: response.data?.organization || {},
          activityStatus: response.data?.activityStatus || "",
          jobPostType: response.data?.jobPostType || "",
          walkthroughLanguage:
            response.data?.walkthroughLanguage === "tagalog"
              ? "tagalog"
              : "english",
          careerPostType: response.data?.careerPostType || null,
          childTitle: response.data?.childTitle || "",
          parentCareerTitle: response.data?.parentCareer?.jobTitle || "",
          archived: response.data?.archived || false,
          archivedAt: response.data?.archivedAt || null,
        });
        const jobPipeline =
          normalizePipeline(response.data?.pipelineStages || DEFAULT_JOB_PIPELINE);
        setTimelineStages(
          jobPipeline.map((stage) => {
            return {
              ...stage,
              droppedCandidates: [],
              substages: stage.substages.map((substage) => {
                return {
                  ...substage,
                  candidates: [],
                };
              }),
            };
          }),
        );
        setCareer(response.data);

        // Mark career as viewed by current user
        if (response.data?._id && user?.email && orgID) {
          try {
            await api.post("/api/mark-career-viewed", {
              careerId: response.data._id,
              userEmail: user.email,
              orgID,
            });

            refreshTabBadges();
          } catch (error) {
            console.error("Failed to mark career as viewed:", error);
            // Don't block the UI if this fails
          }
        }
      } catch (error) {
        fetchingCareerRef.current = false;
        if (error.response.status === 404) {
          Swal.fire({
            title: "Career not found",
            text: "Redirecting back to careers page...",
            timer: 1500,
          }).then(() => {
            window.location.href = "/recruiter-dashboard/careers";
          });
          return;
        }
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "Something went wrong! Please try again.",
        });
      } finally {
        fetchingCareerRef.current = false;
      }
    };
    fetchCareer();
  }, [slug, orgID, user?.email]);

  // Update context with career's job post type for UI banners
  useEffect(() => {
    if (career?.jobPostType) {
      setActiveCareerUsageType(career.jobPostType);
    }
    return () => setActiveCareerUsageType(null);
  }, [career?.jobPostType, setActiveCareerUsageType]);

  const handleCandidateMenuOpen = (candidate: any) => {
    setCandidateMenuOpen((prev) => !prev);
    setSelectedCandidate(candidate);
  };

  const handleCandidateCVOpen = (candidate: any) => {
    setCandidateCVOpen((prev) => !prev);
    setSelectedCandidateCV(candidate);
  };

  const handleDroppedCandidatesOpen = (stage: {
    name: string;
    droppedCandidates: any[];
  }) => {
    setDroppedCandidatesOpen((prev) => !prev);
    setSelectedDroppedCandidates(stage);
  };

  const handleCandidateHistoryOpen = (candidate: any) => {
    setShowCandidateHistory((prev) => !prev);
    setSelectedCandidateHistory(candidate);
  };

  const handleInviteToJob = (candidate: any) => {
    setInviteToJobCandidate(candidate);
    setIsInviteToJobOpen(true);
  };

  const handleCrossBoardInvite = (candidate: any, targetCareer: any, sourceCareerId: string, targetStageId?: string, targetSubstageId?: string) => {
    setHideRecruiterEvalForActionModal(true);
    setSelectedCandidate({
      ...candidate,
      selectedCareers: [targetCareer],
      sourceCareerIdOverride: sourceCareerId,
      forceTransfer: true,
      forEvaluation: false,
      targetStageId,
      targetSubstageId,
    });
    setShowCandidateActionModal("invite");
  };

  const handleInviteToJobOk = (payload: {
    selectedCareers: any[];
    sourceCareerIdOverride?: string;
    forceTransfer?: boolean;
  }) => {
    setIsInviteToJobOpen(false);
    if (payload.selectedCareers?.length > 0 && inviteToJobCandidate) {
      setHideRecruiterEvalForActionModal(true);
      setSelectedCandidate({
        ...inviteToJobCandidate,
        selectedCareers: payload.selectedCareers,
        sourceCareerIdOverride: payload.sourceCareerIdOverride || career?.id,
        forceTransfer: payload.forceTransfer,
        forEvaluation: false,
      });
      setShowCandidateActionModal("invite");
    }
    setInviteToJobCandidate(null);
  };

  const handleCandidateAnalysisComplete = (updatedCandidate: any) => {
    const updatedStages = [...timelineStages];
    updatedStages
      .find((s) => s.name === updatedCandidate.stage)
      ?.substages?.find(
        (substage: any) => substage.name === updatedCandidate.substage,
      )
      ?.candidates?.map((c: any) =>
        c._id === updatedCandidate._id ? updatedCandidate : c,
      );
    setAndSortCandidates(updatedStages);
  };

  const handleCancelEdit = () => {
    setFormData({
      _id: career?._id || "",
      jobTitle: career?.jobTitle || "",
      description: career?.description || "",
      questions: career?.questions || [],
      status: career?.status || "",
      screeningSetting: career?.screeningSetting || "",
      requireVideo:
        career?.requireVideo === null || career?.requireVideo === undefined
          ? true
          : career?.requireVideo,
      walkthroughLanguage:
        career?.walkthroughLanguage === "tagalog" ? "tagalog" : "english",
      careerPostType: career?.careerPostType || null,
      childTitle: career?.childTitle || "",
      parentCareerTitle: career?.parentCareer?.jobTitle || "",
      archived: career?.archived || false,
      archivedAt: career?.archivedAt || null,
    });
    setIsEditing(false);
  };

  const handleEndorseCandidate = (candidate: any) => {
    if (!canManageCandidates) {
      Swal.fire({
        icon: "warning",
        title: "Permission Denied",
        text: "Only Job Owners and Contributors can endorse candidates.",
      });
      return;
    }
    setShowCandidateActionModal("endorse");
    const nextStage = getNextPipelineStage(timelineStages, {
      stage: candidate.stage,
      substage: candidate.substage,
    });
    if (nextStage) {
      setSelectedCandidate({
        ...candidate,
        toStage: nextStage.stage.name,
        toSubstage: nextStage.substage.name,
        forEvaluation: nextStage.isLastSubstage,
      });
    }
  };

  const handleDropCandidate = (candidate: any) => {
    if (!canManageCandidates) {
      Swal.fire({
        icon: "warning",
        title: "Permission Denied",
        text: "Only Job Owners and Contributors can drop candidates.",
      });
      return;
    }
    setShowCandidateActionModal("drop");
    setSelectedCandidate(candidate);
  };

  const dragEndorsedCandidate = (
    candidateId: string,
    fromStageKey: string,
    fromSubstageKey: string,
    toStageKey: string,
    toSubstageKey: string,
  ) => {
    if (!canManageCandidates) {
      Swal.fire({
        icon: "warning",
        title: "Permission Denied",
        text: "Only Job Owners and Contributors can move candidates between stages.",
      });
      return;
    }

    if (fromStageKey === "Invited" || fromSubstageKey === "Invited") {
      errorToast(
        "Candidate has not signed up yet. They will appear in the first stage automatically after sign-up.",
        2500,
      );
      return;
    }

    const isMovingToAIInterview = toStageKey === "AI Interview";

    // Block if moving to AI Interview without an active plan
    if (isMovingToAIInterview && !isCreditLoading && !hasAnyActivePlan) {
      errorToast(
        isExpired
          ? "AI Interview requires an active plan. Your plan has expired."
          : "AI Interview requires an active plan. Please contact your administrator.",
        3000,
      );
      return;
    }

    const isCreditRestricted =
      isMovingToAIInterview &&
      career?.jobPostType !== "premium" &&
      !hasActivePremiumPlan &&
      hasCreditBasedPlan &&
      !isCreditLoading &&
      isInsufficient;

    if (isCreditRestricted) {
      errorToast(
        `Insufficient credits to move candidates to AI Interview. Maintain at least ${CREDIT_THRESHOLDS.INTERVIEW_COST} credits (current balance: ${balance}).`,
        2000,
      );
      return;
    }

    // Block if job post type doesn't match org's active plans
    if (isMovingToAIInterview && !isCreditLoading) {
      const isPremiumCareer = career?.jobPostType === "premium";
      const isCreditBasedCareer = career?.jobPostType === "credit-based";

      if (isPremiumCareer && !hasActivePremiumPlan) {
        errorToast(
          "This job post is marked as Premium but the organization does not have an active Premium plan. Please update the job post type or assign a Premium plan.",
          3000,
        );
        return;
      }

      if (isCreditBasedCareer && !hasActiveCreditBasedPlan) {
        errorToast(
          "This job post is marked as Credit-based but the organization does not have an active Credit-based plan. Please update the job post type or assign a Credit-based plan.",
          3000,
        );
        return;
      }
    }

    const candidateIndex = (
      timelineStages
        .find((stage: any) => stage.name === fromStageKey)
        ?.substages.find((substage: any) => substage.name === fromSubstageKey)
        ?.candidates as any[]
    ).findIndex((c) => c._id.toString() === candidateId);
    const newStage = timelineStages.find(
      (stage: any) => stage.name === toStageKey,
    );
    const newSubstage = timelineStages
      .find((stage: any) => stage.name === toStageKey)
      ?.substages.find((substage: any) => substage.name === toSubstageKey);
    if (!newSubstage) return;
    const update: any = {
      currentStep: newSubstage.currentStep,
      status: newSubstage.status,
      updatedAt: Date.now(),
      applicationMetadata: {
        updatedAt: Date.now(),
        updatedBy: {
          image: user?.image,
          name: user?.name,
          email: user?.email,
        },
        action: "Endorsed",
      },
      stageId: newStage.id,
      substageId: newSubstage.id,
    };
    if (newSubstage.currentStep === "Contract Signed") {
      update.applicationStatus = "Hired";
    }
    if (candidateIndex !== -1) {
      const updatedStages = [...timelineStages];
      const candidate = updatedStages
        .find((stage: any) => stage.name === fromStageKey)
        ?.substages.find((substage: any) => substage.name === fromSubstageKey)
        ?.candidates?.[candidateIndex];
      // Remove and add to new stage

      const newStageIndex = updatedStages.findIndex(
        (stage: any) => stage.name === toStageKey,
      );
      const newSubstageIndex = updatedStages[
        newStageIndex
      ]?.substages.findIndex(
        (substage: any) => substage.name === toSubstageKey,
      );
      (
        updatedStages[newStageIndex]?.substages[newSubstageIndex]
          ?.candidates as any[]
      ).push({ ...candidate, ...update });
      (
        updatedStages
          .find((stage: any) => stage.name === fromStageKey)
          ?.substages.find((substage: any) => substage.name === fromSubstageKey)
          ?.candidates as any[]
      ).splice(candidateIndex, 1);
      setAndSortCandidates(updatedStages);
      draggedCandidateRef.current = true;
      setShowCandidateActionModal("endorse");
      setSelectedCandidate({
        ...candidate,
        stage: fromStageKey,
        substage: fromSubstageKey,
        toStage: toStageKey,
        toSubstage: toSubstageKey,
        forEvaluation:
          newSubstageIndex ===
          updatedStages[newStageIndex]?.substages.length - 1,
      });
    }
  };

  const handleReconsiderCandidate = (candidate: any) => {
    setShowCandidateActionModal("reconsider");
    setSelectedCandidate(candidate);
  };

  const handleRetakeInterview = async (candidate: any) => {
    setShowCandidateActionModal("retake");
    setSelectedCandidate(candidate);
  };

  const handleCandidateAction = async (action: string, data?: any) => {
    setShowCandidateActionModal("");
    setHideRecruiterEvalForActionModal(false);
    const resolvedStages = selectedCandidate.sourceStages ?? timelineStages;
    const resolvedCareerId = selectedCandidate.sourceCareerId ?? career?._id?.toString();
    if (action === "endorse") {
      const { stage, substage, toStage, toSubstage } = selectedCandidate;
      let draggedStage = null;
      if (toStage && toSubstage) {
        const newStage = resolvedStages.find(
          (stage: any) => stage.name === toStage,
        );
        const newSubstage = newStage?.substages.find(
          (substage: any) => substage.name === toSubstage,
        );
        draggedStage = {
          stage: newStage,
          substage: newSubstage,
        };
      }
      const nextStage =
        draggedStage ||
        getNextPipelineStage(resolvedStages, {
          stage: stage,
          substage: substage,
        });

      const isGoingToAIInterview =
        nextStage?.stage?.name === "AI Interview" &&
        career?.jobPostType !== "premium" &&
        hasCreditBasedPlan &&
        !isCreditLoading;

      if (isGoingToAIInterview && isInsufficient) {
        errorToast(
          `Insufficient credits to move candidates to AI Interview. Maintain at least ${CREDIT_THRESHOLDS.INTERVIEW_COST} credits (current balance: ${balance}).`,
          2000,
        );
        return;
      }

      if (nextStage) {
        try {
          Swal.showLoading();
          const recruiterEvaluation = data?.matchFit
            ? {
                action: "Endorsed",
                matchFit: data?.matchFit,
                evaluationNotes: data?.evaluationNotes,
                updatedBy: {
                  image: user?.image,
                  name: user?.name,
                  email: user?.email,
                },
                createdBy: {
                  image: user?.image,
                  name: user?.name,
                  email: user?.email,
                },
                stageId: nextStage?.stage?.id,
                substageId: nextStage?.substage?.id,
              }
            : null;
          const update: any = {
            currentStep: nextStage?.substage.currentStep,
            status: nextStage?.substage.status,
            updatedAt: Date.now(),
            applicationMetadata: {
              updatedAt: Date.now(),
              updatedBy: {
                image: user?.image,
                name: user?.name,
                email: user?.email,
              },
              action: "Endorsed",
            },
            stageId: nextStage?.stage.id,
            substageId: nextStage?.substage.id,
          };
          if (nextStage?.substage.currentStep === "Contract Signed") {
            update.applicationStatus = "Hired";
          }
          const currentPipelineStage = getCurrentPipelineStage(resolvedStages, {
            status: selectedCandidate.status,
            currentStep: selectedCandidate.currentStep,
            stageId: selectedCandidate.stageId,
            substageId: selectedCandidate.substageId,
          });
          await api.post("/api/update-interview", {
            uid: selectedCandidate._id,
            data: update,
            interviewTransaction: {
              interviewUID: selectedCandidate._id,
              careerId: resolvedCareerId,
              fromStage: `${stage}: ${substage}`,
              toStage: `${nextStage?.stage.name}: ${nextStage?.substage.name}`,
              fromStageId: currentPipelineStage.stage.id,
              fromSubstageId: currentPipelineStage.substage.id,
              toStageId: nextStage?.stage.id,
              toSubstageId: nextStage?.substage.id,
              action: "Endorsed",
              updatedBy: {
                image: user?.image,
                name: user?.name,
                email: user?.email,
              },
            },
            recruiterEvaluation: recruiterEvaluation,
            automationIdsToUse: data?.automationIdsToUse,
            recruiterAction: {
              interviewUID: selectedCandidate._id,
              orgID: career?.orgID,
              action: "Endorsed",
              recruiterEmail: user?.email,
            },
          });
          if (!draggedCandidateRef.current) {
            if (selectedCandidate.sourceCareerId) {
              // Candidate is from an expanded board — update that timeline
              const targetTimeline =
                selectedCandidate.sourceCareerId === parentTimeline.career?._id?.toString()
                  ? parentTimeline
                  : childTimeline;
              const updatedStages = [...targetTimeline.stages];
              const currentStageIndex = updatedStages.findIndex(
                (s) => s.name === stage,
              );
              const currentSubstageIndex = updatedStages[
                currentStageIndex
              ].substages.findIndex((s) => s.name === substage);
              updatedStages[currentStageIndex].substages[
                currentSubstageIndex
              ].candidates = updatedStages[currentStageIndex].substages[
                currentSubstageIndex
              ].candidates.filter((c: any) => c._id !== selectedCandidate._id);
              const nextStageIndex = updatedStages.findIndex(
                (s) => s.name === nextStage?.stage.name,
              );
              const nextSubstageIndex = updatedStages[
                nextStageIndex
              ].substages.findIndex((s) => s.name === nextStage?.substage.name);
              updatedStages[nextStageIndex].substages[
                nextSubstageIndex
              ].candidates.push({ ...selectedCandidate, ...update });
              targetTimeline.setStages(updatedStages);
            } else {
              const updatedStages = [...timelineStages];
              const currentStageIndex = updatedStages.findIndex(
                (s) => s.name === stage,
              );
              const currentSubstageIndex = updatedStages[
                currentStageIndex
              ].substages.findIndex((s) => s.name === substage);
              updatedStages[currentStageIndex].substages[
                currentSubstageIndex
              ].candidates = updatedStages[currentStageIndex].substages[
                currentSubstageIndex
              ].candidates.filter((c: any) => c._id !== selectedCandidate._id);
              const nextStageIndex = updatedStages.findIndex(
                (s) => s.name === nextStage?.stage.name,
              );
              const nextSubstageIndex = updatedStages[
                nextStageIndex
              ].substages.findIndex((s) => s.name === nextStage?.substage.name);
              updatedStages[nextStageIndex].substages[
                nextSubstageIndex
              ].candidates.push({ ...selectedCandidate, ...update });
              setAndSortCandidates(updatedStages);
            }
          } else {
            if (selectedCandidate.sourceCareerId) {
              // Drag endorse on expanded board — candidate already moved locally by createExpandedHandlers
              // Just update the candidate data in the expanded timeline
              const targetTimeline =
                selectedCandidate.sourceCareerId === parentTimeline.career?._id?.toString()
                  ? parentTimeline
                  : childTimeline;
              const updatedStages = [...targetTimeline.stages];
              const stageIndex = updatedStages.findIndex(
                (s) => s.id === nextStage.stage?.id,
              );
              const substageIndex = updatedStages[
                stageIndex
              ]?.substages?.findIndex(
                (substage) => substage.id === nextStage.substage?.id,
              );
              updatedStages[stageIndex].substages[substageIndex].candidates =
                updatedStages[stageIndex].substages[substageIndex].candidates.map(
                  (c: any) =>
                    c._id === selectedCandidate._id
                      ? { ...selectedCandidate, ...update }
                      : c,
                );
              targetTimeline.setStages(updatedStages);
            } else {
              const updatedStages = [...timelineStages];
              const stageIndex = updatedStages.findIndex(
                (s) => s.id === nextStage.stage?.id,
              );
              const substageIndex = updatedStages[
                stageIndex
              ]?.substages?.findIndex(
                (substage) => substage.id === nextStage.substage?.id,
              );
              updatedStages[stageIndex].substages[substageIndex].candidates =
                updatedStages[stageIndex].substages[substageIndex].candidates.map(
                  (c: any) =>
                    c._id === selectedCandidate._id
                      ? { ...selectedCandidate, ...update }
                      : c,
                );
              setAndSortCandidates(updatedStages);
            }
          }
          candidateActionToast(
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginLeft: 8,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span
                  style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}
                >
                  Candidate endorsed
                </span>
                <span
                  style={{
                    fontSize: 14,
                    color: "#717680",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  You have endorsed the candidate to the next stage.
                </span>
              </div>
            </div>,
            1300,
            <i
              className="la la-user-check"
              style={{ color: "#039855", fontSize: 32 }}
            ></i>,
          );
        } catch (error) {
          console.error("error", error);
          const apiError = (error as any)?.response?.data?.error;
          errorToast(apiError || "Failed to endorse candidate", 2000);
        } finally {
          Swal.close();
        }
      }
    }

    if (action === "drop") {
      Swal.showLoading();
      try {
        const { stage, substage } = selectedCandidate;
        const currentStage = getCurrentPipelineStage(resolvedStages, {
          status: selectedCandidate.status,
          currentStep: selectedCandidate.currentStep,
          stageId: selectedCandidate.stageId,
          substageId: selectedCandidate.substageId,
        });
        const recruiterEvaluation = data?.matchFit
          ? {
              action: "Dropped",
              matchFit: data?.matchFit,
              evaluationNotes: data?.evaluationNotes,
              updatedBy: {
                image: user?.image,
                name: user?.name,
                email: user?.email,
              },
              createdBy: {
                image: user?.image,
                name: user?.name,
                email: user?.email,
              },
              stageId: currentStage?.stage?.id,
              substageId: currentStage?.substage?.id,
            }
          : null;
        const update = {
          applicationStatus: "Dropped",
          updatedAt: Date.now(),
          applicationMetadata: {
            updatedAt: Date.now(),
            updatedBy: {
              image: user?.image,
              name: user?.name,
              email: user?.email,
            },
            action: "Dropped",
          },
        };
        const currentPipelineStage = getCurrentPipelineStage(resolvedStages, {
          status: selectedCandidate.status,
          currentStep: selectedCandidate.currentStep,
          stageId: selectedCandidate.stageId,
          substageId: selectedCandidate.substageId,
        });
        await api.post("/api/update-interview", {
          uid: selectedCandidate._id,
          data: update,
          automationIdsToUse: data?.automationIdsToUse,
          // For logging history
          interviewTransaction: {
            interviewUID: selectedCandidate._id,
            careerId: resolvedCareerId,
            fromStage: `${stage}: ${substage}`,
            fromStageId: currentPipelineStage.stage.id,
            fromSubstageId: currentPipelineStage.substage.id,
            action: "Dropped",
            updatedBy: {
              image: user?.image,
              name: user?.name,
              email: user?.email,
            },
          },
          recruiterEvaluation: recruiterEvaluation,
          recruiterAction: {
            interviewUID: selectedCandidate._id,
            orgID: career?.orgID,
            action: "Dropped",
            recruiterEmail: user?.email,
          },
        });
        // Update state
        const isFromInvited = stage === "Invited" && substage === "Invited";
        if (isFromInvited) {
          setInvitedCandidates((prev) =>
            prev.filter((c: any) => c._id !== selectedCandidate._id),
          );
          const matchedStage = timelineStages.find(
            (s: any) => s.id === selectedCandidate.stageId,
          );
          if (matchedStage) {
            const updatedStages = [...timelineStages];
            const stageIndex = updatedStages.findIndex(
              (s: any) => s.id === selectedCandidate.stageId,
            );
            updatedStages[stageIndex].droppedCandidates.push({
              ...selectedCandidate,
              ...update,
              stage: matchedStage.name,
              substage:
                matchedStage.substages.find(
                  (s: any) => s.id === selectedCandidate.substageId,
                )?.name || matchedStage.substages[0]?.name,
              currentEvaluation: recruiterEvaluation,
            });
            setAndSortCandidates(updatedStages);
          }
        } else if (selectedCandidate.sourceCareerId) {
          // Candidate is from an expanded board
          const targetTimeline =
            selectedCandidate.sourceCareerId === parentTimeline.career?._id?.toString()
              ? parentTimeline
              : childTimeline;
          const updatedStages = [...targetTimeline.stages];
          const currentStageIndex = updatedStages.findIndex(
            (s) => s.name === stage,
          );
          if (currentStageIndex !== -1) {
            const currentSubstageIndex = updatedStages[
              currentStageIndex
            ].substages.findIndex((s) => s.name === substage);
            updatedStages[currentStageIndex].substages[
              currentSubstageIndex
            ].candidates = updatedStages[currentStageIndex].substages[
              currentSubstageIndex
            ].candidates.filter((c: any) => c._id !== selectedCandidate._id);
            updatedStages[currentStageIndex].droppedCandidates.push({
              ...selectedCandidate,
              ...update,
              currentEvaluation: recruiterEvaluation,
            });
            targetTimeline.setStages(updatedStages);
          }
        } else if (timelineStages?.find((s) => s.name === stage)) {
          const updatedStages = [...timelineStages];
          const currentStageIndex = updatedStages.findIndex(
            (s) => s.name === stage,
          );
          const currentSubstageIndex = updatedStages[
            currentStageIndex
          ].substages.findIndex((s) => s.name === substage);
          updatedStages[currentStageIndex].substages[
            currentSubstageIndex
          ].candidates = updatedStages[currentStageIndex].substages[
            currentSubstageIndex
          ].candidates.filter((c: any) => c._id !== selectedCandidate._id);
          updatedStages[currentStageIndex].droppedCandidates.push({
            ...selectedCandidate,
            ...update,
            currentEvaluation: recruiterEvaluation,
          });
          setAndSortCandidates(updatedStages);
        }
        candidateActionToast(
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginLeft: 8,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                Candidate dropped
              </span>
              <span
                style={{
                  fontSize: 14,
                  color: "#717680",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                You have dropped the candidate from the application
                process.{" "}
              </span>
            </div>
          </div>,
          1300,
          <i
            className="la la-user-minus"
            style={{ color: "#D92D20", fontSize: 32 }}
          ></i>,
        );
      } catch (error) {
        console.error("error", error);
        errorToast("Failed to drop candidate", 1300);
      } finally {
        Swal.close();
      }
    }

    if (action === "reconsider") {
      Swal.showLoading();
      try {
        const { stage, substage } = selectedCandidate;
        const update = {
          applicationStatus: "Ongoing",
          updatedAt: Date.now(),
          applicationMetadata: {
            updatedAt: Date.now(),
            updatedBy: {
              image: user?.image,
              name: user?.name,
              email: user?.email,
            },
            action: "Reconsidered",
          },
          archived: false,
        };
        const currentPipelineStage = getCurrentPipelineStage(timelineStages, {
          status: selectedCandidate.status,
          currentStep: selectedCandidate.currentStep,
          stageId: selectedCandidate.stageId,
          substageId: selectedCandidate.substageId,
        });
        await api.post("/api/update-interview", {
          uid: selectedCandidate._id,
          data: update,
          interviewTransaction: {
            interviewUID: selectedCandidate._id,
            careerId: career?._id?.toString(),
            fromStage: `${stage}: ${substage}`,
            fromStageId: currentPipelineStage.stage.id,
            fromSubstageId: currentPipelineStage.substage.id,
            action: "Reconsidered",
            updatedBy: {
              image: user?.image,
              name: user?.name,
              email: user?.email,
            },
          },
          recruiterAction: {
            interviewUID: selectedCandidate._id,
            orgID: career?.orgID,
            action: "Reconsidered",
            recruiterEmail: user?.email,
          },
        });
        if (timelineStages?.find((s) => s.name === stage)) {
          const updatedStages = [...timelineStages];
          const currentStageIndex = updatedStages.findIndex(
            (s) => s.name === stage,
          );
          const currentSubstageIndex = updatedStages[
            currentStageIndex
          ].substages.findIndex((s) => s.name === substage);
          updatedStages[currentStageIndex].droppedCandidates = updatedStages[
            currentStageIndex
          ].droppedCandidates.filter(
            (c: any) => c._id !== selectedCandidate._id,
          );
          updatedStages[currentStageIndex].substages[
            currentSubstageIndex
          ].candidates.push({ ...selectedCandidate, ...update });
          setAndSortCandidates(updatedStages);
        }
        candidateActionToast(
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginLeft: 8,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                Candidate reconsidered
              </span>
              <span
                style={{
                  fontSize: 14,
                  color: "#717680",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                You have reconsidered the candidate back to the ongoing stage.
              </span>
            </div>
          </div>,
          1300,
          <i
            className="la la-user-check"
            style={{ color: "#039855", fontSize: 32 }}
          ></i>,
        );
      } catch (error) {
        console.error("error", error);
        errorToast("Failed to reconsider candidate", 1300);
      } finally {
        Swal.close();
      }
    }
    if (action === "approve") {
      Swal.showLoading();
      // reset interview data
      try {
        await api.post("/api/reset-interview-data", {
          id: selectedCandidate._id,
        });

        const update = {
          status: "Approved",
          updatedAt: Date.now(),
          approvedBy: {
            image: user.image,
            name: user.name,
            email: user.email,
          },
        };
        const currentPipelineStage = getCurrentPipelineStage(timelineStages, {
          status: selectedCandidate.status,
          currentStep: selectedCandidate.currentStep,
          stageId: selectedCandidate.stageId,
          substageId: selectedCandidate.substageId,
        });
        await api.post("/api/update-interview", {
          uid: selectedCandidate._id,
          data: {
            retakeRequest: update,
          },
          interviewTransaction: {
            interviewUID: selectedCandidate._id,
            careerId: career?._id?.toString(),
            fromStage: getStage(selectedCandidate),
            toStage: "Pending AI Interview",
            fromStageId: currentPipelineStage.stage.id,
            fromSubstageId: currentPipelineStage.substage.id,
            toStageId: DEFAULT_JOB_PIPELINE?.[1]?.id,
            toSubstageId: DEFAULT_JOB_PIPELINE?.[1]?.substages?.[0]?.id,
            action: "Endorsed",
            updatedBy: {
              image: user?.image,
              name: user?.name,
              email: user?.email,
            },
          },
          recruiterAction: {
            interviewUID: selectedCandidate._id,
            orgID: career?.orgID,
            action: "Approved Retake Request",
            recruiterEmail: user?.email,
          },
        });
        Swal.close();
        candidateActionToast(
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginLeft: 8,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                Approved request
              </span>
              <span
                style={{
                  fontSize: 14,
                  color: "#717680",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                You have approved <strong>{selectedCandidate?.name}'s</strong>{" "}
                request to retake interview.
              </span>
            </div>
          </div>,
          1300,
          <i
            className="la la-check-circle"
            style={{ color: "#039855", fontSize: 32 }}
          ></i>,
        );
        const { stage, substage } = selectedCandidate;
        if (timelineStages?.find((s) => s.name === stage)) {
          const updatedStages = [...timelineStages];
          const currentStageIndex = updatedStages.findIndex(
            (s) => s.name === stage,
          );
          const currentSubstageIndex = updatedStages[
            currentStageIndex
          ].substages.findIndex((s) => s.name === substage);
          updatedStages[currentStageIndex].substages[
            currentSubstageIndex
          ].candidates = updatedStages[currentStageIndex].substages[
            currentSubstageIndex
          ].candidates.map((c: any) =>
            c._id === selectedCandidate._id
              ? { ...c, retakeRequest: update }
              : c,
          );
          setAndSortCandidates(updatedStages);
        }
      } catch (error) {
        console.error("error", error);
        Swal.close();
        errorToast("Failed to approve request", 1300);
      }
    }

    if (action === "reject") {
      Swal.showLoading();
      try {
        const update = {
          status: "Rejected",
          updatedAt: Date.now(),
          approvedBy: {
            image: user.image,
            name: user.name,
            email: user.email,
          },
        };
        await api.post("/api/update-interview", {
          uid: selectedCandidate._id,
          data: {
            retakeRequest: update,
          },
          recruiterAction: {
            interviewUID: selectedCandidate._id,
            orgID: career?.orgID,
            action: "Rejected Retake Request",
            recruiterEmail: user?.email,
          },
        });

        Swal.close();
        candidateActionToast(
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginLeft: 8,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}>
                Rejected request
              </span>
              <span
                style={{
                  fontSize: 14,
                  color: "#717680",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                You have rejected <strong>{selectedCandidate?.name}'s</strong>{" "}
                request to retake interview.
              </span>
            </div>
          </div>,
          1300,
          <i
            className="la la-times-circle"
            style={{ color: "#D92D20", fontSize: 32 }}
          ></i>,
        );
        const { stage, substage } = selectedCandidate;
        if (timelineStages?.find((s) => s.name === stage)) {
          const updatedStages = [...timelineStages];
          const currentStageIndex = updatedStages.findIndex(
            (s) => s.name === stage,
          );
          const currentSubstageIndex = updatedStages[
            currentStageIndex
          ].substages.findIndex((s) => s.name === substage);
          updatedStages[currentStageIndex].substages[
            currentSubstageIndex
          ].candidates = updatedStages[currentStageIndex].substages[
            currentSubstageIndex
          ].candidates.map((c: any) =>
            c._id === selectedCandidate._id
              ? { ...c, retakeRequest: update }
              : c,
          );
          setAndSortCandidates(updatedStages);
        }
      } catch (error) {
        console.error("error", error);
        Swal.close();
        errorToast("Failed to reject request", 1300);
      }
    }

    if (action === "invite") {
      try {
        Swal.showLoading();
        const response = await api.post("/api/invite-candidate-to-career", {
          sourceInterviewId: selectedCandidate._id,
          targetCareerIds: selectedCandidate.selectedCareers.map(
            (c: any) => c._id,
          ),
          candidateEmail: selectedCandidate.email,
          invitedBy: {
            name: user?.name,
            email: user?.email,
            image: user?.image,
          },
          sourceCareerIdOverride: selectedCandidate.sourceCareerIdOverride,
          forceTransfer: selectedCandidate.forceTransfer,
          automationIdsToUse: (data as any)?.automationIdsToUse,
          targetStageId: selectedCandidate.targetStageId,
          targetSubstageId: selectedCandidate.targetSubstageId,
        });
        Swal.close();

        const { created, skipped, blocked } = response.data;
        if (created?.length > 0) {
          const expandedChildMongoId = childTimeline.career?._id?.toString();
          const expandedChildRouteId =
            childTimeline.career?.id || expandedChildMongoId;
          const shouldRefreshExpandedChild =
            Boolean(expandedChildRouteId) &&
            created.some(
              (createdCareer: any) => createdCareer.careerId === expandedChildMongoId,
            );

          if (shouldRefreshExpandedChild && expandedChildRouteId && orgID) {
            childTimeline.expand(expandedChildRouteId, orgID);
          }
          candidateActionToast(
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginLeft: 8,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span
                  style={{ fontSize: 14, fontWeight: 700, color: "#181D27" }}
                >
                  Candidate invited
                </span>
                <span
                  style={{
                    fontSize: 14,
                    color: "#717680",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {selectedCandidate?.name} has been invited to {created.length}{" "}
                  job{created.length > 1 ? "s" : ""}.
                </span>
              </div>
            </div>,
            1300,
            <i
              className="la la-user-plus"
              style={{ color: "#1570EF", fontSize: 32 }}
            ></i>,
          );
        }
        if (blocked?.length > 0) {
          errorToast(
            `${blocked.length} job(s) blocked: ${blocked.map((b: any) => b.careerTitle).join(", ")}`,
            3000,
          );
        }
        if (skipped?.length > 0) {
          errorToast(
            `${skipped.length} job(s) skipped: ${skipped.map((s: any) => s.reason).join(", ")}`,
            2000,
          );
        }
      } catch (error) {
        console.error("Error inviting candidate:", error);
        Swal.close();
        errorToast("Failed to invite candidate", 1300);
      }
    }

    if (!action && draggedCandidateRef.current) {
      // Revert the changes since cancelled
      const { stage, substage, toStage, toSubstage } = selectedCandidate;
      if (selectedCandidate.sourceCareerId) {
        // Revert on the correct expanded timeline
        const targetTimeline =
          selectedCandidate.sourceCareerId === parentTimeline.career?._id?.toString()
            ? parentTimeline
            : childTimeline;
        const revertedStages = [...targetTimeline.stages];
        const newCandidateIndex = (
          revertedStages
            .find((s) => s.name === toStage)
            ?.substages.find((substage: any) => substage.name === toSubstage)
            ?.candidates as any[]
        ).findIndex((c) => c._id.toString() === selectedCandidate._id);
        (
          revertedStages
            .find((s) => s.name === stage)
            ?.substages.find((s: any) => s.name === substage)?.candidates as any[]
        ).push(selectedCandidate);
        (
          revertedStages
            .find((s) => s.name === toStage)
            ?.substages.find((s: any) => s.name === toSubstage)
            ?.candidates as any[]
        ).splice(newCandidateIndex, 1);
        targetTimeline.setStages(revertedStages);
      } else {
        const revertedStages = [...timelineStages];
        const newCandidateIndex = (
          revertedStages
            .find((s) => s.name === toStage)
            ?.substages.find((substage: any) => substage.name === toSubstage)
            ?.candidates as any[]
        ).findIndex((c) => c._id.toString() === selectedCandidate._id);
        (
          revertedStages
            .find((s) => s.name === stage)
            ?.substages.find((s: any) => s.name === substage)?.candidates as any[]
        ).push(selectedCandidate);
        (
          revertedStages
            .find((s) => s.name === toStage)
            ?.substages.find((s: any) => s.name === toSubstage)
            ?.candidates as any[]
        ).splice(newCandidateIndex, 1);
        setAndSortCandidates(revertedStages);
      }
      draggedCandidateRef.current = false;
    }

    if (draggedCandidateRef.current) {
      draggedCandidateRef.current = false;
    }
  };

  // Linked career expansion helpers
  const isLinkedCareer = career?.careerPostType === "candidate_pool" || career?.careerPostType === "receiving_pool";
  const isParentExpanded = career?.careerPostType === "receiving_pool" && parentTimeline.isExpanded && parentTimeline.stages.length > 0;
  const isChildExpanded = career?.careerPostType === "candidate_pool" && childTimeline.isExpanded && childTimeline.stages.length > 0;

  const handleExpandedEmailAutomation = (expandedCareerId: string, expandedCareerName: string) => {
    setEmailAutomationCareerId(expandedCareerId);
    setEmailAutomationCareerName(expandedCareerName);
    setEmailAutomation(true);
  };

  const handleMainEmailAutomation = (value: boolean) => {
    setEmailAutomationCareerId(undefined);
    setEmailAutomationCareerName(undefined);
    setEmailAutomation(value);
  };

  const emailAutomationTimelineStages = useMemo(() => {
    if (!emailAutomationCareerId) return enabledTimelineStages;
    const parentId = parentTimeline.career?._id?.toString();
    if (parentId && parentId === emailAutomationCareerId) return parentTimeline.stages;
    const childId = childTimeline.career?._id?.toString();
    if (childId && childId === emailAutomationCareerId) return childTimeline.stages;
    return enabledTimelineStages;
  }, [emailAutomationCareerId, parentTimeline.career, parentTimeline.stages, childTimeline.career, childTimeline.stages, enabledTimelineStages]);

  // Create handlers for expanded board candidates
  const createExpandedHandlers = (timeline: ReturnType<typeof useLinkedCareerTimeline>) => {
    if (!timeline.career) return null;
    return {
      handleEndorseCandidate: (candidate: any) => {
        const nextStage = getNextPipelineStage(timeline.stages, {
          stage: candidate.stage,
          substage: candidate.substage,
        });
        if (nextStage) {
          setSelectedCandidate({
            ...candidate,
            toStage: nextStage.stage.name,
            toSubstage: nextStage.substage.name,
            forEvaluation: nextStage.isLastSubstage,
            sourceCareerId: timeline.career?._id?.toString(),
            sourceStages: timeline.stages,
          });
          setShowCandidateActionModal("endorse");
        }
      },
      handleDropCandidate: (candidate: any) => {
        setSelectedCandidate({
          ...candidate,
          sourceCareerId: timeline.career?._id?.toString(),
          sourceStages: timeline.stages,
        });
        setShowCandidateActionModal("drop");
      },
      dragEndorsedCandidate: (
        candidateId: string,
        fromStageKey: string,
        fromSubstageKey: string,
        toStageKey: string,
        toSubstageKey: string,
      ) => {
        const stages = timeline.stages;
        const candidateIndex = (
          stages
            .find((stage: any) => stage.name === fromStageKey)
            ?.substages.find((substage: any) => substage.name === fromSubstageKey)
            ?.candidates as any[]
        )?.findIndex((c: any) => c._id?.toString() === candidateId);
        if (candidateIndex === undefined || candidateIndex === -1) return;
        const newStage = stages.find((stage: any) => stage.name === toStageKey);
        const newSubstage = newStage?.substages.find((substage: any) => substage.name === toSubstageKey);
        if (!newSubstage) return;
        const updatedStages = [...stages];
        const candidate = updatedStages
          .find((stage: any) => stage.name === fromStageKey)
          ?.substages.find((substage: any) => substage.name === fromSubstageKey)
          ?.candidates?.[candidateIndex];
        const newStageIndex = updatedStages.findIndex((stage: any) => stage.name === toStageKey);
        const newSubstageIndex = updatedStages[newStageIndex]?.substages.findIndex(
          (substage: any) => substage.name === toSubstageKey,
        );
        const update: any = {
          currentStep: newSubstage.currentStep,
          status: newSubstage.status,
          updatedAt: Date.now(),
          stageId: newStage.id,
          substageId: newSubstage.id,
        };
        (updatedStages[newStageIndex]?.substages[newSubstageIndex]?.candidates as any[]).push({ ...candidate, ...update });
        (updatedStages
          .find((stage: any) => stage.name === fromStageKey)
          ?.substages.find((substage: any) => substage.name === fromSubstageKey)
          ?.candidates as any[]).splice(candidateIndex, 1);
        timeline.setStages(updatedStages);
        draggedCandidateRef.current = true;
        setShowCandidateActionModal("endorse");
        setSelectedCandidate({
          ...candidate,
          stage: fromStageKey,
          substage: fromSubstageKey,
          toStage: toStageKey,
          toSubstage: toSubstageKey,
          forEvaluation: newSubstageIndex === updatedStages[newStageIndex]?.substages.length - 1,
          sourceCareerId: timeline.career?._id?.toString(),
          sourceStages: timeline.stages,
        });
      },
    };
  };

  const parentHandlers = isParentExpanded ? createExpandedHandlers(parentTimeline) : null;
  const childHandlers = isChildExpanded ? createExpandedHandlers(childTimeline) : null;

  return (
    <>
      {/* Header */}
      <HeaderBar
        activeLink="Careers"
        currentPage={(activeOrg?.linkedCareersEnabled && formData.childTitle && formData.parentCareerTitle ? formData.parentCareerTitle : formData.jobTitle)?.replace(/<[^>]*>/g, "") || ""}
        icon="la la-suitcase"
      />
      <div
        className="container-fluid mt--7"
        style={{ padding: "5rem 0px 6rem 0px", height: "100%" }}
      >
        {!emailAutomation && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {isEditing ? (
              <input
                type="text"
                value={formData.jobTitle}
                onChange={(e) =>
                  setFormData({ ...formData, jobTitle: e.target.value })
                }
                style={{
                  color: "#030217",
                  fontWeight: 550,
                  fontSize: 30,
                  width: "70%",
                }}
              />
            ) : (
              <div style={{ maxWidth: "70%" }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <h1
                    style={{ color: "#030217", fontWeight: 550, fontSize: 30 }}
                  >
                    {(() => {
                      const displayTitle = activeOrg?.linkedCareersEnabled && formData.childTitle && formData.parentCareerTitle
                        ? formData.parentCareerTitle
                        : formData.jobTitle;
                      return typeof window !== "undefined"
                        ? new DOMParser().parseFromString(displayTitle, "text/html").body.textContent
                        : displayTitle;
                    })()}
                  </h1>
                  {career && (
                    <>
                      <CareerStatusBadges career={formData} />
                      {activeTab === "career-settings" && (
                        <button
                          onClick={() => setShowCareerStatusModal(true)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "2px 10px",
                            borderRadius: "8px",
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #D5D7DA",
                            fontWeight: 700,
                            fontSize: 14,
                            color: "#414651",
                          }}
                        >
                          Update
                        </button>
                      )}
                    </>
                  )}
                </div>
                {activeOrg?.linkedCareersEnabled && career && (
                  <CareerHierarchyBadge career={career} orgID={orgID} />
                )}
              </div>
            )}
            {/* <div style={{ display: "flex", gap: 16, alignItems: "center", textAlign: "center" }}>
                <div style={{ color: "#030217" }}>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>{hired}</div>
                    <div style={{ fontSize: 14 }}>Hired</div>
                </div>
                <div style={{ width: 1, height: "50px", background: "#E9EAEB", marginLeft: "15px", marginRight: "15px" }} />
                <div  style={{ color: "#030217" }}>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>{interviewsInProgress}</div>
                    <div style={{ fontSize: 14 }}>In Progress</div>
                </div>
                <div style={{ width: 1, height: "50px", background: "#E9EAEB", marginLeft: "15px", marginRight: "15px"  }} />
                <div style={{ color: "#030217" }}>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>{dropped}</div>
                    <div style={{ fontSize: 14 }}>Dropped</div>
                </div> 
                </div> */}

            {/* Options dropdown */}
            {activeTab === "application-timeline" && (
              <div ref={optionsDropdownRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setOptionsDropdownOpen((prev) => !prev)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    borderRadius: 8,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #D5D7DA",
                    fontWeight: 700,
                    fontSize: 14,
                    color: "#414651",
                    cursor: "pointer",
                    boxShadow: "0 1px 2px 0 rgba(10,13,18,0.05)",
                  }}
                >
                  Options
                  <img
                    src="/icons/chevron-down.svg"
                    alt=""
                    style={{
                      height: 16,
                      width: 16,
                      transition: "transform 0.2s",
                      transform: optionsDropdownOpen ? "rotate(180deg)" : "none",
                    }}
                  />
                </button>

                {optionsDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 4px)",
                      zIndex: 50,
                      minWidth: 200,
                      background: "#fff",
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 8,
                      boxShadow:
                        "0 12px 16px -4px rgba(10,13,18,0.08), 0 4px 6px -2px rgba(10,13,18,0.03)",
                      display: "flex",
                      flexDirection: "column",
                      padding: "4px 0",
                    }}
                  >
                    {interviewsInProgress > 0 && (
                      <div style={{ padding: "1px 6px" }}>
                        <button
                          onClick={() => {
                            setOptionsDropdownOpen(false);
                            const candidates = timelineStages.flatMap((stage) => {
                              const ongoingCandidates = stage.substages.flatMap(
                                (substage) => {
                                  return substage.candidates.map((c) => {
                                    return {
                                      ...c,
                                      stage: `${stage.name} - ${substage.name}`,
                                    };
                                  });
                                },
                              );
                              const droppedCandidates = stage.droppedCandidates.map(
                                (dropped) => {
                                  return {
                                    ...dropped,
                                    stage: `${dropped.stage} - ${dropped.substage}`,
                                  };
                                },
                              );
                              return [...ongoingCandidates, ...droppedCandidates];
                            });
                            const csvContent =
                              "NAME,EMAIL,JOB TITLE,DATE APPLIED,APPLICATION STATUS,APPLICATION STAGE,CV SCREENING RATING,AI INTERVIEW RATING,LAST MOVEMENT DATE,LAST ACTIVITY DATE" +
                              "\n" +
                              candidates
                                .map((candidate) => {
                                  return [
                                    candidate.name?.replace(/,/g, ""),
                                    candidate.email?.replace(/,/g, ""),
                                    career.jobTitle?.replace(/,/g, ""),
                                    new Date(candidate.createdAt).toLocaleDateString(),
                                    candidate.applicationStatus,
                                    candidate.stage,
                                    candidate.cvStatus || "N/A",
                                    candidate.jobFit || "N/A",
                                    candidate.latestApplicationMovement?.createdAt
                                      ? new Date(
                                          candidate.latestApplicationMovement.createdAt,
                                        ).toLocaleDateString()
                                      : "N/A",
                                    candidate.latestRecruiterAction?.createdAt
                                      ? `${candidate.latestRecruiterAction.action} on ${new Date(candidate.latestRecruiterAction.createdAt).toLocaleDateString()}`
                                      : "N/A",
                                  ];
                                })
                                .join("\n");
                            const encodedUri =
                              "data:text/csv;charset=utf-8," +
                              encodeURIComponent(csvContent);
                            const link = document.createElement("a");
                            link.setAttribute("href", encodedUri);
                            link.setAttribute(
                              "download",
                              `${career.jobTitle}-Candidates-${new Date().toLocaleDateString()}.csv`,
                            );
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: 6,
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            transition: "background 0.2s",
                          }}
                          onMouseEnter={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.background =
                              "#F9F9FB")
                          }
                          onMouseLeave={(e) =>
                            ((e.currentTarget as HTMLButtonElement).style.background =
                              "transparent")
                          }
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            <img
                              src="/icons/download-cloud-02.svg"
                              alt=""
                              style={{ height: 16, width: 16, flexShrink: 0 }}
                            />
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: "#414651",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Export Candidates
                            </span>
                          </span>
                          <span
                            style={{
                              padding: "1px 4px",
                              border: "1px solid #E9EAEB",
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 500,
                              color: "#A4A7AE",
                              flexShrink: 0,
                            }}
                          >
                            CSV
                          </span>
                        </button>
                      </div>
                    )}

                    <div style={{ padding: "1px 6px" }}>
                      <button
                        onClick={() => {
                          setOptionsDropdownOpen(false);
                          setEmailAutomation(true);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 6,
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          transition: "background 0.2s",
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.background =
                            "#F9F9FB")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.background =
                            "transparent")
                        }
                      >
                        <img
                          src="/icons/zap.svg"
                          alt=""
                          style={{ height: 16, width: 16, flexShrink: 0 }}
                        />
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: "#414651",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Email Automations
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {/* Tabs */}
        {!emailAutomation && (
          <div className="career-tab-container">
            <div className="career-tab-content">
              {tabs.map((tab) => (
                <div
                  key={tab.value}
                  className={`career-tab-item ${
                    activeTab === tab.value ? "active" : ""
                  }`}
                  onClick={() => handleTabChange(tab.value)}
                >
                  <i
                    className={`la la-${tab.icon}`}
                    style={{ fontSize: 20, marginRight: 8 }}
                  ></i>
                  {tab.label}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Career Tab Information */}
        {activeTab === "application-timeline" && (
          activeOrg?.linkedCareersEnabled && isLinkedCareer && !emailAutomation ? (
            // Linked career: single continuous scrollable container
            <div className="career-stage-container" onDragStartCapture={() => { activeDragBoardRef.current = "main"; }}>
              {/* Parent Expander (collapsed) */}
              {career?.careerPostType === "receiving_pool" && !parentTimeline.isExpanded && (
                <LinkedCareerExpander
                  direction="left"
                  expanded={false}
                  loading={parentTimeline.isLoading}
                  onClick={() => {
                    if (career?.parentCareerID && orgID) {
                      parentTimeline.expand(career.parentCareerID, orgID);
                      return;
                    }

                    setShowMissingParentModal(true);
                  }}
                />
              )}

              {/* Parent Expanded Board */}
              {isParentExpanded && parentHandlers && (
                <ExpandedBoardPanel
                  direction="left"
                  boardKey="parent"
                  stages={parentTimeline.stages}
                  handlers={parentHandlers}
                  handleCandidateMenuOpen={(candidate, _board) => handleCandidateMenuOpen(candidate)}
                  handleCandidateCVOpen={handleCandidateCVOpen}
                  handleDroppedCandidatesOpen={(stage, _board) => handleDroppedCandidatesOpen(stage)}
                  handleCandidateHistoryOpen={handleCandidateHistoryOpen}
                  handleRetakeInterview={(candidate, _board) => handleRetakeInterview(candidate)}
                  handleInviteToJob={(candidate, _board) => handleInviteToJob(candidate)}
                  canManageCandidates={canManageCandidates}
                  activeDropdown={activeDropdown}
                  setActiveDropdown={setActiveDropdown}
                  onEmailAutomationOpen={(_boardKey) => {
                    const id = parentTimeline.career?._id?.toString();
                    const name = parentTimeline.career?.jobTitle || "";
                    if (id) handleExpandedEmailAutomation(id, name);
                  }}
                  activeDragBoardRef={activeDragBoardRef}
                />
              )}

              {/* Parent Expanded Separator */}
              {isParentExpanded && (
                <div className={linkedStyles.separatorColumn}>
                  <LinkedCareerExpander
                    direction="left"
                    expanded={true}
                    onClick={() => parentTimeline.collapse()}
                  />
                  <div className={linkedStyles.separatorLine} />
                </div>
              )}

              {/* Main Board Columns */}
              <CareerStageColumn
                careerName={career?.jobTitle || formData?.jobTitle || ""}
                emailAutomation={false}
                setEmailAutomation={handleMainEmailAutomation}
                timelineStages={enabledTimelineStages}
                invitedCandidates={invitedCandidates}
                handleCandidateMenuOpen={handleCandidateMenuOpen}
                handleCandidateCVOpen={handleCandidateCVOpen}
                handleDroppedCandidatesOpen={handleDroppedCandidatesOpen}
                handleEndorseCandidate={handleEndorseCandidate}
                handleDropCandidate={handleDropCandidate}
                dragEndorsedCandidate={dragEndorsedCandidate}
                handleCandidateHistoryOpen={handleCandidateHistoryOpen}
                handleRetakeInterview={handleRetakeInterview}
                handleInviteToJob={handleInviteToJob}
                canManageCandidates={canManageCandidates}
                activeDropdown={activeDropdown}
                setActiveDropdown={setActiveDropdown}
                activeDragBoardRef={activeDragBoardRef}
                onCrossBoardDrop={isParentExpanded ? (candidateId: string, srcStage: string, srcSubstage: string, tgtStageName: string, tgtSubstageName: string, sourceBoardId: string) => {
                  if (sourceBoardId !== "parent") return;
                  const candidate = parentTimeline.stages
                    ?.flatMap((s: any) => s.substages?.flatMap((sub: any) =>
                      sub.candidates?.map((c: any) => ({ ...c, stage: s.name, substage: sub.name }))
                    ))
                    ?.find((c: any) => c?._id === candidateId);
                  if (!candidate) return;

                  const tgtStage = enabledTimelineStages.find((s: any) => s.name === tgtStageName);
                  const tgtSubstage = tgtStage?.substages?.find((sub: any) => sub.name === tgtSubstageName);

                  handleCrossBoardInvite(
                    candidate,
                    career,
                    parentTimeline.career?.id,
                    tgtStage?.id,
                    tgtSubstage?.id,
                  );
                } : undefined}
              />

              {/* Child Expanded Separator */}
              {isChildExpanded && (
                <div className={linkedStyles.separatorColumn}>
                  <LinkedCareerExpander
                    direction="right"
                    expanded={true}
                    onClick={() => childTimeline.collapse()}
                    childTitle={career?.childTitle || childTimeline.career?.childTitle}
                  />
                  <div className={linkedStyles.separatorLine} />
                </div>
              )}

              {/* Child Expanded Board */}
              {isChildExpanded && childHandlers && (
                <ExpandedBoardPanel
                  direction="right"
                  boardKey="child"
                  stages={childTimeline.stages}
                  handlers={childHandlers}
                  handleCandidateMenuOpen={(candidate, _board) => handleCandidateMenuOpen(candidate)}
                  handleCandidateCVOpen={handleCandidateCVOpen}
                  handleDroppedCandidatesOpen={(stage, _board) => handleDroppedCandidatesOpen(stage)}
                  handleCandidateHistoryOpen={handleCandidateHistoryOpen}
                  handleRetakeInterview={(candidate, _board) => handleRetakeInterview(candidate)}
                  handleInviteToJob={(candidate, _board) => handleInviteToJob(candidate)}
                  canManageCandidates={canManageCandidates}
                  activeDropdown={activeDropdown}
                  setActiveDropdown={setActiveDropdown}
                  onEmailAutomationOpen={(_boardKey) => {
                    const id = childTimeline.career?._id?.toString();
                    const name = childTimeline.career?.jobTitle || "";
                    if (id) handleExpandedEmailAutomation(id, name);
                  }}
                  activeDragBoardRef={activeDragBoardRef}
                  onCrossBoardDrop={(candidateId, srcStage, srcSubstage, tgtStageName, tgtSubstageName) => {
                    const candidate = enabledTimelineStages
                      ?.flatMap((s: any) => s.substages?.flatMap((sub: any) =>
                        sub.candidates?.map((c: any) => ({ ...c, stage: s.name, substage: sub.name }))
                      ))
                      ?.find((c: any) => c?._id === candidateId);
                    if (!candidate) return;

                    const tgtStage = childTimeline.stages.find((s: any) => s.name === tgtStageName);
                    const tgtSubstage = tgtStage?.substages?.find((sub: any) => sub.name === tgtSubstageName);

                    handleCrossBoardInvite(
                      candidate,
                      childTimeline.career,
                      career?.id,
                      tgtStage?.id,
                      tgtSubstage?.id,
                    );
                  }}
                />
              )}

              {/* Child Expander (collapsed) */}
              {career?.careerPostType === "candidate_pool" && !childTimeline.isExpanded && (
                <LinkedCareerExpander
                  direction="right"
                  expanded={false}
                  loading={childTimeline.isLoading}
                  onClick={() => setShowChildModal(true)}
                />
              )}
            </div>
          ) : (
            // Standalone career or email automation: original behavior
            <CareerStageColumn
              careerName={emailAutomationCareerName || career?.jobTitle || formData?.jobTitle || ""}
              careerId={emailAutomationCareerId}
              emailAutomation={emailAutomation}
              setEmailAutomation={handleMainEmailAutomation}
              timelineStages={emailAutomationTimelineStages}
              invitedCandidates={invitedCandidates}
              handleCandidateMenuOpen={handleCandidateMenuOpen}
              handleCandidateCVOpen={handleCandidateCVOpen}
              handleDroppedCandidatesOpen={handleDroppedCandidatesOpen}
              handleEndorseCandidate={handleEndorseCandidate}
              handleDropCandidate={handleDropCandidate}
              dragEndorsedCandidate={dragEndorsedCandidate}
              handleCandidateHistoryOpen={handleCandidateHistoryOpen}
              handleRetakeInterview={handleRetakeInterview}
              handleInviteToJob={handleInviteToJob}
              canManageCandidates={canManageCandidates}
              activeDropdown={activeDropdown}
              setActiveDropdown={setActiveDropdown}
            />
          )
        )}
        {activeTab === "all-applicants" && (
          <CareerApplicantsTable
            slug={career?.id}
            pipelineStages={timelineStages}
            career={career}
          />
        )}
        {activeTab === "career-settings" && (
          <CareerDescriptionView
            formData={formData}
            setFormData={setFormData}
            deletePreview={
              career
                ? {
                    childCareers: career.childCareers ?? [],
                    parentCareer: career.parentCareer ?? null,
                  }
                : undefined
            }
            onEdit={(section) => {
              // Map section names to step indices and section IDs
              const sectionMapping: {
                [key: string]: { step: number; sectionId?: string };
              } = {
                "Career Details & Team Access": {
                  step: 0,
                  sectionId: "team-access",
                },
                teamAccess: { step: 0, sectionId: "team-access" },
                "Pipeline Stages": { step: 1 },
                pipelineStages: { step: 1 },
                "CV Review & Pre-Screening Questions": { step: 2 },
                cvReview: { step: 2 },
                preScreening: { step: 2, sectionId: "pre-screening" },
                "AI Interview Questions": { step: 3 },
                aiInterview: { step: 3 },
              };

              const mapping = sectionMapping[section] || { step: 0 };
              const url = `/recruiter-dashboard/careers/edit-career/${
                formData._id
              }?orgID=${orgID}&step=${mapping.step}${
                mapping.sectionId ? `&section=${mapping.sectionId}` : ""
              }`;
              router.push(url);
            }}
          />
        )}
        {activeTab === "emails" && (
          <div style={{ marginTop: 20 }}>
            <EmailModule careerId={career?.id} />
          </div>
        )}
        {activeTab === "activity-tracker" && (
          <div style={{ marginTop: 20 }}>
            <ActivityTracker orgID={orgID} career={career} />
          </div>
        )}
        {candidateMenuOpen && (
          <CandidateMenu
            handleCandidateMenuOpen={handleCandidateMenuOpen}
            pipelineStages={timelineStages}
            candidate={selectedCandidate}
            handleCandidateCVOpen={handleCandidateCVOpen}
            handleEndorseCandidate={handleEndorseCandidate}
            handleDropCandidate={handleDropCandidate}
            handleCandidateAnalysisComplete={handleCandidateAnalysisComplete}
            handleRetakeInterview={handleRetakeInterview}
            canManageCandidates={canManageCandidates}
          />
        )}
        {candidateCVOpen && (
          <CandidateModal
            candidate={selectedCandidate}
            setShowCandidateModal={setCandidateCVOpen}
          />
        )}
        {droppedCandidatesOpen && (
          <DroppedCandidates
            handleDroppedCandidatesOpen={setDroppedCandidatesOpen}
            timelineStage={selectedDroppedCandidates}
            handleCandidateMenuOpen={handleCandidateMenuOpen}
            handleCandidateCVOpen={handleCandidateCVOpen}
            handleReconsiderCandidate={handleReconsiderCandidate}
          />
        )}
        {showCandidateHistory && (
          <CandidateHistory
            candidate={selectedCandidateHistory}
            setShowCandidateHistory={setShowCandidateHistory}
          />
        )}
        {showCandidateActionModal &&
          (() => {
            const nextstageName =
              selectedCandidate.toStage ?? selectedCandidate.stage;
            const nextsubstageName =
              selectedCandidate.toSubstage ?? selectedCandidate.substage;
            const resolvedStagesForModal = selectedCandidate.sourceStages ?? timelineStages;
            const nextStageFromPipeline = resolvedStagesForModal.find(
              (s: any) => s.name === nextstageName,
            );
            const nextSubstageFromPipeline =
              nextStageFromPipeline?.substages?.find(
                (s: any) => s.name === nextsubstageName,
              );
            return (
              <CandidateActionModal
                nextstage={nextstageName}
                substage={nextsubstageName}
                nextStageId={nextStageFromPipeline?.id}
                nextSubstageId={nextSubstageFromPipeline?.id}
                fromStage={selectedCandidate.stage}
                fromSubstage={selectedCandidate.substage}
                careerId={selectedCandidate.sourceCareerId ?? career?._id?.toString()}
                candidate={selectedCandidate}
                onAction={handleCandidateAction}
                action={showCandidateActionModal}
                hideRecruiterEvaluation={hideRecruiterEvalForActionModal}
              />
            );
          })()}
        <InviteToJobModal
          isOpen={isInviteToJobOpen}
          onClose={() => {
            setIsInviteToJobOpen(false);
            setInviteToJobCandidate(null);
            setExcludedCareerIdsForInvite([]);
          }}
          candidate={inviteToJobCandidate}
          excludedCareerIds={excludedCareerIdsForInvite}
          sourceCareer={
            career
              ? ({
                  id: career.id,
                  parentCareerID: career.parentCareerID || null,
                } as CareerHierarchyInfo)
              : null
          }
          sourceCareerIsImplicit={true}
          onOk={handleInviteToJobOk}
        />
        <Tooltip
          className="career-fit-tooltip fade-in"
          id="career-fit-tooltip"
          clickable={true}
        />

        {showCareerStatusModal && (
          <CareerStatusModal
            formData={formData}
            action="update-status"
            onConfirm={(updatedFormData) => {
              setFormData({ ...formData, ...updatedFormData });
              setShowCareerStatusModal(false);
            }}
            onCancel={() => setShowCareerStatusModal(false)}
          />
        )}

        {/* Child Selection Modal for linked careers */}
        <ChildSelectionModal
          open={showChildModal}
          onClose={() => setShowChildModal(false)}
          parentTitle={career?.jobTitle || ""}
          childCareers={career?.childCareers || []}
          onSelectChild={(childId: string, childTitle: string) => {
            if (orgID) {
              childTimeline.expand(childId, orgID);
              setShowChildModal(false);
            }
          }}
        />
        <MissingParentModal
          open={showMissingParentModal}
          onClose={() => setShowMissingParentModal(false)}
          onOpenEditPage={handleOpenEditCareerPage}
        />
      </div>
    </>
  );
}
