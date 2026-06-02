import { useState, useEffect } from "react";
import { type KanbanGroup, type CandidateCard, type KanbanColumn } from "./kanban/types";
import { api } from "@/lib/utils/apiClient";


// will improve later
// Transform interview/candidate data from DB to Kanban structure
function transformToKanbanData(interviews: any[], pipelineStages: any[]): { groups: KanbanGroup[] } {
  // Use pipeline stages from career or default structure
  const stages = pipelineStages && pipelineStages.length > 0 
    ? pipelineStages 
    : [
        { id: "cv-screening", name: "CV Screening", substages: [
          { id: "waiting-submission", name: "Waiting Submission" },
          { id: "for-review", name: "For Review" }
        ]},
        { id: "ai-interviews", name: "AI Interviews", substages: [
          { id: "waiting-interview", name: "Waiting Interview" },
          { id: "for-review-ai", name: "For Review" }
        ]},
      ];
  
  // Ensure interviews is an array (even if empty)
  const interviewsList = interviews || [];

  const groups: KanbanGroup[] = stages.map((stage) => {
    const columns: KanbanColumn[] = (stage.substages || []).map((substage: any) => {
      // Filter interviews that belong to this stage and substage
      const matchingInterviews = interviewsList.filter((interview) => {
        // Match by currentStep and status from the substage definition
        const matchesStage = interview.currentStep === substage.currentStep || 
                            interview.currentStep === stage.name;
        const matchesStatus = interview.status === substage.status ||
                             interview.substage === substage.name;
        
        return matchesStage && (matchesStatus || interview.currentStep === stage.name);
      });

      // Transform interviews to candidate cards
      const cards: CandidateCard[] = matchingInterviews.map((interview) => {
        // Determine fit tag based on CV/AI analysis
        let fit = undefined;
        if (interview.cvScreeningEvaluation?.result) {
          const result = interview.cvScreeningEvaluation.result;
          if (result.includes("Good")) fit = "Jia: Good Fit";
          else if (result.includes("Strong")) fit = "Jia: Strong Fit";
          else if (result.includes("Maybe")) fit = "Jia: Maybe Fit";
          else if (result.includes("Bad")) fit = "Jia: Bad Fit";
        }

        // Get endorser info
        let endorsedBy = undefined;
        let endorsedByAvatar = undefined;
        if (interview.currentEvaluation) {
          endorsedBy = interview.currentEvaluation.recruiterName || "Recruiter";
          endorsedByAvatar = interview.currentEvaluation.recruiterImage || null;
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
          interviewID: interview._id?.toString() || interview.id || "",
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
      title: stage.name,
      droppedCount,
      columns,
    };
  });

  return { groups };
}

export function useViewCareerData(careerId: string) {
  const [data, setData] = useState<{ groups: KanbanGroup[] } | null>(null);
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
        
        // Fetch interviews/candidates for this career
        // Use the career's UUID 'id' field, not the MongoDB '_id'
        const careerUUID = careerData.id || careerData._id;
        
        // Use get-career-applicants which includes applicant data (name, email, image)
        const applicantsResponse = await api.get(`/api/get-career-applicants?careerID=${careerUUID}&limit=1000`);
        const interviews = applicantsResponse.data.applicants || [];

        // Transform to Kanban structure using career's pipelineStages
        const kanbanData = transformToKanbanData(interviews, careerData.pipelineStages);
        
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

  return { data, isLoading, error };
}

export function useCandidateAnalysis(careerId: string, candidateId: string) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCandidateAnalysis = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch candidate/interview details
        const response = await api.post("/api/interview-details", { 
          interviewUID: candidateId 
        });
        
        setData(response.data);
      } catch (err) {
        console.error("Error fetching candidate analysis:", err);
        setError(err instanceof Error ? err : new Error("Failed to fetch candidate analysis"));
      } finally {
        setIsLoading(false);
      }
    };

    if (careerId && candidateId) {
      fetchCandidateAnalysis();
    }
  }, [careerId, candidateId]);

  return { data, isLoading, error };
}
