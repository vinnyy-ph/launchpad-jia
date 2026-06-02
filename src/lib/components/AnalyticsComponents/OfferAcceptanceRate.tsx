import { ChartTypeDisplay } from "@/lib/utils/recruiterAnalytics";
import LineChart from "./LineChart";
import ColumnChart from "./ColumnChart";
import Metric from "./Metric";
import NoDataAvailable from "./NoDataAvailable";
import TableMetric from "./TableMetric";

export default function OfferAcceptanceRateChart({ chartTypeDisplay, data }: { chartTypeDisplay: ChartTypeDisplay, data: any }) {
    if (!data) {
        return <NoDataAvailable />;
    }
    switch (chartTypeDisplay) {
        case "line":
            return <LineChart data={convertOfferAcceptanceRateData(data, chartTypeDisplay)} yAxisMetric="%" toolTipValueName="%" xAxisType="date" />;
        case "column":
            return <ColumnChart data={convertOfferAcceptanceRateData(data, chartTypeDisplay)} yAxisMetric="%" xAxisType="date" chartTitle="Offer Acceptance Rate" toolTipValueName="%"/>;
        case "metric":
            const convertedData = convertOfferAcceptanceRateData(data, chartTypeDisplay);
            return <Metric data={convertedData} />;
        case "table":
            return <TableMetric data={convertOfferAcceptanceRateData(data, chartTypeDisplay)} />;
        default:
            return <NoDataAvailable />;
    }
}

const convertOfferAcceptanceRateData = (data: any, chartTypeDisplay: ChartTypeDisplay) => {
    switch (chartTypeDisplay) {
        case "line":
            return data?.map((item: any) => ({
                category: item.date,
                value: item.offerAcceptanceRate,
                valueName: "Offer Acceptance Rate",
                percentageChange: item.percentageChange,
            }));
        case "column":
            return data?.map((item: any) => ({
                category: item.date,
                value: item.offerAcceptanceRate,
                percentageChange: item.percentageChange,
            }));
        case "metric":
            return [{
                metricValue: data.reduce((acc: number, curr: any) => acc + curr.offerAcceptanceRate, 0) / data.length,
                percentageChange: "0.00",
            }];
        case "table":
            return {
                columnHeaders: ["Date", "Offer Acceptance Rate"],
                rows: data.map((item: any) => ({
                    "Date": item.date,
                    "Offer Acceptance Rate": item.offerAcceptanceRate + "%"
                }))
            }
        default:
            return null;
    }
}
