import { assetConstants } from "@/lib/utils/constantsV2";
import { AwardItem } from "./AwardModal";

type AwardsSectionContentProps = {
  value?: string;
  defaultAwardsData: AwardItem[];
  onEditAwardItem: (id: string) => void;
  showEditIcon?: boolean;
};

function parseAwardsData(
  value: string | undefined,
  defaultAwardsData: AwardItem[]
): AwardItem[] {
  if (!value) return defaultAwardsData;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultAwardsData;
    }
    return parsed;
  } catch {
    return defaultAwardsData;
  }
}

export default function AwardsSectionContent({
  value,
  defaultAwardsData,
  onEditAwardItem,
  showEditIcon = true,
}: AwardsSectionContentProps) {
  const awardsList = parseAwardsData(value, defaultAwardsData);

  if (!awardsList.length) {
    return <span>Upload your CV to auto-fill this section.</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {awardsList.map((award, index) => (
        <div
          key={award.id}
          style={{
            display: "flex",
            gap: "16px",
            paddingBottom: "24px",
            borderBottom: index === awardsList.length - 1 ? "none" : "1px solid #E9EAEB",
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
                {award.title}
              </h4>
              {showEditIcon && (
                <img
                  alt="Edit"
                  src={assetConstants.edit}
                  onClick={() => onEditAwardItem(award.id)}
                  style={{ width: "16px", height: "16px", cursor: "pointer", opacity: 0.6 }}
                />
              )}
            </div>

            <div style={{ fontSize: "14px", color: "#667085", marginBottom: "8px" }}>
              <span>Issued by {award.issuer}</span>
              {(award.issueDate.month || award.issueDate.year) && (
                <>
                  <span style={{ margin: "0 4px" }}>•</span>
                  <span>{`${award.issueDate.month} ${award.issueDate.year}`.trim()}</span>
                </>
              )}
            </div>

            {award.description && (
              <div style={{ fontSize: "14px", color: "#344054", lineHeight: "24px", whiteSpace: "pre-wrap" }}>
                {award.description}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
