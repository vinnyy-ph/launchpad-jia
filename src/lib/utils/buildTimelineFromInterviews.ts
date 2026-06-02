import { getFirstEnabledStage, getCurrentPipelineStage } from "@/lib/Utils";

interface BuildTimelineResult {
  timelineStages: any[];
  invitedCandidates: any[];
}

export function buildTimelineFromInterviews(
  pipelineStages: any[],
  interviews: any[]
): BuildTimelineResult {
  const newTimelineStages = pipelineStages.map((stage: any) => ({
    ...stage,
    droppedCandidates: [],
    substages: (stage?.substages || []).map((substage: any) => ({
      ...substage,
      candidates: [],
    })),
  }));

  const invited: any[] = [];
  const firstEnabledStage = getFirstEnabledStage(newTimelineStages);

  const resolveFirstEnabledStagePlacement = (
    interview: any
  ): "matched" | "not-matched" | "unresolved" => {
    if (!firstEnabledStage) return "unresolved";

    const hasStageIds = Boolean(interview?.stageId && interview?.substageId);

    if (hasStageIds) {
      const matchesById =
        interview.stageId === firstEnabledStage.stage.id &&
        interview.substageId === firstEnabledStage.substage.id;

      if (matchesById) {
        return "matched";
      }
    }

    const resolvedCurrentStage = getCurrentPipelineStage(newTimelineStages, {
      status: interview?.status,
      currentStep: interview?.currentStep,
    });

    if (!resolvedCurrentStage?.stage?.id || !resolvedCurrentStage?.substage?.id) {
      return "unresolved";
    }

    return resolvedCurrentStage.stage.id === firstEnabledStage.stage.id &&
      resolvedCurrentStage.substage.id === firstEnabledStage.substage.id
      ? "matched"
      : "not-matched";
  };

  for (const interview of interviews) {
    const isDropped =
      interview.applicationStatus === "Dropped" ||
      interview.applicationStatus === "Cancelled";

    const isInviteOnlyCandidate =
      Boolean(interview?.invitedFrom) &&
      interview?.hasJiaAccount === false &&
      !isDropped;

    const firstEnabledPlacement = isInviteOnlyCandidate
      ? resolveFirstEnabledStagePlacement(interview)
      : "not-matched";

    const shouldShowInInvited =
      isInviteOnlyCandidate &&
      (firstEnabledPlacement === "matched" ||
        firstEnabledPlacement === "unresolved");

    if (shouldShowInInvited) {
      invited.push(interview);
      continue;
    }

    if (interview.currentStep === "Applied") {
      const currentStage = {
        stage: "CV Screening",
        substage: "Waiting Submission",
      };
      const interviewWithStage = { ...interview, ...currentStage };
      if (isDropped) {
        newTimelineStages
          .find((stage) => stage.name === currentStage.stage)
          ?.droppedCandidates.push(interviewWithStage);
      } else {
        newTimelineStages
          .find((stage) => stage.name === currentStage.stage)
          ?.substages.find(
            (substage: any) => substage.name === currentStage.substage
          )
          ?.candidates.push(interviewWithStage);
      }
      continue;
    }

    if (
      interview.currentStep === "AI Interview" ||
      !interview.currentStep ||
      (interview.currentStep === "CV Screening" &&
        interview.status === "For AI Interview")
    ) {
      if (
        interview.status === "For Interview" ||
        interview.status === "For AI Interview"
      ) {
        const currentStage = {
          stage: "AI Interview",
          substage: "Waiting Interview",
        };
        const interviewWithStage = { ...interview, ...currentStage };
        isDropped
          ? newTimelineStages
            .find((stage) => stage.name === currentStage.stage)
            ?.droppedCandidates.push(interviewWithStage)
          : newTimelineStages
            .find((stage) => stage.name === currentStage.stage)
            ?.substages.find(
              (substage: any) => substage.name === currentStage.substage
            )
            ?.candidates.push(interviewWithStage);
        continue;
      }

      isDropped
        ? newTimelineStages
          .find((stage) => stage.name === "AI Interview")
          ?.droppedCandidates.push({
            ...interview,
            stage: "AI Interview",
            substage: "For Review",
          })
        : newTimelineStages
          .find((stage) => stage.name === "AI Interview")
          ?.substages.find(
            (substage: any) => substage.name === "For Review"
          )
          ?.candidates.push({
            ...interview,
            stage: "AI Interview",
            substage: "For Review",
          });
      continue;
    }

    if (interview.currentStep === "CV Screening") {
      const stage = { stage: "CV Screening", substage: "For Review" };
      const interviewWithStage = { ...interview, ...stage };
      if (isDropped) {
        newTimelineStages
          .find((stage) => stage.name === "CV Screening")
          ?.droppedCandidates.push(interviewWithStage);
      } else {
        newTimelineStages
          .find((stage) => stage.name === "CV Screening")
          ?.substages.find(
            (substage: any) => substage.name === "For Review"
          )
          ?.candidates.push(interviewWithStage);
      }
      continue;
    }

    if (
      interview.currentStep === "Human Interview" ||
      interview.currentStep === "Job Interview"
    ) {
      if (interview.status === "For Human Interview") {
        const stage = {
          stage: "Human Interview",
          substage: "Waiting Schedule",
        };
        const interviewWithStage = { ...interview, ...stage };
        isDropped
          ? newTimelineStages
            .find((stage) => stage.name === "Human Interview")
            ?.droppedCandidates.push(interviewWithStage)
          : newTimelineStages
            .find((stage) => stage.name === "Human Interview")
            ?.substages.find(
              (substage: any) => substage.name === "Waiting Schedule"
            )
            ?.candidates.push(interviewWithStage);
        continue;
      }

      if (interview.status === "For Interview") {
        const stage = {
          stage: "Human Interview",
          substage: "Waiting Interview",
        };
        const interviewWithStage = { ...interview, ...stage };
        isDropped
          ? newTimelineStages
            .find((stage) => stage.name === "Human Interview")
            ?.droppedCandidates.push(interviewWithStage)
          : newTimelineStages
            .find((stage) => stage.name === "Human Interview")
            ?.substages.find(
              (substage: any) => substage.name === "Waiting Interview"
            )
            ?.candidates.push(interviewWithStage);
        continue;
      }

      if (interview.status === "For Human Interview Review") {
        const stage = {
          stage: "Human Interview",
          substage: "For Review",
        };
        const interviewWithStage = { ...interview, ...stage };
        isDropped
          ? newTimelineStages
            .find((stage) => stage.name === "Human Interview")
            ?.droppedCandidates.push(interviewWithStage)
          : newTimelineStages
            .find((stage) => stage.name === "Human Interview")
            ?.substages.find(
              (substage: any) => substage.name === "For Review"
            )
            ?.candidates.push(interviewWithStage);
        continue;
      }
    }

    if (interview.currentStep === "Job Offered") {
      const currentStage = {
        stage: "Job Offer",
        substage: "For Contract Signing",
      };
      const interviewWithStage = { ...interview, ...currentStage };
      isDropped
        ? newTimelineStages
          .find((stage) => stage.name === currentStage.stage)
          ?.droppedCandidates.push(interviewWithStage)
        : newTimelineStages
          .find((stage) => stage.name === currentStage.stage)
          ?.substages.find(
            (substage: any) => substage.name === currentStage.substage
          )
          ?.candidates.push(interviewWithStage);
      continue;
    }

    if (interview.currentStep === "Contract Signed") {
      const currentStage = { stage: "Job Offer", substage: "Hired" };
      const interviewWithStage = { ...interview, ...currentStage };
      isDropped
        ? newTimelineStages
          .find((stage) => stage.name === currentStage.stage)
          ?.droppedCandidates.push(interviewWithStage)
        : newTimelineStages
          .find((stage) => stage.name === currentStage.stage)
          ?.substages.find(
            (substage: any) => substage.name === currentStage.substage
          )
          ?.candidates.push(interviewWithStage);
      continue;
    }

    // Custom pipeline stages - use case-insensitive matching
    let pipelineStageStep = newTimelineStages.find(
      (stage) => stage.name && interview.currentStep &&
        stage.name.toLowerCase() === interview.currentStep.toLowerCase()
    );

    // Fallback: Try strict ID matching if name matching failed (handles renamed stages)
    if (!pipelineStageStep && interview.stageId) {
      pipelineStageStep = newTimelineStages.find((stage) => stage.id === interview.stageId);
    }

    if (pipelineStageStep) {
      let substage = pipelineStageStep.substages.find(
        (substage: any) => substage.status && interview.status &&
          substage.status.toLowerCase() === interview.status.toLowerCase()
      );

      // Fallback: Try ID matching for substage
      if (!substage && interview.substageId) {
        substage = pipelineStageStep.substages.find((s: any) => s.id === interview.substageId);
      }

      if (substage) {
        const stage = {
          stage: pipelineStageStep.name,
          substage: substage.name,
        };
        const interviewWithStage = { ...interview, ...stage };
        isDropped
          ? newTimelineStages
            .find((stage) => stage.name === pipelineStageStep.name)
            ?.droppedCandidates.push(interviewWithStage)
          : newTimelineStages
            .find((stage) => stage.name === pipelineStageStep.name)
            ?.substages.find(
              (substage: any) => substage.name === stage.substage
            )
            ?.candidates.push(interviewWithStage);
        continue;
      }
    }
  }

  return {
    timelineStages: newTimelineStages,
    invitedCandidates: invited,
  };
}
