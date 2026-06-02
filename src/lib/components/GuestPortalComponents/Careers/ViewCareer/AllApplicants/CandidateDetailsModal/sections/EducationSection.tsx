"use client";

import React from "react";
import Markdown from "react-markdown";
import { getCVSection } from "@/lib/Utils";

type EducationSectionProps = {
  cvData: any;
};

export function EducationSection({ cvData }: EducationSectionProps) {
  const digitalCV = Array.isArray(cvData?.digitalCV) ? cvData.digitalCV : [];
  const educationContent = getCVSection(digitalCV, "Education");

  return (
    <div className="layered-card-outer">
      <div className="layered-card-middle">
        <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700, marginLeft: 16 }}>Education</span>
        {educationContent ? (
          <div className="layered-card-content">
            <Markdown>{educationContent}</Markdown>
          </div>
        ) : (
          <div className="layered-card-content">
            <div className="text-center" style={{ padding: "20px" }}>
              <p style={{ color: "#6B7280" }}>No education information available.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

