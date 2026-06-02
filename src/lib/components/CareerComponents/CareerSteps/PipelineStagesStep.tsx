"use client";

import PipelineStageBuilder from "../PipelineStageBuilder";

interface PipelineStagesStepProps {
  careerForm: any;
  setCareerForm: (careerForm: any) => void;
  jobPipeline: any[];
  setJobPipeline: (pipeline: any[]) => void;
  standaloneDefaultPipeline: any[];
  formType: "add" | "edit";
  onPipelineCopied?: (sourceId: string) => void;
}

export default function PipelineStagesStep({
  careerForm,
  jobPipeline,
  setJobPipeline,
  standaloneDefaultPipeline,
  formType,
  onPipelineCopied,
}: PipelineStagesStepProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PipelineStageBuilder
        careerForm={careerForm}
        jobPipeline={jobPipeline}
        setJobPipeline={setJobPipeline}
        careerPostType={careerForm.careerPostType}
        standaloneDefaultPipeline={standaloneDefaultPipeline}
        formType={formType}
        onPipelineCopied={onPipelineCopied}
      />
    </div>
  );
}
