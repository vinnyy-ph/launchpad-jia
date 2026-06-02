import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, LabelList, Bar, CartesianGrid } from "recharts";
import moment from "moment";

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

interface ColumnChartData {
    category: string;
    value: number;
    percentageChange?: number;
    comparedTo?: string;
}

type XAxisType = "date" | "number";

export default function ColumnChart({ data, yAxisMetric, xAxisType, chartTitle, toolTipValueName }: { data: ColumnChartData[], yAxisMetric: string, xAxisType: XAxisType, chartTitle: string, toolTipValueName: string }) {
    const customWidth = data?.length * 53 < 280 ? 280 : data?.length * 53;
    return (
        <ResponsiveContainer width="100%" height="100%" minWidth={customWidth}>
        <BarChart
        accessibilityLayer
        barCategoryGap="10%"
        barGap={10}
        data={
            data?.map((item: ColumnChartData) => ({
                category: item.category,
                value: item.value,
                percentageChange: item.percentageChange,
                comparedTo: item.comparedTo,
            }))
        }
        margin={{
            left: -20,
            top: 10,
        }}
        syncMethod="index"
        >
        <CartesianGrid vertical={false} horizontal={true} stroke="#F5F5F5" />
        <YAxis 
        type="number" 
        axisLine={false} 
        tickLine={false} 
        tick={{
            fontSize: 12,
            fontWeight: 500,
            color: "#717680"
        }}
        tickFormatter={(value: number) => value.toFixed(0) + yAxisMetric} 
        />
        <XAxis
            dataKey="category"
            type="category"
            tick={{
                fontSize: 12,
                fontWeight: 500,
                color: "#717680"
            }}
            width={"auto"}
            axisLine={false}
            tickLine={false}
            tickFormatter={xAxisType === "date" ? customDateTickFormatter : customTickFormatter}
        />
        <Tooltip content={<ColumnChartTooltip active={true} payload={[]} label={""} chartTitle={chartTitle} toolTipValueName={toolTipValueName} xAxisType={xAxisType} />} cursor={{ fill: "#F5F5F5"}} />
        <Bar
            dataKey="value"
            fill="#C7D7FE"
            stackId="a"
            radius={[5, 5, 5, 5]}
        >
        </Bar>
        </BarChart>
        </ResponsiveContainer>
    )
 }

 const customTickFormatter = (value: string, index: number, limit = 10) => {
    if (value.length < limit) return value;
    return `${value.substring(0, limit)}...`;
 };

 const customDateTickFormatter = (value: string) => {
    return moment(value).format('MMM D');
 }

const ColumnChartTooltip = ({ active, payload, label, chartTitle, toolTipValueName, xAxisType }: { active: boolean, payload: any[], label: string, chartTitle: string, toolTipValueName: string, xAxisType: "date" | "number" }) => {
    if (active && payload?.length) {
        return (
            <div className="bg-white p-3 shadow" style={{ borderRadius: "10px", width: "236px", height: "fit-content" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px" }}>
                    <span style={toolTipHeaderStyle}>{chartTitle}</span>
                    <span style={toolTipTextStyle}>{xAxisType === "date" ? moment(payload?.[0]?.payload?.category).format("dddd, MMMM D, YYYY") : payload?.[0]?.payload?.category}</span>
                </div>
                <div style={{ width: "100%", height: "1px", backgroundColor: "#E9EAEB", margin: "10px 0" }} />
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", width: "100%", gap: "5px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#8098F9" }} />
                <span style={toolTipTextStyle}>
                    <span style={toolTipBoldTextStyle}>{payload?.[0]?.payload?.value}</span> {toolTipValueName}
                </span>
                </div>
            </div>
        );
    }
    return null;
}