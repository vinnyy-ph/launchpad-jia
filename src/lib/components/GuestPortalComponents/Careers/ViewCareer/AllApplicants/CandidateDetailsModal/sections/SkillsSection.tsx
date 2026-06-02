"use client";

import React from "react";

type SkillsSectionProps = {
  orgSkills: string[] | null;
  cvSkills: string[] | null;
};

export function SkillsSection({ orgSkills, cvSkills }: SkillsSectionProps) {
  const resolvedSkills =
    Array.isArray(orgSkills) && orgSkills.length > 0
      ? orgSkills
      : Array.isArray(cvSkills) && cvSkills.length > 0
        ? cvSkills
        : [];

  return (
    <div className="layered-card-outer">
      <div className="layered-card-middle">
        <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700, marginLeft: 16 }}>Skills</span>
        <div className="layered-card-content">
          {resolvedSkills.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {resolvedSkills.map((skill: string, idx: number) => (
                <span
                  key={`${skill}-${idx}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "6px 12px",
                    borderRadius: "999px",
                    backgroundColor: "#F3F4F6",
                    border: "1px solid #E5E7EB",
                    fontSize: 13,
                    color: "#374151",
                    fontWeight: 500,
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-center" style={{ padding: "20px" }}>
              <p style={{ color: "#6B7280" }}>No skills listed.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

