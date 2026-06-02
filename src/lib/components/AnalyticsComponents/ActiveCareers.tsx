import { ChartTypeDisplay } from "@/lib/utils/recruiterAnalytics";
import ColumnChart from "./ColumnChart";
import LineChart from "./LineChart";
import Metric from "./Metric";
import NoDataAvailable from "./NoDataAvailable";
import TableMetric from "./TableMetric";

export default function ActiveCareersChart({ data, chartTypeDisplay, includeMetricTitle = false }: { data: any, chartTypeDisplay: ChartTypeDisplay, includeMetricTitle?: boolean }) {
    if (!data) {
        return <NoDataAvailable />;
    }
    switch (chartTypeDisplay) {
        case "line":
            return <LineChart data={convertActiveCareersData(data, chartTypeDisplay)} yAxisMetric="" toolTipValueName="careers" xAxisType="date" />;
        case "column":
            return <ColumnChart data={convertActiveCareersData(data, chartTypeDisplay)} yAxisMetric="" xAxisType="date" chartTitle="Active Careers" toolTipValueName="careers"/>;
        case "metric":
            const convertedData = convertActiveCareersData(data, chartTypeDisplay, includeMetricTitle);
            return <Metric data={convertedData} />;
        case "table":
            return <TableMetric data={convertActiveCareersData(data, chartTypeDisplay)} />;
        default:
            return <NoDataAvailable />;
    }
}

const convertActiveCareersData = (data: any, chartTypeDisplay: ChartTypeDisplay, includeMetricTitle?: boolean) => {
    switch (chartTypeDisplay) {
        case "metric":
            return [{
                metricTitle: includeMetricTitle ? "Active Careers" : undefined,
                metricValue: data.metricValue,
                percentageChange: data.percentageChange,
                percentageSubtitle: `compared to ${data.comparedTo}`,
            }];
        case "line":
            return data.data.map((item: any) => ({
                category: item.date,
                value: item.value,
                valueName: "Active Careers",
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
                        "Past": data.pastValue,
                    }
                ]
            }
        default:
            return null;
    }
}