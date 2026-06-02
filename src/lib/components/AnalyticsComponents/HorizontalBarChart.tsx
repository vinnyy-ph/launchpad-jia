import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, LabelList, Bar } from "recharts";
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

interface HorizontalBarChartData {
    category: string;
    value: number;
    label: string;
    percentageChange?: number;
    comparedTo?: string;
}

export default function HorizontalBarChart({ data }: { data: HorizontalBarChartData[] }) {
    const customHeight = data?.length * 30 < 174 ? 174 : data?.length * 30;
    return (
        <ResponsiveContainer width="100%" height={customHeight}>
        <BarChart
        accessibilityLayer
        barCategoryGap="10%"
        barGap={10}
        data={
            data?.map((item: HorizontalBarChartData) => ({
                category: item.category,
                value: item.value,
                label: item.label,
                percentageChange: item.percentageChange,
                comparedTo: item.comparedTo,
            }))
        }
        margin={{
            left: 10,
            top: 10,
            right: 50,
        }}
        layout="vertical"
        syncMethod="index"
        >
        <XAxis type="number" hide={true} />
        <YAxis
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
            tickFormatter={customTickFormatter}
        />
        <Tooltip content={<EndorsementEfficiencyTooltip active={true} payload={[]} label={""} />} cursor={{ fill: "#F5F5F5"}} />
        <Bar
            dataKey="value"
            fill="#C7D7FE"
            stackId="a"
            radius={[5, 5, 5, 5]}
            barSize={20}
        >
        <LabelList
            dataKey="label"
            position="right"
        />
        </Bar>
        </BarChart>
        </ResponsiveContainer>
    )
 }

 export const EndorsementEfficiencyTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white p-3 shadow" style={{ borderRadius: "10px", width: "236px", height: "fit-content", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px" }}>
            <span style={toolTipHeaderStyle}>Endorsement Efficiency</span>
            <span style={toolTipTextStyle}>{payload?.[0]?.payload?.category}</span>
          </div>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E9EAEB", margin: "10px 0" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px", width: "100%"}}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", width: "100%", gap: "5px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#8098F9" }} />
                <span style={toolTipTextStyle}>
                    <span style={toolTipBoldTextStyle}>{payload?.[0]?.payload?.value}</span>%
                </span>
            </div>
            {payload?.[0]?.payload?.percentageChange && payload?.[0]?.payload?.percentageChange !== "0.00" && 
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", width: "100%", gap: "5px" }}>
                <span className={`percentage-change ${payload?.[0]?.payload?.percentageChange > 0 ? "positive" : "negative"}`}>
                {payload?.[0]?.payload?.percentageChange}%
                </span>
                <span style={toolTipTextStyle}>
                from {payload?.[0]?.payload?.comparedTo}
                </span>
            </div>
            }
          </div>
        </div>
      );
    }
    return null;
  };

const customTickFormatter = (value: string, index: number, limit = 15) => {
    if (value.length < limit) return value;
    return `${value.substring(0, limit)}...`;
 };