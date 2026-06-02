import CustomToolTip from "./CustomToolTip";
import { CAREER_STATUS_OPTIONS } from "@/lib/utils/constants";

interface CareerStatusBadges {
    jobPostType: string;
    activityStatus: string;
    status: string;
}

export default function CareerStatusBadges({ career, exclude = [] }: { career: any; exclude?: string[] }) {
    const badgeFields: { label: string; field: string }[] = [
      { label: "Published Status", field: "status" },
      { label: "Activity Status", field: "activityStatus" },
      { label: "Subscription Plan", field: "jobPostType" },
    ];

    const getBadgeValues = () => {
      // TODO: Implement Deal status badge
      return badgeFields
        .filter(({ label, field }) => career[field] && !exclude.includes(label))
        .map(({ label, field }) => ({ label, value: career[field] }));
    }
    
    return (
      <div className="d-flex justify-content-flex-start align-items-center" style={{ gap: 4 }}>
        {getBadgeValues().map((badgeValue: { label: string, value: string }, index: number) => {
          const badgeGroup = CAREER_STATUS_OPTIONS.find((o) => o.label === badgeValue.label)
          const badgeDetails = badgeGroup?.options?.find((o) => o.value === badgeValue.value)
           
          return badgeDetails && <CustomToolTip key={index} tooltipText={badgeDetails.tooltipText}>
            <div style={{ display: "flex", alignItems: "center", padding: "4px 10px", borderRadius: "16px", backgroundColor: badgeDetails.backgroundColor, border: badgeDetails.border }}>
              <img src={badgeDetails.icon} alt={badgeValue.value} style={{ width: 13, height: 13 }} />
            </div>
          </CustomToolTip>
        })}
      </div>
    )
  }
