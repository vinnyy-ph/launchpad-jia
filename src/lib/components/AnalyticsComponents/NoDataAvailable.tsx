export default function NoDataAvailable() {
    return (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, justifyContent: "center", alignItems: "center", height: "100%" }}>
            <span style={{ color: "#181D27", fontSize: 14, fontWeight: 700 }}>We couldn’t find any data for your query.</span>
            <span style={{ color: "#717680", fontSize: 14, fontWeight: 500 }}>Please try a different date range, career or remove some filters.</span>
        </div>
    )
}