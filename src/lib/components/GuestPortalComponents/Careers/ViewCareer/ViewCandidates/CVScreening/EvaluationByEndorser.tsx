"use client";

import React from "react";
import { Label } from "@/lib/components/GuestPortalComponents/label";
import Container from "../../../../Container";
import AvatarImage from "@/lib/components/AvatarImage/AvatarImage";
import type { RecruiterEvaluation } from "./useCVScreeningData";

type Props = {
  evaluation: RecruiterEvaluation | null;
};

/**
 * Get fit label styling based on status
 */
function getFitLabelStyle(status: string | null): {
  bgColor: string;
  strokeColor: string;
  textColor: string;
} {
  if (!status) {
    return { bgColor: "#F2F4F7", strokeColor: "#EAECF0", textColor: "#344054" };
  }

  const lower = status.toLowerCase();
  if (lower.includes("strong")) {
    return { bgColor: "#ECFDF3", strokeColor: "#ABEFC6", textColor: "#067647" };
  }
  if (lower.includes("good")) {
    return { bgColor: "#EFF8FF", strokeColor: "#B2DDFF", textColor: "#175CD3" };
  }
  if (lower.includes("maybe")) {
    return { bgColor: "#FFFAEB", strokeColor: "#FEDF89", textColor: "#B54708" };
  }
  if (lower.includes("bad")) {
    return { bgColor: "#FEF3F2", strokeColor: "#FECDCA", textColor: "#B42318" };
  }
  return { bgColor: "#F2F4F7", strokeColor: "#EAECF0", textColor: "#344054" };
}

export default function EvaluationByEndorser({ evaluation }: Props) {
  // Don't render if no evaluation exists
  if (!evaluation) {
    return null;
  }

  const endorserName = evaluation.updatedBy?.name || "Recruiter";
  const endorserImage = evaluation.updatedBy?.image;
  const matchFit = evaluation.matchFit;
  const evaluationNotes = evaluation.evaluationNotes;
  const fitStyle = getFitLabelStyle(matchFit || null);

  return (
    <Container
      icon={
        endorserImage ? (
          <AvatarImage
            src={endorserImage}
            alt={endorserName}
            style={{ width: 32, height: 32 }}
          />
        ) : (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#181D27",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
            }}
          >
            {endorserName.charAt(0).toUpperCase()}
          </div>
        )
      }
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: "#101828" }}>
              Evaluation by {endorserName}
            </span>
            {matchFit && (
              <Label
                bgColor={fitStyle.bgColor}
                strokeColor={fitStyle.strokeColor}
                textColor={fitStyle.textColor}
                style={{ fontSize: 12, fontWeight: 550 }}
              >
                {matchFit}
              </Label>
            )}
          </div>
        </div>
      }
      parentBgColor="#FFFCF5"
    >
      {evaluationNotes ? (
        <div
          style={{ fontSize: 14, lineHeight: "20px", color: "#475467" }}
          dangerouslySetInnerHTML={{ __html: evaluationNotes }}
        />
      ) : (
        <div style={{ fontSize: 14, color: "#667085", fontStyle: "italic" }}>
          No evaluation notes provided.
        </div>
      )}
    </Container>
  );
}
