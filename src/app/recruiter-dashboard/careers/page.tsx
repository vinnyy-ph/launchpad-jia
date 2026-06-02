"use client";

import React from "react";
import CareersV2Table from "@/lib/components/DataTables/CareersTableV2";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import { JobPostLimitBanner } from "@/lib/components/LimitBanner";

export default function () {
  return (
    <>
      <JobPostLimitBanner />
      <HeaderBar activeLink="Careers" currentPage="Overview" icon="la la-suitcase" />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
        <div className="row">
          <div className="col">
            <CareersV2Table />
          </div>
        </div>
      </div>
    </>
  );
}