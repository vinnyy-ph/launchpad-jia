import LineChart from "@/lib/components/AnalyticsComponents/LineChart";
import ColumnChart from "@/lib/components/AnalyticsComponents/ColumnChart";
import Metric from "@/lib/components/AnalyticsComponents/Metric";
import TableMetric from "@/lib/components/AnalyticsComponents/TableMetric";
import NoDataAvailable from "@/lib/components/AnalyticsComponents/NoDataAvailable";
import StackedBarChart from "@/lib/components/AnalyticsComponents/StackedBarChart";
import StackedLineChart from "@/lib/components/AnalyticsComponents/StackedLineChart";
import CustomPieChart from "@/lib/components/AnalyticsComponents/PieChart";
import type { TalentVaultMetricId } from "./MetricDashboard";
import type { ChartTypeDisplay } from "@/lib/utils/recruiterAnalytics";
import moment from "moment";

const tvTooltipTextStyle = { fontSize: 12, fontWeight: 500, color: "#717680" } as const;
const tvTooltipBoldTextStyle = { fontSize: 12, fontWeight: 700, color: "#181D27" } as const;
const tvTooltipHeaderStyle = { fontSize: 12, fontWeight: 700, color: "#181D27" } as const;

function TVStackedBarTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  return (
    <div className="bg-white p-3 shadow" style={{ borderRadius: "10px", width: "236px", height: "fit-content" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px" }}>
        <span style={tvTooltipHeaderStyle}>Volume</span>
        <span style={tvTooltipTextStyle}>{moment(p?.category).format("dddd, MMMM D, YYYY")}</span>
      </div>
      <div style={{ width: "100%", height: "1px", backgroundColor: "#E9EAEB", margin: "10px 0" }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px", width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", width: "100%", gap: "5px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#C7D7FE" }} />
          <span style={tvTooltipTextStyle}>
            <span style={tvTooltipBoldTextStyle}>{p?.childBarValue}</span> {p?.childBarName}
            {p?.parentBarValue > 0 && ` (${((p?.childBarValue / p?.parentBarValue) * 100).toFixed(0)}%)`}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", width: "100%", gap: "5px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#E0EAFF" }} />
          <span style={tvTooltipTextStyle}>
            <span style={tvTooltipBoldTextStyle}>{p?.parentBarValue}</span> {p?.parentBarName}
          </span>
        </div>
      </div>
    </div>
  );
}

function TVStackedLineTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  return (
    <div className="bg-white p-3 shadow" style={{ borderRadius: "10px", width: "236px", height: "fit-content", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px" }}>
      <span style={tvTooltipHeaderStyle}>{p?.label}</span>
      <span style={tvTooltipTextStyle}>{moment(p?.category).format("dddd, MMMM D, YYYY")}</span>
      <div style={{ width: "100%", height: "1px", backgroundColor: "#E9EAEB", margin: "10px 0" }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px", width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", width: "100%", gap: "5px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#E0EAFF" }} />
          <span style={tvTooltipTextStyle}>
            <span style={tvTooltipBoldTextStyle}>{p?.firstSeries}</span> {p?.firstSeriesName}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", width: "100%", gap: "5px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#C7D7FE" }} />
          <span style={tvTooltipTextStyle}>
            <span style={tvTooltipBoldTextStyle}>{p?.secondSeries}</span> {p?.secondSeriesName}
            {p?.firstSeries > 0 && ` (${((p?.secondSeries / p?.firstSeries) * 100).toFixed(0)}%)`}
          </span>
        </div>
      </div>
    </div>
  );
}

function tvStackedBarLegend({ payload }: any) {
  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", width: "100%", justifyContent: "flex-end", gap: "10px", marginBottom: "10px" }}>
      {payload?.sort((a: any, b: any) => b.value.localeCompare(a.value)).map((entry: any, index: number) => (
        <div key={`item-${index}`} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: entry.color }} />
          <span style={tvTooltipTextStyle}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}
type TimeSeriesEntry = {
  date: string;
  registered: number;
  completed: number;
};

type Comparison = {
  percentageChange: { registered: string; completed: string };
  comparedTo: string;
};

type TalentVaultMetricChartProps = {
  metricId: TalentVaultMetricId;
  chartType: ChartTypeDisplay;
  timeSeries: TimeSeriesEntry[];
  totals: { registered: number; completed: number; invited: number; hired: number };
  comparison?: Comparison | null;
};

function getMetricKey(metricId: TalentVaultMetricId): "registered" | "completed" | null {
  if (metricId === "registered") return "registered";
  if (metricId === "completed") return "completed";
  return null;
}

function toLineData(timeSeries: TimeSeriesEntry[], key: "registered" | "completed") {
  return timeSeries.map((entry) => ({
    category: entry.date,
    value: entry[key],
    valueName: key === "registered" ? "Registered" : "Completed",
  }));
}

function toColumnData(timeSeries: TimeSeriesEntry[], key: "registered" | "completed") {
  return timeSeries.map((entry) => ({
    category: entry.date,
    value: entry[key],
  }));
}

function toTableData(timeSeries: TimeSeriesEntry[], key: "registered" | "completed") {
  const header = key === "registered" ? "Registered" : "Completed";
  return {
    columnHeaders: ["Date", header],
    rows: timeSeries.map((entry) => ({
      Date: entry.date,
      [header]: entry[key],
    })),
  };
}

function renderVolumeChart(
  chartType: ChartTypeDisplay,
  timeSeries: TimeSeriesEntry[],
  totals: { registered: number; completed: number },
  comparison?: Comparison | null,
) {
  if (chartType === "metric") {
    const regPct = comparison?.percentageChange.registered;
    const compPct = comparison?.percentageChange.completed;
    const subtitle = comparison?.comparedTo;
    return (
      <Metric
        data={[
          {
            metricTitle: "Registered",
            metricValue: totals.registered,
            percentageChange: regPct,
            percentageSubtitle: regPct && regPct !== "0.00" ? subtitle : undefined,
          },
          {
            metricTitle: "Completed",
            metricValue: totals.completed,
            percentageChange: compPct,
            percentageSubtitle: compPct && compPct !== "0.00" ? subtitle : undefined,
          },
        ]}
      />
    );
  }

  if (!timeSeries || timeSeries.length === 0) {
    return <NoDataAvailable />;
  }

  switch (chartType) {
    case "stacked-column":
      return (
        <StackedBarChart
          data={timeSeries.map((e) => ({
            category: e.date,
            parentBar: { value: e.registered, name: "Registered" },
            childBar: { value: e.completed, name: "Completed" },
          }))}
          customTooltip={<TVStackedBarTooltip active payload={[]} />}
          customLegend={tvStackedBarLegend}
        />
      );
    case "stacked-line":
      return (
        <StackedLineChart
          data={timeSeries.map((e) => ({
            label: "Volume",
            category: e.date,
            firstSeries: { value: e.registered, valueName: "Registered" },
            secondSeries: { value: e.completed, valueName: "Completed" },
          }))}
          customTooltip={<TVStackedLineTooltip active payload={[]} />}
        />
      );
    case "column":
      return (
        <ColumnChart
          data={timeSeries.map((e) => ({ category: e.date, value: e.registered }))}
          yAxisMetric=""
          xAxisType="date"
          chartTitle="Talent Vault Volume"
          toolTipValueName="registered"
        />
      );
    case "pie":
      return (
        <CustomPieChart
          data={[
            { name: "Registered", value: totals.registered, color: "#C7D7FE" },
            { name: "Completed", value: totals.completed, color: "#6172F3" },
          ]}
        />
      );
    case "table":
      return (
        <TableMetric
          data={{
            columnHeaders: ["Date", "Registered", "Completed"],
            rows: timeSeries.map((e) => ({
              Date: e.date,
              Registered: e.registered,
              Completed: e.completed,
            })),
          }}
        />
      );
    default:
      return <NoDataAvailable />;
  }
}

export default function TalentVaultMetricChart({
  metricId,
  chartType,
  timeSeries,
  totals,
  comparison,
}: TalentVaultMetricChartProps) {
  const metricKey = getMetricKey(metricId);

  // Metrics with no data source yet (invited, hired, derived metrics)
  if (metricId === "talent-vault-volume") {
    return renderVolumeChart(chartType, timeSeries, totals, comparison);
  }

  if (metricKey === null) {
    return <NoDataAvailable />;
  }

  if (!timeSeries || timeSeries.length === 0) {
    if (chartType === "metric") {
      const pct = comparison?.percentageChange[metricKey];
      return (
        <Metric
          data={[{
            metricValue: totals[metricKey],
            percentageChange: pct,
            percentageSubtitle: pct && pct !== "0.00" ? comparison?.comparedTo : undefined,
          }]}
        />
      );
    }
    return <NoDataAvailable />;
  }

  switch (chartType) {
    case "metric": {
      const pct = comparison?.percentageChange[metricKey];
      return (
        <Metric
          data={[{
            metricValue: totals[metricKey],
            percentageChange: pct,
            percentageSubtitle: pct && pct !== "0.00" ? comparison?.comparedTo : undefined,
          }]}
        />
      );
    }
    case "line":
      return (
        <LineChart
          data={toLineData(timeSeries, metricKey)}
          yAxisMetric=""
          toolTipValueName={metricKey === "registered" ? "Registered" : "Completed"}
          xAxisType="date"
        />
      );
    case "column":
      return (
        <ColumnChart
          data={toColumnData(timeSeries, metricKey)}
          yAxisMetric=""
          xAxisType="date"
          chartTitle={metricKey === "registered" ? "Registered" : "Completed"}
          toolTipValueName={metricKey === "registered" ? "Registered" : "Completed"}
        />
      );
    case "table":
      return <TableMetric data={toTableData(timeSeries, metricKey)} />;
    default:
      return <NoDataAvailable />;
  }
}
