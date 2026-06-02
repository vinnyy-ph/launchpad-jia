"use client";

import React from "react";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import EmployerRequisitions from "@/lib/components/RequisitionsComponents";

export default function Page() {
  return (
    <>
      <HeaderBar
        activeLink="Requisitions"
        currentPage="Overview"
        icon="la la-file-alt"
        iconImage="/iconsV3/job-requisition.svg"
      />
      <EmployerRequisitions />
    </>
  );
}

