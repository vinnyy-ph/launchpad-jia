"use client";

import React from "react";
import Markdown from "react-markdown";
import { getCVSection } from "@/lib/Utils";

type ExperienceSectionProps = {
  cvData: any;
};

export function ExperienceSection({ cvData }: ExperienceSectionProps) {
  const digitalCV = Array.isArray(cvData?.digitalCV) ? cvData.digitalCV : [];
  const experienceContent = getCVSection(digitalCV, "Experience");

  return (
    <div className="layered-card-outer">
      <div className="layered-card-middle">
        <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700, marginLeft: 16 }}>Experience</span>
        {experienceContent ? (
          <div className="layered-card-content">
            <Markdown>{experienceContent}</Markdown>
          </div>
        ) : (
          <div className="layered-card-content">
            <div className="text-center" style={{ padding: "20px" }}>
              <p style={{ color: "#6B7280" }}>No experience information available.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

