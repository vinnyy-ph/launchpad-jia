import { useState, useMemo, useCallback } from "react";

interface TimelineStage {
    id: string;
    name: string;
    droppedCandidates: any[];
    substages: any[];
}

type TimelineStages = TimelineStage[];

const sortOrder = {
    "Strong Fit": 1,
    "Good Fit": 2,
    "Maybe Fit": 3,
    "Bad Fit": 4,
    "No Fit": 5,
    "Not Fit": 6,
    "Insufficient Data": 7,
    "No CV": 8,
    "N/A": 9
}

export function useCareerApplicants(initialStages: TimelineStages) {
    const [timelineStages, setTimelineStages] = useState<TimelineStages>(initialStages);

    const interviewsInProgress = useMemo(() => {
        return timelineStages.reduce((acc, stage) => {
            return acc + stage.substages.reduce((acc, substage) => {
                return acc + substage.candidates.length;
            }, 0);
        }, 0);
    }, [timelineStages]);

    const setAndSortCandidates = useCallback((newStages: TimelineStages) => {
        const sortedStages: TimelineStages = [];

        for (const stage of newStages) {
            sortedStages.push({
                ...stage,
                substages: stage.substages.map((substage: any) => ({
                    ...substage,
                    candidates: substage.candidates.sort((a: any, b: any) => {
                        const ratingA = a.currentEvaluation?.matchFit || (a.currentStep === "CV Screening" || (a.stage === "AI Interview" && a.substage === "Waiting Interview") ? a.cvStatus : a.jobFit) || "N/A";
                        const ratingB = b.currentEvaluation?.matchFit || (b.currentStep === "CV Screening" || (b.stage === "AI Interview" && b.substage === "Waiting Interview") ? b.cvStatus : b.jobFit) || "N/A";
                        return sortOrder[ratingA] - sortOrder[ratingB];
                    })
                }))
            })
        }

        setTimelineStages(newStages);
    }, []);

    return {
        timelineStages,
        setTimelineStages,
        setAndSortCandidates,
        interviewsInProgress
    };
}