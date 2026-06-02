"use client";

type Props = {
  onClick?: () => void;
};

export default function ExportCandidateBTN({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        background: "#fff",
        border: "1px solid #EAECF0",
        borderRadius: 999,
        cursor: "pointer",
        color: "#344054",
        fontWeight: 550,
        fontSize: 14,
      }}
      aria-label="Export Candidates"
    >
      <img src="/icons/download-cloud.svg" alt="" style={{ width: 18, height: 18, display: "block" }} />
      Export Candidates
    </button>
  );
}

