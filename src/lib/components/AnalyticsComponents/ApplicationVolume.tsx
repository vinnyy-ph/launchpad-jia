import { ChartTypeDisplay } from "@/lib/utils/recruiterAnalytics";
import StackedLineChart from "./StackedLineChart";
import Metric from "./Metric";
import CustomPieChart from "./PieChart";
import StackedBarChart from "./StackedBarChart";
import NoDataAvailable from "./NoDataAvailable";
import TableMetric from "./TableMetric";

export default function ApplicationVolumeChart({ chartTypeDisplay, data }: { chartTypeDisplay: ChartTypeDisplay, data: any }) {
    if (!data || data?.length === 0) {
        return <NoDataAvailable />;
    }
    switch (chartTypeDisplay) {
        case "stacked-line":
            return <StackedLineChart data={convertApplicationVolumeData(data, chartTypeDisplay)} />;
        case "metric":
            const convertedData = convertApplicationVolumeData(data, chartTypeDisplay);
            return <Metric data={convertedData} />;
        case "pie":
            return <CustomPieChart data={convertApplicationVolumeData(data, chartTypeDisplay)} />;
        case "stacked-column":
            return<StackedBarChart data={convertApplicationVolumeData(data, chartTypeDisplay)} />;
        case "table":
            return <TableMetric data={convertApplicationVolumeData(data, chartTypeDisplay)} />;
        default:
            return <NoDataAvailable />;
    }
}

const convertApplicationVolumeData = (data: any, chartTypeDisplay: ChartTypeDisplay) => {
    switch (chartTypeDisplay) {
        case "stacked-line":
            return data.map((day: any) => ({
                label: "Applicants",
                category: day.date,
                firstSeries: {
                    value: day.applicationVolume,
                    valueName: "Total Applicants"
                },
                secondSeries: {
                    value: day.automaticallyEndorsed,
                    valueName: "Automatically Endorsed"
                },
            }));
        case "metric":
            return [{
                metricValue: data.reduce((acc: number, curr: any) => acc + curr.applicationVolume, 0),
                percentageChange: (data.reduce((acc: number, curr: any) => acc + curr.automaticallyEndorsed, 0) / data.reduce((acc: number, curr: any) => acc + curr.applicationVolume, 0) * 100).toFixed(0),
                percentageSubtitle: "of total applicants are automatically endorsed"
            }];
        case "pie":
            return [
                    {
                        name: "Total Applicants",
                        value: data.reduce((acc: number, curr: any) => acc + curr.applicationVolume, 0),
                        color: "#E0EAFF"
                    },
                    {
                        name: "Automatically Endorsed",
                        value: data.reduce((acc: number, curr: any) => acc + curr.automaticallyEndorsed, 0),
                        color: "#C7D7FE"
                    }
                ];
        case "stacked-column":
            return data.map((day: any) => ({
                category: day.date,
                parentBar: {
                    value: day.applicationVolume,
                    name: "Total Applicants"
                },
                childBar: {
                    value: day.automaticallyEndorsed,
                    name: "Automatically Endorsed"
                },
            }));
        case "table":
            return {
                columnHeaders: ["Group", "Number of Applicants"],
                rows: [
                    {
                        "Group": "Total Applicants",
                        "Number of Applicants": data.reduce((acc: number, curr: any) => acc + curr.applicationVolume, 0)
                    },
                    {
                        "Group": "Automatically Endorsed",
                        "Number of Applicants": data.reduce((acc: number, curr: any) => acc + curr.automaticallyEndorsed, 0)
                    }
                ]
            }
        default:
            return null;
    }   
}