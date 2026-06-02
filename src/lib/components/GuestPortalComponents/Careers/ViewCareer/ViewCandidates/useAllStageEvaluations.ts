"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "@/lib/utils/apiClient";
import type { RecruiterEvaluation } from "./CVScreening/useCVScreeningData";
import type { PipelineStage } from "./ViewCandidateTabs";

export type { RecruiterEvaluation };

type UseAllStageEvaluationsResult = {
  evaluations: RecruiterEvaluation[];
  stageEvaluationsMap: Record<string, RecruiterEvaluation | null>;
  stageLabelsMap: Record<string, string | undefined>;
  getEvaluationForStage: (stageId: string) => RecruiterEvaluation | null;
  isLoading: boolean;
};

/**
 * Hook to fetch all recruiter evaluations for an interview and map them to their stages.
 * 
 * Evaluation storage logic (same as recruiter dashboard):
 * - Evaluations are stored with stageId AND substageId (last substage of the stage)
 * - When endorsing: stageId = nextStage.id, substageId = nextStage.lastSubstage.id
 * - When dropping: stageId = currentStage.id, substageId = currentStage.lastSubstage.id
 * 
 * This hook matches evaluations by both stageId AND substageId for accuracy.
 * 
 * @param interviewUID - The MongoDB _id of the interview
 * @param pipelineStages - The full pipeline stages array to determine stage order
 * @returns All evaluations and helpers to get evaluation for a specific stage
 */
export function useAllStageEvaluations(
  interviewUID: string | null,
  pipelineStages: PipelineStage[] = []
): UseAllStageEvaluationsResult {
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

  /**
   * Get the evaluation for a specific stage.
   * 
   * Matches evaluations by both stageId AND substageId (last substage),
   * consistent with how the recruiter dashboard stores and retrieves evaluations.
   */
  const getEvaluationForStage = useCallback(
    (stageId: string): RecruiterEvaluation | null => {
      if (!stageId || evaluations.length === 0) return null;

      const stage = pipelineStages.find((s) => s.id === stageId);
      if (!stage) return null;

      // Get the last substage ID (this is what the recruiter dashboard uses)
      const lastSubstageId = stage.substages?.[stage.substages.length - 1]?.id;

      // Match by both stageId AND substageId (same logic as recruiter dashboard)
      const evaluation = evaluations.find(
        (eval_) =>
          eval_.stageId === stageId && eval_.substageId === lastSubstageId
      );

      return evaluation || null;
    },
    [evaluations, pipelineStages]
  );

  // Build a map of stageId -> evaluation for all stages
  const stageEvaluationsMap = useMemo(() => {
    const map: Record<string, RecruiterEvaluation | null> = {};
    for (const stage of pipelineStages) {
      map[stage.id] = getEvaluationForStage(stage.id);
    }
    return map;
  }, [pipelineStages, getEvaluationForStage]);

  // Build a map of stageId -> matchFit label for tabs display
  const stageLabelsMap = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const stage of pipelineStages) {
      const evaluation = stageEvaluationsMap[stage.id];
      map[stage.id] = evaluation?.matchFit || undefined;
    }
    return map;
  }, [pipelineStages, stageEvaluationsMap]);

  return {
    evaluations,
    stageEvaluationsMap,
    stageLabelsMap,
    getEvaluationForStage,
    isLoading,
  };
}








