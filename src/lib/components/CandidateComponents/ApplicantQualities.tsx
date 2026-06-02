
const breakdownColorScheme = ["#9FCAED", "#CEB6DA", "#EBACC9", "#FCCEC0"];

export default function ApplicantQualities({ analysis }: { analysis: any }) {
    return (
        <div>
        <h2 style={{ color: "#181D27"}}>Applicant Qualities</h2>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            borderRadius: 8,
            border: "1px solid #E9EAEB",
            padding: "16px 24px",
          }}
        >
          {analysis?.breakdown?.length &&
            analysis?.breakdown?.map(
              (item: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 16,
                    width: "100%",
                  }}
                >
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                    }}
                  >
                    <i
                      className="la la-asterisk"
                      style={{
                        fontSize: 16,
                        marginRight: 5,
                        color: "#6941C6",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 14,
                        minWidth: "30%",
                        color: "#414651", 
                        fontWeight: 400
                      }}
                    >
                      {item?.key}
                    </span>
                    {/* Progress bar */}
                    <div
                      style={{
                        width: "100%",
                        height: 8,
                        borderRadius: 4,
                        background: "#E9EAEB",
                        marginRight: 16,
                      }}
                    >
                      <div
                        style={{
                          width: `${item?.data}%`,
                          height: "100%",
                          borderRadius: 4,
                          background:
                            breakdownColorScheme[idx],
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 14 }}>
                      {item?.data}%
                    </span>
                  </div>
                  <div style={{ width: "100%" }}>
                    <span style={{ fontSize: 14, color: "#414651", fontWeight: 400 }}>
                      {item?.rationale}
                    </span>
                  </div>
                </div>
              )
            )}
        </div>
      </div>
    )
}