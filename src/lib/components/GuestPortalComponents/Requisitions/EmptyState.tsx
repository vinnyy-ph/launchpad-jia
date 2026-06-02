"use client";

import React from "react";
import AddRequisitionButton from "../AddRequisitionButton";

type RequisitionsEmptyStateProps = {
  onCreateRequisition?: () => void;
};

export default function RequisitionsEmptyState({ onCreateRequisition }: RequisitionsEmptyStateProps) {
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
        No requisitions have been created yet.
      </p>
      <p
        style={{
          fontSize: "14px",
          fontWeight: 400,
          color: "#667085",
        }}
      >
        Start by creating one to request a new position
      </p>
      <AddRequisitionButton onClick={onCreateRequisition} />
    </div>
  );
}
