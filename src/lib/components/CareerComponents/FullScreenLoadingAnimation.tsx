import Image from "next/image";

export default function FullScreenLoadingAnimation({ title, subtext }: { title: string, subtext: string }) {
    return (
      <div className="modal-background fade-in-bottom">
          <div className="modal-container">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 24px", width: "100%" }}>
                <Image alt="loading" src="/gifs/analysis-loading.gif" style={{objectFit: "cover"}} width={100} height={100} />
                <span style={{ fontSize: 18, color: "#FFFFFF", fontWeight: 700 }}>{title}</span>
                <span style={{ fontSize: 14, color: "#FFFFFF" }}>{subtext}</span>
              </div>
            </div>
        </div>
    )
}
