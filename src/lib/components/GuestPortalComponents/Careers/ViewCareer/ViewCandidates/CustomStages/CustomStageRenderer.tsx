"use client";

import React from "react";
import Container from "../../../../Container";
import { useStageEvaluation } from "../useStageEvaluation";
import EvaluationByEndorser from "../CVScreening/EvaluationByEndorser";
import type { PipelineStage } from "../ViewCandidateTabs";
import CustomStagesSkeleton from "./CustomStagesSkeleton";

type Props = {
  stage: PipelineStage;
  interviewUID?: string | null;
  pipelineStages?: PipelineStage[];
};

export default function CustomStageRenderer({ stage, interviewUID, pipelineStages = [] }: Props) {
  const { evaluation, isLoading } = useStageEvaluation(
    interviewUID || null,
    stage.id,
    pipelineStages
  );

  if (isLoading) {
    return <CustomStagesSkeleton />;
  }

  // Show evaluation if exists, otherwise show "No evaluation yet" message
  if (evaluation) {
    return <EvaluationByEndorser evaluation={evaluation} />;
  }

  return (
    <Container title={stage.alias || stage.name}>
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
