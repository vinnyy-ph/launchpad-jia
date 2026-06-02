import React from "react";

interface Filter {
    type: string;
    name: string;
    questionId?: string;
    questionText?: string; // Store question text to differentiate questions with same ID
}

interface PreScreeningQuestion {
    id: string;
    question?: string;
    questionType?: string;
}

interface FilterTagsProps {
    selectedFilters: Filter[];
    minYears: string;
    maxYears: string;
    minSalary: string;
    maxSalary: string;
    preScreeningAnswers: Record<string, any>;
    preScreeningQuestions: PreScreeningQuestion[];
    handleRemoveFilter: (type: string, name: string, questionId?: string) => void;
    handleClearAllFilters: () => void;
}

const FilterTags: React.FC<FilterTagsProps> = ({
    selectedFilters,
    minYears,
    maxYears,
    minSalary,
    maxSalary,
    preScreeningAnswers,
    preScreeningQuestions,
    handleRemoveFilter,
    handleClearAllFilters,
}) => {
    // Build effective filters for display (including immediate experience and salary values)
    const displayFilters = React.useMemo(() => {
        const filters = [...selectedFilters];
        
        // Add experience filter for display if min or max is set (immediate, not debounced)
        if (minYears.trim() || maxYears.trim()) {
            const min = minYears.trim();
            const max = maxYears.trim();
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
                const withoutExperience = filters.filter(f => f.type !== "Experience");
                filters.length = 0;
                filters.push(...withoutExperience, { type: "Experience", name: filterName });
            }
        } else {
            // Remove experience filters if both are empty
            const withoutExperience = filters.filter(f => f.type !== "Experience");
            filters.length = 0;
            filters.push(...withoutExperience);
        }
        
        // Add salary filter for display if min or max is set
        if (minSalary.trim() || maxSalary.trim()) {
            const min = minSalary.trim();
            const max = maxSalary.trim();
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
                const withoutSalary = filters.filter(f => f.type !== "Salary");
                filters.length = 0;
                filters.push(...withoutSalary, { type: "Salary", name: filterName });
            }
        } else {
            // Remove salary filters if both are empty
            const withoutSalary = filters.filter(f => f.type !== "Salary");
            filters.length = 0;
            filters.push(...withoutSalary);
        }
        
        return filters;
    }, [selectedFilters, minYears, maxYears, minSalary, maxSalary]);
    
    // Group filters by type, but keep pre-screening questions separate (each question gets its own tag)
    const groupedFilters = React.useMemo(() => {
        return displayFilters.reduce((acc, filter) => {
            let key: string;
            
            if (filter.questionId) {
                // For pre-screening questions, use composite key: questionId + questionText
                // This ensures questions with the same ID but different text get separate tags
                // Use | as separator to avoid issues with question text containing dashes
                const questionText = filter.questionText || '';
                key = `prescreening-${filter.questionId}|${questionText}`;
            } else if (filter.type === "Location") {
                // Location filters should be grouped together (multiple locations in one tag)
                key = filter.type;
            } else {
                // For other standard filters, group by type
                key = filter.type;
            }
            
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(filter.name);
            return acc;
        }, {} as Record<string, string[]>);
    }, [displayFilters]);
    
    // Get all filter keys
    const filterKeys = Object.keys(groupedFilters);
    
    // Standard filter types for proper ordering
    const standardFilterTypes = ["Candidates", "Skills", "Current Position", "Location", "Experience", "Salary", "Availability", "Work Setup"];
    const orderedKeys = [
        ...standardFilterTypes.filter(type => filterKeys.includes(type)),
        ...filterKeys.filter(key => !standardFilterTypes.includes(key))
    ];
    
    // Don't render if no filters
    if (displayFilters.length === 0 && !minYears.trim() && !maxYears.trim() && !minSalary.trim() && !maxSalary.trim() && Object.keys(preScreeningAnswers).length === 0) {
        return null;
    }
    
    if (displayFilters.length === 0) return null;
    
    return (
        <div className="candidates-filter-tags-container">
            <div className="candidates-filter-tags-content">
                {orderedKeys.map((key) => {
                    const filters = groupedFilters[key];
                    if (!filters || filters.length === 0) return null;

                    // Determine type label - check if it's a pre-screening question
                    const isPreScreening = key.startsWith("prescreening-");
                    let typeLabel = key;
                    let filterType = key;
                    let questionId: string | undefined = undefined;
                    
                    if (isPreScreening) {
                        // Pre-screening question - extract questionId and questionText from composite key
                        // Format: "prescreening-{questionId}|{questionText}"
                        const keyWithoutPrefix = key.replace("prescreening-", "");
                        const pipeIndex = keyWithoutPrefix.indexOf('|');
                        
                        if (pipeIndex > 0) {
                            questionId = keyWithoutPrefix.substring(0, pipeIndex);
                            const questionText = keyWithoutPrefix.substring(pipeIndex + 1);
                            typeLabel = questionText || "Pre-Screening";
                        } else {
                            // Fallback: try to find by questionId only
                            questionId = keyWithoutPrefix;
                            const question = preScreeningQuestions.find(q => q.id === questionId);
                            typeLabel = question?.question || question?.questionType || "Pre-Screening";
                        }
                        
                        // Find the question to get questionType for filterType
                        const question = preScreeningQuestions.find(q => q.id === questionId);
                        filterType = question?.questionType || "Pre-Screening";
                    } else {
                        // Standard filter types
                        typeLabel = key === "Candidates" ? "Candidates" : 
                                   key === "Skills" ? "Skills" : 
                                   key === "Current Position" ? "Current Position" : 
                                   key === "Location" ? "Candidate Location" : 
                                   key === "Experience" ? "Experience" : 
                                   key === "Salary" ? "Asking Salary" : 
                                   key === "Availability" ? "Availability" : 
                                   key === "Work Setup" ? "Preferred Work Setup" : key;
                    }
                    
                    return (
                        <div key={key} className="candidates-filter-tag">
                            <div className="candidates-filter-tag-text">
                                <span className="candidates-filter-tag-label">
                                    {typeLabel}:
                                </span>
                                <span className="candidates-filter-tag-name">
                                    {filters.map((name, index) => (
                                        <React.Fragment key={`${key}-${name}-${index}`}>
                                            {index > 0 && ", "}
                                            <span
                                                style={{
                                                    cursor: "pointer",
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Find the filter to get questionId and actual type for pre-screening questions
                                                    const filter = displayFilters.find(f => {
                                                        if (isPreScreening) {
                                                            return f.questionId === questionId && f.name === name;
                                                        }
                                                        return f.type === filterType && f.name === name;
                                                    });
                                                    // Use the actual filter type from the stored filter, or fallback to computed type
                                                    const actualFilterType = filter?.type || filterType;
                                                    handleRemoveFilter(actualFilterType, name, filter?.questionId);
                                                }}
                                                title="Click to remove"
                                            >
                                                {name}
                                            </span>
                                        </React.Fragment>
                                    ))}
                                </span>
                            </div>
                            <button
                                className="candidates-filter-tag-remove"
                                onClick={() => {
                                    // Remove all filters of this type
                                    filters.forEach(name => {
                                        const filter = displayFilters.find(f => {
                                            if (isPreScreening) {
                                                return f.questionId === questionId && f.name === name;
                                            }
                                            return f.type === filterType && f.name === name;
                                        });
                                        // Use the actual filter type from the stored filter, or fallback to computed type
                                        const actualFilterType = filter?.type || filterType;
                                        handleRemoveFilter(actualFilterType, name, filter?.questionId);
                                    });
                                }}
                                type="button"
                                title={`Remove all ${typeLabel}`}
                            >
                                <img src="/iconsV3/xV4.svg" alt="Remove" width={7} height={7} />
                            </button>
                        </div>
                    );
                })}
                {displayFilters.length > 0 && (
                    <>
                        <div className="candidates-filter-tags-divider"></div>
                        <button
                            className="candidates-filter-tags-clear"
                            onClick={handleClearAllFilters}
                            type="button"
                            style={{ background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer", fontWeight: 700, fontStyle: "Bold", fontSize: "14px", lineHeight: "20px", letterSpacing: "0%", color: "var(--Colors-Primary_Colors-Neutrals-600, #535862)", whiteSpace: "nowrap", flexShrink: 0, outline: "none" }}
                            onFocus={(e) => {
                                e.currentTarget.style.outline = "none";
                                e.currentTarget.style.border = "none";
                            }}
                            onMouseDown={(e) => {
                                e.currentTarget.style.outline = "none";
                                e.currentTarget.style.border = "none";
                            }}
                            onMouseUp={(e) => {
                                e.currentTarget.style.outline = "none";
                                e.currentTarget.style.border = "none";
                            }}
                        >
                            Clear Filters
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default FilterTags;

