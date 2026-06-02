/**
 * Utility functions for mapping candidate stages and substages
 */

export interface StageMapping {
  endorseFrom: string;
  endorseTo: string;
  stageStepChange: string;
}

/**
 * Maps stageId to stage name
 */
const getStageName = (stageId: string, pipelineStages: any[]): string => {
  try {
    const stage = pipelineStages?.find((s) => s.id === stageId);
    return stage?.alias || stage?.name || "Unknown Stage";
  } catch (error) {
    console.warn("Error getting stage name:", error);
    return "Unknown Stage";
  }
};

/**
 * Maps substageId to substage name within a stage
 */
const getSubstageName = (
  stageId: string,
  substageId: string,
  pipelineStages: any[]
): string => {
  try {
    const stage = pipelineStages?.find((s) => s.id === stageId);
    if (!stage?.substages) return "For Review";

    const substage = stage.substages.find((sub: any) => sub.id === substageId);
    return substage?.name || "For Review";
  } catch (error) {
    console.warn("Error getting substage name:", error);
    return "For Review";
  }
};

/**
 * Determines the next stage and substage for endorsement
 */
const getNextStageInfo = (
  currentStageId: string,
  pipelineStages: any[]
): { stageId: string; substageId: string } => {
  try {
    const currentIndex =
      pipelineStages?.findIndex((s) => s.id === currentStageId) || -1;

    if (currentIndex === -1 || currentIndex >= pipelineStages.length - 1) {
      // If at last stage or stage not found, stay in current stage
      return { stageId: currentStageId, substageId: "1" };
    }

    const nextStage = pipelineStages[currentIndex + 1];
    return {
      stageId: nextStage.id,
      substageId: nextStage.substages?.[0]?.id || "1",
    };
  } catch (error) {
    console.warn("Error getting next stage info:", error);
    return { stageId: currentStageId, substageId: "1" };
  }
};

/**
 * Main function to generate stage mapping for a candidate
 */
export const generateStageMapping = (candidate: any): StageMapping => {
  try {
    // Default fallback values
    const defaultMapping: StageMapping = {
      endorseFrom: "CV Screening: For Review",
      endorseTo: "AI Interview: Waiting Interview",
      stageStepChange:
        "CV Screening: For Review -> AI Interview: Waiting Interview",
    };

    // Validate candidate object
    if (!candidate || typeof candidate !== "object") {
      console.warn("Invalid candidate object provided");
      return defaultMapping;
    }

    // Extract the required fields - use stageId and substageId from candidate
    const { stageId, substageId, pipelineStages } = candidate;

    // Validate required fields
    if (!stageId || !pipelineStages || !Array.isArray(pipelineStages)) {
      console.warn(
        "Missing required candidate fields: stageId or pipelineStages"
      );
      return defaultMapping;
    }

    // Get current stage and substage names using the updated stageId and substageId
    const currentStageName = getStageName(stageId, pipelineStages);
    const currentSubstageName = getSubstageName(
      stageId,
      substageId || "1",
      pipelineStages
    );

    // Get next stage info
    const nextStageInfo = getNextStageInfo(stageId, pipelineStages);
    const nextStageName = getStageName(nextStageInfo.stageId, pipelineStages);
    const nextSubstageName = getSubstageName(
      nextStageInfo.stageId,
      nextStageInfo.substageId,
      pipelineStages
    );

    // Format the values
    const endorseFrom = `${currentStageName}: ${currentSubstageName}`;
    const endorseTo = `${nextStageName}: ${nextSubstageName}`;
    const stageStepChange = `${endorseFrom} -> ${endorseTo}`;

    return {
      endorseFrom,
      endorseTo,
      stageStepChange,
    };
  } catch (error) {
    console.error("Error generating stage mapping:", error);
    return {
      endorseFrom: "CV Screening: For Review",
      endorseTo: "AI Interview: Waiting Interview",
      stageStepChange:
        "CV Screening: For Review -> AI Interview: Waiting Interview",
    };
  }
};

/**
 * Hook to use stage mapping with candidate data
 */
export const useStageMapping = (candidate: any) => {
  const mapping = generateStageMapping(candidate);

  return mapping;
};
