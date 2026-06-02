import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useDebounce from "@/lib/hooks/useDebounceHook";
import { errorToast } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient";
import {
  FILTER_SORT_DEFAULTS_SCREENS,
  hydrateCareersFromIds,
  hydrateMembersFromIds,
  hydrateProjectsFromIds,
  sanitizeRecruiterDashboardDefaultsState,
  recruiterDashboardUiStateToDefaults,
} from "@/lib/utils/filterSortDefaults";

interface UseRecruiterDashboardViewPreferencesParams {
  orgID: string | null;
  selectedDateFilter: any;
  filterOptions: any;
  setSelectedDateFilter: (value: any) => void;
  setFilterOptions: (value: any) => void;
}

export function useRecruiterDashboardViewPreferences({
  orgID,
  selectedDateFilter,
  filterOptions,
  setSelectedDateFilter,
  setFilterOptions,
}: UseRecruiterDashboardViewPreferencesParams) {
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
            screen: FILTER_SORT_DEFAULTS_SCREENS.recruiterDashboard,
          },
        });

        if (response.data?.defaults) {
          hasSavedDefaults = true;
          savedDefaultsState = sanitizeRecruiterDashboardDefaultsState(response.data.defaults);
        }
      } catch (error) {
        console.error("Error loading recruiter dashboard defaults:", error);
      }

      const resolvedState = sanitizeRecruiterDashboardDefaultsState(savedDefaultsState);

      let careers: any[] = [];
      let projects: any[] = [];
      let jobOwners: any[] = [];
      let contributors: any[] = [];
      let hiringManagers: any[] = [];

      if (hasSavedDefaults) {
        try {
          const [careersResponse, projectsResponse, jobOwnersResponse, contributorsResponse, hiringManagersResponse] = await Promise.all([
            api.post("/api/fetch-careers", { orgID }),
            api.post("/api/projects/list", {
              orgID,
              search: "",
            }),
            api.get("/api/get-job-members", {
              params: { orgID, memberRole: "Job Owner" },
            }),
            api.get("/api/get-job-members", {
              params: { orgID, memberRole: "Contributor" },
            }),
            api.get("/api/get-job-members", {
              params: { orgID, memberRole: "Hiring Manager" },
            }),
          ]);
          careers = careersResponse.data || [];
          projects = projectsResponse.data?.projects || [];
          jobOwners = jobOwnersResponse.data || [];
          contributors = contributorsResponse.data || [];
          hiringManagers = hiringManagersResponse.data || [];
        } catch (error) {
          console.error("Error loading dashboard filter lookup data:", error);
        }
      }

      if (isCancelled) {
        return;
      }

      const hydratedFilters = {
        careers: hydrateCareersFromIds(
          resolvedState.filters.careers,
          careers
        ),
        projects: hydrateProjectsFromIds(
          resolvedState.filters.projects,
          projects
        ),
        jobOwners: hydrateMembersFromIds(
          resolvedState.filters.jobOwners,
          jobOwners,
          "Selected job owner"
        ),
        contributors: hydrateMembersFromIds(
          resolvedState.filters.contributors,
          contributors,
          "Selected contributor"
        ),
        hiringManagers: hydrateMembersFromIds(
          resolvedState.filters.hiringManagers,
          hiringManagers,
          "Selected hiring manager"
        ),
      };

      setSelectedDateFilter({
        type: resolvedState.dateFilter.type,
        startDate:
          resolvedState.dateFilter.type === "Custom" && resolvedState.dateFilter.startDate
            ? new Date(`${resolvedState.dateFilter.startDate}T00:00:00.000`)
            : null,
        endDate:
          resolvedState.dateFilter.type === "Custom" && resolvedState.dateFilter.endDate
            ? new Date(`${resolvedState.dateFilter.endDate}T23:59:59.999`)
            : null,
      });
      setFilterOptions(hydratedFilters);
      setIsSetAsDefault(hasSavedDefaults);
      lastSavedDefaultsRef.current = hasSavedDefaults
        ? JSON.stringify(resolvedState)
        : "";

      initializedForOrgRef.current = orgID;
      setIsViewStateReady(true);
    };

    initializeViewState();

    return () => {
      isCancelled = true;
    };
  }, [orgID]);

  const defaultsForPersistence = useMemo(
    () =>
      recruiterDashboardUiStateToDefaults({
        dateFilter: selectedDateFilter,
        filterOptions,
      }),
    [selectedDateFilter, filterOptions]
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
        screen: FILTER_SORT_DEFAULTS_SCREENS.recruiterDashboard,
        defaults,
      }, signal ? { signal } : {});
      if (signal?.aborted) return;
      lastSavedDefaultsRef.current = JSON.stringify(defaults);
    } catch (error) {
      if (signal?.aborted) return;
      console.error("Error saving recruiter dashboard defaults:", error);
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
            screen: FILTER_SORT_DEFAULTS_SCREENS.recruiterDashboard,
          },
        });
        lastSavedDefaultsRef.current = "";
      }
    } catch (error) {
      console.error("Error updating recruiter dashboard defaults:", error);
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
        const defaults = sanitizeRecruiterDashboardDefaultsState(
          JSON.parse(debouncedDefaultsForPersistence)
        );
        await persistDefaultsInBackground(defaults, true, abortController.signal);
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error("Error auto-saving recruiter dashboard defaults:", error);
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
