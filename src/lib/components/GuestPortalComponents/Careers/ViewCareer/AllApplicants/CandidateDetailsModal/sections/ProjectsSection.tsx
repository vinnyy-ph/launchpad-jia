"use client";

import React from "react";
import Markdown from "react-markdown";
import { getCVSection } from "@/lib/Utils";

type ProjectsSectionProps = {
  cvData: any;
};

export function ProjectsSection({ cvData }: ProjectsSectionProps) {
  const digitalCV = Array.isArray(cvData?.digitalCV) ? cvData.digitalCV : [];
  const projectsContent = getCVSection(digitalCV, "Projects");

  return (
    <div className="layered-card-outer">
      <div className="layered-card-middle">
        <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700, marginLeft: 16 }}>Projects</span>
        {projectsContent ? (
          <div className="layered-card-content">
            <Markdown>{projectsContent}</Markdown>
          </div>
        ) : (
          <div className="layered-card-content">
            <div className="text-center" style={{ padding: "20px" }}>
              <p style={{ color: "#6B7280" }}>No projects available.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

