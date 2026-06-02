"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/lib/components/ui";
import SubProgramsTable from "./SubProgramsTable";

export function SubProgramsSection() {
  const router = useRouter();
  return (
    <>
    <div style={{ display: "flex", gap: "20px", justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 0, margin: "10px 0" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#181D27" }}>Programs</h1>

        <p style={{ margin: "0", fontWeight: 500, fontSize: "16px", color: "#717680" }}>
          Set up program categories where Talent Vault candidates get sorted into. Customize the{" "}
          question bank and prescreening questions per program to get quality answers from your candidates.
        </p>
      </div>

      <div style={{ alignSelf: "flex-start", whiteSpace: "nowrap" }}>
        <Button
          size="large"
          variant="primary"
          onClick={() => router.push("/admin-portal/talent-vault/new-program")}
          label="Add new program"
          icon="/icons/plus.svg"
        />
      </div>
    </div>
    <SubProgramsTable />
    </>
  );
}