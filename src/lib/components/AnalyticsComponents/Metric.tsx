interface MetricData {
    metricTitle?: string;
    metricValue: number;
    percentageChange?: string;
    percentageSubtitle?: string;
    metricValueUnit?: string;
}

export default function Metric({ data }: { data: MetricData[] }) {
    return (
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: data.length > 1 ? "space-between" : "center", width: "100%", padding: data.length > 1 ? "0 50px" : "0" }}>
            {data.map((item, index) => (
                <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                {item.metricTitle && <span>{item.metricTitle}</span>}
                <h3>{item.metricValue.toFixed(0)} {item.metricValueUnit && item.metricValueUnit !== "" ? item.metricValueUnit : ""}</h3>
                {item.percentageChange && item.percentageChange !== "0.00" && 
                <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, width: "100%", textAlign: "center" }}>
                    <span className={`percentage-change ${parseFloat(item.percentageChange) > 0 ? "positive" : "negative"}`} style={{ textAlign: "center" }}>{item.percentageChange}%</span> 
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#717680" }}>{item.percentageSubtitle}</span>
                </div>}
                </div>
            ))}
        </div>
    )
}