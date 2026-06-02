function SkeletonBox({ width, height }: { width: string | number; height: string | number }) {
  return (
    <div
      style={{
        width,
        height,
        background: "linear-gradient(90deg, #F9FAFB 0%, #F3F4F6 50%, #F9FAFB 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        borderRadius: 4,
      }}
    />
  );
}

function SkeletonCard() {
  return (
    <div
      style={{
        border: "1px solid #EAECF0",
        borderRadius: 16,
        padding: "16px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SkeletonBox width={200} height={24} />
          <SkeletonBox width={80} height={24} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <SkeletonBox width={100} height={20} />
          <div style={{ width: 1, height: 20, background: "#EAECF0" }} />
          <SkeletonBox width={100} height={20} />
          <div style={{ width: 1, height: 20, background: "#EAECF0" }} />
          <SkeletonBox width={100} height={20} />
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          height: 1,
          background: "#EAECF0",
          margin: "16px 0",
          width: "100%",
        }}
      />

      {/* Body */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(140px, 1fr))",
            gap: 12,
            flex: 1,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <SkeletonBox width={80} height={12} />
              <SkeletonBox width="100%" height={14} />
            </div>
          ))}
        </div>
        <SkeletonBox width={120} height={40} />
      </div>
    </div>
  );
}

export default function CareersTableSkeleton() {
  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </>
  );
}
