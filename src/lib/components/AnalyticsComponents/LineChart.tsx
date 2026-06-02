import moment from "moment";
import { ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Area } from "recharts";
const toolTipTextStyle = {
    fontSize: 12,
    fontWeight: 500,
    color: "#717680"
}

const toolTipBoldTextStyle = {
    fontSize: 12,
    fontWeight: 700,
    color: "#181D27"
}
  
const toolTipHeaderStyle = {
    fontSize: 12,
    fontWeight: 700,
    color: "#181D27"
}

interface LineChartData {
    category: string;
    value: number;
    valueName: string;
    percentageChange?: number;
}

export default function LineChart({ data, yAxisMetric, toolTipValueName, xAxisType, customTooltipContent }: { data: LineChartData[], yAxisMetric: string, toolTipValueName: string, xAxisType: "date" | "number", customTooltipContent?: React.ReactNode }) {
    const customWidth = data?.length * 10;
    return (
        <ResponsiveContainer width="100%" height="100%" minWidth={customWidth} minHeight={174}>
        <AreaChart
        data={data}
        margin={{
            left: -20,
            top: 30,
        }}
        >
            <defs>
                <linearGradient id="fill-gradient" gradientTransform="rotate(90)">
                <stop offset="0%" stopColor="#8098F9" stopOpacity={0.1} />
                </linearGradient>
            </defs>
        <CartesianGrid vertical={false} horizontal={true} stroke="#F5F5F5" />
        <XAxis 
        dataKey="category" 
        tickFormatter={xAxisType === "date" ? customDateTickFormatter : customTickFormatter} 
        interval={getXAxisInterval(data)} 
        tickLine={false}
        axisLine={false}
        tick={{
            fontSize: 12,
            fontWeight: 500,
            color: "#717680"
        }}
        />
        <YAxis 
        axisLine={false} 
        tickLine={false} 
        tick={{
            fontSize: 12,
            fontWeight: 500,
            color: "#717680"
        }}
        tickFormatter={(value: number) => value.toFixed(0) + yAxisMetric} 
        />
        <Tooltip
            content={customTooltipContent ? customTooltipContent as any : <LineChartTooltip active={true} payload={[]} label={""} toolTipValueName={toolTipValueName} xAxisType={xAxisType} />}
            cursor={false}
        />
        <Area 
        dataKey="value"
        stroke="#8098F9"
        fill="url(#fill-gradient)"
        type="monotone"
        strokeWidth={2}
        name={data?.[0]?.valueName}
        />
        </AreaChart>
        </ResponsiveContainer>
    )
 }

 const customDateTickFormatter = (value: string) => {
    return moment(value).format('MMM D');
 }

 const customTickFormatter = (value: string, index: number, limit = 10) => {
    if (value.length < limit) return value;
    return `${value.substring(0, limit)}...`;
 };

 const getXAxisInterval = (data: any) => {
    // Based on data length, set interval to get 7 ticks
    if (data.length < 7) return 1;
    return Math.ceil(data.length / 7);
 }

 export const LineChartTooltip = ({ active, payload, label, toolTipValueName, xAxisType }: { active: boolean, payload: any[], label: string, toolTipValueName: string, xAxisType: "date" | "number" }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white p-3 shadow" style={{ borderRadius: "10px", width: "236px", height: "fit-content", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px" }}>
          <span style={toolTipHeaderStyle}>{payload?.[0]?.payload?.valueName}</span>
          <span style={toolTipTextStyle}>{xAxisType === "date" ? moment(payload?.[0]?.payload?.category).format("dddd, MMMM D, YYYY") : payload?.[0]?.payload?.category}</span>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E9EAEB", margin: "10px 0" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px", width: "100%"}}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", width: "100%", gap: "5px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#8098F9" }} />
                <span style={toolTipTextStyle}>
                    <span style={toolTipBoldTextStyle}>{payload?.[0]?.payload?.value}</span> {toolTipValueName}
                </span>
            </div>
            {payload?.[0]?.payload?.percentageChange && payload?.[0]?.payload?.percentageChange !== "0.00" && 
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", width: "100%", gap: "5px" }}>
                <span className={`percentage-change ${payload?.[0]?.payload?.percentageChange > 0 ? "positive" : "negative"}`}>
                {payload?.[0]?.payload?.percentageChange}%
                </span>
                <span style={toolTipTextStyle}>
                from previous day
                </span>
            </div>
            }
          </div>
        </div>
      );
    }
    return null;
  };