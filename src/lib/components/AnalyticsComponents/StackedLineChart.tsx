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
    label: string;
    category: string;
    firstSeries: {
        value: number;
        valueName: string;
        percentageChange?: number;
    };
    secondSeries: {
        value: number;
        valueName: string;
        percentageChange?: number;
    };
}

export default function StackedLineChart({ data, customTooltip }: { data: LineChartData[]; customTooltip?: React.ReactElement }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
        <AreaChart
        data={data?.map((item: LineChartData) => ({
            label: item.label,
            category: item.category,
            firstSeries: item.firstSeries.value,
            firstSeriesName: item.firstSeries.valueName,
            secondSeries: item.secondSeries.value,
            secondSeriesName: item.secondSeries.valueName,
        }))}
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
        tickFormatter={customDateTickFormatter} 
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
        tickFormatter={(value: number) => value.toFixed(0)} 
        />
        <Tooltip
            content={customTooltip || <LineChartTooltip active={true} payload={[]} label={""} />}
            cursor={false}
        />
        <Area 
        dataKey="firstSeries"
        stroke="#E0EAFF"
        fill="url(#fill-gradient)"
        type="monotone"
        strokeWidth={2}
        name={data?.[0]?.firstSeries?.valueName}
        />
         <Area 
        dataKey="secondSeries"
        stroke="#C7D7FE"
        fill="url(#fill-gradient)"
        type="monotone"
        strokeWidth={2}
        name={data?.[0]?.secondSeries?.valueName}
        />
        </AreaChart>
        </ResponsiveContainer>
    )
 }

 const customDateTickFormatter = (value: string) => {
    return moment(value).format('MMM D');
 }

 const getXAxisInterval = (data: any) => {
    // Based on data length, set interval to get 7 ticks
    if (data.length < 7) return 1;
    return Math.ceil(data.length / 7);
 }

 export const LineChartTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white p-3 shadow" style={{ borderRadius: "10px", width: "236px", height: "fit-content", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px" }}>
          <span style={toolTipHeaderStyle}>{payload?.[0]?.payload?.label}</span>
          <span style={toolTipTextStyle}>{moment(payload?.[0]?.payload?.category).format("dddd, MMMM D, YYYY")}</span>
          
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E9EAEB", margin: "10px 0" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px", width: "100%"}}>

            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", width: "100%", gap: "5px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#C7D7FE" }} />
                <span style={toolTipTextStyle}>
                    <span style={toolTipBoldTextStyle}>{payload?.[0]?.payload?.secondSeries}</span> {payload?.[0]?.payload?.secondSeriesName} ({ payload?.[0]?.payload?.firstSeries > 0 ? ((payload?.[0]?.payload?.secondSeries / payload?.[0]?.payload?.firstSeries) * 100).toFixed(0) : 0}%)
                </span>
            </div>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", width: "100%", gap: "5px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#E0EAFF" }} />
                <span style={toolTipTextStyle}>
                    <span style={toolTipBoldTextStyle}>{payload?.[0]?.payload?.firstSeries}</span> {payload?.[0]?.payload?.firstSeriesName}
                </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };