import { TERMINAL_APPLICATION_STATUSES } from "@/lib/utils/constants";

type PipelineSubstage = {
  id?: string;
  name?: string;
};

type PipelineStage = {
  id?: string;
  name?: string;
  enabled?: boolean;
  substages?: PipelineSubstage[];
};

type ValidationResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
    };

const stageKey = (value: unknown): string | null => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return null;
};

export const validatePipelineMutationsAgainstInterviews = async ({
  db,
  careerId,
  previousPipeline,
  nextPipeline,
}: {
  db: any;
  careerId?: string;
  previousPipeline?: PipelineStage[];
  nextPipeline?: PipelineStage[];
}): Promise<ValidationResult> => {
  if (!careerId || !Array.isArray(previousPipeline) || !Array.isArray(nextPipeline)) {
    return { ok: true };
  }

  const nextById = new Map<string, PipelineStage>();
  for (const stage of nextPipeline) {
    const key = stageKey(stage?.id);
    if (key) {
      nextById.set(key, stage);
    }
  }

  const blockedStageMeta = new Map<
    string,
    { name: string; action: "disable" | "delete" }
  >();
  const removedSubstageMeta = new Map<string, { stageName: string; substageName: string }>();

  for (const previousStage of previousPipeline) {
    const previousStageId = stageKey(previousStage?.id);
    if (!previousStageId) {
      continue;
    }

    const nextStage = nextById.get(previousStageId);
    const stageWasEnabled = previousStage.enabled !== false;
    const stageIsEnabled = nextStage ? nextStage.enabled !== false : false;

    if (!nextStage) {
      blockedStageMeta.set(previousStageId, {
        name: previousStage.name || previousStageId,
        action: "delete",
      });
      continue;
    }

    if (stageWasEnabled && !stageIsEnabled) {
      blockedStageMeta.set(previousStageId, {
        name: previousStage.name || previousStageId,
        action: "disable",
      });
    }

    const nextSubstageIds = new Set<string>();
    for (const nextSubstage of nextStage.substages || []) {
      const nextSubstageId = stageKey(nextSubstage?.id);
      if (nextSubstageId) {
        nextSubstageIds.add(nextSubstageId);
      }
    }

    for (const previousSubstage of previousStage.substages || []) {
      const previousSubstageId = stageKey(previousSubstage?.id);
      if (!previousSubstageId) {
        continue;
      }

      if (!nextSubstageIds.has(previousSubstageId)) {
        removedSubstageMeta.set(`${previousStageId}::${previousSubstageId}`, {
          stageName: previousStage.name || previousStageId,
          substageName: previousSubstage.name || previousSubstageId,
        });
      }
    }
  }

  const blockedStageIds = Array.from(blockedStageMeta.keys());
  if (blockedStageIds.length > 0) {
    const occupiedStage = await db.collection("interviews").findOne(
      {
        id: careerId,
        stageId: { $in: blockedStageIds },
        applicationStatus: { $nin: TERMINAL_APPLICATION_STATUSES },
      },
      {
        projection: {
          stageId: 1,
        },
      }
    );

    if (occupiedStage?.stageId) {
      const meta = blockedStageMeta.get(String(occupiedStage.stageId));
      if (meta) {
        return {
          ok: false,
          message: `Cannot ${meta.action} stage "${meta.name}" with ongoing applicants.`,
        };
      }
    }
  }

  const removedSubstageFilters = Array.from(removedSubstageMeta.keys()).map((key) => {
    const [stageId, substageId] = key.split("::");
    return { stageId, substageId };
  });

  if (removedSubstageFilters.length > 0) {
    const occupiedSubstage = await db.collection("interviews").findOne(
      {
        id: careerId,
        $or: removedSubstageFilters,
        applicationStatus: { $nin: TERMINAL_APPLICATION_STATUSES },
      },
      {
        projection: {
          stageId: 1,
          substageId: 1,
        },
      }
    );

    if (occupiedSubstage?.stageId && occupiedSubstage?.substageId) {
      const key = `${occupiedSubstage.stageId}::${occupiedSubstage.substageId}`;
      const meta = removedSubstageMeta.get(key);
      if (meta) {
        return {
          ok: false,
          message: `Cannot delete substage "${meta.substageName}" in stage "${meta.stageName}" with ongoing applicants.`,
        };
      }
    }
  }

  return { ok: true };
};
