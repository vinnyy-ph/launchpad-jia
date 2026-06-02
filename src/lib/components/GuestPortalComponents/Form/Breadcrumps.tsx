import React from "react";

type BreadcrumbsProps = {
  onBack: () => void;
  title: string;
};

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ onBack, title }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
      }}
    >
      {/* Header with Back Button and Title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "24px 0",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            paddingLeft: 20,
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <img
            src="/icons/arrow.svg"
            alt="Back"
            style={{ width: 18, height: 18 }}
          />
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#535862",
            }}
          >
            Back
          </span>
        </button>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: "#101828",
            margin: 0,
          }}
        >
          {title}
        </h1>
      </div>
    </div>
  );
};

export default Breadcrumbs;
