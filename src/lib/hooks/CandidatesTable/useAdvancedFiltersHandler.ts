import { useCallback } from "react";
import { PreScreeningQuestion } from "@/lib/hooks/CandidatesTable/usePreScreeningQuestions";
import {
    convertPreScreeningAnswersToFilters,
    updateLocationFilters,
    Filter,
} from "@/lib/utils/CandidatesTable/candidateFilterHelpers";

interface AdvancedFilters {
    locations: string[];
    minYears: string;
    maxYears: string;
    minSalary: string;
    maxSalary: string;
    availability: string;
    workSetup: string[];
    preScreeningAnswers: Record<string, any>;
}

interface UseAdvancedFiltersHandlerParams {
    setSelectedFilters: React.Dispatch<React.SetStateAction<Filter[]>>;
    setMinYears: (value: string) => void;
    setMaxYears: (value: string) => void;
    setMinSalary: (value: string) => void;
    setMaxSalary: (value: string) => void;
    setPreScreeningAnswers: (value: Record<string, any>) => void;
    preScreeningQuestions: PreScreeningQuestion[];
}

/**
 * Custom hook to handle advanced filters application
 * Extracts the complex onApplyFilters callback logic
 */
export function useAdvancedFiltersHandler({
    setSelectedFilters,
    setMinYears,
    setMaxYears,
    setMinSalary,
    setMaxSalary,
    setPreScreeningAnswers,
    preScreeningQuestions,
}: UseAdvancedFiltersHandlerParams) {
    const handleApplyFilters = useCallback(
        (filters: AdvancedFilters) => {
            // Update location filters
            setSelectedFilters(prev =>
                updateLocationFilters(prev, filters.locations, filters.availability, filters.workSetup)
            );

            // Update experience filters
            setMinYears(filters.minYears);
            setMaxYears(filters.maxYears);

            // Update salary filters
            setMinSalary(filters.minSalary);
            setMaxSalary(filters.maxSalary);

            // Update pre-screening question answers
            setPreScreeningAnswers(filters.preScreeningAnswers || {});

            // Convert pre-screening answers to filter tags - each question gets its own filter
            if (filters.preScreeningAnswers && Object.keys(filters.preScreeningAnswers).length > 0) {
                setSelectedFilters(prev => {
                    // Remove existing pre-screening filters (identified by questionId)
                    const withoutPreScreening = prev.filter(f => !f.questionId);

                    // Convert pre-screening answers to filter entries
                    const preScreeningFilters = convertPreScreeningAnswersToFilters(
                        filters.preScreeningAnswers,
                        preScreeningQuestions
                    );

                    return [...withoutPreScreening, ...preScreeningFilters];
                });
            } else {
                // Remove all pre-screening filters if no answers (identified by questionId)
                setSelectedFilters(prev => prev.filter(f => !f.questionId));
            }
        },
        [
            setSelectedFilters,
            setMinYears,
            setMaxYears,
            setMinSalary,
            setMaxSalary,
            setPreScreeningAnswers,
            preScreeningQuestions,
        ]
    );

    return handleApplyFilters;
}

