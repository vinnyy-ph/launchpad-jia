"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { api } from "@/lib/utils/apiClient";

interface ErrorEntry {
  _id: string;
  name: string;
  interviewID: string;
  logDate: string;
  createdAt: string;
  count: number;
  err?: any;
  errCode?: string;
  errTrace?: string;
  [key: string]: any;
}

interface ErrorStats {
  totalErrors: number;
  uniqueErrorTypes: number;
  errorTypeStats: Array<{
    name: string;
    count: number;
    uniqueOccurrences: number;
    percentage: string;
  }>;
  errorCountByDate: Array<{
    _id: string;
    count: number;
    logDate?: string;
  }>;
}

interface ErrorDataContextType {
  // Data
  errors: ErrorEntry[];
  stats: ErrorStats | null;
  filteredErrors: ErrorEntry[];
  filteredStats: ErrorStats | null;

  // Loading states
  loading: boolean;
  statsLoading: boolean;

  // Filters
  searchQuery: string;
  errorNameFilter: string;

  // Actions
  setSearchQuery: (query: string) => void;
  setErrorNameFilter: (filter: string) => void;
  clearFilters: () => void;
  refreshData: () => void;
}

const ErrorDataContext = createContext<ErrorDataContextType | undefined>(
  undefined
);

export const useErrorData = () => {
  const context = useContext(ErrorDataContext);
  if (!context) {
    throw new Error("useErrorData must be used within an ErrorDataProvider");
  }
  return context;
};

interface ErrorDataProviderProps {
  children: React.ReactNode;
}

export default function ErrorDataProvider({
  children,
}: ErrorDataProviderProps) {
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorNameFilter, setErrorNameFilter] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch all errors data
  const fetchErrors = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: "1",
        limit: "1000", // Get more data for filtering
      });

      const response = await api.get(`/api/error-tracking?${params}`);
      const result = await response.data;

      if (result.success) {
        setErrors(result.data);
      }
    } catch (error) {
      console.error("Error fetching errors:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch stats data
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const response = await api.get("/api/error-tracking/stats");
      const result = await response.data;

      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Apply filters to errors
  const getFilteredErrors = useCallback(() => {
    let filtered = [...errors];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (error) =>
          error.name?.toLowerCase().includes(query) ||
          error.interviewID?.toLowerCase().includes(query) ||
          error.logDate?.toLowerCase().includes(query)
      );
    }

    // Apply error name filter
    if (errorNameFilter) {
      filtered = filtered.filter((error) => error.name === errorNameFilter);
    }

    return filtered;
  }, [errors, searchQuery, errorNameFilter]);

  // Calculate filtered stats
  const getFilteredStats = useCallback(() => {
    const filteredErrors = getFilteredErrors();

    if (filteredErrors.length === 0) {
      return {
        totalErrors: 0,
        uniqueErrorTypes: 0,
        errorTypeStats: [],
        errorCountByDate: [],
      };
    }

    // Calculate error type stats from filtered data
    const errorTypeMap = new Map();
    const dateMap = new Map();

    filteredErrors.forEach((error) => {
      // Count by error type
      const errorName = error.name || "Unknown";
      if (errorTypeMap.has(errorName)) {
        errorTypeMap.set(
          errorName,
          errorTypeMap.get(errorName) + (error.count || 1)
        );
      } else {
        errorTypeMap.set(errorName, error.count || 1);
      }

      // Count by date
      const dateKey = error.logDate
        ? new Date(error.logDate).toISOString().split("T")[0]
        : new Date(error.createdAt).toISOString().split("T")[0];
      if (dateMap.has(dateKey)) {
        dateMap.set(dateKey, dateMap.get(dateKey) + (error.count || 1));
      } else {
        dateMap.set(dateKey, error.count || 1);
      }
    });

    // Convert to arrays and calculate percentages
    const totalOccurrences = Array.from(errorTypeMap.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    const errorTypeStats = Array.from(errorTypeMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        uniqueOccurrences: 1, // Simplified for filtered data
        percentage:
          totalOccurrences > 0
            ? ((count / totalOccurrences) * 100).toFixed(2)
            : "0.00",
      }))
      .sort((a, b) => b.count - a.count);

    const errorCountByDate = Array.from(dateMap.entries())
      .map(([date, count]) => ({
        _id: date,
        count,
        logDate: date,
      }))
      .sort((a, b) => new Date(a._id).getTime() - new Date(b._id).getTime());

    return {
      totalErrors: filteredErrors.length,
      uniqueErrorTypes: errorTypeMap.size,
      errorTypeStats,
      errorCountByDate,
    };
  }, [getFilteredErrors]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setErrorNameFilter("");
  }, []);

  // Refresh data
  const refreshData = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  // Fetch data on mount and refresh
  useEffect(() => {
    fetchErrors();
    fetchStats();
  }, [fetchErrors, fetchStats, refreshTrigger]);

  const filteredErrors = getFilteredErrors();
  const filteredStats = getFilteredStats();

  const value: ErrorDataContextType = {
    // Data
    errors,
    stats,
    filteredErrors,
    filteredStats,

    // Loading states
    loading,
    statsLoading,

    // Filters
    searchQuery,
    errorNameFilter,

    // Actions
    setSearchQuery,
    setErrorNameFilter,
    clearFilters,
    refreshData,
  };

  return (
    <ErrorDataContext.Provider value={value}>
      {children}
    </ErrorDataContext.Provider>
  );
}
