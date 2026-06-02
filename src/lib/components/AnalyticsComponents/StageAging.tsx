import { ChartTypeDisplay } from "@/lib/utils/recruiterAnalytics";
import HorizontalStackedBarChart from "./HorizontalStackedBarChart";
import NoDataAvailable from "./NoDataAvailable";
import { DEFAULT_JOB_PIPELINE } from "@/lib/utils/constants";
import TableMetric from "./TableMetric";

export default function StageAgingChart({ chartTypeDisplay, data }: { chartTypeDisplay: ChartTypeDisplay, data: any }) {
    if (!data || data?.length === 0) {
        return <NoDataAvailable />;
    }
    switch (chartTypeDisplay) {
        case "stacked-bar":
            return <HorizontalStackedBarChart chartData={convertStageAgingData(data, chartTypeDisplay)} />;
        case "table":
            return <TableMetric data={convertStageAgingData(data, chartTypeDisplay)} />;
        default:
            return <NoDataAvailable />;
    }
}


const convertStageAgingData = (data: any, chartTypeDisplay: ChartTypeDisplay) => {
    switch (chartTypeDisplay) {
        case "stacked-bar":
            return data?.map((item) => {
                const stageIds = item.stages.map((stage: any) => stage.stageId);
                const uniqueStageIds = [...new Set(stageIds)];
                return {
                label: item.totalAvgDurationDays,
                category: item._id.careerJobTitle,
                careerId: item._id.careerId,
                groups: uniqueStageIds.map((stageId: string) => {
                    const substages = item.stages.filter((stage: any) => stage.stageId === stageId);
                    const stageName = substages?.[0]?.stageName?.split(" - ")?.[0];
                    return {
                        stageId: stageId,
                        name: stageName,
                        key: stageId,
                        totalValue: substages.reduce((acc: number, curr: any) => acc + curr.avgDurationDays, 0),
                        substages: substages.map((substage: any) => {
                            return {
                                id: substage.stageId,
                                name: substage.stageName,
                                value: substage.avgDurationDays,
                            }
                        }),
                    }
                })
                }
            });
        case "table":
            const customStageNames: string[] = data.map((item: any) => item.stages.filter((s: any) => !["1", "2", "3", "4"].includes(s.stageId)).map((stage: any) => stage.stageName)).flat();
            const uniqueCustomStageNames = [...new Set(customStageNames)];
            const headers = ["Career", "CV Screening", "AI Interview", "Human Interview", ...uniqueCustomStageNames, "Job Offer"];
            return {
                columnHeaders: headers,
                rows: data.map((item: any) => ({
                    "Career": item._id.careerJobTitle,
                    "CV Screening": item.stages.find((stage: any) => stage.stageId === "1")?.avgDurationDays || "N/A",
                    "AI Interview": item.stages.find((stage: any) => stage.stageId === "2")?.avgDurationDays || "N/A",
                    "Human Interview": item.stages.find((stage: any) => stage.stageId === "3")?.avgDurationDays || "N/A",
                    "Job Offer": item.stages.find((stage: any) => stage.stageId === "4")?.avgDurationDays || "N/A",
                    ...Object.fromEntries(item.stages.filter((s: any) => !["1", "2", "3", "4"].includes(s.stageId)).map((stage: any) => ([stage.stageName, stage?.avgDurationDays || "N/A"]))),
                    metadata: {
                        _id: item._id.careerId,
                    }
                })),
            }
        default:
            return null;
    }
}