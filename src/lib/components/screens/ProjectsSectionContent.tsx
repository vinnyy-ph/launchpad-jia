import { assetConstants } from "@/lib/utils/constantsV2";
import { ProjectItem } from "./ProjectsModal";

type ProjectsSectionContentProps = {
  value?: string;
  defaultProjectsData: ProjectItem[];
  onEditProjectItem: (id: string) => void;
  showEditIcon?: boolean;
};

const monthMap: { [key: string]: number } = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
  "": 0,
};

function parseProjectsData(
  value: string | undefined,
  defaultProjectsData: ProjectItem[]
): ProjectItem[] {
  if (!value) return defaultProjectsData;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultProjectsData;
    }
    return parsed;
  } catch {
    return defaultProjectsData;
  }
}

export default function ProjectsSectionContent({
  value,
  defaultProjectsData,
  onEditProjectItem,
  showEditIcon = true,
}: ProjectsSectionContentProps) {
  const projectsList = parseProjectsData(value, defaultProjectsData)
    .slice()
    .sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;

      const bYear = parseInt(b.endDate.year) || 0;
      const aYear = parseInt(a.endDate.year) || 0;
      if (bYear !== aYear) return bYear - aYear;

      const bMonth = monthMap[b.endDate.month] || 0;
      const aMonth = monthMap[a.endDate.month] || 0;
      return bMonth - aMonth;
    });

  if (!projectsList.length) {
    return <span>Upload your CV to auto-fill this section.</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {projectsList.map((proj, index) => (
        <div
          key={proj.id}
          style={{
            display: "flex",
            gap: "16px",
            paddingBottom: "24px",
            borderBottom: index === projectsList.length - 1 ? "none" : "1px solid #E9EAEB",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "4px",
              }}
            >
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#101828" }}>
                {proj.name}
              </h4>
              {showEditIcon && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <img
                    alt="Edit"
                    src={assetConstants.edit}
                    onClick={() => onEditProjectItem(proj.id)}
                    style={{ width: "16px", height: "16px", cursor: "pointer", opacity: 0.6 }}
                  />
                </div>
              )}
            </div>
            <div style={{ fontSize: "14px", color: "#667085", marginBottom: "8px" }}>
              {proj.startDate.year} — {proj.isCurrent ? "Present" : proj.endDate.year}
            </div>
            <div style={{ fontSize: "14px", color: "#344054", lineHeight: "24px", whiteSpace: "pre-wrap" }}>
              {proj.description}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
