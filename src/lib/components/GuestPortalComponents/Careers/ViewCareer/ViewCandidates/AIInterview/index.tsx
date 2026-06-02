"use client";

import React from "react";
import { useAIInterviewData } from "./useAIInterviewData";
import { EvaluationByEndorser, type RecruiterEvaluation } from "../CVScreening";
import InterviewAnalysis from "./InterviewAnalysis";
import InterviewSummary from "./InterviewSummary";
import InterviewTranscript from "./InterviewTranscript";
import VideoRecording from "./VideoRecording";
import AIInterviewSkeleton from "./AIInterviewSkeleton";

type Props = {
  interviewID: string;
  interviewUID: string;
  evaluation?: RecruiterEvaluation | null; // Evaluation passed from parent
};

export default function AIInterview({ interviewID, interviewUID, evaluation }: Props) {
  const {
    analysis,
    summary,
    transcripts,
    interviewRecording,
    candidateName,
    isLoading,
  } = useAIInterviewData(interviewID, interviewUID);

  // Show loading skeleton while data is being fetched
  if (isLoading) {
    return <AIInterviewSkeleton />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Evaluation by Endorser - Use evaluation from parent */}
      {evaluation && (
        <EvaluationByEndorser evaluation={evaluation} />
      )}

      {/* Interview Analysis - Always show */}
      <InterviewAnalysis analysis={analysis} />

      {/* Interview Summary - Always show */}
      <InterviewSummary summary={summary} />

      {/* Interview Transcript - Always show */}
      <InterviewTranscript transcripts={transcripts} candidateName={candidateName} />

      {/* Video/Audio Recording - Always show */}
      <VideoRecording recording={interviewRecording} />
    </div>
  );
}
