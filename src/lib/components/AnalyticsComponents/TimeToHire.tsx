import { ChartTypeDisplay } from "@/lib/utils/recruiterAnalytics";
import LineChart from "./LineChart";
import ColumnChart from "./ColumnChart";
import Metric from "./Metric";
import NoDataAvailable from "./NoDataAvailable";
import TableMetric from "./TableMetric";

export default function TimeToHireChart({ chartTypeDisplay, data }: { chartTypeDisplay: ChartTypeDisplay, data: any }) {
    if (!data) {
        return <NoDataAvailable />;
    }
    switch (chartTypeDisplay) {
        case "line":
            return <LineChart data={convertTimeToHireData(data, chartTypeDisplay)} yAxisMetric="d" toolTipValueName="days" xAxisType="date" />;
        case "column":
            return <ColumnChart data={convertTimeToHireData(data, chartTypeDisplay)} yAxisMetric="d" xAxisType="date" chartTitle="Time to Hire" toolTipValueName="days" />;
        case "metric":
            const convertedData = convertTimeToHireData(data, chartTypeDisplay);
            return <Metric data={convertedData} />;
        case "table":
            return <TableMetric data={convertTimeToHireData(data, chartTypeDisplay)} />;
        default:
            return <NoDataAvailable />;
    }
}

const convertTimeToHireData = (data: any, chartTypeDisplay: ChartTypeDisplay) => {
    switch (chartTypeDisplay) {
        case "line":
            return data?.map((item: any) => ({
                category: item.date,
                value: item.timeToHire,
                valueName: "Average Time to Hire",
                percentageChange: item.percentageChange,
            }));
        case "column":
            return data?.map((item: any) => ({
                category: item.date,
                value: item.timeToHire,
                percentageChange: item.percentageChange,
            }));
        case "metric":
            return [{
                metricValue: data.reduce((acc: number, curr: any) => acc + curr.timeToHire, 0) / data.length,
                percentageChange: "0.00",
            }];
        case "table":
            return {
                columnHeaders: ["Date", "Average Time to Hire"],
                rows: data.map((item: any) => ({
                    "Date": item.date,
                    "Average Time to Hire": item.timeToHire + " days"
                }))
            }
        default:
            return null;
    }
}