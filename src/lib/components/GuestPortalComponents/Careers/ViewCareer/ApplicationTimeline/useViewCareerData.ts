import { useState, useEffect } from "react";
import { type KanbanGroup, type CandidateCard, type KanbanColumn } from "./kanban/types";
import { api } from "@/lib/utils/apiClient";

// Transform interview/candidate data from DB to Kanban structure
function transformToKanbanData(interviews: any[], pipelineStages: any[]): { groups: KanbanGroup[] } {
  const getTimeValue = (value: any) => {
    if (!value) return 0;
    const d = new Date(value);
    const t = d.getTime();
    return Number.isFinite(t) ? t : 0;
  };

  const dedupeInterviews = (items: any[]) => {
    const map = new Map<string, any>();
    for (const interview of items) {
      const key =
        (interview?.email || interview?.userId || interview?.uid || interview?._id || interview?.id || "")
          ?.toString()
          ?.toLowerCase() || "";

      if (!key) continue;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, interview);
        continue;
      }

      const existingTime = Math.max(getTimeValue(existing?.updatedAt), getTimeValue(existing?.createdAt));
      const nextTime = Math.max(getTimeValue(interview?.updatedAt), getTimeValue(interview?.createdAt));
      if (nextTime >= existingTime) {
        map.set(key, interview);
      }
    }
    return Array.from(map.values());
  };

  const getStageForInterview = (stages: any[], interview: any) => {
    if (!interview) return null;

    const byStageName = stages.find((stage) => stage?.name && interview.currentStep === stage.name);
    if (byStageName) return byStageName;

    const bySubstageCurrentStep = stages.find((stage) =>
      (stage?.substages || []).some((sub: any) => sub?.currentStep && sub.currentStep === interview.currentStep)
    );
    if (bySubstageCurrentStep) return bySubstageCurrentStep;

    const bySubstageStatus = stages.find((stage) =>
      (stage?.substages || []).some((sub: any) => sub?.status && sub.status === interview.status)
    );
    if (bySubstageStatus) return bySubstageStatus;

    return null;
  };

  const getSubstageForInterview = (stage: any, interview: any) => {
    const substages = Array.isArray(stage?.substages) ? stage.substages : [];
    if (substages.length === 0) return null;

    const bySubstageName = interview?.substage
      ? substages.find((s: any) => s?.name && s.name === interview.substage)
      : null;
    if (bySubstageName) return bySubstageName;

    const byStatus = interview?.status ? substages.find((s: any) => s?.status && s.status === interview.status) : null;
    if (byStatus) return byStatus;

    const byCurrentStep = interview?.currentStep
      ? substages.find((s: any) => s?.currentStep && s.currentStep === interview.currentStep)
      : null;
    if (byCurrentStep) return byCurrentStep;

    if (interview?.currentStep && stage?.name && interview.currentStep === stage.name) {
      return substages.find((s: any) => s?.name === "For Review") || substages[0];
    }

    return null;
  };

  // Use pipeline stages from career only. If missing/empty, do not invent defaults.
  const stages = Array.isArray(pipelineStages) ? pipelineStages : [];
  if (stages.length === 0) {
    return { groups: [] };
  }
  
  // Ensure interviews is an array (even if empty)
  const interviewsList = dedupeInterviews(interviews || []);

  const assignments = new Map<string, Map<string, any[]>>();
  for (const stage of stages) {
    const subMap = new Map<string, any[]>();
    for (const sub of stage?.substages || []) {
      subMap.set(sub.id, []);
    }
    assignments.set(stage.id, subMap);
  }

  for (const interview of interviewsList) {
    const stage = getStageForInterview(stages, interview);
    if (!stage) continue;
    const substage = getSubstageForInterview(stage, interview);
    if (!substage) continue;

    const stageMap = assignments.get(stage.id);
    if (!stageMap) continue;
    const bucket = stageMap.get(substage.id);
    if (!bucket) continue;
    bucket.push(interview);
  }

  const groups: KanbanGroup[] = stages.map((stage) => {
    const columns: KanbanColumn[] = (stage.substages || []).map((substage: any) => {
      // Filter interviews that belong to this stage and substage
      const matchingInterviews = assignments.get(stage.id)?.get(substage.id) || [];

      // Transform interviews to candidate cards
      const cards: CandidateCard[] = matchingInterviews.map((interview) => {
        // Determine fit tag - match CandidateCard.tsx logic exactly
        let fit = undefined;
        if (interview.currentEvaluation?.matchFit) {
          const evaluatorName = interview.currentEvaluation?.updatedBy?.name;
          const evaluatorFirstName = evaluatorName ? String(evaluatorName).split(" ")[0] : "Recruiter";
          fit = `${evaluatorFirstName}: ${interview.currentEvaluation.matchFit}`;
        } else {
          // Check if this is a CV stage (matching CandidateCard.tsx logic)
          const isCvStage = 
            interview.currentStep === "CV Screening" || 
            stage?.name === "CV Screening" ||
            (stage?.name === "AI Interview" && substage?.name === "Waiting Interview");
          
          if (isCvStage) {
            fit = `CV: ${interview.cvStatus || "N/A"}`;
          } else {
            fit = `Interview: ${interview.jobFit || "N/A"}`;
          }
        }

        // Get endorser info
        let endorsedBy = undefined;
        let endorsedByAvatar = undefined;
        if (interview.currentEvaluation) {
          const updatedBy = interview.currentEvaluation?.updatedBy;
          const recruiterName =
            updatedBy?.name ||
            interview.currentEvaluation?.recruiterName ||
            interview.currentEvaluation?.recruiter?.name ||
            undefined;
          const recruiterImage =
            updatedBy?.image ||
            updatedBy?.avatar ||
            interview.currentEvaluation?.recruiterImage ||
            interview.currentEvaluation?.recruiter?.image ||
            undefined;

          endorsedBy = recruiterName;
          endorsedByAvatar = recruiterImage || null;
        }

        // Calculate time ago
        const createdAt = interview.createdAt ? new Date(interview.createdAt) : new Date();
        const now = new Date();
        const diffMs = now.getTime() - createdAt.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        
        let timeAgo = "Just now";
        if (diffDays > 0) timeAgo = `${diffDays}d ago`;
        else if (diffHours > 0) timeAgo = `${diffHours}h ago`;

        return {
          id: interview._id?.toString() || interview.id,
          interviewID: interview.interviewID || interview._id?.toString() || interview.id || "",
          name: interview.name || "Unknown Candidate",
          email: interview.email || "",
          avatar: interview.image || "/default-avatar.png",
          fit: fit as any,
          endorsedBy: endorsedBy ? `${endorsedBy.split(' ')[0]}...` : undefined,
          endorsedByAvatar,
          assessedBy: interview.cvScreeningEvaluation ? "Jia" : undefined,
          timeAgo,
        };
      });

      return {
        id: substage.id,
        title: substage.name,
        color: "#16B364", // Default color
        cards,
      };
    });

    // Count dropped candidates in this stage
    const droppedCount = interviewsList.filter((interview) => 
      interview.applicationStatus === "Dropped" && 
      (interview.currentStep === stage.name || interview.stageId === stage.id)
    ).length;

    return {
      id: stage.id,
      title: stage.alias || stage.name,
      droppedCount,
      columns,
    };
  });

  return { groups };
}

export type PipelineStage = {
  id: string;
  name: string;
  alias?: string;
  icon?: string;
  type?: string;
  enabled?: boolean;
  substages?: Array<{
    id: string;
    name: string;
    currentStep: string;
    status: string;
  }>;
};

export function useViewCareerData(careerId: string) {
  const [data, setData] = useState<{ groups: KanbanGroup[] } | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [allPipelineStages, setAllPipelineStages] = useState<PipelineStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchViewCareerData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch career details to get pipeline stages
        const guestOrg = localStorage.getItem("guestOrg");
        const orgID = guestOrg ? JSON.parse(guestOrg)._id : null;
        
        const careerResponse = await api.post("/api/career-data", { id: careerId, orgID });
        const careerData = careerResponse.data;

        // Store all pipeline stages (for candidate detail views that need CV Screening/AI Interview)
        const allStages = Array.isArray(careerData.pipelineStages) ? careerData.pipelineStages : [];
        setAllPipelineStages(allStages);
        
        // Store enabled stages only (for Kanban display)
        const enabledStages = allStages.filter((stage: any) => stage?.enabled !== false);
        setPipelineStages(enabledStages);

        // Fetch interviews/candidates for this career
        // Use the career's UUID 'id' field, not the MongoDB '_id'
        const careerUUID = careerData.id || careerData._id;
        
        // Use get-career-applicants which includes applicant data (name, email, image)
        const applicantsResponse = await api.get(`/api/get-career-applicants?careerID=${careerUUID}&limit=1000`);
        const interviews = applicantsResponse.data.applicants || [];

        // Transform to Kanban structure using only enabled pipeline stages
        const kanbanData = transformToKanbanData(interviews, enabledStages);
        setData(kanbanData);
      } catch (err) {
        console.error("Error fetching career view data:", err);
        setError(err instanceof Error ? err : new Error("Failed to fetch career view data"));
      } finally {
        setIsLoading(false);
      }
    };

    if (careerId) {
      fetchViewCareerData();
    }
  }, [careerId]);

  // pipelineStages: enabled stages only (for Kanban)
  // allPipelineStages: all stages including disabled (for candidate detail views)
  return { data, pipelineStages, allPipelineStages, isLoading, error };
}
