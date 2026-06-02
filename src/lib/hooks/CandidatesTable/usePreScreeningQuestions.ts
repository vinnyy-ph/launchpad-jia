import { useState, useEffect } from "react";
import { api } from "@/lib/utils/apiClient";

export interface PreScreeningQuestion {
    id: string;
    questionType: string;
    question: string;
    questionFormat: string;
    answers: Array<{ id: string | number; value: string | number; type: string }>;
}

interface UsePreScreeningQuestionsParams {
    orgID: string | null;
}

interface UsePreScreeningQuestionsReturn {
    preScreeningQuestions: PreScreeningQuestion[];
    isLoading: boolean;
}

/**
 * Fetches all pre-screening questions from careers for an organization.
 * Aggregates questions from all careers (old and new).
 *
 * Deduplication Logic:
 * - Questions with the same ID are deduplicated
 * - If all questions with the same ID have the same text → show only one
 * - If questions with the same ID have different texts → show each unique text version
 *   (This handles cases where a question title was changed, e.g., 
 *    "How much is your expected monthly salary?" → "How much is your monthly salary?")
 */
export const usePreScreeningQuestions = ({
    orgID,
}: UsePreScreeningQuestionsParams): UsePreScreeningQuestionsReturn => {
    const [preScreeningQuestions, setPreScreeningQuestions] = useState<PreScreeningQuestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPreScreeningQuestions = async () => {
            if (!orgID) {
                setIsLoading(false);
                return;
            }

            try {
                // Fetch all careers for the organization
                const response = await api.post("/api/fetch-careers", {
                    orgID,
                });

                const careers = response.data || [];

                // Extract all pre-screening questions from all careers
                const allQuestions: PreScreeningQuestion[] = [];
                careers.forEach((career: any) => {
                    if (career.preScreeningQuestions && Array.isArray(career.preScreeningQuestions)) {
                        career.preScreeningQuestions.forEach((question: PreScreeningQuestion) => {
                            // Only add questions that have a questionType and question text
                            if (question.questionType && question.question) {
                                allQuestions.push(question);
                            }
                        });
                    }
                });

                // Deduplicate questions by ID:
                // - If all questions with the same ID have the same text → show only one
                // - If questions with the same ID have different texts → show each unique text version
                const questionsById = new Map<string, Map<string, PreScreeningQuestion>>();
                
                allQuestions.forEach((question) => {
                    const questionId = question.id;
                    const questionText = question.question.trim();
                    
                    if (!questionsById.has(questionId)) {
                        questionsById.set(questionId, new Map());
                    }
                    
                    const textMap = questionsById.get(questionId)!;
                    // Use question text as key - if same ID has different text, they'll be separate entries
                    // Only keep the first occurrence of each text version for the same ID
                    if (!textMap.has(questionText)) {
                        textMap.set(questionText, question);
                    }
                });
                
                // Flatten the map structure back to array
                const deduplicatedQuestions: PreScreeningQuestion[] = [];
                questionsById.forEach((textMap, questionId) => {
                    // If only one text version exists for this ID, add it once (deduplicated)
                    if (textMap.size === 1) {
                        deduplicatedQuestions.push(Array.from(textMap.values())[0]);
                    } else {
                        // Multiple text versions for same ID - add each unique text version
                        // This handles the case where a question title was changed
                        textMap.forEach((question) => {
                            deduplicatedQuestions.push(question);
                        });
                    }
                });

                setPreScreeningQuestions(deduplicatedQuestions);
            } catch (error) {
                console.error("Error fetching pre-screening questions:", error);
                setPreScreeningQuestions([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPreScreeningQuestions();
    }, [orgID]);

    return {
        preScreeningQuestions,
        isLoading,
    };
};

