import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useDebounce from "@/lib/hooks/useDebounceHook";
import { errorToast } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient";
import {
  FILTER_SORT_DEFAULTS_SCREENS,
  hydrateCareersFromIds,
  hydrateMembersFromIds,
  hydrateProjectsFromIds,
  pipelineReportUiStateToDefaults,
  sanitizePipelineReportDefaultsState,
} from "@/lib/utils/filterSortDefaults";

interface UsePipelineReportViewPreferencesParams {
  orgID: string | null;
  projectId?: string;
  page: number;
  limit: number;
  filterStatus: any;
  setPage: (value: number) => void;
  setLimit: (value: number) => void;
  setFilterStatus: (value: any) => void;
}

export function usePipelineReportViewPreferences({
  orgID,
  projectId,
  page,
  limit,
  filterStatus,
  setPage,
  setLimit,
  setFilterStatus,
}: UsePipelineReportViewPreferencesParams) {
  const [isViewStateReady, setIsViewStateReady] = useState(false);
  const [isSetAsDefault, setIsSetAsDefault] = useState(false);
  const [isSetAsDefaultLoading, setIsSetAsDefaultLoading] = useState(false);
  const lastSavedDefaultsRef = useRef("");
  const initializedForOrgRef = useRef<string | null>(null);
  const autoSaveAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const initializeViewState = async () => {
      if (!orgID) {
        setIsViewStateReady(false);
        return;
      }

      setIsViewStateReady(false);
      initializedForOrgRef.current = null;
      let savedDefaultsState = null;
      let hasSavedDefaults = false;

      try {
        const response = await api.get("/api/filter-sort-defaults", {
          params: {
            orgID,
            screen: FILTER_SORT_DEFAULTS_SCREENS.pipelineReport,
          },
        });

        if (response.data?.defaults) {
          hasSavedDefaults = true;
          savedDefaultsState = sanitizePipelineReportDefaultsState(response.data.defaults);
        }
      } catch (error) {
        console.error("Error loading pipeline defaults:", error);
      }

      const resolvedState = sanitizePipelineReportDefaultsState(savedDefaultsState);

      let careers: any[] = [];
      let projects: any[] = [];
      let jobOwners: any[] = [];
      let contributors: any[] = [];
      let hiringManagers: any[] = [];

      if (hasSavedDefaults) {
        try {
          const [careersResponse, projectsResponse, jobOwnersResponse, contributorsResponse, hiringManagersResponse] = await Promise.all([
            api.post("/api/fetch-careers", {
              orgID,
              projectId,
            }),
            api.post("/api/projects/list", {
              orgID,
              search: "",
            }),
            api.get("/api/get-job-members", {
              params: { orgID, memberRole: "Job Owner", projectId },
            }),
            api.get("/api/get-job-members", {
              params: { orgID, memberRole: "Contributor", projectId },
            }),
            api.get("/api/get-job-members", {
              params: { orgID, memberRole: "Hiring Manager", projectId },
            }),
          ]);
          careers = careersResponse.data || [];
          projects = projectsResponse.data?.projects || [];
          jobOwners = jobOwnersResponse.data || [];
          contributors = contributorsResponse.data || [];
          hiringManagers = hiringManagersResponse.data || [];
        } catch (error) {
          console.error("Error loading pipeline filter lookup data:", error);
        }
      }

      if (isCancelled) {
        return;
      }

      const hydratedFilterStatus = {
        jobOwners: hydrateMembersFromIds(
          resolvedState.filters.jobOwners,
          jobOwners,
          "Selected job owner"
        ),
        projects: projectId
          ? []
          : hydrateProjectsFromIds(
              resolvedState.filters.projects,
              projects
            ),
        "Published Status": resolvedState.filters.publishedStatus,
        "Activity Status": resolvedState.filters.activityStatus,
        "Subscription Plan": resolvedState.filters.subscriptionPlan,
        contributors: hydrateMembersFromIds(
          resolvedState.filters.contributors,
          contributors,
          "Selected contributor"
        ),
        careers: hydrateCareersFromIds(
          resolvedState.filters.careers,
          careers
        ),
        hiringManagers: hydrateMembersFromIds(
          resolvedState.filters.hiringManagers,
          hiringManagers,
          "Selected hiring manager"
        ),
      };

      setPage(resolvedState.page);
      setLimit(resolvedState.limit);
      setFilterStatus(hydratedFilterStatus as any);
      setIsSetAsDefault(hasSavedDefaults);
      lastSavedDefaultsRef.current = hasSavedDefaults
        ? JSON.stringify(pipelineReportUiStateToDefaults({
            page: 1,
            limit: resolvedState.limit,
            filterStatus: hydratedFilterStatus,
          }))
        : "";

      initializedForOrgRef.current = orgID;
      setIsViewStateReady(true);
    };

    initializeViewState();

    return () => {
      isCancelled = true;
    };
  }, [orgID, projectId]);

  const defaultsForPersistence = useMemo(
    () =>
      pipelineReportUiStateToDefaults({
        page: 1,
        limit,
        filterStatus,
      }),
    [limit, filterStatus]
  );
  const debouncedDefaultsForPersistence = useDebounce(
    JSON.stringify(defaultsForPersistence),
    800
  );

  const persistDefaultsInBackground = useCallback(async (defaults: any, silent = true, signal?: AbortSignal) => {
    if (!orgID) {
      return;
    }

    try {
      await api.put("/api/filter-sort-defaults", {
        orgID,
        screen: FILTER_SORT_DEFAULTS_SCREENS.pipelineReport,
        defaults,
      }, signal ? { signal } : {});
      if (signal?.aborted) return;
      lastSavedDefaultsRef.current = JSON.stringify(defaults);
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Error saving pipeline defaults:", error);
      if (!silent) {
        errorToast("Failed to update default filters", 1300);
      }
      throw error;
    }
  }, [orgID]);

  const handleSetAsDefaultChange = useCallback(async (checked: boolean) => {
    if (!orgID) {
      return;
    }

    const previousValue = isSetAsDefault;
    setIsSetAsDefault(checked);
    setIsSetAsDefaultLoading(true);

    try {
      if (checked) {
        await persistDefaultsInBackground(defaultsForPersistence, false);
      } else {
        autoSaveAbortRef.current?.abort();
        await api.delete("/api/filter-sort-defaults", {
          data: {
            orgID,
            screen: FILTER_SORT_DEFAULTS_SCREENS.pipelineReport,
          },
        });
        lastSavedDefaultsRef.current = "";
      }
    } catch (error) {
      console.error("Error updating pipeline defaults:", error);
      if (!checked) {
        errorToast("Failed to update default filters", 1300);
      }
      setIsSetAsDefault(previousValue);
    } finally {
      setIsSetAsDefaultLoading(false);
    }
  }, [orgID, isSetAsDefault, defaultsForPersistence, persistDefaultsInBackground]);

  useEffect(() => {
    if (!orgID || !isViewStateReady || !isSetAsDefault) {
      return;
    }

    if (orgID !== initializedForOrgRef.current) {
      return;
    }

    if (debouncedDefaultsForPersistence === lastSavedDefaultsRef.current) {
      return;
    }

    if (debouncedDefaultsForPersistence !== JSON.stringify(defaultsForPersistence)) {
      return;
    }

    const abortController = new AbortController();
    autoSaveAbortRef.current = abortController;
    let retryTimeout: ReturnType<typeof setTimeout>;
    const persist = async (retries = 1) => {
      try {
        const defaults = sanitizePipelineReportDefaultsState(
          JSON.parse(debouncedDefaultsForPersistence)
        );
        await persistDefaultsInBackground(defaults, true, abortController.signal);
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error("Error auto-saving pipeline defaults:", error);
          if (retries > 0) {
            await new Promise<void>((r) => { retryTimeout = setTimeout(r, 3000); });
            if (!abortController.signal.aborted) await persist(retries - 1);
          }
        }
      }
    };
    persist();

    return () => {
      abortController.abort();
      clearTimeout(retryTimeout);
    };
  }, [
    orgID,
    isViewStateReady,
    isSetAsDefault,
    debouncedDefaultsForPersistence,
    persistDefaultsInBackground,
  ]);

  return {
    isViewStateReady,
    isSetAsDefault,
    isSetAsDefaultLoading,
    handleSetAsDefaultChange,
  };
}
