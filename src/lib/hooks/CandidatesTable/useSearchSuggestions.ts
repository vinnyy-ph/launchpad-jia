import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/utils/apiClient";

interface SearchSuggestion {
  name: string;
  email?: string;
  count: number;
}

interface SearchSuggestionsData {
  candidates: SearchSuggestion[];
  skills: SearchSuggestion[];
  positions: SearchSuggestion[];
}

/**
 * Custom hook to fetch search suggestions from MongoDB
 * Fetches candidates, skills and positions matching the query with candidate counts
 * Processes all data in MongoDB for the organization, just like Skills filter
 */
export function useSearchSuggestions(
  orgID: string | null,
  query: string,
  debounceMs: number = 300
): {
  data: SearchSuggestionsData;
  isLoading: boolean;
  error: Error | null;
} {
  const [data, setData] = useState<SearchSuggestionsData>({ candidates: [], skills: [], positions: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!orgID || !query || query.trim().length < 2) {
      setData({ candidates: [], skills: [], positions: [] });
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    const timeoutId = setTimeout(async () => {
      try {
        const response = await api.get("/api/search-candidate-suggestions", {
          params: {
            orgID,
            q: query.trim()
          }
        });

        if (!isActive) return;

        if (response.data) {
          setData({
            candidates: response.data.candidates || [],
            skills: response.data.skills || [],
            positions: response.data.positions || []
          });
        }
      } catch (err: any) {
        if (!isActive) return;
        console.error("Error fetching search suggestions:", err);
        setError(err);
        setData({ candidates: [], skills: [], positions: [] });
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [orgID, query, debounceMs]);

  return { data, isLoading, error };
}

