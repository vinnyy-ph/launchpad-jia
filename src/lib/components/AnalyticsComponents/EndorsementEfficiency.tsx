import { ChartTypeDisplay } from "@/lib/utils/recruiterAnalytics";
import HorizontalBarChart from "./HorizontalBarChart";
import ColumnChart from "./ColumnChart";
import NoDataAvailable from "./NoDataAvailable";
import TableMetric from "./TableMetric";

export default function EndorsementEfficiencyChart({ chartTypeDisplay, data }: { chartTypeDisplay: ChartTypeDisplay, data: any }) {
    if (!data || data?.length === 0) {
        return <NoDataAvailable />;
    }
    switch (chartTypeDisplay) {
        case "bar-chart":
            return <HorizontalBarChart data={convertEndorsementEfficiencyData(data, chartTypeDisplay)} />;
        case "column":
            return <ColumnChart data={convertEndorsementEfficiencyData(data, chartTypeDisplay)} yAxisMetric="%" xAxisType="number" chartTitle="Endorsement Efficiency" toolTipValueName="%"/>;
        case "table":
            return <TableMetric data={convertEndorsementEfficiencyData(data, chartTypeDisplay)} />;
        default:
            return <NoDataAvailable />;
    }
}


const convertEndorsementEfficiencyData = (data: any, chartTypeDisplay: ChartTypeDisplay) => {
    switch (chartTypeDisplay) {
        case "bar-chart":
            return data.map((item: any) => ({
                category: item.jobTitle,
                value: item.endorsementEfficiency,
                valueName: "Endorsement Efficiency",
                percentageChange: item.percentageChange,
                label: item.endorsementEfficiency.toFixed(0) + "%",
            }));
        case "column":
            return data.map((item: any) => ({
                category: item.jobTitle,
                value: item.endorsementEfficiency,
                percentageChange: item.percentageChange,
            }));
        case "table":
            return {
                columnHeaders: ["Job Title", "Endorsement Efficiency"],
                rows: data.map((item: any) => ({
                    "Job Title": item.jobTitle,
                    "Endorsement Efficiency": item.endorsementEfficiency.toFixed(0) + "%",
                    metadata: {
                        _id: item._id,
                    }
                }))
            };
        default:
            return null;
    }
}