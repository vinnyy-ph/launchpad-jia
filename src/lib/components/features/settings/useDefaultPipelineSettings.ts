"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/utils/apiClient";
import { errorToast, successToast, normalizePipeline } from "@/lib/Utils";
import { DEFAULT_JOB_PIPELINE } from "@/lib/utils/constants";
import { clonePreScreeningSuggestions } from "./defaultPreScreeningSuggestions";

type UseDefaultPipelineSettingsOptions = {
  orgID?: string | null;
  projectID?: string | null;
  isAdminRole?: boolean;
  loadErrorMessage?: string;
  pipelineSaveErrorMessage?: string;
  pipelineSaveSuccessMessage?: string;
  preScreeningSaveErrorMessage?: string;
  preScreeningSaveSuccessMessage?: string;
  adminRequiredErrorMessage?: string;
};

const clonePipeline = (pipeline: any[]) => normalizePipeline(JSON.parse(JSON.stringify(pipeline || [])));
const cloneDefaultPipeline = () => clonePipeline(DEFAULT_JOB_PIPELINE);
const cloneEmptyPreScreeningSuggestions = () => [] as any[];

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isDeepEqual = (left: any, right: any): boolean => {
  if (left === right) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (!isDeepEqual(left[index], right[index])) {
        return false;
      }
    }

    return true;
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(right, key)) {
        return false;
      }

      if (!isDeepEqual(left[key], right[key])) {
        return false;
      }
    }

    return true;
  }

  return false;
};

export function useDefaultPipelineSettings({
  orgID,
  projectID,
  isAdminRole = false,
  loadErrorMessage = "Failed to load default settings",
  pipelineSaveErrorMessage = "Failed to save default pipeline settings",
  pipelineSaveSuccessMessage = "Default pipeline saved",
  preScreeningSaveErrorMessage = "Failed to save default pre-screening settings",
  preScreeningSaveSuccessMessage = "Default pre-screening questions saved",
  adminRequiredErrorMessage = "Only admin and super admin can save default settings",
}: UseDefaultPipelineSettingsOptions) {
  const [jobPipeline, setJobPipeline] = useState<any[]>(cloneDefaultPipeline);
  const [savedPipeline, setSavedPipeline] = useState<any[]>(cloneDefaultPipeline);
  const [preScreeningQuestions, setPreScreeningQuestions] = useState<any[]>(
    cloneEmptyPreScreeningSuggestions
  );
  const [savedPreScreeningQuestions, setSavedPreScreeningQuestions] = useState<any[]>(
    cloneEmptyPreScreeningSuggestions
  );
  const [hasResolvedInitialLoad, setHasResolvedInitialLoad] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingPipeline, setIsSavingPipeline] = useState(false);
  const [isSavingPreScreening, setIsSavingPreScreening] = useState(false);

  const hasPipelineChanges = useMemo(
    () => !isDeepEqual(jobPipeline, savedPipeline),
    [jobPipeline, savedPipeline]
  );

  const hasPreScreeningChanges = useMemo(
    () => !isDeepEqual(preScreeningQuestions, savedPreScreeningQuestions),
    [preScreeningQuestions, savedPreScreeningQuestions]
  );

  const hasChanges = useMemo(
    () => hasPipelineChanges || hasPreScreeningChanges,
    [hasPipelineChanges, hasPreScreeningChanges]
  );

  const isSaving = isSavingPipeline || isSavingPreScreening;

  useEffect(() => {
    let isMounted = true;

    const fetchDefaultPipeline = async () => {
      if (!orgID) {
        setHasResolvedInitialLoad(true);
        setIsLoading(false);
        return;
      }

      setHasResolvedInitialLoad(false);
      setIsLoading(true);
      try {
        const response = await api.get("/api/career-settings/default-pipeline", {
          params: {
            orgID,
            ...(projectID ? { projectID } : {}),
          },
        });

        if (!isMounted) {
          return;
        }

        const fetchedPipeline = response.data?.defaultPipelineStages;
        const fetchedPreScreening = response.data?.defaultPreScreeningSuggestions;

        const resolvedPipeline = Array.isArray(fetchedPipeline)
          ? clonePipeline(fetchedPipeline)
          : cloneDefaultPipeline();
        const resolvedPreScreening = Array.isArray(fetchedPreScreening)
          ? clonePreScreeningSuggestions(fetchedPreScreening)
          : cloneEmptyPreScreeningSuggestions();

        setSavedPipeline(resolvedPipeline);
        setJobPipeline(clonePipeline(resolvedPipeline));
        setSavedPreScreeningQuestions(resolvedPreScreening);
        setPreScreeningQuestions(clonePreScreeningSuggestions(resolvedPreScreening));
      } catch (error: any) {
        if (!isMounted) {
          return;
        }

        errorToast(error?.response?.data?.error || loadErrorMessage, 1500);
        const fallbackPipeline = cloneDefaultPipeline();
        const fallbackPreScreening = cloneEmptyPreScreeningSuggestions();
        setSavedPipeline(fallbackPipeline);
        setJobPipeline(clonePipeline(fallbackPipeline));
        setSavedPreScreeningQuestions(fallbackPreScreening);
        setPreScreeningQuestions(clonePreScreeningSuggestions(fallbackPreScreening));
      } finally {
        if (isMounted) {
          setHasResolvedInitialLoad(true);
          setIsLoading(false);
        }
      }
    };

    fetchDefaultPipeline();

    return () => {
      isMounted = false;
    };
  }, [orgID, projectID, loadErrorMessage]);

  const handleReset = () => {
    setJobPipeline(clonePipeline(savedPipeline));
    setPreScreeningQuestions(clonePreScreeningSuggestions(savedPreScreeningQuestions));
  };

  const handleResetPipeline = () => {
    setJobPipeline(clonePipeline(savedPipeline));
  };

  const handleResetPreScreening = () => {
    setPreScreeningQuestions(clonePreScreeningSuggestions(savedPreScreeningQuestions));
  };

  const handleSavePipeline = async () => {
    if (!orgID) {
      errorToast("Org ID is required", 1500);
      return;
    }

    if (!isAdminRole) {
      errorToast(adminRequiredErrorMessage, 1800);
      return;
    }

    if (!hasPipelineChanges) {
      return;
    }

    setIsSavingPipeline(true);
    try {
      await api.post("/api/career-settings/default-pipeline", {
        orgID,
        ...(projectID ? { projectID } : {}),
        defaultPipelineStages: jobPipeline,
      });

      const nextSavedPipeline = clonePipeline(jobPipeline);
      setSavedPipeline(nextSavedPipeline);
      setJobPipeline(clonePipeline(nextSavedPipeline));
      successToast(pipelineSaveSuccessMessage, 1200);
    } catch (error: any) {
      errorToast(error?.response?.data?.error || pipelineSaveErrorMessage, 1800);
    } finally {
      setIsSavingPipeline(false);
    }
  };

  const handleSavePreScreening = async () => {
    if (!orgID) {
      errorToast("Org ID is required", 1500);
      return;
    }

    if (!isAdminRole) {
      errorToast(adminRequiredErrorMessage, 1800);
      return;
    }

    if (!hasPreScreeningChanges) {
      return;
    }

    setIsSavingPreScreening(true);
    try {
      await api.post("/api/career-settings/default-pipeline", {
        orgID,
        ...(projectID ? { projectID } : {}),
        defaultPreScreeningSuggestions: preScreeningQuestions,
      });

      const nextSavedPreScreening = clonePreScreeningSuggestions(preScreeningQuestions);
      setSavedPreScreeningQuestions(nextSavedPreScreening);
      setPreScreeningQuestions(clonePreScreeningSuggestions(nextSavedPreScreening));
      successToast(preScreeningSaveSuccessMessage, 1200);
    } catch (error: any) {
      errorToast(error?.response?.data?.error || preScreeningSaveErrorMessage, 1800);
    } finally {
      setIsSavingPreScreening(false);
    }
  };

  return {
    jobPipeline,
    setJobPipeline,
    preScreeningQuestions,
    setPreScreeningQuestions,
    isLoading,
    isSaving,
    isSavingPipeline,
    isSavingPreScreening,
    hasResolvedInitialLoad,
    hasPipelineChanges,
    hasPreScreeningChanges,
    hasChanges,
    handleResetPipeline,
    handleResetPreScreening,
    handleSavePipeline,
    handleSavePreScreening,
    handleReset,
  };
}
