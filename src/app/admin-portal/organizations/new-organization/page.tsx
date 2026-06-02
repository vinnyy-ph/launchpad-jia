"use client";

import React, { Suspense } from "react";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import SegmentedOrgForm from "@/lib/components/AdminComponents/OrgCreation/SegmentedOrgForm";

export default function NewOrganizationPage() {
  return (
    <>
      <HeaderBar
        activeLink="Organizations"
        currentPage="Add new organization"
        icon="la la-building"
      />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
        <div className="row">
          <Suspense fallback={<div>Loading...</div>}>
            <SegmentedOrgForm />
          </Suspense>
        </div>
      </div>
    </>
  );
}
