import { useCallback } from "react";
import { Filter } from "@/lib/utils/CandidatesTable/candidateFilterHelpers";

interface UseFilterHandlersParams {
    setSelectedFilters: React.Dispatch<React.SetStateAction<Filter[]>>;
    setMinYears: (value: string) => void;
    setMaxYears: (value: string) => void;
    setMinSalary: (value: string) => void;
    setMaxSalary: (value: string) => void;
    setPreScreeningAnswers: (value: Record<string, any>) => void;
}

/**
 * Custom hook that provides filter removal and clearing handlers
 */
export function useFilterHandlers({
    setSelectedFilters,
    setMinYears,
    setMaxYears,
    setMinSalary,
    setMaxSalary,
    setPreScreeningAnswers,
}: UseFilterHandlersParams) {
    const handleRemoveFilter = useCallback(
        (type: string, name: string, questionId?: string) => {
            setSelectedFilters(prev =>
                prev.filter(f => {
                    if (f.type === type && f.name === name) {
                        // For pre-screening questions (identified by questionId), also check questionId
                        if (questionId && f.questionId) {
                            return f.questionId !== questionId;
                        }
                        // For standard filters without questionId, match by type and name
                        if (!questionId && !f.questionId) {
                            return false;
                        }
                        return true;
                    }
                    return true;
                })
            );

            // Also clear salary state if removing salary filter
            if (type === "Salary") {
                setMinSalary("");
                setMaxSalary("");
            }

            // Also clear years state if removing experience filter
            if (type === "Experience") {
                setMinYears("");
                setMaxYears("");
            }

            // Clear pre-screening answer if removing pre-screening filter (identified by questionId)
            if (questionId) {
                setPreScreeningAnswers(prev => {
                    const updated = { ...prev };
                    delete updated[questionId];
                    return updated;
                });
            }
        },
        [setSelectedFilters, setMinYears, setMaxYears, setMinSalary, setMaxSalary, setPreScreeningAnswers]
    );

    const handleClearAllFilters = useCallback(() => {
        setMinYears("");
        setMaxYears("");
        setMinSalary("");
        setMaxSalary("");
        setPreScreeningAnswers({});
        setSelectedFilters([]);
    }, [setMinYears, setMaxYears, setMinSalary, setMaxSalary, setPreScreeningAnswers, setSelectedFilters]);

    return {
        handleRemoveFilter,
        handleClearAllFilters,
    };
}

