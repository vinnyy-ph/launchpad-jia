import { PreScreeningQuestion } from "@/lib/hooks/CandidatesTable/usePreScreeningQuestions";

export interface Filter {
    type: string;
    name: string;
    questionId?: string;
    questionText?: string; // Store question text to differentiate questions with same ID
}

export interface PreScreeningFilter extends Filter {
    questionId: string;
}

/**
 * Converts pre-screening question answers to filter tags
 * Each question gets its own filter entry
 */
export function convertPreScreeningAnswersToFilters(
    preScreeningAnswers: Record<string, any>,
    preScreeningQuestions: PreScreeningQuestion[]
): PreScreeningFilter[] {
    const preScreeningFilters: PreScreeningFilter[] = [];

    Object.entries(preScreeningAnswers).forEach(([compositeKey, answer]) => {
        // Parse the composite key: "questionId|questionText"
        const parts = compositeKey.split('|');
        let questionId: string;
        let questionText: string | undefined;
        
        if (parts.length === 2) {
            // Composite key format: "questionId|questionText"
            questionId = parts[0];
            questionText = parts[1];
        } else {
            // Fallback: treat as plain questionId (for backward compatibility)
            questionId = compositeKey;
            questionText = undefined;
        }
        
        // Find the question that matches both ID and text (to handle duplicate IDs across careers)
        let question: PreScreeningQuestion | undefined;
        if (questionText) {
            question = preScreeningQuestions.find(q => 
                q.id === questionId && q.question === questionText
            );
        }
        
        // Fallback: try to find by ID only if composite key matching fails
        if (!question) {
            question = preScreeningQuestions.find(q => q.id === questionId);
        }
        
        if (!question) {
            console.warn(`No question found for key: ${compositeKey}`);
            return;
        }

        let displayValue = "";

        if (question.questionFormat === "Range") {
            const rangeAnswer = answer as { min?: string; max?: string };
            if (rangeAnswer.min && rangeAnswer.max) {
                displayValue = `${rangeAnswer.min}-${rangeAnswer.max}`;
            } else if (rangeAnswer.min) {
                displayValue = `${rangeAnswer.min}≥`;
            } else if (rangeAnswer.max) {
                displayValue = `${rangeAnswer.max}≤`;
            }
        } else if (Array.isArray(answer)) {
            displayValue = answer.join(", ");
        } else {
            displayValue = String(answer);
        }

        if (displayValue) {
            // Use questionType as the filter type, or question text if questionType is generic
            const filterType = question.questionType === "Custom Question"
                ? question.question
                : question.questionType;

            preScreeningFilters.push({
                type: filterType,
                name: displayValue,
                questionId: question.id, // Use the actual question ID
                // Store question text in the filter for proper grouping in FilterTags
                questionText: question.question
            });
        }
    });

    return preScreeningFilters;
}

/**
 * Updates location, availability, and work setup filters
 */
export function updateLocationFilters(
    currentFilters: Filter[],
    locations: string[],
    availability: string,
    workSetup: string[]
): Filter[] {
    // Remove existing Location, Availability, and Work Setup filters
    const withoutLocationAvailabilityWorkSetup = currentFilters.filter(
        f => f.type !== "Location" && f.type !== "Availability" && f.type !== "Work Setup"
    );

    // Add new location filters
    const locationFilters = locations.map(loc => ({ type: "Location" as const, name: loc }));

    // Add availability filter if set
    const availabilityFilters = availability
        ? [{ type: "Availability" as const, name: availability }]
        : [];

    // Add work setup filters
    const workSetupFilters = workSetup.map(setup => ({ type: "Work Setup" as const, name: setup }));

    return [
        ...withoutLocationAvailabilityWorkSetup,
        ...locationFilters,
        ...availabilityFilters,
        ...workSetupFilters
    ];
}

