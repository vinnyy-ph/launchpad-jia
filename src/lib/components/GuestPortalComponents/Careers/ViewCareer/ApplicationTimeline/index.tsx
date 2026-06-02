"use client";

import React from "react";
import KanbanContainer from "./kanban/KanbanContainer";
import type { KanbanGroup, CandidateCard } from "./kanban/types";

type ApplicationTimelineProps = {
  data: { groups: KanbanGroup[] };
  onViewAnalysis?: (card: CandidateCard, context: { groupTitle: string; columnTitle: string }) => void;
  onViewCV?: (card: CandidateCard) => void;
};

export default function ApplicationTimeline({ data, onViewAnalysis, onViewCV }: ApplicationTimelineProps) {
  return (
    <>
      <KanbanContainer
        data={data}
        onViewAnalysis={onViewAnalysis}
        onViewCV={onViewCV}
      />
    </>
  );
}

export { useViewCareerData } from "./useViewCareerData";
export type { PipelineStage } from "./useViewCareerData";
export type { CandidateCard, KanbanGroup, KanbanColumn } from "./kanban/types";
