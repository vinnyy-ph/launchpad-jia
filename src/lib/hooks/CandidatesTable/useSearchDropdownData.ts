import { useMemo } from "react";
import { getCurrentPosition, getSkills } from "@/lib/utils/candidateHelpers";

interface SearchResultItem {
    id?: string;
    name: string;
    count: number;
}

interface SearchDropdownData {
    candidates: SearchResultItem[];
    skills: SearchResultItem[];
    positions: SearchResultItem[];
}

/**
 * Custom hook to compute search dropdown data from candidates
 * Aggregates candidates, skills, and positions for search suggestions
 */
export function useSearchDropdownData(allCandidates: any[]): SearchDropdownData {
    return useMemo(() => {
        if (!Array.isArray(allCandidates) || allCandidates.length === 0) {
            return { candidates: [], skills: [], positions: [] };
        }

        const candidateResults = allCandidates.map((candidate: any, index: number) => ({
            id: candidate?._id || candidate?.id || candidate?.email || `candidate-${index}`,
            name: candidate?.name || candidate?.email || "Unnamed Candidate",
            email: candidate?.email,
            count: 1,
        }));

        const skillCounts = new Map<string, number>();
        const positionCounts = new Map<string, number>();

        allCandidates.forEach((candidate: any) => {
            const skills = Array.from(
                new Set(
                    (getSkills(candidate) || [])
                        .map((skill: string) => skill?.trim())
                        .filter((skill: string) => Boolean(skill))
                )
            );
            skills.forEach((skill: string | undefined) => {
                if (!skill) return;
                skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
            });

            const position = getCurrentPosition(candidate);
            if (position && position !== "-") {
                positionCounts.set(position, (positionCounts.get(position) || 0) + 1);
            }
        });

        const skills = Array.from(skillCounts.entries()).map(([name, count]) => ({ name, count }));
        const positions = Array.from(positionCounts.entries()).map(([name, count]) => ({ name, count }));

        return {
            candidates: candidateResults,
            skills,
            positions,
        };
    }, [allCandidates]);
}

