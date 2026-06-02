import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/utils/apiClient";
import type { Message } from "@/lib/components/CandidateProfileComponents/AIInterviewSection/TranscriptMessage";
import {
  adjustNameVisibility,
  getTabDetails,
  type InterviewData,
  type NameVisibility,
  type RecruiterEvaluation,
  type StageTab,
} from "@/lib/components/CandidateProfileComponents/candidateProfileUtils";

interface CandidateProfileData {
  orgData: any;
  interviewData: InterviewData | null;
  cvData: any;
  recruiterEvaluations: any;
  feedback: { rating: number; feedback: string } | null;
  transcripts: Message[] | null;
  interviewRecording: InterviewData["interviewRecording"] | null;
}

type ViewableStageConfig = {
  viewable: boolean;
  disabled?: boolean;
  stageName?: string;
};

// Stage IDs: "1" = CV Screening, "2" = AI Interview, "3" = Human Interview, UUIDs = custom stages
type ViewableStagesMap = Record<string, ViewableStageConfig>;

interface AssessmentParams {
  orgID: string;
  interviewId: string;
  interviewUID: string;
  applicantEmail: string;
  nameVisibility: NameVisibility;
  viewableStages: ViewableStagesMap;
  showJiaAssessments?: boolean;
  showRecruiterAssessments?: boolean;
  showContactDetails?: boolean;
  showDisplayPhoto?: boolean;
  cvVersionLabel?: string | null;
  isContactVisible?: boolean;
  profileId?: string;
  passcode?: string;
  previewToken?: string;
}

const initialData: CandidateProfileData = {
  orgData: null,
  interviewData: null,
  cvData: null,
  recruiterEvaluations: null,
  feedback: null,
  transcripts: null,
  interviewRecording: null,
};

export function useCandidateProfileData(assessment: AssessmentParams) {
  const {
    orgID,
    interviewId,
    interviewUID,
    applicantEmail,
    nameVisibility,
    viewableStages,
    showRecruiterAssessments = true,
    profileId,
    passcode,
    previewToken,
  } = assessment;

  const [data, setData] = useState<CandidateProfileData>(initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function fetchAll() {
      setIsLoading(true);
      setError(null);

      try {
        // Use consolidated endpoint for public share links and preview links
        if (profileId && (passcode || previewToken)) {
          const response = await api.post(
            "/api/fetch-shareable-assessment-data",
            { profileId, passcode, previewToken },
            { signal: controller.signal }
          );

          if (isMounted && response.data.success) {
            const fetchedData = response.data.data;
            setData({
              orgData: fetchedData.orgData,
              interviewData: fetchedData.interviewData,
              cvData: fetchedData.cvData ? { data: fetchedData.cvData } : null,
              recruiterEvaluations: { data: fetchedData.recruiterEvaluations },
              feedback: fetchedData.feedback,
              transcripts: fetchedData.transcripts,
              interviewRecording: fetchedData.interviewRecording,
            });
          }
        } else {
          // Original authenticated flow for dashboard users
          const [orgRes, interviewRes, evalRes] = await Promise.all([
            api.post("/api/feth-org-details", { orgID }, { signal: controller.signal }),
            api.post("/api/interview-details", { id: interviewId, orgID }, { signal: controller.signal }),
            api.post("/api/get-recruiter-evaluations", { interviewID: interviewUID }, { signal: controller.signal }),
          ]);

          let cvData: any = null;
          let feedback: { rating: number; feedback: string } | null = null;
          let transcripts: Message[] | null = null;

          // Stage ID "1" = CV Screening
          if (viewableStages["1"]?.viewable) {
            cvData = await api.post("/api/load-user-cv", { email: applicantEmail }, { signal: controller.signal });
          }

          // Stage ID "2" = AI Interview
          if (viewableStages["2"]?.viewable) {
            const [feedbackRes, transcriptRes] = await Promise.all([
              api.get("/api/get-candidate-feedback", { 
                signal: controller.signal,
                params: { orgID, interviewID: interviewId } 
              }),
              api.post("/api/fetch-transcript", { id: interviewId }, { signal: controller.signal }),
            ]);

            const feedbackList = Array.isArray(feedbackRes.data) ? feedbackRes.data : [];
            const userFeedback = feedbackList.find((item) => item.interviewID === interviewId);
            feedback = userFeedback ? { rating: userFeedback.rating, feedback: userFeedback.feedback } : null;

            transcripts = transcriptRes.status === 200 && Array.isArray(transcriptRes.data) ? transcriptRes.data : null;
          }

          if (isMounted) {
            setData({
              orgData: orgRes.data,
              interviewData: interviewRes.data,
              cvData,
              recruiterEvaluations: evalRes,
              feedback,
              transcripts,
              interviewRecording: interviewRes.data?.interviewRecording ?? null,
            });
          }
        }
      } catch (err) {
        if (!isMounted) {
          return;
        }

        if ((err as Error)?.name === "CanceledError") {
          return;
        }

        setError(err instanceof Error ? err : new Error("Failed to load candidate profile"));
        console.error("CandidateProfile fetch error:", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchAll();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [
    orgID,
    interviewId,
    interviewUID,
    applicantEmail,
    viewableStages["1"]?.viewable,  // CV Screening
    viewableStages["2"]?.viewable,  // AI Interview
    profileId,
    passcode,
    previewToken,
  ]);

  const applicantName = useMemo(() => {
    if (!data.interviewData) return null;
    return adjustNameVisibility(nameVisibility, data.interviewData.name);
  }, [data.interviewData, nameVisibility]);

  const stages: Partial<Record<string, StageTab>> = useMemo(() => {
    if (!data.interviewData || !data.recruiterEvaluations) return {};

    const recruiterData = (data.recruiterEvaluations.data ?? []) as RecruiterEvaluation[];
    const computedStages: Record<string, StageTab> = {};
    const pipelineStages = data.interviewData.pipelineStages ?? [];

    for (const stage of pipelineStages) {
      const stageConfig = viewableStages[stage.id];
      if (!stageConfig?.viewable) continue;

      const isHumanStage = stage.id !== "1" && stage.id !== "2";
      if (isHumanStage && !showRecruiterAssessments) continue;

      const stageName = stageConfig.stageName || stage.name || stage.id;

      computedStages[stageName] = getTabDetails(
        data.interviewData,
        recruiterData,
        stage.id,
        stageName
      );
    }

    return computedStages;
  }, [data.interviewData, data.recruiterEvaluations, showRecruiterAssessments, viewableStages]);

  const defaultActiveTab: string = useMemo(() => {
    const stageKeys = Object.keys(stages);
    return stageKeys[0] ?? "";
  }, [stages]);

  // Expose full name for transcript redaction
  const fullName = data.interviewData?.name ?? null;

  return { data, isLoading, error, applicantName, fullName, nameVisibility, stages, defaultActiveTab };
}
