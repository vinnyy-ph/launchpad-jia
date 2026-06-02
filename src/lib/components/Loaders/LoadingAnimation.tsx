import Image from "next/image";

export default function LoadingAnimation({text, subtext}: {text: string, subtext: string}) {
    return (
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", padding: "16px 24px", width: "100%" }}>
        <Image alt="loading" src="/gifs/analysis-loading.gif" style={{objectFit: "cover"}} width={100} height={90} unoptimized />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 24px" }}>
          <span style={{ fontSize: 16, color: "#414651", fontWeight: 700 }}>{text}</span>
          <span style={{ fontSize: 12, color: "#717680" }}>{subtext}</span>
        </div>
      </div>
    )
  }