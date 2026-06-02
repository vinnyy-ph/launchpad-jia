import { ChartTypeDisplay, pipelineStageColors } from "@/lib/utils/recruiterAnalytics";
import LineChart from "./LineChart";
import Metric from "./Metric";
import NoDataAvailable from "./NoDataAvailable";
import RetentionCurve from "./RetentionCurve";
import moment from "moment";
import TableMetric from "./TableMetric";

export default function DropOffRateChart({ chartTypeDisplay, data }: { chartTypeDisplay: ChartTypeDisplay, data: any }) {
  if (!data || data?.totalApplicants === 0) {
    return <NoDataAvailable />;
  }
  switch (chartTypeDisplay) {
      case "retention-curve":
          return <RetentionCurve 
          data={convertDropOffRateData(data, chartTypeDisplay)}
          customTooltipContent={<DropOffRateTooltip active={true} payload={[]} label={""} />}
          />
      case "line":
          return <LineChart 
          data={convertDropOffRateData(data, chartTypeDisplay)} 
          yAxisMetric="" 
          toolTipValueName="candidates" 
          xAxisType="number" 
          customTooltipContent={<DropOffRateTooltip active={true} payload={[]} label={""} />}
          />;
      case "metric":
          return <Metric data={convertDropOffRateData(data, chartTypeDisplay)} />;
      case "table":
          return <TableMetric data={convertDropOffRateData(data, chartTypeDisplay)} />;
      default:
          return <NoDataAvailable />;
  }
}

const convertDropOffRateData = (data: any, chartTypeDisplay: ChartTypeDisplay) => {
    switch (chartTypeDisplay) {
      case "retention-curve":
        return data.stages.flatMap((stage: any) => stage.substages.map((substage: any, index: number) => {
          return {
            group: stage.group,
            name: substage.name,
            value: substage.remainingCandidates,
            droppedCount: substage.droppedCount,
            droppedPercentage: substage.droppedPercentage,
            droppedByCancellation: substage.droppedByCancellation,
            droppedByRecruiter: substage.droppedByRecruiter,
            remainingCandidates: substage.remainingCandidates,
            groupPercentage: stage.groupPercentage?.toFixed(0),
            substagePercentage: substage.percentage.toFixed(0),
            fill: pipelineStageColors[stage.group].colors[index],
            totalApplicants: data?.totalApplicants || 0,
            averageStageDuration: substage.averageStageDuration,
            remainingPercentage: substage.remainingPercentage,
            cancellationPercentage: substage.cancellationPercentage,
            droppedByRecruiterPercentage: substage.droppedByRecruiterPercentage,
            startDate: data?.dateRange?.startDate,
            endDate: data?.dateRange?.endDate,
          }
        }));
        case "line":
            return data.stages.flatMap((item: any) => item.substages.map((substage: any) => ({
                category: substage.name,
                value: substage.remainingCandidates,
                group: item.group,
                name: substage.name,
                droppedCount: substage.droppedCount,
                droppedPercentage: substage.droppedPercentage,
                droppedByCancellation: substage.droppedByCancellation,
                droppedByRecruiter: substage.droppedByRecruiter,
                remainingCandidates: substage.remainingCandidates,
                groupPercentage: item.groupPercentage?.toFixed(0),
                substagePercentage: substage.percentage.toFixed(0),
                totalApplicants: data?.totalApplicants || 0,
                averageStageDuration: substage.averageStageDuration,
                remainingPercentage: substage.remainingPercentage,
                cancellationPercentage: substage.cancellationPercentage,
                droppedByRecruiterPercentage: substage.droppedByRecruiterPercentage,
                startDate: data?.dateRange?.startDate,
                endDate: data?.dateRange?.endDate,
            })));
        case "metric":
            return data.stages.flatMap((item: any) => ({
                metricTitle: item.group,
                metricValue:  item.substages[item.substages.length - 1].remainingCandidates,
            }));
        case "table":
          return {
            columnHeaders: ["Stage", "Candidates", "Avg. Stage Time", "Stage Conversion", "Drop-off", "Dropped by Recruiters", "Dropped by Cancellation"],
            rows: data.stages.flatMap((item: any) => item.substages.map((substage: any) => ({
              "Stage": substage.name,
              "Candidates": substage.remainingCandidates + " / " + data.totalApplicants,
              "Avg. Stage Time": substage.averageStageDuration + " days",
              "Stage Conversion": substage.percentage + "%",
              "Drop-off": substage.droppedPercentage + "%",
              "Dropped by Recruiters": substage.droppedByRecruiter + " / " + substage.remainingCandidates,
              "Dropped by Cancellation": substage.droppedByCancellation + " / " + substage.remainingCandidates,
            })))
          }
        default:
            return null;
    }
}

const toolTipTextStyle = {
    fontSize: 12,
    fontWeight: 500,
    color: "#717680"
  }
  
  const toolTipValueStyle = {
    fontSize: 12,
    fontWeight: 700,
    color: "#414651"
  }
  
  const toolTipHeaderStyle = {
    fontSize: 12,
    fontWeight: 700,
    color: "#181D27"
  }

export const DropOffRateTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white p-3 shadow" style={{ borderRadius: "10px", width: "342px", height: "fit-content" }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
            <div style={{ backgroundColor: payload?.[0]?.payload?.fill, width: "8px", height: "8px", borderRadius: "50%" }}/>
            <span style={toolTipHeaderStyle}>{payload?.[0]?.payload?.name}</span>
          </div>
          <span style={toolTipTextStyle}>{moment(payload?.[0]?.payload?.startDate).format("MMM D, YYYY")} {payload?.[0]?.payload?.endDate && `- ${moment(payload?.[0]?.payload?.endDate).format("MMM D, YYYY")}`}</span>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E9EAEB", margin: "10px 0" }} />
          <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px", width: "100%"}}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                <span style={toolTipTextStyle}>Candidates</span>
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
                <span style={toolTipValueStyle}>
                  {payload?.[0]?.payload?.remainingCandidates} of {payload?.[0]?.payload?.totalApplicants} </span>
                  <span className={`percentage-change ${payload?.[0]?.payload?.remainingPercentage < 100 ? "negative" : "positive"}`}>{payload?.[0]?.payload?.remainingPercentage}%</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                <span style={toolTipTextStyle}>Stage Conversion</span>
                <span style={toolTipValueStyle}>{payload?.[0]?.payload?.substagePercentage}%</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                <span style={toolTipTextStyle}>Dropped by recruiters</span>
                {payload?.[0]?.payload?.droppedByRecruiter > 0 ? 
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
                <span style={toolTipValueStyle}>
                  {payload?.[0]?.payload?.droppedByRecruiter} of {payload?.[0]?.payload?.remainingCandidates} </span>
                  <span className={`percentage-change negative`}>{payload?.[0]?.payload?.droppedByRecruiterPercentage}%</span>
                  </div> : <span style={toolTipValueStyle}>-</span>}
              </div>
          </div>
  
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px", width: "100%"}}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                <span style={toolTipTextStyle}>Avg. Stage Time</span>
                {payload?.[0]?.payload?.averageStageDuration > 0 ? <span style={toolTipValueStyle}>{payload?.[0]?.payload?.averageStageDuration} days</span> : <span style={toolTipValueStyle}>-</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                <span style={toolTipTextStyle}>Drop-off</span>
                {payload?.[0]?.payload?.droppedPercentage > 0 ? <span style={toolTipValueStyle}>{payload?.[0]?.payload?.droppedPercentage}%</span> : <span style={toolTipValueStyle}>-</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                <span style={toolTipTextStyle}>Dropped by candidates</span>
                {payload?.[0]?.payload?.droppedByCancellation > 0 ? 
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
                  <span style={toolTipValueStyle}>
                  {payload?.[0]?.payload?.droppedByCancellation} of {payload?.[0]?.payload?.remainingCandidates}</span>
                  <span className={`percentage-change negative`}>{payload?.[0]?.payload?.cancellationPercentage}%</span>
                </div>
                   : <span style={toolTipValueStyle}>-</span>}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
};