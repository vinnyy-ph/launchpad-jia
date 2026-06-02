import { useMemo } from "react";
import {
    getCandidateLocation,
    getCurrentPosition,
    getExperienceYears,
    getCandidateSalary,
    getCandidateAvailability,
    getCandidateWorkSetup,
    getSkills,
    getCandidatePreScreeningAnswer,
    getCandidateAskingSalaryPreScreeningAnswers,
    hasCandidatePreScreeningAnswerByType,
    Candidate,
} from "@/lib/utils/candidateHelpers";

export type FilterType = "Candidates" | "Skills" | "Current Position" | "Location" | "Experience" | "Salary" | "Availability" | "Work Setup" | string;

export interface Filter {
    type: FilterType;
    name: string;
    questionId?: string;
}

interface PreScreeningQuestion {
    id: string;
    questionType: string;
    question: string;
    questionFormat: string;
    answers: Array<{ id: string | number; value: string | number; type: string }>;
}

interface UseCandidateFiltersParams {
    candidates: Candidate[];
    selectedFilters: Filter[];
    debouncedMinYears: string;
    debouncedMaxYears: string;
    debouncedMinSalary: string;
    debouncedMaxSalary: string;
    preScreeningAnswers?: Record<string, any>;
    preScreeningQuestions?: PreScreeningQuestion[];
}

export const useCandidateFilters = ({
    candidates,
    selectedFilters,
    debouncedMinYears,
    debouncedMaxYears,
    debouncedMinSalary,
    debouncedMaxSalary,
    preScreeningAnswers = {},
    preScreeningQuestions = [],
}: UseCandidateFiltersParams) => {
    const filteredCandidates = useMemo(() => {
        // Build effective filters including experience and salary from debounced values
        const effectiveFilters: Filter[] = [...selectedFilters];
        
        // Add experience filter if min or max is set
        if (debouncedMinYears.trim() || debouncedMaxYears.trim()) {
            const min = debouncedMinYears.trim();
            const max = debouncedMaxYears.trim();
            let filterName = "";
            
            if (min && max) {
                filterName = `${min}-${max} years`;
            } else if (min) {
                filterName = `${min}≥ years`;
            } else if (max) {
                filterName = `${max}≤ years`;
            }
            
            if (filterName) {
                // Remove existing Experience filters and add the new one
                const withoutExperience = effectiveFilters.filter(f => f.type !== "Experience");
                effectiveFilters.length = 0;
                effectiveFilters.push(...withoutExperience, { type: "Experience", name: filterName });
            }
        } else {
            // Remove experience filters if both are empty
            const withoutExperience = effectiveFilters.filter(f => f.type !== "Experience");
            effectiveFilters.length = 0;
            effectiveFilters.push(...withoutExperience);
        }
        
        // Add salary filter if min or max is set
        if (debouncedMinSalary.trim() || debouncedMaxSalary.trim()) {
            const min = debouncedMinSalary.trim();
            const max = debouncedMaxSalary.trim();
            let filterName = "";
            
            if (min && max) {
                filterName = `${min}-${max}`;
            } else if (min) {
                filterName = `${min}≥`;
            } else if (max) {
                filterName = `${max}≤`;
            }
            
            if (filterName) {
                // Remove existing Salary filters and add the new one
                const withoutSalary = effectiveFilters.filter(f => f.type !== "Salary");
                effectiveFilters.length = 0;
                effectiveFilters.push(...withoutSalary, { type: "Salary", name: filterName });
            }
        } else {
            // Remove salary filters if both are empty
            const withoutSalary = effectiveFilters.filter(f => f.type !== "Salary");
            effectiveFilters.length = 0;
            effectiveFilters.push(...withoutSalary);
        }
        
        if (effectiveFilters.length === 0) {
            return candidates;
        }

        // Separate pre-screening filters from standard filters
        const preScreeningFilters = effectiveFilters.filter(f => f.questionId);
        const standardFilters = effectiveFilters.filter(f => !f.questionId);
        
        // Group standard filters by type
        const filtersByType = standardFilters.reduce((acc, filter) => {
            if (!acc[filter.type]) {
                acc[filter.type] = [];
            }
            acc[filter.type].push(filter);
            return acc;
        }, {} as Record<FilterType, Filter[]>);

        return candidates.filter((candidate: Candidate) => {
            // First check pre-screening filters
            const matchesPreScreening = preScreeningFilters.length === 0 || preScreeningFilters.every(filter => {
                if (!filter.questionId) return true;
                
                const question = preScreeningQuestions.find(q => q.id === filter.questionId);
                if (!question) return false;
                
                // For predefined question types (excluding Custom Question), if candidate doesn't have
                // that question type in any of their applications, include them
                if (question.questionType !== "Custom Question") {
                    const hasQuestionType = hasCandidatePreScreeningAnswerByType(candidate, question.questionType);
                    if (!hasQuestionType) {
                        // Candidate applied to jobs without this predefined question type - include them
                        return true;
                    }
                }
                
                // Get candidate's answers for this question
                const candidateAnswers = getCandidatePreScreeningAnswer(candidate, filter.questionId);
                // For Custom Questions, strict matching - if no answers, exclude
                if (candidateAnswers.length === 0) {
                    return question.questionType === "Custom Question" ? false : true;
                }
                
                // Get the filter value(s) - could be a single value or array
                // Try composite key first (questionId|questionText), then fallback to questionId
                let filterValue = preScreeningAnswers[`${filter.questionId}|${question.question}`];
                if (!filterValue) {
                    filterValue = preScreeningAnswers[filter.questionId];
                }
                if (!filterValue) return false;
                
                // Handle different question formats
                if (question.questionFormat === "Range") {
                    // For range questions, filter.name contains the range (e.g., "50000-100000")
                    const rangeMatch = filter.name.match(/(\d+)-(\d+)/);
                    const minMatch = filter.name.match(/(\d+)≥/);
                    const maxMatch = filter.name.match(/(\d+)≤/);
                    
                    const candidateMin = candidateAnswers.find((a: any) => a.type === "Minimum")?.value;
                    const candidateMax = candidateAnswers.find((a: any) => a.type === "Maximum")?.value;
                    
                    if (rangeMatch) {
                        // Range filter: "50000-100000" - check if candidate's range overlaps with filter range
                        const filterMin = parseInt(rangeMatch[1], 10);
                        const filterMax = parseInt(rangeMatch[2], 10);
                        if (candidateMin !== undefined && candidateMax !== undefined) {
                            // Ranges overlap if: candidateMin <= filterMax && candidateMax >= filterMin
                            return candidateMin <= filterMax && candidateMax >= filterMin;
                        } else if (candidateMin !== undefined) {
                            // Only candidate min: check if it's within filter range
                            return candidateMin >= filterMin && candidateMin <= filterMax;
                        } else if (candidateMax !== undefined) {
                            // Only candidate max: check if it's within filter range
                            return candidateMax >= filterMin && candidateMax <= filterMax;
                        }
                    } else if (minMatch) {
                        // Min only filter: "35000≥" - filter wants values >= filterMin
                        // Candidate should match if their range overlaps: candidateMax >= filterMin
                        const filterMin = parseInt(minMatch[1], 10);
                        if (candidateMin !== undefined && candidateMax !== undefined) {
                            // Both exist: check if range overlaps
                            return candidateMax >= filterMin;
                        } else if (candidateMin !== undefined) {
                            // Only min exists: check if min >= filterMin
                            return candidateMin >= filterMin;
                        } else if (candidateMax !== undefined) {
                            // Only max exists: check if max >= filterMin
                            return candidateMax >= filterMin;
                        }
                    } else if (maxMatch) {
                        // Max only filter: "50000≤" - filter wants values <= filterMax
                        // Candidate should match if their range overlaps: candidateMin <= filterMax
                        const filterMax = parseInt(maxMatch[1], 10);
                        if (candidateMin !== undefined && candidateMax !== undefined) {
                            // Both exist: check if range overlaps
                            return candidateMin <= filterMax;
                        } else if (candidateMax !== undefined) {
                            // Only max exists: check if max <= filterMax
                            return candidateMax <= filterMax;
                        } else if (candidateMin !== undefined) {
                            // Only min exists: check if min <= filterMax
                            return candidateMin <= filterMax;
                        }
                    }
                    return false;
                } else {
                    // For Dropdown, Checkboxes, Short Answer, Long Answer
                    // Check if any candidate answer matches the filter value(s)
                    const filterValues = Array.isArray(filterValue) ? filterValue : [filterValue];
                    const candidateValues = candidateAnswers.map((a: any) => String(a.value).toLowerCase());
                    
                    return filterValues.some(fv => {
                        const filterValueStr = String(fv).toLowerCase();
                        return candidateValues.some(cv => cv === filterValueStr || cv.includes(filterValueStr));
                    });
                }
            });
            
            if (!matchesPreScreening) return false;
            
            // Then check standard filters - candidate must match ALL types (AND logic across types)
            return Object.entries(filtersByType).every(([type, filters]) => {
                // Within each type, candidate must match ANY filter (OR logic within type)
                return filters.some(filter => {
                    if (type === "Candidates") {
                        const candidateName = candidate?.name || candidate?.email || "";
                        return candidateName.toLowerCase().includes(filter.name.toLowerCase());
                    } else if (type === "Skills") {
                        const skills = getSkills(candidate);
                        return skills.some((skill: string) => 
                            skill.toLowerCase() === filter.name.toLowerCase()
                        );
                    } else if (type === "Current Position") {
                        const position = getCurrentPosition(candidate);
                        return position.toLowerCase().includes(filter.name.toLowerCase());
                    } else if (type === "Location") {
                        const location = getCandidateLocation(candidate);
                        if (!location || location === "-") return false;
                        // Extract city name from location (first part before comma)
                        const locationParts = location.split(',').map(p => p.trim());
                        const cityName = locationParts[0];
                        // Match if the filter name matches the city name or is contained in the full location
                        return cityName.toLowerCase() === filter.name.toLowerCase() || 
                               location.toLowerCase().includes(filter.name.toLowerCase());
                    } else if (type === "Experience") {
                        const candidateYears = getExperienceYears(candidate);
                        if (candidateYears === null) return false;
                        
                        // Parse the filter name to extract min and max
                        // Format: "2-5 years", "2≥ years", or "5≤ years"
                        const filterName = filter.name;
                        const minMatch = filterName.match(/(\d+)≥/);
                        const maxMatch = filterName.match(/(\d+)≤/);
                        const rangeMatch = filterName.match(/(\d+)-(\d+)/);
                        
                        if (rangeMatch) {
                            // Range: "2-5 years"
                            const min = parseInt(rangeMatch[1], 10);
                            const max = parseInt(rangeMatch[2], 10);
                            return candidateYears >= min && candidateYears <= max;
                        } else if (minMatch) {
                            // Min only: "2≥ years"
                            const min = parseInt(minMatch[1], 10);
                            return candidateYears >= min;
                        } else if (maxMatch) {
                            // Max only: "5≤ years"
                            const max = parseInt(maxMatch[1], 10);
                            return candidateYears <= max;
                        }
                        
                        return false;
                    } else if (type === "Salary") {
                        // Check if candidate has asking salary pre-screening answers
                        const askingSalaryAnswers = getCandidateAskingSalaryPreScreeningAnswers(candidate);
                        
                        // If candidate doesn't have asking salary pre-screening answers,
                        // they applied to a job without that question - include them
                        if (askingSalaryAnswers.length === 0) {
                            return true;
                        }
                        
                        // Parse the filter name to extract min and max
                        // Format: "20000-50000", "20000≥", or "50000≤"
                        const filterName = filter.name;
                        const minMatch = filterName.match(/(\d+)≥/);
                        const maxMatch = filterName.match(/(\d+)≤/);
                        const rangeMatch = filterName.match(/(\d+)-(\d+)/);
                        
                        // Try to get salary from pre-screening answers first (Range format)
                        const candidateMin = askingSalaryAnswers.find((a: any) => a.type === "Minimum")?.value;
                        const candidateMax = askingSalaryAnswers.find((a: any) => a.type === "Maximum")?.value;
                        
                        if (candidateMin !== undefined || candidateMax !== undefined) {
                            // Use pre-screening answer values
                            const min = candidateMin !== undefined ? Number(candidateMin) : null;
                            const max = candidateMax !== undefined ? Number(candidateMax) : null;
                            
                            if (rangeMatch) {
                                // Range: "20000-50000"
                                const filterMin = parseInt(rangeMatch[1], 10);
                                const filterMax = parseInt(rangeMatch[2], 10);
                                // Check if candidate's range overlaps with filter range
                                if (min !== null && max !== null) {
                                    return min <= filterMax && max >= filterMin;
                                } else if (min !== null) {
                                    return min <= filterMax;
                                } else if (max !== null) {
                                    return max >= filterMin;
                                }
                            } else if (minMatch) {
                                // Min only: "20000≥" - filter wants candidates with salary >= filterMin
                                // Candidate should match if their range overlaps: their max >= filterMin
                                const filterMin = parseInt(minMatch[1], 10);
                                if (min !== null && max !== null) {
                                    // Both min and max exist: check if range overlaps
                                    return max >= filterMin;
                                } else if (min !== null) {
                                    // Only min exists: check if min >= filterMin
                                    return min >= filterMin;
                                } else if (max !== null) {
                                    // Only max exists: check if max >= filterMin
                                    return max >= filterMin;
                                }
                            } else if (maxMatch) {
                                // Max only: "50000≤" - filter wants candidates with salary <= filterMax
                                // Candidate should match if their range overlaps: their min <= filterMax
                                const filterMax = parseInt(maxMatch[1], 10);
                                if (min !== null && max !== null) {
                                    // Both min and max exist: check if range overlaps
                                    return min <= filterMax;
                                } else if (max !== null) {
                                    // Only max exists: check if max <= filterMax
                                    return max <= filterMax;
                                } else if (min !== null) {
                                    // Only min exists: check if min <= filterMax
                                    return min <= filterMax;
                                }
                            }
                        }
                        
                        // Fallback to regular CV salary if pre-screening answer format doesn't match
                        const candidateSalary = getCandidateSalary(candidate);
                        if (candidateSalary === null) return false;
                        
                        if (rangeMatch) {
                            // Range: "20000-50000"
                            const min = parseInt(rangeMatch[1], 10);
                            const max = parseInt(rangeMatch[2], 10);
                            return candidateSalary >= min && candidateSalary <= max;
                        } else if (minMatch) {
                            // Min only: "20000≥"
                            const min = parseInt(minMatch[1], 10);
                            return candidateSalary >= min;
                        } else if (maxMatch) {
                            // Max only: "50000≤"
                            const max = parseInt(maxMatch[1], 10);
                            return candidateSalary <= max;
                        }
                        
                        return false;
                    } else if (type === "Availability") {
                        // Get candidate availability from CV data or candidate object
                        const candidateAvailability = getCandidateAvailability(candidate);
                        if (!candidateAvailability) return false;
                        
                        // Match the filter name exactly (case-insensitive)
                        return candidateAvailability.toLowerCase() === filter.name.toLowerCase();
                    } else if (type === "Work Setup") {
                        // Get candidate work setup from interviews, CV data, or candidate object
                        const candidateWorkSetup = getCandidateWorkSetup(candidate);
                        if (!candidateWorkSetup) return false;
                        
                        // Match the filter name exactly (case-insensitive)
                        // Normalize work setup values (e.g., "On-site" vs "Onsite", "Fully Remote" vs "Remote")
                        const normalizedCandidate = candidateWorkSetup.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
                        const normalizedFilter = filter.name.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
                        
                        // Check for exact match or common variations
                        if (normalizedCandidate === normalizedFilter) return true;
                        if (normalizedCandidate.includes('remote') && normalizedFilter.includes('remote')) return true;
                        if (normalizedCandidate.includes('hybrid') && normalizedFilter.includes('hybrid')) return true;
                        if ((normalizedCandidate.includes('onsite') || normalizedCandidate.includes('onsite')) && normalizedFilter.includes('onsite')) return true;
                        
                        return false;
                    }
                    return false;
                });
            });
        });
    }, [candidates, selectedFilters, debouncedMinYears, debouncedMaxYears, debouncedMinSalary, debouncedMaxSalary, preScreeningAnswers, preScreeningQuestions]);

    return { filteredCandidates };
};

