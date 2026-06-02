"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import styles from "@/app/(talent-vault)/styles/modules/applicant-dashboard.module.scss";
import { MetricDashboard } from "@/app/(talent-vault)/components/admin-dashboard/MetricDashboard";
import { SubProgramsSection } from "@/app/(talent-vault)/components/admin-dashboard/SubProgramsSection";

const TAB_VALUES = ["metrics", "programs"] as const;
type Tab = (typeof TAB_VALUES)[number];

function parseTab(param: string | null): Tab {
  if (param === "metrics" || param === "programs") return param;
  return "metrics";
}

export default function () {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedTab = parseTab(searchParams.get("tab"));

  const setTab = (tab: Tab) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tab);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <>
      <HeaderBar activeLink="Talent Vault" currentPage={selectedTab === "programs" ? "Programs" : "Metrics"} icon="la la-chart-area" />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem", paddingBottom: "6rem" }}>
        <div className="row">
          <div className="col">
            <div style={{ marginBottom: "35px"}}>
              <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#181D27" }}>Talent Vault</h1>
              <span style={{ fontSize: "16px", color: "#717680", fontWeight: 500 }}>View Talent Vault metrics and manage Talent-Vault related settings</span>
            </div>
          </div>
        </div>

        <div className={styles.tabs}>
          <div
            className={`${styles.tab} ${selectedTab === "metrics" ? styles.selected : styles.unselected}`}
            onClick={() => setTab("metrics")}
            style={{ cursor: "pointer" }}
          >
            <span className={`${styles.tabName} ${selectedTab === "metrics" ? styles.selected : styles.unselected}`}>Metrics</span>
          </div>
          <div
            className={`${styles.tab} ${selectedTab === "programs" ? styles.selected : styles.unselected}`}
            onClick={() => setTab("programs")}
            style={{ cursor: "pointer" }}
          >
            <span className={`${styles.tabName} ${selectedTab === "programs" ? styles.selected : styles.unselected}`}>Programs</span>
          </div>
        </div>

        <div className={styles.content}>
          {selectedTab === "metrics" && <MetricDashboard />}
          {selectedTab === "programs" && <SubProgramsSection />}
        </div>
      </div>
    </>
  );
}
