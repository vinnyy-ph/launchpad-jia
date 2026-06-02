"use client";

import React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TabsProps } from "./types";

export default function Tabs({ isCareers, onTabChange }: TabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId");
  
  // Helper to build URL with orgId
  const buildUrl = (path: string) => {
    if (!orgId) return path;
    return `${path}?orgId=${orgId}`;
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        borderBottom: "1px solid #EAECF0",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: "14px",
          fontWeight: 500,
          color: "#667085",
        }}
      >
        <button
          type="button"
          onClick={() => {
            onTabChange("careers");
            router.push(buildUrl("/guest-portal/careers"));
          }}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "12px  ",
            transitionProperty: "color",
            transitionDuration: "150ms",
            color: isCareers ? "#101828" : "#667085",
            background: "none",
            border: "none",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <img
            src="/iconsV3/career-active.svg"
            alt="Careers"
            style={{ width: 20, height: 20 }}
          />
          <span >Careers</span>
          {isCareers && (
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: "-1px",
                height: "2px",
                borderRadius: "9999px",
                backgroundImage:
                  "linear-gradient(270deg, #9fcaed -0.44%, #ceb6da 32.7%, #ebacc9 65.85%, #fccec0 100%)",
              }}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            onTabChange("requisitions");
            router.push(buildUrl("/guest-portal/requisitions"));
          }}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "12px 12px",
            transitionProperty: "color",
            transitionDuration: "150ms",
            color: !isCareers ? "#101828" : "#667085",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          <img
            src={isCareers ? "/iconsV3/requisition-inactive.svg" : "/iconsV3/requisition-active.svg"}
            alt="Requisitions"
            style={{ width: 20, height: 20 }}
          />
          <span>Requisitions</span>
          {!isCareers && (
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: "-1px",
                height: "2px",
                borderRadius: "9999px",
                backgroundImage:
                  "linear-gradient(270deg, #9fcaed -0.44%, #ceb6da 32.7%, #ebacc9 65.85%, #fccec0 100%)",
              }}
            />
          )}
        </button>
      </div>
    </div>
  );
}

