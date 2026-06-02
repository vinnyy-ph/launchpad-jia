"use client";

import React from "react";
import Markdown from "react-markdown";
import { getCVSection } from "@/lib/Utils";

type ContactInformationSectionProps = {
  cvData: any;
};

export function ContactInformationSection({ cvData }: ContactInformationSectionProps) {
  const digitalCV = Array.isArray(cvData?.digitalCV) ? cvData.digitalCV : [];
  const contactContent = getCVSection(digitalCV, "Contact Info");

  return (
    <div className="layered-card-outer">
      <div className="layered-card-middle">
        <span style={{ fontSize: 16, color: "#181D27", fontWeight: 700, marginLeft: 16 }}>Contact Information</span>
        {contactContent ? (
          <div className="layered-card-content">
            <Markdown>{contactContent}</Markdown>
          </div>
        ) : (
          <div className="layered-card-content">
            <div className="text-center" style={{ padding: "20px" }}>
              <p style={{ color: "#6B7280" }}>No contact information available.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

