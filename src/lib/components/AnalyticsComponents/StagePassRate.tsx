import { ChartTypeDisplay, pipelineStageColors } from "@/lib/utils/recruiterAnalytics";
import NoDataAvailable from "./NoDataAvailable";
import RetentionCurve from "./RetentionCurve";
import LineChart from "./LineChart";
import Metric from "./Metric";
import TableMetric from "./TableMetric";
import moment from "moment";
import styles from "@/lib/styles/analytics/graphs.module.scss";

export default function StagePassRate({ chartTypeDisplay, data }: { chartTypeDisplay: ChartTypeDisplay, data: any }) {
    if (!data || data?.stages?.length === 0) {
        return <NoDataAvailable />;
    }
    switch (chartTypeDisplay) {
        case "retention-curve":
            return <RetentionCurve 
            data={convertStagePassRateData(data, chartTypeDisplay)}
            customTooltipContent={<StagePassRateTooltip active={true} payload={[]} label={""} />}
            customGroupTickFormatter={(value: string, index: number) => value}
            customGroupPercentageTickFormatter={(value: number, index: number) => value + "%"}
            />
        case "line":
            return <LineChart 
            data={convertStagePassRateData(data, chartTypeDisplay)} 
            yAxisMetric="" 
            toolTipValueName="candidates" 
            xAxisType="number" 
            customTooltipContent={<StagePassRateTooltip active={true} payload={[]} label={""} />}
            />;
        case "metric":
            return <Metric data={convertStagePassRateData(data, chartTypeDisplay)} />;
        case "table":
            return <TableMetric data={convertStagePassRateData(data, chartTypeDisplay)} />;
        default:
            return <NoDataAvailable />;
    }
}

const convertStagePassRateData = (data: any, chartTypeDisplay: ChartTypeDisplay) => {
    switch (chartTypeDisplay) {
        case "retention-curve":
            return data.stages.map((stage: any, index: number) => {
                return {
                    group: stage.group,
                    name: stage.group,
                    value: stage.passRate,
                    passedCount: stage.candidatesPassed,
                    droppedCount: stage.candidatesDropped,
                    totalCount: stage.totalCount,
                    passRate: stage.passRate,
                    fill: pipelineStageColors[stage.group].colors[index],
                    groupPercentage: stage.passRate?.toFixed(0),
                    startDate: data?.dateRange?.startDate,
                    endDate: data?.dateRange?.endDate
                }
            });
        case "line":
            return data.stages.map((stage: any, index: number) => {
                return {
                    category: stage.group,
                    group: stage.group,
                    name: stage.group,
                    value: stage.passRate,
                    passedCount: stage.candidatesPassed,
                    droppedCount: stage.candidatesDropped,
                    totalCount: stage.totalCount,
                    passRate: stage.passRate,
                    groupPercentage: stage.passRate?.toFixed(0),
                    startDate: data?.dateRange?.startDate,
                    endDate: data?.dateRange?.endDate,
                }
            });
        case "metric":
            return data.stages.map((item: any) => ({
                metricTitle: item.group,
                metricValue:  item.passRate,
                metricValueUnit: "%",
            }));
        case "table":
            return {
                columnHeaders: ["Stage", "Candidates", "Stage Pass Rate", "Candidates Passed", "Candidates Dropped"],
                rows: data.stages.map((item: any) => ({
                    "Stage": item.group,
                    "Candidates": item.candidatesPassed + " / " + item.totalCount,
                    "Stage Pass Rate": item.passRate + "%",
                    "Candidates Passed": item.candidatesPassed,
                    "Candidates Dropped": item.candidatesDropped,
                })),
            };
        default:
            return null;
    }
}

export const StagePassRateTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white p-3 shadow" style={{ borderRadius: "10px", width: "342px", height: "fit-content" }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
            <div style={{ backgroundColor: payload?.[0]?.payload?.fill, width: "8px", height: "8px", borderRadius: "50%" }}/>
            <span className={styles.tooltipHeaderStyle}>{payload?.[0]?.payload?.name}</span>
          </div>
          <span className={styles.tooltipTextStyle}>{moment(payload?.[0]?.payload?.startDate).format("MMM D, YYYY")} {payload?.[0]?.payload?.endDate && `- ${moment(payload?.[0]?.payload?.endDate).format("MMM D, YYYY")}`}</span>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E9EAEB", margin: "10px 0" }} />
          <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px", width: "100%"}}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                <span className={styles.tooltipTextStyle}>Candidates</span>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
                <span className={styles.tooltipValueStyle}>
                  {payload?.[0]?.payload?.passedCount} of {payload?.[0]?.payload?.totalCount} </span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                <span className={styles.tooltipTextStyle}>Candidates Passed</span>
                <span className={styles.tooltipValueStyle}>{payload?.[0]?.payload?.passedCount}</span>
              </div>
          </div>
  
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px", width: "100%"}}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                <span className={styles.tooltipTextStyle}>Stage Pass Rate</span>
                <span className={styles.tooltipValueStyle}>{payload?.[0]?.payload?.passRate}%</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                <span className={styles.tooltipTextStyle}>Candidates Dropped</span>
                <span className={styles.tooltipValueStyle}>{payload?.[0]?.payload?.droppedCount}</span>
            </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
};