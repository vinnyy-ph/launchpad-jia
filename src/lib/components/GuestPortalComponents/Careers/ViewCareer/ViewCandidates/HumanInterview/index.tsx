"use client";

import React from "react";
import { useStageEvaluation } from "../useStageEvaluation";
import EvaluationByEndorser from "../CVScreening/EvaluationByEndorser";
import type { PipelineStage } from "../ViewCandidateTabs";
import Container from "../../../../Container";
import HumanInterviewSkeleton from "./HumanInterviewSkeleton";

type Props = {
  interviewUID?: string | null;
  stageId?: string | null;
  pipelineStages?: PipelineStage[];
};

export default function HumanInterview({ interviewUID, stageId, pipelineStages = [] }: Props) {
  const { evaluation, isLoading } = useStageEvaluation(
    interviewUID || null,
    stageId || null,
    pipelineStages
  );

  if (isLoading) {
    return <HumanInterviewSkeleton />;
  }

  // Show evaluation if exists, otherwise show "No evaluation yet" message
  if (evaluation) {
    return <EvaluationByEndorser evaluation={evaluation} />;
  }

  return (
    <Container title="Human Interview">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 14, color: "#667085" }}>
          No evaluation by recruiter yet for this stage.
        </p>
      </div>
    </Container>
  );
}
