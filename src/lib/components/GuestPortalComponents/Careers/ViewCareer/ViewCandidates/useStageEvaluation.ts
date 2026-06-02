"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/utils/apiClient";
import type { RecruiterEvaluation } from "./CVScreening/useCVScreeningData";
import type { PipelineStage } from "./ViewCandidateTabs";

export type { RecruiterEvaluation };

type UseStageEvaluationResult = {
  evaluation: RecruiterEvaluation | null;
  isLoading: boolean;
};

/**
 * Hook to fetch recruiter evaluation for a specific stage.
 * 
 * Matches evaluations by both stageId AND substageId (last substage),
 * consistent with how the recruiter dashboard stores and retrieves evaluations.
 * 
 * @param interviewUID - The MongoDB _id of the interview
 * @param stageId - The stage ID to get evaluation for
 * @param pipelineStages - The full pipeline stages array to get substage info
 * @returns The evaluation for the stage (if exists) and loading state
 */
export function useStageEvaluation(
  interviewUID: string | null,
  stageId: string | null,
  pipelineStages: PipelineStage[] = []
): UseStageEvaluationResult {
  const [evaluations, setEvaluations] = useState<RecruiterEvaluation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchRecruiterEvaluations = async () => {
      if (!interviewUID) return;

      setIsLoading(true);
      try {
        const response = await api.post("/api/get-recruiter-evaluations", {
          interviewID: interviewUID,
        });
        if (response.status === 200 && Array.isArray(response.data)) {
          setEvaluations(response.data);
        }
      } catch (err) {
        console.error("Failed to fetch recruiter evaluations:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecruiterEvaluations();
  }, [interviewUID]);

  // Find evaluation for the specific stage by matching both stageId AND substageId
  const evaluation = useMemo(() => {
    if (!stageId || evaluations.length === 0) return null;

    const stage = pipelineStages.find((s) => s.id === stageId);
    if (!stage) return null;

    // Get the last substage ID (this is what the recruiter dashboard uses)
    const lastSubstageId = stage.substages?.[stage.substages.length - 1]?.id;

    // Match by both stageId AND substageId (same logic as recruiter dashboard)
    const matchedEval = evaluations.find(
      (eval_) =>
        eval_.stageId === stageId && eval_.substageId === lastSubstageId
    );

    return matchedEval || null;
  }, [evaluations, stageId, pipelineStages]);

  return {
    evaluation,
    isLoading,
  };
}
