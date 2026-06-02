"use client";

import { useMemo, useState, useEffect } from "react";
import { api } from "@/lib/utils/apiClient";

export type AnalysisBreakdown = {
  key: string;
  data: number;
  rationale: string;
};

export type InterviewAnalysis = {
  overall_score: number;
  final_assessment: string;
  assessment_reason?: string;
  breakdown?: AnalysisBreakdown[];
};

export type TranscriptMessage = {
  type: "user" | "assistant";
  content: string;
  time: string;
};

export type InterviewRecording = {
  filename: string;
  filetype: string;
};

export type AIInterviewData = {
  analysis: InterviewAnalysis | null;
  summary: string | null;
  transcripts: TranscriptMessage[];
  interviewRecording: InterviewRecording | null;
  candidateName: string | null;
  isLoading: boolean;
  error: string | null;
};

/**
 * Hook for fetching AI Interview data (analysis, summary, transcripts, recording)
 * Note: Recruiter evaluations are now handled by useAllStageEvaluations in the parent component
 * @param interviewID - The interview ID (used for transcript data)
 * @param interviewUID - The MongoDB _id of the interview (used for interview details)
 */
export function useAIInterviewData(
  interviewID: string | null,
  interviewUID: string | null
): AIInterviewData {
  const [analysis, setAnalysis] = useState<InterviewAnalysis | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [interviewRecording, setInterviewRecording] = useState<InterviewRecording | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get orgId from localStorage
  const orgId = useMemo(() => {
    try {
      if (typeof window === "undefined") return null;
      const guestOrg = localStorage.getItem("guestOrg");
      return guestOrg ? JSON.parse(guestOrg)._id : null;
    } catch {
      return null;
    }
  }, []);

  // Fetch interview details - uses interviewID (UUID), not interviewUID (MongoDB _id)
  useEffect(() => {
    const fetchInterviewDetails = async () => {
      if (!interviewID || !orgId) return;

      try {
        const response = await api.post("/api/interview-details", {
          id: interviewID,
          orgID: orgId,
        });

        if (response.data) {
          if (response.data.analysis) {
            setAnalysis(response.data.analysis);
          }
          if (response.data.summary) {
            setSummary(response.data.summary);
          }
          if (response.data.interviewRecording) {
            setInterviewRecording(response.data.interviewRecording);
          }
          if (response.data.name) {
            setCandidateName(response.data.name);
          }
        }
      } catch (err) {
        console.error("Failed to fetch interview details:", err);
        setError("Failed to fetch interview details");
      }
    };

    fetchInterviewDetails();
  }, [interviewID, orgId]);

  // Fetch transcripts - uses interviewID (UUID)
  useEffect(() => {
    const fetchTranscripts = async () => {
      if (!interviewID) return;

      try {
        const response = await api.post("/api/fetch-transcript", {
          id: interviewID,
        });

        if (response.data && Array.isArray(response.data)) {
          setTranscripts(response.data);
        }
      } catch (err) {
        console.error("Failed to fetch transcripts:", err);
      }
    };

    fetchTranscripts();
  }, [interviewID]);

  // Set loading to false after initial fetches complete
  useEffect(() => {
    if (interviewID && orgId) {
      // Give time for all fetches to complete
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    } else if (!interviewID) {
      setIsLoading(false);
    }
  }, [interviewID, orgId]);

  return {
    analysis,
    summary,
    transcripts,
    interviewRecording,
    candidateName,
    isLoading,
    error,
  };
}

