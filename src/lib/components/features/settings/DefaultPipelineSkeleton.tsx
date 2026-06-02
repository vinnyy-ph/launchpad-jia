"use client";

export default function DefaultPipelineSkeleton({
  columnCount = 4,
}: {
  columnCount?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 16,
        marginTop: 24,
        marginBottom: 16,
        width: "100%",
        overflowX: "auto",
      }}
    >
      {Array.from({ length: columnCount }).map((_, columnIndex) => (
        <div
          key={`pipeline-skeleton-${columnIndex}`}
          style={{
            height: 478,
            minWidth: 252,
            flex: "1 1 252px",
            border: "1px dashed #E9EAEB",
            borderRadius: 16,
            backgroundColor: "#FFFFFF",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div className="skeleton-bar" style={{ width: "65%", height: 14, alignSelf: "center" }}></div>
          <div className="skeleton-bar" style={{ width: "55%", height: 20, alignSelf: "center" }}></div>
          <div className="skeleton-bar" style={{ width: "35%", height: 12, marginTop: 8 }}></div>

          {Array.from({ length: 6 }).map((__, rowIndex) => (
            <div
              key={`pipeline-skeleton-row-${columnIndex}-${rowIndex}`}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <div className="skeleton-bar" style={{ width: 14, height: 14, borderRadius: "50%" }}></div>
              <div
                className="skeleton-bar"
                style={{ width: `${72 - (rowIndex % 3) * 10}%`, height: 12 }}
              ></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
