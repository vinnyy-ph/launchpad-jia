import moment from "moment";
import { CartesianGrid, XAxis, YAxis, BarChart, Bar, Legend, Tooltip, ResponsiveContainer } from "recharts";
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

interface StackedBarData {
    category: string;
    parentBar: {
        value: number;
        name: string;
    };
    childBar: {
        value: number;
        name: string;
    };
}
interface StackedBarChartProps {
    data: StackedBarData[];
    customTooltip?: React.ReactElement;
    customLegend?: ({ payload }: any) => React.ReactNode;
}

export default function StackedBarChart({ data, customTooltip, customLegend }: StackedBarChartProps) {
    const renderLegend = ({ payload }) => {
        return (
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", width: "100%", justifyContent: "flex-end", gap: "10px", marginBottom: "10px" }}>
                {payload.sort((a: any, b: any) => b.value.localeCompare(a.value)).map((entry: any, index: number) => (
                    <div key={`item-${index}`} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: entry.color }} />
                        <span style={toolTipTextStyle}>{entry.value === "Automatically Endorsed" ? "Automatically endorsed by Jia" : entry.value}</span>
                    </div>
                ))}
            </div>
        );
    };

    const customDayTickFormatter = (value: string) => {
        if (data?.length <= 7) {
            return moment(value).format("dddd");
        }
        return moment(value).format("MMM D");
    }
    const customWidth = data?.length * 53 < 280 ? 280 : data?.length * 53;
    return (
        <ResponsiveContainer width="100%" height="100%" minWidth={customWidth} minHeight={174}>
        <BarChart
        accessibilityLayer
        barCategoryGap="10%"
        barGap={10}
        data={
            data.map((item: StackedBarData) => ({
                category: item.category,
                parentBarValue: item.parentBar.value,
                parentBarName: item.parentBar.name,
                childBarValue: item.childBar.value,
                childBarName: item.childBar.name,
            }))
        }
        syncMethod="index"
        margin={{
            left: -20,
            top: 10,
        }}
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
            xAxisId="a"
            tickLine={false}
            axisLine={false}
            tickFormatter={customDayTickFormatter}
        />
        <XAxis
            hide={true}
            xAxisId="b"
        />
        <Legend 
        layout="horizontal" 
        verticalAlign="top" 
        align="right"
        content={customLegend || renderLegend}
            />
        <Tooltip content={customTooltip || <StackedBarChartTooltip active={true} payload={[]} label={""} />} cursor={{ fill: "#F5F5F5"}} />
        <Bar
            dataKey="parentBarValue"
            fill="#E0EAFF"
            name={data?.[0]?.parentBar?.name}
            xAxisId="b"
            radius={[10, 10, 0, 0]}
        />
        <Bar
            dataKey="childBarValue"
            fill="#C7D7FE"
            name={data?.[0]?.childBar?.name}
            radius={[10, 10, 0, 0]}
            xAxisId="a"
        />
        </BarChart> 
        </ResponsiveContainer>
    )
 }

 export const StackedBarChartTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white p-3 shadow" style={{ borderRadius: "10px", width: "236px", height: "fit-content" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px" }}>
            <span style={toolTipHeaderStyle}>Applicants</span>
            <span style={toolTipTextStyle}>{moment(payload?.[0]?.payload?.name).format("dddd, MMMM D, YYYY")}</span>
          </div>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E9EAEB", margin: "10px 0" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px", width: "100%"}}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", width: "100%", gap: "5px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#C7D7FE" }} />
                <span style={toolTipTextStyle}>
                    <span style={toolTipBoldTextStyle}>{payload?.[0]?.payload?.childBarValue}</span> {payload?.[0]?.payload?.childBarName} ({ payload?.[0]?.payload?.parentBarValue > 0 ? ((payload?.[0]?.payload?.childBarValue / payload?.[0]?.payload?.parentBarValue) * 100).toFixed(0) : 0}%)
                </span>
            </div>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", width: "100%", gap: "5px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#E0EAFF" }} />
                <span style={toolTipTextStyle}>
                    <span style={toolTipBoldTextStyle}>{payload?.[0]?.payload?.parentBarValue}</span> {payload?.[0]?.payload?.parentBarName}
                </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
};