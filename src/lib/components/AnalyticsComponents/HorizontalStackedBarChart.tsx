import { useState, useRef, useEffect } from "react";
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Legend, Bar } from "recharts";
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

const barColors = {
    "1": "#B2DDFF",
    "2": "#BDB4FE",
    "3": "#FCCEEE",
    "4": "#FDDCAB",
}

interface HorizontalStackedBarChartData {
    label: string;
    category: string;
    careerId: string;
    groups: {
        stageId: string;
        name: string;
        key: string;
        totalValue: number;
        subgroups: {
            id: string;
            name: string;
            value: number;
        }[];
    }[];
}

export default function HorizontalStackedBarChart({ chartData }: { chartData: HorizontalStackedBarChartData[] }) {
    const renderLegend = ({ payload }) => {
        const stages = [
          { id: "1", name: "CV Screening" },
          { id: "2", name: "AI Interview" },
          { id: "3", name: "Human Interview" },
          { id: "4", name: "Job Offer" },
          { id: "5", name: "Custom Stage" },
        ];
        return (
        <div style={{ width: "100%", borderBottom: "1px solid #E9EAEB", paddingBottom: "10px", marginBottom: "10px" }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", width: "60%", justifyContent: "space-between", margin: "0 auto" }}>
            {
              stages.map((stage: any, index: number) => (
                <div key={`item-${index}`} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: barColors[stage.id] || "#12B76A" }} />
                    <span style={toolTipTextStyle}>{stage.name}</span>
                </div>
              ))
            }
          </div>
          </div>
        );
    };
    const [activeBarInfo, setActiveBarInfo] = useState<{ stageId: string, rowName: string } | null>(null);
    const activeBarRef = useRef<any>(null);
    const customHeight = chartData?.length * 30 < 280 ? 280 : chartData?.length * 30;
    const [barData, setBarData] = useState<any[]>([]);

    useEffect(() => {
      if (chartData?.length > 0) {
        const newBarData = [];
        for (const item of chartData) {
          for (let i = 0; i < item.groups.length; i++) {
            const group = item.groups[i];
            if (!newBarData.find((bar: any) => bar.key === group.key)) {
              newBarData.push({
                stageId: group.stageId,
                name: group.name,
                key: group.key,
                careerId: item.careerId,
              });
            }
          }
        }
        const jobOfferStageIndex = newBarData.findIndex((bar: any) => bar.stageId === "4");
        if (jobOfferStageIndex !== -1) {
          const jobOfferStage = newBarData.splice(jobOfferStageIndex, 1);
          newBarData.push(...jobOfferStage);
        }
        setBarData(newBarData);
      }
    }, [chartData]);

    const handleMouseOver = (data: any, stageId: string) => {
      const rowName = data?.category;
      const current = activeBarRef.current;
      if (rowName !== current?.rowName || current?.stageId !== stageId) {
        setActiveBarInfo({ stageId, rowName });
        activeBarRef.current = { stageId, rowName };
      }
    }
    const customBarShape = (props: any) => {
        const { fill, x, y, width, height } = props;
        if (typeof x === 'number' && typeof width === 'number') {
            const gap = 2;

            return (
                <rect
                    fill={fill}
                    x={typeof x === 'number' ? x + (gap / 2) : x}
                    y={y}
                    width={width > gap ? width - gap : width}
                    height={height}
                    rx={5}
                    ry={5}
                />
            );
        }
        return null;
    }
    return (
        <ResponsiveContainer width="100%" height={customHeight}>
        <BarChart
        accessibilityLayer
        barCategoryGap="10%"
        barGap={10}
        data={chartData.flatMap((item: HorizontalStackedBarChartData) => ({
          label: item.label,
          category: item.category,
          careerId: item.careerId,
          ...(Object.fromEntries(item.groups.map((group: any) => ([group.key, group.totalValue])))),
          substages: item.groups,
          lastStageId: item.groups[item.groups.length - 1].stageId
      }))}
        layout="vertical"
        margin={{
          bottom: 10,
          left: 20,
          right: 30,
          top: 10
        }}
        syncMethod="index"
        onMouseLeave={() => setActiveBarInfo(null)}
      >
        <XAxis type="number" hide={true} />
        <YAxis
          dataKey="category"
          type="category"
          tick={{
              fontSize: 12,
          }}
          width={"auto"}
          axisLine={false}
          tickLine={false}
          tickFormatter={customTickFormatter}
        />
        <Legend layout="horizontal" verticalAlign="top" align="center" content={renderLegend} />
        <Tooltip 
          content={(props: any) => <StageAgingTooltip {...props} activeBarInfo={activeBarInfo} />}
          cursor={false}
        />
        {barData?.length > 0 && barData.map((barDetails: any, index: number) => (
          <Bar
          key={index}
          dataKey={barDetails.key}
          fill={barColors[barDetails.stageId] || "#12B76A"}
          stackId="a"
          radius={[5, 5, 5, 5]}
          barSize={20}
          name={barDetails.name}
          onMouseOver={(data: any) => {
            handleMouseOver(data, barDetails.stageId);
          }}
          label={{
            dataKey: (value: any) => {
              if (barDetails.stageId === value.lastStageId) {
                return value.label;
              }
            },
            formatter: (value: number) => value ? value.toFixed(2) + "d" : "",
            position: "right",
          }}
          shape={customBarShape}
        />
        ))}
      </BarChart>
      </ResponsiveContainer>
    )
  }

const customTickFormatter = (value: string, index: number, limit = 15) => {
    if (value.length < limit) return value;
    return `${value.substring(0, limit)}...`;
 };

 export const StageAgingTooltip = ({ active, payload, label, activeBarInfo }: { active?: boolean, payload?: any, label?: string, activeBarInfo: { stageId: string, rowName: string } | null }) => {
    if (!activeBarInfo || !active || !payload?.[0]?.payload) return null;
    
    // Only show tooltip if the payload matches the active row
    const payloadRowName = payload[0].payload.category;
    if (payloadRowName !== activeBarInfo.rowName) return null;
    
    const payloadSubstages = payload?.[0]?.payload?.substages;
    const substages = payloadSubstages?.find((s: any) => s?.stageId === activeBarInfo.stageId)?.substages;
    if (substages?.length > 0) {
      return (
        <div className="bg-white p-3 shadow" style={{ borderRadius: "10px", width: "236px", height: "fit-content", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px" }}>
          <span style={toolTipHeaderStyle}>{substages?.[0]?.name?.split(" - ")[0] || "Unknown Stage"}</span>
          <span style={toolTipTextStyle}>{payload?.[0]?.payload?.category}</span>
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E9EAEB", margin: "10px 0" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10px", width: "100%"}}>
            <span style={{ fontWeight: 500, fontSize: 12, color: "#D5D7DA" }}>Substages:</span>
            {substages?.map((s: any, index: number) => (
              <span key={index} style={toolTipTextStyle}>{s.name?.split(" - ")[1]}: <span style={toolTipBoldTextStyle}>{s.value?.toFixed(2)}</span>d</span>
            ))}
            <span style={toolTipTextStyle}><span style={toolTipBoldTextStyle}>Total Days:</span> <span style={toolTipBoldTextStyle}>{substages.reduce((acc: number, curr: any) => acc + curr.value, 0).toFixed(2)}</span>d</span>
          </div>
        </div>
      );
    }
    return null;
  };