"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/components/ui";
import WalkthroughLanguageSelector from "@/lib/components/CareerComponents/WalkthroughLanguageSelector";
import GlobalPipelineStageColumns from "./GlobalPipelineStageColumns";
import DefaultPipelineSkeleton from "./DefaultPipelineSkeleton";
import { useAppContext } from "@/lib/context/AppContext";
import { useRecruiterContext } from "@/lib/context/RecruiterContext";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { useWalkthroughLanguage } from "@/lib/hooks/useWalkthroughLanguage";
import { useDefaultPipelineSettings } from "./useDefaultPipelineSettings";
import PreScreeningSettingsPanel from "./PreScreeningSettingsPanel";

export function GlobalCareerSettings() {
  const router = useRouter();
  const { orgID } = useAppContext();
  const { setHasUnsavedChanges, modalType, setModalType } = useRecruiterContext();
  const [activeOrg, setActiveOrg] = useLocalStorage("activeOrg", null);
  const [preScreeningResetSignal, setPreScreeningResetSignal] = useState(0);
  const [pendingSidebarUrl, setPendingSidebarUrl] = useState<string | null>(null);
  const isRestoringHistoryRef = useRef(false);
  const isAdminRole = activeOrg?.role === "admin" || activeOrg?.role === "super_admin";

  const {
    walkthroughLanguage,
    setWalkthroughLanguage,
    hasWalkthroughChanges,
    isSavingWalkthrough,
    handleResetWalkthrough,
    handleSaveWalkthrough,
  } = useWalkthroughLanguage({ orgID, activeOrg, setActiveOrg, isAdminRole });

  const {
    jobPipeline,
    setJobPipeline,
    preScreeningQuestions,
    setPreScreeningQuestions,
    isLoading,
    isSavingPipeline,
    isSavingPreScreening,
    hasResolvedInitialLoad,
    hasPipelineChanges,
    hasPreScreeningChanges,
    handleResetPipeline,
    handleResetPreScreening,
    handleSavePipeline,
    handleSavePreScreening,
  } = useDefaultPipelineSettings({ orgID, isAdminRole });

  const handlePreScreeningReset = () => {
    handleResetPreScreening();
    setPreScreeningResetSignal((previousSignal) => previousSignal + 1);
  };

  const handlePipelineReset = () => {
    handleResetPipeline();
  };

  const hasUnsavedChanges = useMemo(
    () => hasWalkthroughChanges || hasPipelineChanges || hasPreScreeningChanges,
    [hasWalkthroughChanges, hasPipelineChanges, hasPreScreeningChanges]
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, overflowY: "auto", paddingBottom: 24 }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#181D27", margin: 0 }}>
              Pre-screening Questions
            </h2>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#717680", margin: 0, marginTop: 4 }}>
              These questions will be used as the default pre-screening questions whenever you create a job posting.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Button
              variant="secondary"
              onClick={handlePreScreeningReset}
              label="Reset Changes"
              disabled={!hasResolvedInitialLoad || isLoading || isSavingPreScreening}
            />
            <Button
              variant="primary"
              onClick={handleSavePreScreening}
              label="Save Changes"
              disabled={!hasResolvedInitialLoad || isLoading || isSavingPreScreening || !isAdminRole || !hasPreScreeningChanges}
            />
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <PreScreeningSettingsPanel
            questions={preScreeningQuestions}
            setQuestions={setPreScreeningQuestions}
            resetSignal={preScreeningResetSignal}
          />
        </div>
      </div>

      <hr style={{ margin: "0 0 12px 0", border: "none", borderTop: "1px solid #E5E7EB" }} />

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#181D27", margin: 0 }}>
              AI Interview Video Walkthrough
            </h2>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#717680", margin: 0, marginTop: 4 }}>
              Choose the default language for the AI interview video walkthrough. This will be used for new careers unless overridden per career.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Button
              variant="secondary"
              onClick={handleResetWalkthrough}
              label="Reset Changes"
              disabled={!hasResolvedInitialLoad || isLoading || isSavingWalkthrough || !hasWalkthroughChanges}
            />
            <Button
              variant="primary"
              onClick={handleSaveWalkthrough}
              label="Save Changes"
              disabled={!hasResolvedInitialLoad || isLoading || isSavingWalkthrough || !isAdminRole || !hasWalkthroughChanges}
            />
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <WalkthroughLanguageSelector
            value={walkthroughLanguage}
            onChange={setWalkthroughLanguage}
          />
        </div>
      </div>

      <hr style={{ margin: "14px 0 0 0", border: "none", borderTop: "1px solid #E5E7EB" }} />

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#181D27", margin: 0 }}>
              Default Pipeline
            </h2>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#717680", margin: 0, marginTop: 4 }}>
              Create, edit, reorder, or delete stages and sub-stages. This pipeline will be used as the default for all new job postings.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Button
              variant="secondary"
              onClick={handlePipelineReset}
              label="Reset Changes"
              disabled={!hasResolvedInitialLoad || isLoading || isSavingPipeline}
            />
            <Button
              variant="primary"
              onClick={handleSavePipeline}
              label="Save Changes"
              disabled={!hasResolvedInitialLoad || isLoading || isSavingPipeline || !isAdminRole || !hasPipelineChanges}
            />
          </div>
        </div>

        {!hasResolvedInitialLoad ? (
          <DefaultPipelineSkeleton />
        ) : (
          <GlobalPipelineStageColumns
            jobPipeline={jobPipeline}
            setJobPipeline={setJobPipeline}
          />
        )}
      </div>
    </div>
  );
}
