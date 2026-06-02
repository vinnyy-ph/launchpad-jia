import { ResponsiveContainer, Tooltip, Pie, PieChart, Cell } from "recharts";
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

interface PieChartData {
    name: string;
    value: number;
    color: string;
}

export default function CustomPieChart({ data }: { data: PieChartData[] }) {

    return (
        <ResponsiveContainer
  height="100%"
  width="100%"
>
  <PieChart data={data}>
    <Pie
      cx="50%"
      cy="50%"
      dataKey="value"
      innerRadius={60}
      outerRadius={80}
    >
        {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
        ))}
    </Pie>
    <Tooltip
      content={<PieChartTooltip active={true} payload={[]} label={""} />}
    />
  </PieChart>
</ResponsiveContainer>
    )
}

export const PieChartTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
        return (
            <div className="bg-white p-3 shadow" style={{ borderRadius: "10px", width: "236px", height: "fit-content", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px" }}>
                <span style={toolTipHeaderStyle}>{payload?.[0]?.payload?.name}</span>
                <span style={toolTipTextStyle}>{payload?.[0]?.payload?.value}</span>
            </div>
        )
    }
    return null;
}