"use client";

import React from "react";
import Markdown from "react-markdown";
import { getCVSection } from "@/lib/Utils";

type CertificationsSectionProps = {
  cvData: any;
};

export function CertificationsSection({ cvData }: CertificationsSectionProps) {
  const digitalCV = Array.isArray(cvData?.digitalCV) ? cvData.digitalCV : [];
  const certificationsContent = getCVSection(digitalCV, "Certifications");

  return (
    <div className="layered-card-outer">
      <div className="layered-card-middle">
        <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700, marginLeft: 16 }}>Certifications</span>
        {certificationsContent ? (
          <div className="layered-card-content">
            <Markdown>{certificationsContent}</Markdown>
          </div>
        ) : (
          <div className="layered-card-content">
            <div className="text-center" style={{ padding: "20px" }}>
              <p style={{ color: "#6B7280" }}>No certifications available.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

