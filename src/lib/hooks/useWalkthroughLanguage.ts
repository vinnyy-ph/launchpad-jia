"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/utils/apiClient";
import { errorToast, successToast } from "@/lib/Utils";

export type WalkthroughLanguage = "english" | "tagalog";

const normalizeLang = (value: unknown): WalkthroughLanguage =>
  value === "tagalog" ? "tagalog" : "english";

export type UseWalkthroughLanguageOptions = {
  orgID: string | null | undefined;
  activeOrg: { _id?: string; walkthroughLanguage?: string } | null;
  setActiveOrg: (org: { _id?: string; walkthroughLanguage?: string } | null) => void;
  isAdminRole: boolean;
};

export function useWalkthroughLanguage({
  orgID,
  activeOrg,
  setActiveOrg,
  isAdminRole,
}: UseWalkthroughLanguageOptions) {
  const [walkthroughLanguage, setWalkthroughLanguage] = useState<WalkthroughLanguage>("english");
  const [savedWalkthroughLanguage, setSavedWalkthroughLanguage] = useState<WalkthroughLanguage>("english");
  const [isSavingWalkthrough, setIsSavingWalkthrough] = useState(false);

  useEffect(() => {
    const lang = normalizeLang(activeOrg?.walkthroughLanguage);
    setSavedWalkthroughLanguage(lang);
    setWalkthroughLanguage(lang);
  }, [activeOrg?._id, activeOrg?.walkthroughLanguage]);

  const hasWalkthroughChanges = walkthroughLanguage !== savedWalkthroughLanguage;

  const handleResetWalkthrough = useCallback(() => {
    setWalkthroughLanguage(savedWalkthroughLanguage);
  }, [savedWalkthroughLanguage]);

  const handleSaveWalkthrough = useCallback(async () => {
    if (!orgID) {
      errorToast("Organization ID not found", 1500);
      return;
    }
    if (!isAdminRole) {
      errorToast("Only admin and super admin can save this setting", 1800);
      return;
    }
    if (!hasWalkthroughChanges) return;

    setIsSavingWalkthrough(true);
    try {
      await api.post("/api/admin/update-organization", {
        orgID,
        update: { walkthroughLanguage },
      });
      setSavedWalkthroughLanguage(walkthroughLanguage);
      if (activeOrg) {
        setActiveOrg({ ...activeOrg, walkthroughLanguage });
      }
      successToast("Walkthrough language saved", 1200);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      errorToast(message || "Failed to save walkthrough language", 1800);
    } finally {
      setIsSavingWalkthrough(false);
    }
  }, [
    orgID,
    isAdminRole,
    hasWalkthroughChanges,
    walkthroughLanguage,
    activeOrg,
    setActiveOrg,
  ]);

  return {
    walkthroughLanguage,
    setWalkthroughLanguage,
    hasWalkthroughChanges,
    isSavingWalkthrough,
    handleResetWalkthrough,
    handleSaveWalkthrough,
  };
}
