"use client";

import AddRequisitionButton from "../AddRequisitionButton";

type CareersEmptyStateProps = {
  onCreateRequisition?: () => void;
};

export default function CareersEmptyState({ onCreateRequisition }: CareersEmptyStateProps) {
  return (
    <div
      style={{
        marginTop: "2rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          marginBottom: "1.5rem",
          position: "relative",
        }}
      >
        <img
          src="/iconsV3/No Results@3x.svg"
          alt="No results"
          style={{
            maxWidth: "200px",
            height: "auto",
          }}
        />
      </div>
      <p
        style={{
          fontSize: "16px",
          fontWeight: 500,
          marginBottom: 0,
          color: "#101828",
        }}
      >
        No careers have been requested from this account
      </p>
      <p
        style={{
          fontSize: "14px",
          fontWeight: 400,
          color: "#667085",
        }}
      >
        A career represents a new opening, an open position or vacancy listing. All careers shared with you will be displayed on this page.
      </p>
      <AddRequisitionButton onClick={onCreateRequisition} />
    </div>
  );
}
