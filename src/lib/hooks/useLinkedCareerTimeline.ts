import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/utils/apiClient";
import { buildTimelineFromInterviews } from "@/lib/utils/buildTimelineFromInterviews";
import { isStageEnabled } from "@/lib/Utils";

interface LinkedTimelineStage {
  id: string;
  name: string;
  alias?: string;
  substages: any[];
  droppedCandidates: any[];
  [key: string]: any;
}

interface UseLinkedCareerTimelineReturn {
  stages: LinkedTimelineStage[];
  setStages: React.Dispatch<React.SetStateAction<LinkedTimelineStage[]>>;
  career: any;
  careerTitle: string;
  isLoading: boolean;
  error: string | null;
  isExpanded: boolean;
  expand: (careerId: string, orgID: string) => Promise<void>;
  collapse: () => void;
}

export function useLinkedCareerTimeline(): UseLinkedCareerTimelineReturn {
  const [stages, setStages] = useState<LinkedTimelineStage[]>([]);
  const [careerTitle, setCareerTitle] = useState("");
  const [career, setCareer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestRequestRef = useRef<string | null>(null);

  const expand = useCallback(async (careerId: string, orgID: string) => {
    latestRequestRef.current = careerId;
    setIsLoading(true);
    setError(null);

    try {
      const [careerResponse, interviewsResponse] = await Promise.all([
        api.post("/api/career-data", { id: careerId, orgID }),
        api.get(`/api/get-career-interviews?careerID=${careerId}`),
      ]);

      if (latestRequestRef.current !== careerId) return;

      const career = careerResponse.data;
      const interviews = Array.isArray(interviewsResponse.data)
        ? interviewsResponse.data
        : [];

      const pipelineStages = career?.pipelineStages || [];
      const { timelineStages } = buildTimelineFromInterviews(
        pipelineStages,
        interviews
      );

      const enabledStages = timelineStages.filter(isStageEnabled);

      setStages(enabledStages);
      setCareerTitle(career?.jobTitle || "");
      setCareer(career);
    } catch (err: any) {
      if (latestRequestRef.current !== careerId) return;
      setError(err?.message || "Failed to load linked career timeline");
      setStages([]);
      setCareerTitle("");
    } finally {
      if (latestRequestRef.current === careerId) {
        setIsLoading(false);
      }
    }
  }, []);

  const collapse = useCallback(() => {
    latestRequestRef.current = null;
    setStages([]);
    setCareerTitle("");
    setError(null);
    setCareer(null);
  }, []);

  return {
    stages,
    setStages,
    career,
    careerTitle,
    isLoading,
    error,
    isExpanded: stages.length > 0,
    expand,
    collapse,
  };
}
