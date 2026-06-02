import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useDebounce from "@/lib/hooks/useDebounceHook";
import { errorToast } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient";
import {
  FILTER_SORT_DEFAULTS_SCREENS,
  careersUiStateToDefaults,
  hydrateMembersFromIds,
  hydrateProjectsFromIds,
  sanitizeCareersDefaultsState,
} from "@/lib/utils/filterSortDefaults";

interface UseCareersViewPreferencesParams {
  orgID: string | null;
  userEmail?: string | null;
  search: string;
  sortBy: string;
  filterStatus: any;
  sortByOptions: Record<string, { key: string | null; direction: string }>;
  setSearch: (value: string) => void;
  setSortBy: (value: string) => void;
  setSortConfig: (value: { key: string | null; direction: string }) => void;
  setFilterStatus: (value: any) => void;
}

export function useCareersViewPreferences({
  orgID,
  userEmail,
  search,
  sortBy,
  filterStatus,
  sortByOptions,
  setSearch,
  setSortBy,
  setSortConfig,
  setFilterStatus,
}: UseCareersViewPreferencesParams) {
  const [isViewStateReady, setIsViewStateReady] = useState(false);
  const [isSetAsDefault, setIsSetAsDefault] = useState(false);
  const [isSetAsDefaultLoading, setIsSetAsDefaultLoading] = useState(false);
  const lastSavedDefaultsRef = useRef("");
  const initializedForOrgRef = useRef<string | null>(null);
  const autoSaveAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const initializeViewState = async () => {
      if (!orgID || !userEmail) {
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
            screen: FILTER_SORT_DEFAULTS_SCREENS.careers,
          },
        });

        if (response.data?.defaults) {
          hasSavedDefaults = true;
          savedDefaultsState = sanitizeCareersDefaultsState(response.data.defaults);
        }
      } catch (error) {
        console.error("Error loading careers defaults:", error);
      }

      const resolvedState = sanitizeCareersDefaultsState(savedDefaultsState);

      let jobOwners: any[] = [];
      let contributors: any[] = [];
      let projects: any[] = [];
      let hiringManagers: any[] = [];

      if (hasSavedDefaults) {
        try {
          const [jobOwnersResponse, contributorsResponse, projectsResponse, hiringManagersResponse] = await Promise.all([
            api.get("/api/get-job-members", {
              params: { orgID, memberRole: "Job Owner" },
            }),
            api.get("/api/get-job-members", {
              params: { orgID, memberRole: "Contributor" },
            }),
            api.post("/api/projects/list", {
              orgID,
              search: "",
            }),
            api.get("/api/get-job-members", {
              params: { orgID, memberRole: "Hiring Manager" },
            }),
          ]);
          jobOwners = jobOwnersResponse.data || [];
          contributors = contributorsResponse.data || [];
          projects = projectsResponse.data?.projects || [];
          hiringManagers = hiringManagersResponse.data || [];
        } catch (error) {
          console.error("Error loading careers filter lookup data:", error);
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
        projects: hydrateProjectsFromIds(
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
        hiringManagers: hydrateMembersFromIds(
          resolvedState.filters.hiringManagers,
          hiringManagers,
          "Selected hiring manager"
        ),
      };

      const resolvedStateForPersistence = sanitizeCareersDefaultsState({
        ...resolvedState,
        page: 1,
      });

      setSearch(resolvedState.search);
      setSortBy(resolvedState.sortBy);
      setSortConfig({
        key: sortByOptions[resolvedState.sortBy]?.key ?? null,
        direction: sortByOptions[resolvedState.sortBy]?.direction ?? "ascending",
      });
      setFilterStatus(hydratedFilterStatus as any);
      setIsSetAsDefault(hasSavedDefaults);
      lastSavedDefaultsRef.current = hasSavedDefaults
        ? JSON.stringify(resolvedStateForPersistence)
        : "";

      initializedForOrgRef.current = orgID;
      setIsViewStateReady(true);
    };

    initializeViewState();

    return () => {
      isCancelled = true;
    };
  }, [orgID, userEmail]);

  const defaultsForPersistence = useMemo(
    () =>
      careersUiStateToDefaults({
        search,
        sortBy,
        page: 1,
        filterStatus,
      }),
    [search, sortBy, filterStatus]
  );
  const debouncedDefaultsForPersistence = useDebounce(
    JSON.stringify(defaultsForPersistence),
    800
  );

  const persistDefaultsInBackground = useCallback(
    async (defaults: any, silent = true, signal?: AbortSignal) => {
      if (!orgID || !userEmail) {
        return;
      }
      try {
        await api.put("/api/filter-sort-defaults", {
          orgID,
          screen: FILTER_SORT_DEFAULTS_SCREENS.careers,
          defaults,
        }, signal ? { signal } : {});
        if (signal?.aborted) return;
        lastSavedDefaultsRef.current = JSON.stringify(defaults);
      } catch (error) {
        if (signal?.aborted) return;
        console.error("Error saving careers defaults:", error);
        if (!silent) {
          errorToast("Failed to update default filters", 1300);
        }
        throw error;
      }
    },
    [orgID, userEmail]
  );

  const handleSetAsDefaultChange = useCallback(async (checked: boolean) => {
    if (!orgID || !userEmail) {
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
            screen: FILTER_SORT_DEFAULTS_SCREENS.careers,
          },
        });
        lastSavedDefaultsRef.current = "";
      }
    } catch (error) {
      console.error("Error updating careers defaults:", error);
      if (!checked) {
        errorToast("Failed to update default filters", 1300);
      }
      setIsSetAsDefault(previousValue);
    } finally {
      setIsSetAsDefaultLoading(false);
    }
  }, [orgID, userEmail, isSetAsDefault, defaultsForPersistence, persistDefaultsInBackground]);

  useEffect(() => {
    if (!isViewStateReady || !isSetAsDefault || !orgID || !userEmail) {
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
        const defaults = sanitizeCareersDefaultsState(
          JSON.parse(debouncedDefaultsForPersistence)
        );
        await persistDefaultsInBackground(defaults, true, abortController.signal);
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error("Error auto-saving careers defaults:", error);
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
    isViewStateReady,
    isSetAsDefault,
    orgID,
    userEmail,
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
