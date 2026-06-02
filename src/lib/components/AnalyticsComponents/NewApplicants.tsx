import { ChartTypeDisplay } from "@/lib/utils/recruiterAnalytics";
import ColumnChart from "./ColumnChart";
import LineChart from "./LineChart";
import Metric from "./Metric";
import NoDataAvailable from "./NoDataAvailable";
import TableMetric from "./TableMetric";

export default function NewApplicantsChart({ data, chartTypeDisplay, includeMetricTitle = false }: { data: any, chartTypeDisplay: ChartTypeDisplay, includeMetricTitle?: boolean }) {
    if (!data) {
        return <NoDataAvailable />;
    }
    switch (chartTypeDisplay) {
        case "line":
            return <LineChart data={convertNewApplicantsData(data, chartTypeDisplay)} yAxisMetric="" toolTipValueName="applicants" xAxisType="date" />;
        case "column":
            return <ColumnChart data={convertNewApplicantsData(data, chartTypeDisplay)} yAxisMetric="" xAxisType="date" chartTitle="New Applicants" toolTipValueName="applicants"/>;
        case "metric":
            const convertedData = convertNewApplicantsData(data, chartTypeDisplay, includeMetricTitle);
            return <Metric data={convertedData} />;
        case "table":
            return <TableMetric data={convertNewApplicantsData(data, chartTypeDisplay)} />;
        default:
            return <NoDataAvailable />;
    }
}

const convertNewApplicantsData = (data: any, chartTypeDisplay: ChartTypeDisplay, includeMetricTitle?: boolean) => {
    switch (chartTypeDisplay) {
        case "metric":
            return [{
                metricTitle: includeMetricTitle ? "New Applicants" : undefined,
                metricValue: data.metricValue,
                percentageChange: data.percentageChange,
                percentageSubtitle: `compared to ${data.comparedTo}`,
            }];
        case "line":
            return data.data.map((item: any) => ({
                category: item.date,
                value: item.value,
                valueName: "New Applicants",
                percentageChange: item.percentageChange,
            }));
        case "column":
            return data.data.map((item: any) => ({
                category: item.date,
                value: item.value,
            }));
        case "table":
            return {
                columnHeaders: ["Current", "Past"],
                rows: [
                    {
                        "Current": data.metricValue,
                        "Past": data.pastValue
                    }
                ]
            }
        default:
            return null;
    }
}