"use client";

import HeaderBar from "@/lib/PageComponent/HeaderBar";
import SegmentedProgramForm from "@/app/(talent-vault)/components/admin-dashboard/SegmentedProgramForm";

export default function NewProgramPage() {
  return (
    <>
      <HeaderBar activeLink="Talent Vault" currentPage="Add new program" icon="la la-chart-area" />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
        <div className="row">
          <SegmentedProgramForm mode="create" />
        </div>
      </div>
    </>
  );
}
