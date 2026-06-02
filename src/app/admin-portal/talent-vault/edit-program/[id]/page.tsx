"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import SegmentedProgramForm, {
  type SegmentedProgramFormInitialData,
} from "@/app/(talent-vault)/components/admin-dashboard/SegmentedProgramForm";
import { api } from "@/lib/utils/apiClient";
import { errorToast } from "@/lib/Utils";
import { Button } from "@/lib/components/ui";

export default function EditProgramPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const subprogramId = typeof params?.id === "string" ? params.id : "";

  // Parse step query param with safe bounds [0, 3]
  const stepParam = searchParams.get("step");
  const parsedStep = stepParam ? parseInt(stepParam, 10) : 0;
  const initialStep = Number.isNaN(parsedStep)
    ? 0
    : Math.min(Math.max(parsedStep, 0), 3);
  const [subprogram, setSubprogram] =
    useState<SegmentedProgramFormInitialData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchSubprogram = async () => {
      if (!subprogramId) {
        if (isMounted) {
          setIsLoading(false);
          setHasLoadError(true);
        }
        errorToast("Invalid program id", 1800);
        router.replace("/admin-portal/talent-vault?tab=programs");
        return;
      }

      try {
        const response = await api.get(`/api/talent-vault/subprograms/${subprogramId}`);
        const nextSubprogram = response?.data?.subprogram || null;

        if (!nextSubprogram) {
          throw new Error("Subprogram not found");
        }

        if (isMounted) {
          setSubprogram(nextSubprogram);
        }
      } catch (error) {
        console.error("Error fetching subprogram:", error);
        errorToast("Error fetching program data", 1800);

        if (isMounted) {
          setHasLoadError(true);
          router.replace("/admin-portal/talent-vault?tab=programs");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchSubprogram();

    return () => {
      isMounted = false;
    };
  }, [router, subprogramId]);

  if (isLoading) {
    return (
      <>
        <HeaderBar
          activeLink="Talent Vault"
          currentPage="Edit program"
          icon="la la-chart-area"
        />
        <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "300px",
            }}
          >
            <div className="spinner-border text-primary" role="status">
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!subprogram) {
    return (
      <>
        <HeaderBar
          activeLink="Talent Vault"
          currentPage="Edit program"
          icon="la la-chart-area"
        />
        <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "320px",
              gap: "16px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#181D27" }}>
              {hasLoadError ? "Unable to load this program" : "Program not found"}
            </div>
            <div style={{ color: "#717680", fontSize: "14px" }}>
              You can return to the programs list and try again.
            </div>
            <Button
              variant="primary"
              label="Back to Programs"
              onClick={() => router.replace("/admin-portal/talent-vault?tab=programs")}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderBar
        activeLink="Talent Vault"
        currentPage="Edit program"
        icon="la la-chart-area"
      />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
        <div className="row">
          <SegmentedProgramForm
            mode="edit"
            subprogramId={subprogramId}
            initialData={subprogram}
            initialStep={initialStep}
          />
        </div>
      </div>
    </>
  );
}
