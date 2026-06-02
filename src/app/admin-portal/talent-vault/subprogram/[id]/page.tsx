"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useParams, useRouter, useSearchParams } from "next/navigation";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import { api } from "@/lib/utils/apiClient";
import { errorToast } from "@/lib/Utils";
import { Button } from "@/lib/components/ui";
import CareerStatusBadges from "@/lib/components/CareerComponents/CareerStatusBadge";

import SubProgramCandidatesTable from "@/app/(talent-vault)/components/admin-dashboard/SubProgramCandidatesTable";
import SubProgramSettings from "@/app/(talent-vault)/components/admin-dashboard/SubProgramSettings";

const TAB_VALUES = ["candidates", "settings"] as const;
type Tab = (typeof TAB_VALUES)[number];

function parseTab(param: string | null): Tab {
  if (param === "candidates" || param === "settings") return param;
  return "candidates";
}

type SubProgram = {
  _id: string;
  title: string;
  roleType?: string;
  status?: string;
  activityStatus?: string;
  [key: string]: any;
};

export default function SubProgramDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const subprogramId = typeof params?.id === "string" ? params.id : "";
  const rawTab = searchParams.get("tab");
  const selectedTab = parseTab(rawTab);

  useEffect(() => {
    if (rawTab !== "candidates" && rawTab !== "settings") {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("tab");
      next.set("tab", "candidates");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }
  }, [rawTab, pathname, router, searchParams]);
  const [subprogram, setSubprogram] = useState<SubProgram | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

  const setTab = (tab: Tab) => {
    if (tab === "settings") {
      router.push(`${pathname}?tab=settings`);
    } else if (tab === "candidates") {
      router.push(`${pathname}?tab=candidates`);
    }
  };
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
          currentPage="Program Details"
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
          currentPage="Program Details"
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
        currentPage={subprogram.title || "Program Details"}
        icon="la la-chart-area"
      />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem", paddingBottom: "6rem" }}>
        <div className="row">
          <div className="col">
            <div style={{ marginBottom: "35px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
                <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#181D27", margin: 0 }}>
                  {subprogram.title || "Program Details"}
                </h1>
                <CareerStatusBadges
                  career={{
                    status: subprogram.status,
                    activityStatus: subprogram.activityStatus,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="career-tab-container">
          <div className="career-tab-content">
            <div
              className={`career-tab-item ${selectedTab === "candidates" ? "active" : ""}`}
              onClick={() => setTab("candidates")}
            >
              <i className="la la-users" style={{ fontSize: 20, marginRight: 4 }}></i>
              Candidates
            </div>
            <div
              className={`career-tab-item ${selectedTab === "settings" ? "active" : ""}`}
              onClick={() => setTab("settings")}
            >
              <i className="la la-cog" style={{ fontSize: 20, marginRight: 4 }}></i>
              Settings
            </div>
          </div>
        </div>

        {selectedTab === "candidates" && (
          <SubProgramCandidatesTable subprogramId={subprogramId} />
        )}

        {selectedTab === "settings" && (
          <SubProgramSettings
            subprogram={subprogram}
            onEditStep={(stepIndex) => {
              router.push(`/admin-portal/talent-vault/edit-program/${subprogramId}?step=${stepIndex}`);
            }}
          />
        )}
      </div>
    </>
  );
}
