"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import SegmentedCareerForm from "@/lib/components/CareerComponents/SegmentedCareerForm";
import { api } from "@/lib/utils/apiClient";
import { Button } from "@/lib/components/ui";

export default function NewCareerPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgID = searchParams.get("orgID");
  const projectId = searchParams.get("projectId");
  const projectName = searchParams.get("projectName");
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);

  useEffect(() => {
    const checkPlan = async () => {
      try {
        const res = await api.get("/api/pricing-plan/get-plan-details", {
          params: { orgID },
        });
        setHasPlan(res.data.hasPlan || false);
      } catch (error) {
        console.error("Error checking plan status:", error);
        setHasPlan(false);
      }
    };
    checkPlan();
  }, [orgID]);

  // Show loading state while checking plan
  if (hasPlan === null) {
    return (
      <>
        <HeaderBar activeLink="Careers" currentPage="Add new career" icon="la la-suitcase" />
        <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "300px" }}>
            <div className="spinner-border text-primary" role="status">
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Show blocked UI if org has no plan
  if (hasPlan === false) {
    return (
      <>
        <HeaderBar activeLink="Careers" currentPage="Add new career" icon="la la-suitcase" />
        <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "400px",
            gap: "16px",
            textAlign: "center",
            padding: "40px",
          }}>
            <i className="la la-exclamation-circle" style={{ fontSize: "64px", color: "#F04438" }}></i>
            <h2 style={{ fontSize: "24px", fontWeight: 600, color: "#181D27", margin: 0 }}>
              No Active Plan
            </h2>
            <p style={{ fontSize: "16px", color: "#717680", maxWidth: "500px", margin: 0 }}>
              This organization does not have an active plan. Please contact your administrator to assign a plan before creating careers.
            </p>
            <Button
              variant="primary"
              label="Back to Careers"
              onClick={() => router.push(`/recruiter-dashboard/careers?orgID=${orgID}`)}
              style={{ marginTop: "16px" }}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderBar activeLink="Careers" currentPage="Add new career" icon="la la-suitcase" />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
        <div className="row">
          <SegmentedCareerForm
            formType="add"
            preselectedProject={projectId && projectName ? { id: projectId, name: projectName } : undefined}
          />
        </div>
      </div>
    </>
  )
}
