"use client";

import React from "react";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import InquiriesTable from "@/lib/components/DataTables/InquiriesTable";

export default function () {
  return (
    <>
      <HeaderBar activeLink="Inquiries" currentPage="Overview" icon="la la-file-alt" />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
        <div className="row">
          <div className="col">
            <InquiriesTable />
          </div>
        </div>
      </div>
    </>
  );
}