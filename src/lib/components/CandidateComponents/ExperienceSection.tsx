import React from "react";

export interface ExperienceItem {
  id: string;
  title: string;
  company: string;
  employmentType: string;
  location: string;
  workSetup: string;
  startDate: { month: string; year: string };
  endDate: { month: string; year: string };
  isCurrentRole: boolean;
  description: string;
}

interface ExperienceSectionProps {
  experiences: ExperienceItem[];
  loading?: boolean;
}

const ExperienceSection: React.FC<ExperienceSectionProps> = ({ experiences, loading = false }) => {
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={{ height: "20px", width: "100%", background: "#e0e0e0", borderRadius: "8px" }} />
        <div style={{ height: "20px", width: "100%", background: "#e0e0e0", borderRadius: "8px" }} />
      </div>
    );
  }

  if (!experiences || experiences.length === 0) {
    return (
      <div style={{ fontWeight: 500, fontSize: "14px", lineHeight: "20px", color: "#717680" }}>
        No experience information available.
      </div>
    );
  }

  // Define month map for sorting
  const monthMap: { [key: string]: number } = {
    "January": 0, "February": 1, "March": 2, "April": 3, "May": 4, "June": 5,
    "July": 6, "August": 7, "September": 8, "October": 9, "November": 10, "December": 11
  };

  const getExperienceDateValue = (exp: ExperienceItem, isStart: boolean) => {
    const datePart = isStart ? exp.startDate : exp.endDate;
    if (exp.isCurrentRole && !isStart) return new Date().getTime() + 100000; // Future
    if (!datePart.year || !datePart.month) return 0;
    return new Date(parseInt(datePart.year), monthMap[datePart.month]).getTime();
  };

  // Sort data: End Date Desc, then Start Date Desc
  const sortedExperiences = [...experiences].sort((a: ExperienceItem, b: ExperienceItem) => {
    const endA = getExperienceDateValue(a, false);
    const endB = getExperienceDateValue(b, false);
    if (endA !== endB) return endB - endA;
    
    const startA = getExperienceDateValue(a, true);
    const startB = getExperienceDateValue(b, true);
    return startB - startA;
  });

  // Group by company
  const grouped = sortedExperiences.reduce((acc: any, curr: ExperienceItem) => {
    const lastGroup = acc[acc.length - 1];
    if (lastGroup && lastGroup.company === curr.company) {
      lastGroup.items.push(curr);
    } else {
      acc.push({ company: curr.company, items: [curr] });
    }
    return acc;
  }, []);

  // Helper to calculate duration
  const calculateDuration = (start: { month: string; year: string }, end: { month: string; year: string }, isCurrent: boolean) => {
    if (!start.month || !start.year) return "";
    
    const startDate = new Date(parseInt(start.year), monthMap[start.month]);
    const endDate = isCurrent ? new Date() : new Date(parseInt(end.year), monthMap[end.month]);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return "";

    let months = (endDate.getFullYear() - startDate.getFullYear()) * 12;
    months -= startDate.getMonth();
    months += endDate.getMonth();
    months += 1; // Include start month

    if (months <= 0) return "";

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    let duration = "";
    if (years > 0) duration += `${years} yr${years > 1 ? "s" : ""} `;
    if (remainingMonths > 0) duration += `${remainingMonths} mos`;
    
    return duration.trim();
  };

  // Helper for total duration of group
  const calculateTotalDuration = (items: ExperienceItem[]) => {
    if (!items.length) return "";
    
    let minDate = new Date(8640000000000000);
    let maxDate = new Date(-8640000000000000);
    
    items.forEach(item => {
      if (item.startDate.year && item.startDate.month) {
        const d = new Date(parseInt(item.startDate.year), monthMap[item.startDate.month]);
        if (d < minDate) minDate = d;
      }
      
      let endD = new Date(); // Default to now if current
      if (!item.isCurrentRole && item.endDate.year && item.endDate.month) {
        endD = new Date(parseInt(item.endDate.year), monthMap[item.endDate.month]);
      }
      if (endD > maxDate) maxDate = endD;
    });
    
    if (minDate.getFullYear() === 8640000000000000 || maxDate.getFullYear() === -8640000000000000) return "";

    let months = (maxDate.getFullYear() - minDate.getFullYear()) * 12;
    months -= minDate.getMonth();
    months += maxDate.getMonth();
    months += 1;

    if (months <= 0) return "";
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    let duration = "";
    if (years > 0) duration += `${years} yr${years > 1 ? "s" : ""} `;
    if (remainingMonths > 0) duration += `${remainingMonths} mos`;
    return duration.trim();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {grouped.map((group: any, groupIndex: number) => {
        if (group.items.length === 1) {
          // SINGLE ITEM LAYOUT
          const exp = group.items[0];
          const duration = calculateDuration(exp.startDate, exp.endDate, exp.isCurrentRole);
          
          return (
            <div key={exp.id} style={{ display: "flex", gap: "16px", paddingBottom: "24px", borderBottom: groupIndex === grouped.length - 1 ? "none" : "1px solid #E9EAEB" }}>
              <div style={{ 
                width: "48px", 
                height: "48px", 
                borderRadius: "50%", 
                background: "#181D27", 
                color: "#FFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                fontSize: "20px",
                flexShrink: 0
              }}>
                {exp.company ? exp.company.charAt(0).toUpperCase() : "C"}
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontSize: "16px", fontWeight: 600, color: "#181D27" }}>
                    {exp.title}
                  </div>
                </div>

                <div style={{ fontSize: "14px", color: "#181D27" }}>
                  {exp.company}{exp.employmentType ? ` • ${exp.employmentType}` : ""}
                </div>

                <div style={{ fontSize: "14px", color: "#667085" }}>
                  {exp.startDate.month} {exp.startDate.year} — {exp.isCurrentRole ? "Present" : `${exp.endDate.month} ${exp.endDate.year}`}
                  {duration ? ` • ${duration}` : ""}
                </div>

                <div style={{ fontSize: "14px", color: "#667085" }}>
                  {[exp.location, exp.workSetup].filter(Boolean).join(" • ")}
                </div>

                {exp.description && (
                  <div style={{ fontSize: "14px", color: "#475467", marginTop: "12px", whiteSpace: "pre-wrap", lineHeight: "1.5" }}>
                    {exp.description}
                  </div>
                )}
              </div>
            </div>
          );
        } else {
          // GROUPED LAYOUT
          const groupTotalDuration = calculateTotalDuration(group.items);
          const firstItem = group.items[0];

          return (
            <div key={groupIndex} style={{ display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "24px", borderBottom: groupIndex === grouped.length - 1 ? "none" : "1px solid #E9EAEB" }}>
               {/* Company Header Row */}
               <div style={{ display: "flex", gap: "16px" }}>
                  {/* Logo Column */}
                  <div style={{ width: "48px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
                    <div style={{ 
                      width: "48px", 
                      height: "48px", 
                      borderRadius: "50%", 
                      background: "#181D27", 
                      color: "#FFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: "20px",
                      flexShrink: 0,
                      zIndex: 1
                    }}>
                      {group.company ? group.company.charAt(0).toUpperCase() : "C"}
                    </div>
                    {/* Vertical Line from Logo to First Item */}
                    <div style={{ width: "2px", background: "#E9EAEB", flex: 1, minHeight: "24px", position: "absolute", top: "48px", bottom: "-24px", left: "50%", transform: "translateX(-1px)" }} />
                  </div>

                  {/* Company Details */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontSize: "16px", fontWeight: 600, color: "#181D27" }}>
                      {group.company}
                    </div>
                    <div style={{ fontSize: "14px", color: "#667085" }}>
                      {firstItem.employmentType ? `${firstItem.employmentType} • ` : ""}{groupTotalDuration}
                    </div>
                    <div style={{ fontSize: "14px", color: "#667085" }}>
                      {[firstItem.location, firstItem.workSetup].filter(Boolean).join(" • ")}
                    </div>
                  </div>
               </div>

               {/* Roles List */}
               <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  {group.items.map((exp: ExperienceItem, idx: number) => {
                    const duration = calculateDuration(exp.startDate, exp.endDate, exp.isCurrentRole);
                    const isLast = idx === group.items.length - 1;
                    
                    return (
                      <div key={exp.id} style={{ display: "flex", gap: "16px", position: "relative" }}>
                        {/* Timeline Column for Item */}
                        <div style={{ width: "48px", flexShrink: 0, position: "relative" }}>
                          {/* Line Segment Above Dot (Connects to previous item or logo) */}
                          <div style={{ 
                            position: "absolute", 
                            left: "50%", 
                            transform: "translateX(-1px)", 
                            width: "2px", 
                            background: "#E9EAEB", 
                            top: "-24px", 
                            height: "30px" // 24px gap + 6px to dot center
                          }} />
                           
                          {/* Line Segment Below Dot (Connects to next item) */}
                          {!isLast && (
                            <div style={{ 
                              position: "absolute", 
                              left: "50%", 
                              transform: "translateX(-1px)", 
                              width: "2px", 
                              background: "#E9EAEB", 
                              top: "6px", 
                              bottom: "-24px" // Extend through current item height + gap
                            }} />
                          )}
                           
                          {/* Dot */}
                          <div style={{ 
                            position: "absolute", 
                            top: "6px", 
                            left: "50%", 
                            transform: "translateX(-50%)", 
                            width: "10px", 
                            height: "10px", 
                            borderRadius: "50%", 
                            background: "#E9EAEB", 
                            border: "2px solid #FFF", 
                            zIndex: 1 
                          }} />
                        </div>

                        {/* Role Content */}
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ fontSize: "16px", fontWeight: 600, color: "#181D27" }}>
                              {exp.title}
                            </div>
                          </div>
                          <div style={{ fontSize: "14px", color: "#667085" }}>
                            {exp.startDate.month} {exp.startDate.year} — {exp.isCurrentRole ? "Present" : `${exp.endDate.month} ${exp.endDate.year}`}
                            {duration ? ` • ${duration}` : ""}
                          </div>
                           
                          {exp.description && (
                            <div style={{ fontSize: "14px", color: "#475467", marginTop: "12px", whiteSpace: "pre-wrap", lineHeight: "1.5" }}>
                              {exp.description}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
               </div>
            </div>
          );
        }
      })}
    </div>
  );
};

export default ExperienceSection;
