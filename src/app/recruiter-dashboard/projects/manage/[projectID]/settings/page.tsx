"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, use } from "react";
import { api } from "@/lib/utils/apiClient";
import { Button } from "@/lib/components/ui";
import styles from "@/lib/styles/screens/manage-project.module.scss";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import { Project } from "@/lib/types/projects";
import { errorToast } from "@/lib/Utils";
import GlobalPipelineStageColumns from "@/lib/components/features/settings/GlobalPipelineStageColumns";
import DefaultPipelineSkeleton from "@/lib/components/features/settings/DefaultPipelineSkeleton";
import PreScreeningSettingsPanel from "@/lib/components/features/settings/PreScreeningSettingsPanel";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { useDefaultPipelineSettings } from "@/lib/components/features/settings/useDefaultPipelineSettings";
import { useRecruiterContext } from "@/lib/context/RecruiterContext";

interface ManageProjectSettingsPageProps {
  params: Promise<{ projectID: string }>;
}

export default function ManageProjectSettingsPage({
  params,
}: ManageProjectSettingsPageProps) {
  const { projectID } = use(params);
  const searchParams = useSearchParams();
  const orgID = searchParams.get("orgID");
  const router = useRouter();
  const { setHasUnsavedChanges, modalType, setModalType } = useRecruiterContext();
  const [activeOrg] = useLocalStorage("activeOrg", null);
  const isAdminRole = activeOrg?.role === "admin" || activeOrg?.role === "super_admin";

  const {
    jobPipeline,
    setJobPipeline,
    preScreeningQuestions,
    setPreScreeningQuestions,
    isLoading: isPipelineLoading,
    isSavingPipeline,
    isSavingPreScreening,
    hasResolvedInitialLoad,
    hasPipelineChanges,
    hasPreScreeningChanges,
    handleResetPipeline,
    handleResetPreScreening,
    handleSavePipeline,
    handleSavePreScreening,
  } = useDefaultPipelineSettings({
    orgID,
    projectID,
    isAdminRole,
    loadErrorMessage: "Failed to load project settings",
    pipelineSaveSuccessMessage: "Project default pipeline saved",
    pipelineSaveErrorMessage: "Failed to save project default pipeline settings",
    preScreeningSaveSuccessMessage: "Project pre-screening settings saved",
    preScreeningSaveErrorMessage: "Failed to save project pre-screening settings",
    adminRequiredErrorMessage: "Only admin and super admin can save project settings",
  });

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [preScreeningResetSignal, setPreScreeningResetSignal] = useState(0);
  const [pendingSidebarUrl, setPendingSidebarUrl] = useState<string | null>(null);
  const isRestoringHistoryRef = useRef(false);

  const handlePreScreeningReset = () => {
    handleResetPreScreening();
    setPreScreeningResetSignal((previousSignal) => previousSignal + 1);
  };

  const handlePipelineReset = () => {
    handleResetPipeline();
  };

  const hasUnsavedChanges = useMemo(
    () => hasPipelineChanges || hasPreScreeningChanges,
    [hasPipelineChanges, hasPreScreeningChanges]
  );

  useEffect(() => {
    setHasUnsavedChanges(hasUnsavedChanges);
    return () => setHasUnsavedChanges(false);
  }, [hasUnsavedChanges, setHasUnsavedChanges]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handlePopState = () => {
      if (!hasUnsavedChanges) {
        return;
      }

      if (isRestoringHistoryRef.current) {
        isRestoringHistoryRef.current = false;
        return;
      }

      const shouldLeave = window.confirm(
        "You have unsaved changes. Are you sure you want to leave this page?"
      );

      if (shouldLeave) {
        setHasUnsavedChanges(false);
        return;
      }

      isRestoringHistoryRef.current = true;
      window.history.go(1);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [hasUnsavedChanges, setHasUnsavedChanges]);

  useEffect(() => {
    const handleSidebarClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest(".sidebar-v2 a");

      if (!link) {
        return;
      }

      const href = link.getAttribute("href");

      if (!href) {
        return;
      }

      const linkUrl = new URL(href, window.location.origin);
      const currentParams = new URLSearchParams(window.location.search);
      const linkedOrgID = currentParams.get("orgID");

      if (linkedOrgID && !linkUrl.searchParams.has("orgID")) {
        linkUrl.searchParams.set("orgID", linkedOrgID);
      }

      setPendingSidebarUrl(linkUrl.pathname + linkUrl.search);
    };

    document.addEventListener("click", handleSidebarClick, true);
    return () => document.removeEventListener("click", handleSidebarClick, true);
  }, []);

  useEffect(() => {
    if (modalType !== "inactive" || !hasUnsavedChanges) {
      return;
    }

    const shouldLeave = window.confirm(
      "You have unsaved changes. Are you sure you want to leave this page?"
    );

    if (shouldLeave) {
      setHasUnsavedChanges(false);

      if (pendingSidebarUrl) {
        router.push(pendingSidebarUrl);
        setPendingSidebarUrl(null);
      }
    }

    if (!shouldLeave) {
      setPendingSidebarUrl(null);
    }

    setModalType(null);
  }, [
    modalType,
    hasUnsavedChanges,
    pendingSidebarUrl,
    router,
    setHasUnsavedChanges,
    setModalType,
  ]);

  useEffect(() => {
    const fetchProject = async () => {
      if (!projectID || !orgID) return;

      try {
        setLoading(true);
        const response = await api.post("/api/projects/get", {
          projectId: projectID,
          orgID,
        });
        if (response.status === 200) {
          setProject(response.data.project);
        }
      } catch (error: any) {
        errorToast(error.message, 2500);
        router.push(`/recruiter-dashboard/projects?orgID=${orgID}&limit=1000`);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectID, orgID, router]);

  if (loading || !project) {
    return (
      <>
        <HeaderBar
          activeLink="Projects"
          currentPage="Loading..."
          subpage="Settings"
          icon="la la-folder"
        />
        <div className={styles.manageProjectContainer}>
          <div className={styles.projectHeaderSection}>
            <div className={styles.projectHeaderLeft}>
              <div className={styles.projectTitleRow}>
                <div
                  className="skeleton-bar"
                  style={{ width: "200px", height: "28px" }}
                ></div>
              </div>
              <div className={styles.projectMetaRow}>
                <div className="skeleton-bar" style={{ width: "100px" }}></div>
                <div
                  className="skeleton-bar"
                  style={{ width: "32px", height: "32px", borderRadius: "50%" }}
                ></div>
                <div className="skeleton-bar" style={{ width: "80px" }}></div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderBar
        activeLink="Projects"
        currentPage={project.name}
        subpage="Settings"
        icon="la la-folder"
      />
      <div className={styles.manageProjectContainer}>
        <div className={styles.projectHeaderSection}>
          <div className={styles.projectHeaderLeft}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: "#181D27", margin: 0 }}>
                Project Settings
              </h2>
              <p style={{ fontSize: 14, fontWeight: 500, color: "#717680", margin: 0, marginTop: 4 }}>
                Set your preferences for pre-screening questions and pipelines.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24, overflowY: "auto", paddingBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#181D27", margin: 0 }}>
                Pre-screening Questions
              </h2>
              <p style={{ fontSize: 14, fontWeight: 500, color: "#717680", margin: 0, marginTop: 4 }}>
                These questions will be used as the default pre-screening questions whenever you create a job posting within the project.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Button
                onClick={handlePreScreeningReset}
                variant="secondary"
                label="Reset Changes"
                disabled={!hasResolvedInitialLoad || isPipelineLoading || isSavingPreScreening}
              />
              <Button
                onClick={handleSavePreScreening}
                variant="primary"
                label="Save Changes"
                disabled={!hasResolvedInitialLoad || isPipelineLoading || isSavingPreScreening || !isAdminRole || !hasPreScreeningChanges}
              />
            </div>
          </div>

          <div>
            <PreScreeningSettingsPanel
              questions={preScreeningQuestions}
              setQuestions={setPreScreeningQuestions}
              resetSignal={preScreeningResetSignal}
            />
          </div>

          <hr style={{ margin: "14px 0 0 0", border: "none", borderTop: "1px solid #E5E7EB" }} />

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#181D27", margin: 0 }}>
                  Default Pipeline
                </h2>
                <p style={{ fontSize: 14, fontWeight: 500, color: "#717680", margin: 0, marginTop: 4 }}>
                  Create, edit, reorder, or delete stages and sub-stages. This pipeline will be used as the default for all new job postings within the project.
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Button
                  onClick={handlePipelineReset}
                  variant="secondary"
                  label="Reset Changes"
                  disabled={!hasResolvedInitialLoad || isPipelineLoading || isSavingPipeline}
                />
                <Button
                  onClick={handleSavePipeline}
                  variant="primary"
                  label="Save Changes"
                  disabled={!hasResolvedInitialLoad || isPipelineLoading || isSavingPipeline || !isAdminRole || !hasPipelineChanges}
                />
              </div>
            </div>

            {!hasResolvedInitialLoad ? (
              <DefaultPipelineSkeleton />
            ) : (
              <GlobalPipelineStageColumns
                jobPipeline={jobPipeline}
                setJobPipeline={setJobPipeline}
                allowDisableBoundaryCoreStages={true}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
