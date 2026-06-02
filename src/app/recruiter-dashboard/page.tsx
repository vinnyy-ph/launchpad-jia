"use client";

import React, { useState } from "react";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import RecruiterDashboard from "../../lib/components/GuestPortalComponents/DashboardComponents/RecruiterDashboard";
import styles from "@/lib/styles/analytics/graphs.module.scss";
import RecruiterPipelineReport from "@/lib/components/AnalyticsComponents/RecruiterPipelineReport";

export default function () {
  const [isSavingAnalyticsDashboard, setIsSavingAnalyticsDashboard] = useState(false);
  const [activeTab, setActiveTab] = useState<any>("Overview");
  const tabs = [
    "Overview",
    "Pipeline Report"
  ]
  
  return (
    <>
      <HeaderBar activeLink="Dashboard" currentPage="Overview" icon="la la-chart-area" />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem", paddingBottom: "6rem", height: "fit-content" }}>
        <div className="row">
          <div className="col">
            <div style={{ marginBottom: "35px"}} id="page-title-header">
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 10 }}>
              <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#181D27" }}>Dashboard</h1>
              {isSavingAnalyticsDashboard && <span style={{ fontSize: "16px", color: "#717680", fontWeight: 500 }}>Saving...</span>}
              </div>
              <span style={{ fontSize: "16px", color: "#717680", fontWeight: 500 }}>Here’s an overview of your current recruitment process.</span>
            </div>
            {/* Tabs */}
            <div className={styles.dashboardTabContainer}>
            {tabs.map((tab: string, index: number) => (
              <div
                key={index}
                className={`${activeTab === tab ? styles.dashboardActiveTabItem : styles.dashboardTabItem}`}
                style={{ flexShrink: 0, whiteSpace: "nowrap" }}
                onClick={() => {
                  setActiveTab(tab);
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>{tab}</span>
                </span>
              </div>
            ))}
            </div>
            {activeTab === "Overview" && <RecruiterDashboard setIsSavingAnalyticsDashboard={setIsSavingAnalyticsDashboard} />}
            {activeTab === "Pipeline Report" && <RecruiterPipelineReport />}
          </div>
        </div>
      </div>
    </>
  );
}
