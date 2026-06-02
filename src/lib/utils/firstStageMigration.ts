import { getFirstEnabledStage } from "@/lib/Utils";

type PipelineSubstage = {
  id?: string;
  name?: string;
  currentStep?: string;
  status?: string;
};

type PipelineStage = {
  id?: string;
  name?: string;
  alias?: string;
  enabled?: boolean;
  substages?: PipelineSubstage[];
};

type UpdatedBy = {
  name?: string;
  email?: string;
  image?: string;
};

import { TERMINAL_APPLICATION_STATUSES } from "@/lib/utils/constants";

export const migrateZeroMovementCandidatesToNewFirstStage = async ({
  db,
  careerId,
  careerObjectId,
  previousPipeline,
  nextPipeline,
  updatedBy,
}: {
  db: any;
  careerId?: string;
  careerObjectId?: { toString: () => string } | null;
  previousPipeline?: PipelineStage[];
  nextPipeline?: PipelineStage[];
  updatedBy?: UpdatedBy;
}) => {
  if (!careerId || !Array.isArray(previousPipeline) || !Array.isArray(nextPipeline)) {
    return { movedCount: 0 };
  }

  const oldFirst = getFirstEnabledStage(previousPipeline as any);
  const newFirst = getFirstEnabledStage(nextPipeline as any);

  if (!oldFirst || !newFirst) {
    return { movedCount: 0 };
  }

  const firstStageUnchanged =
    oldFirst.stage?.id === newFirst.stage?.id &&
    oldFirst.substage?.id === newFirst.substage?.id;

  if (firstStageUnchanged) {
    return { movedCount: 0 };
  }

  const candidatesAtOldFirst = await db
    .collection("interviews")
    .find(
      {
        id: careerId,
        stageId: oldFirst.stage.id,
        substageId: oldFirst.substage.id,
        applicationStatus: { $nin: TERMINAL_APPLICATION_STATUSES },
      },
      {
        projection: { _id: 1 },
      }
    )
    .toArray();

  if (candidatesAtOldFirst.length === 0) {
    return { movedCount: 0 };
  }

  const candidateInterviewUIDs = candidatesAtOldFirst.map((candidate: any) =>
    candidate._id.toString()
  );

  const movedFromOldFirstUIDs = await db.collection("interview-history").distinct(
    "interviewUID",
    {
      interviewUID: { $in: candidateInterviewUIDs },
      fromStageId: oldFirst.stage.id,
      fromSubstageId: oldFirst.substage.id,
    }
  );

  const movedFromOldFirstSet = new Set(
    movedFromOldFirstUIDs.map((uid: any) => String(uid))
  );

  const eligibleCandidates = candidatesAtOldFirst.filter(
    (candidate: any) => !movedFromOldFirstSet.has(candidate._id.toString())
  );

  if (eligibleCandidates.length === 0) {
    return { movedCount: 0 };
  }

  const eligibleCandidateIds = eligibleCandidates.map((candidate: any) => candidate._id);
  const nextStageAlias =
    (newFirst.stage.id === "1" || newFirst.stage.id === "2") &&
    typeof newFirst.stage.alias === "string" &&
    newFirst.stage.alias.trim().length > 0
      ? newFirst.stage.alias.trim()
      : null;

  const baseSetFields = {
    stageId: newFirst.stage.id,
    substageId: newFirst.substage.id,
    currentStep: newFirst.substage.currentStep,
    status: newFirst.substage.status,
    updatedAt: new Date(),
  };

  const updateOperation: Record<string, any> = {
    $set: {
      ...baseSetFields,
      ...(nextStageAlias ? { currentStepAlias: nextStageAlias } : {}),
    },
  };

  if (!nextStageAlias) {
    updateOperation.$unset = { currentStepAlias: "" };
  }

  await db.collection("interviews").updateMany(
    {
      _id: { $in: eligibleCandidateIds },
      id: careerId,
      stageId: oldFirst.stage.id,
      substageId: oldFirst.substage.id,
      applicationStatus: { $nin: TERMINAL_APPLICATION_STATUSES },
    },
    updateOperation
  );

  const movedCandidates = await db
    .collection("interviews")
    .find(
      {
        _id: { $in: eligibleCandidateIds },
        id: careerId,
        stageId: newFirst.stage.id,
        substageId: newFirst.substage.id,
        applicationStatus: { $nin: TERMINAL_APPLICATION_STATUSES },
      },
      {
        projection: { _id: 1 },
      }
    )
    .toArray();

  if (movedCandidates.length === 0) {
    return { movedCount: 0 };
  }

  await db.collection("interview-history").insertMany(
    movedCandidates.map((candidate: any) => ({
      interviewUID: candidate._id.toString(),
      careerId: careerObjectId?.toString(),
      fromStage: `${oldFirst.stage.name}: ${oldFirst.substage.name}`,
      toStage: `${newFirst.stage.name}: ${newFirst.substage.name}`,
      fromStageId: oldFirst.stage.id,
      fromSubstageId: oldFirst.substage.id,
      toStageId: newFirst.stage.id,
      toSubstageId: newFirst.substage.id,
      action: "Auto-Moved First Stage",
      updatedBy: {
        name: updatedBy?.name,
        email: updatedBy?.email,
        image: updatedBy?.image,
      },
      createdAt: Date.now(),
    }))
  );

  return { movedCount: movedCandidates.length };
};
