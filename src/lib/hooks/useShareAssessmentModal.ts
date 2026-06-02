import { useCallback, useEffect, useState, useRef } from "react";
import { toast } from "react-toastify";
import { api } from "@/lib/utils/apiClient";
import type { ShareableAssessmentDetails } from "@/lib/components/ShareableAssessmentModalComponents/ShareModalV2";
import { createElement } from "react";

export type ShareableAssessmentRecord = ShareableAssessmentDetails & {
  _id: string;
  link: string;
  profileId: string;
  createdBy?: {
    uid?: string | null;
    email?: string | null;
    name?: string | null;
  };
};

export type UseShareableAssessmentLinksResult = {
  generatedLinks: ShareableAssessmentRecord[];
  isFetching: boolean;
  errorMessage: string | null;
  refreshLinks: () => Promise<void>;
  toggleLinkActive: (assessmentId: string, newActive: boolean) => Promise<void>;
  deleteLink: (assessmentId: string) => Promise<void>;
};

function showShareableAssessmentToast(title: string, subtitle: string) {
  toast.success(
    createElement(
      "div",
      { className: "jia-shareable-assessment-toast" },
      createElement(
        "div",
        { className: "jia-shareable-assessment-toast__icon" },
        createElement(
          "div",
          { className: "jia-shareable-assessment-toast__icon-inner" },
          createElement("i", { className: "la la-check" })
        )
      ),
      createElement(
        "div",
        { className: "jia-shareable-assessment-toast__content" },
        createElement("p", { className: "jia-shareable-assessment-toast__title" }, title),
        createElement("p", { className: "jia-shareable-assessment-toast__subtitle" }, subtitle)
      )
    ),
    {
      icon: false,
      className: "jia-toast-shareable-assessment",
      autoClose: 2200,
    }
  );
}

export function useShareableAssessmentLinks(
  interviewId?: string,
  orgID?: string
): UseShareableAssessmentLinksResult {
  const [generatedLinks, setGeneratedLinks] = useState<ShareableAssessmentRecord[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshLinks = useCallback(async () => {
    if (!interviewId || !orgID) {
      setGeneratedLinks([]);
      return;
    }

    setIsFetching(true);
    setErrorMessage(null);

    try {
      const response = await api.post("/api/fetch-shareable-assessment-links", {
        interviewId,
        orgID,
      });

      if (response.data?.success) {
        const assessments = Array.isArray(response.data.assessments)
          ? (response.data.assessments as ShareableAssessmentRecord[])
          : [];
        setGeneratedLinks(assessments);
        return;
      }

      const message = response.data?.message ?? "Unable to fetch shareable assessment links.";
      setErrorMessage(message);
      toast.error(message);
    } catch (error) {
      console.error("Error fetching shareable assessment links:", error);
      setErrorMessage("Unable to fetch shareable assessment links.");
      toast.error("Unable to fetch shareable assessment links.");
    } finally {
      setIsFetching(false);
    }
  }, [interviewId, orgID]);

  const toggleLinkActive = useCallback(
    async (assessmentId: string, newActive: boolean) => {
      if (!orgID) {
        toast.error("Organization not found");
        return;
      }

      const targetLink = generatedLinks.find(link => link._id === assessmentId);

      setGeneratedLinks(prev =>
        prev.map(link =>
          link._id === assessmentId ? { ...link, active: newActive } : link
        )
      );

      try {
        await api.post("/api/update-shareable-assessment", {
          assessmentId,
          active: newActive,
          orgID,
        });

        if (newActive) {
          showShareableAssessmentToast("Link enabled", "External viewers can access this link.");
        } else {
          showShareableAssessmentToast("Link disabled", "External access has been paused.");
        }
      } catch (error) {
        console.error("Failed to update shareable assessment:", error);
        toast.error("Failed to update shareable assessment");

        if (targetLink) {
          setGeneratedLinks(prev =>
            prev.map(link =>
              link._id === assessmentId ? { ...link, active: targetLink.active } : link
            )
          );
        }
      }
    },
    [generatedLinks, orgID]
  );

  useEffect(() => {
    refreshLinks();
  }, [refreshLinks]);

  const deleteLink = useCallback(
    async (assessmentId: string) => {
      if (!orgID) {
        toast.error("Organization not found");
        return;
      }

      const targetLink = generatedLinks.find(link => link._id === assessmentId);
      if (!targetLink) {
        toast.error("Shareable link not found");
        return;
      }

      const previousLinks = generatedLinks;
      setGeneratedLinks(prev => prev.filter(link => link._id !== assessmentId));

      try {
        await api.post("/api/delete-shareable-assessment", {
          assessmentId,
          orgID,
        });

        showShareableAssessmentToast("Link deleted", "External access has been revoked.");
      } catch (error) {
        console.error("Failed to delete shareable assessment:", error);
        toast.error("Failed to delete shareable link");
        setGeneratedLinks(previousLinks);
      }
    },
    [generatedLinks, orgID]
  );

  return {
    generatedLinks,
    isFetching,
    errorMessage,
    refreshLinks,
    toggleLinkActive,
    deleteLink,
  };
}

type StageAttachmentBucket = {
  stageId: string;
  substageId: string;
  attachments: any[];
};

type UseStageAvailabilityOptions = {
  interviewId?: string;
  pipelineStages: any[];
  stageAttachments?: StageAttachmentBucket[];
  enabled?: boolean;
}

export type StageDisabledMap = Record<string, boolean>;

export function useHumanInterviewStageAvailability({ 
  interviewId, 
  pipelineStages, 
  stageAttachments = [], 
  enabled = true 
}: UseStageAvailabilityOptions) {
  const [disabledStages, setDisabledStages] = useState<StageDisabledMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const hasFetched = useRef(false);
  const evaluationsRef = useRef<any[]>([]);

  const computeDisabledStages = useCallback((evaluations: any[]): StageDisabledMap => {
    const result: StageDisabledMap = {};
    
    for (const stage of pipelineStages) {
      if (stage.id === "4" || stage.id === "1" || stage.id === "2") continue;
      
      const hasEvaluation = evaluations.some((evaluation: any) => 
        evaluation.stageId === stage.id
      );

      const hasAttachments = stageAttachments.some(
        (bucket) => bucket.stageId === stage.id && bucket.attachments?.length > 0
      );
      
      result[stage.id] = !hasEvaluation && !hasAttachments;
    }
    
    return result;
  }, [pipelineStages, stageAttachments]);

  useEffect(() => {
    if (!interviewId || !pipelineStages.length || !enabled || hasFetched.current) return;

    const fetchAvailability = async () => {
      setIsLoading(true);
      try {
        const response = await api.post("/api/get-recruiter-evaluations", { interviewID: interviewId });
        evaluationsRef.current = response.data;
        hasFetched.current = true;
        setDisabledStages(computeDisabledStages(response.data));
      } catch (error) {
        console.error("Error fetching stage availability:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailability();
  }, [interviewId, pipelineStages, enabled, computeDisabledStages]);

  useEffect(() => {
    if (!hasFetched.current || !pipelineStages.length) return;
    
    const newDisabled = computeDisabledStages(evaluationsRef.current);
    setDisabledStages(prev => {
      const keys = new Set([...Object.keys(prev), ...Object.keys(newDisabled)]);
      for (const key of keys) {
        if (prev[key] !== newDisabled[key]) return newDisabled;
      }
      return prev;
    });
  }, [stageAttachments, pipelineStages, computeDisabledStages]);

  return { disabledStages, isLoading };
}
