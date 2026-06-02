import { useEffect, useState } from "react";
import { api } from "@/lib/utils/apiClient";

export interface LocationSuggestion {
  name: string;
  count: number;
  region?: string;
}

export interface LocationSuggestionsData {
  locations: LocationSuggestion[];
}

/**
 * Fetch location suggestions from MongoDB (all org candidates) with debounce.
 */
export function useLocationSuggestions(
  orgID: string | null,
  query: string,
  debounceMs: number = 300,
): {
  data: LocationSuggestionsData;
  isLoading: boolean;
  error: Error | null;
} {
  const [data, setData] = useState<LocationSuggestionsData>({ locations: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!orgID || !query || query.trim().length < 2) {
      setData({ locations: [] });
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await api.get("/api/search-location-suggestions", {
          params: {
            orgID,
            q: query.trim(),
          },
        });

        if (!isActive) return;

        setData({
          locations: response.data?.locations || [],
        });
      } catch (err: any) {
        if (!isActive) return;
        console.error("Error fetching location suggestions:", err);
        setError(err);
        setData({ locations: [] });
      } finally {
        if (isActive) setIsLoading(false);
      }
    }, debounceMs);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [orgID, query, debounceMs]);

  return { data, isLoading, error };
}


