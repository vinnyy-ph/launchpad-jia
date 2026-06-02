import { handleCareerFitColor } from "@/lib/Utils";

export default function CareerFit({ fit, assessment, candidateDetails, evaluatorName }: any) {
    if (!fit) return null;

    const { background, color } = handleCareerFitColor(fit);

    const tooltipHtml = assessment ? `<div class="career-fit-tooltip-header">
    <div style="display: flex; flex-direction: row; align-items: center; gap: 6px;">
    <img src="${candidateDetails?.image}" alt="${candidateDetails?.name}" style="width: 24px; height: 24px; border-radius: 50%;">
    <span class="candidate-name">${candidateDetails?.name}</span>
    </div>
    <div>
    <span style="background: ${background}; color: ${color}; border-radius: 16px; padding: 2px 10px; font-size: 12px; font-weight: 500;">${fit}</span> 
    <span style="font-size: 12px; color: #717680; font-weight: 500;">by ${evaluatorName}</span>
    </div>
    </div>
    <div style="width: 100%; height: 1px; background: #E9EAEB; margin: 10px 0;" ></div>
    <div>${assessment}</div>` : "No assessment available";

    return (
      assessment && !assessment.includes("N/A") ? <a
        data-tooltip-id="career-fit-tooltip"
        data-tooltip-html={tooltipHtml}
      >
        <span
            style={{
                width: "fit-content",
                background,
                color,
                borderRadius: 6,
                padding: "2px 10px",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer"
            }}
        >
            {fit?.includes("Strong Fit") && <img src="/strong-fit-badge.svg" alt="Strong Fit" style={{ width: 10, height: 10 }}></img>} {fit}
        </span>
        {evaluatorName && (
          <span style={{ fontSize: 12, color: "#717680", fontWeight: 500 }}> by {evaluatorName}</span>
        )}
      </a> : <span style={{ fontSize: 12, color: "#717680", fontWeight: 500 }}>No assessment yet</span>
    )
}
