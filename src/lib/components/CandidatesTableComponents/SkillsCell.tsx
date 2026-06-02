import React from "react";
import ResponsiveTagList, { Tag } from "./ResponsiveTagList";

interface SkillsCellProps {
    candidate: any;
    getSkillTags: (candidate: any, selectedFilters?: Array<{ type: string; name: string; questionId?: string }>) => Tag[];
    selectedFilters?: Array<{ type: string; name: string; questionId?: string }>;
}

// Memoized SkillsCell component to prevent unnecessary re-renders when menu opens/closes
const SkillsCell = React.memo(({ candidate, getSkillTags, selectedFilters = [] }: SkillsCellProps) => {
    const skillTags = getSkillTags(candidate, selectedFilters);
    if (skillTags.length === 0) {
        return <span className="candidates-table-cell-text">-</span>;
    }
    const candidateId = candidate?._id || candidate?.id || candidate?.email || 'unknown';
    
    // Custom render function for tags to apply filtered styling
    const renderTag = (tag: Tag) => {
        const isFiltered = (tag as any).isFiltered === true;
        return (
            <div
                key={tag.id}
                data-tag-element
                className={`candidates-table-skill-tag ${isFiltered ? 'candidates-table-skill-tag-filtered' : ''}`}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "2px 8px",
                    backgroundColor: isFiltered ? "#ECFDF3" : "var(--Colors-Secondary_Colors-Blue-50, #EFF8FF)",
                    border: isFiltered ? "1px solid #A6F4C5" : "1px solid var(--Colors-Secondary_Colors-Blue-200, #B2DDFF)",
                    borderRadius: "16px",
                    fontSize: "12px",
                    fontWeight: 700,
                    lineHeight: "18px",
                    textAlign: "center",
                    color: isFiltered ? "#027948" : "var(--Colors-Secondary_Colors-Blue-700, #175CD3)",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                }}
            >
                {tag.label}
            </div>
        );
    };
    
    return (
        <ResponsiveTagList
            key={`skills-${candidateId}`}
            tags={skillTags}
            gap={4}
            className="candidates-table-skills-container"
            tagClassName="candidates-table-skill-tag"
            renderTag={renderTag}
        />
    );
}, (prevProps, nextProps) => {
    // Only re-render if candidate ID changed or selectedFilters changed
    // getSkillTags function reference should be stable (memoized with useCallback)
    // The cache inside getSkillTags ensures tags array reference stays stable
    const prevId = prevProps.candidate?._id || prevProps.candidate?.id || prevProps.candidate?.email || '';
    const nextId = nextProps.candidate?._id || nextProps.candidate?.id || nextProps.candidate?.email || '';
    
    // Check if selectedFilters changed
    const prevFiltersKey = JSON.stringify(prevProps.selectedFilters || []);
    const nextFiltersKey = JSON.stringify(nextProps.selectedFilters || []);
    
    // Also check if getSkillTags function reference changed (shouldn't happen, but just in case)
    if (prevProps.getSkillTags !== nextProps.getSkillTags) {
        return false; // Re-render if function reference changed
    }
    
    return prevId === nextId && prevFiltersKey === nextFiltersKey; // Return true if IDs and filters match (no re-render needed)
});

SkillsCell.displayName = "SkillsCell";

export default SkillsCell;


