// Notification Data Hooks using SWR
// Provides data fetching hooks and actions for notifications

import useSWR, { mutate } from 'swr';
import { NotificationDocument } from '@/lib/utils/notificationTypes';
import { useEffect, useState, useRef, useCallback } from 'react';
import { swrFetcher } from '@/lib/swr/config';
import { api } from '@/lib/utils/apiClient';

interface NotificationResponse {
  notifications: NotificationDocument[];
  total: number;
  hasMore: boolean;
}

function getOrgIDFromStorage(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const activeOrg = localStorage.getItem('activeOrg');
  if (activeOrg) {
    try {
      const org = JSON.parse(activeOrg);
      return org._id || org.orgID;
    } catch {}
  }

  const guestOrg = localStorage.getItem('guestOrg');
  if (guestOrg) {
    try {
      const org = JSON.parse(guestOrg);
      return org._id;
    } catch {}
  }

  return undefined;
}

export function useUnreadCount() {
  const orgID = getOrgIDFromStorage();
  const key = orgID ? `/api/notifications/count-unread?orgID=${encodeURIComponent(orgID)}` : null;

  const { data, error, isLoading, mutate: mutateLocal } = useSWR<{ count: number }>(
    key,
    swrFetcher,  // Explicit fetcher with localStorage auth
    {
      revalidateOnFocus: true,    // Override global false
      revalidateOnMount: true,    // Force initial fetch
      fallbackData: { count: 0 }, // Prevent undefined
      onError: (err) => {
        console.error('[useUnreadCount] Fetch failed:', err);
      },
    }
  );

  return {
    unreadCount: data?.count ?? 0,
    isLoading,
    error,
    refresh: mutateLocal,
  };
}

// Hook for fetching notifications list with pagination and optional search
// Use separate instances for different pages
// Works with both recruiter dashboard and guest portal via localStorage
export function useNotifications(page: number = 1, limit: number = 20, searchQuery?: string) {
  const orgID = getOrgIDFromStorage();

  // Build query string with orgID if available
  const key = page > 0 && orgID
    ? searchQuery
      ? `/api/notifications/fetch?page=${page}&limit=${limit}&search=${encodeURIComponent(searchQuery)}&orgID=${encodeURIComponent(orgID)}`
      : `/api/notifications/fetch?page=${page}&limit=${limit}&orgID=${encodeURIComponent(orgID)}`
    : null;

  const { data, error, isLoading, mutate: mutateLocal } = useSWR<NotificationResponse>(
    key,
    swrFetcher,  // Explicit fetcher with localStorage auth
    {
      revalidateOnMount: true,    // Force initial fetch
      revalidateIfStale: true,    // Revalidate stale data
      keepPreviousData: true,     // Smooth pagination
      fallbackData: {             // Prevent undefined
        notifications: [],
        total: 0,
        hasMore: false,
      },
      onError: (err) => {
        console.error('[useNotifications] Fetch failed:', err);
      },
    }
  );

  return {
    notifications: data?.notifications ?? [],
    total: data?.total ?? 0,
    hasMore: data?.hasMore ?? false,
    isLoading,
    error,
    refresh: mutateLocal,
  };
}

// Hook for fetching notification preferences
// Works with both recruiter dashboard and guest portal via localStorage
export function useNotificationPreferences() {
  const orgID = getOrgIDFromStorage();
  const key = orgID ? `/api/notifications/preferences?orgID=${encodeURIComponent(orgID)}` : null;

  const { data, error, isLoading, mutate: mutateLocal } = useSWR<Record<string, boolean>>(
    key,
    swrFetcher,  // Explicit fetcher with localStorage auth
    {
      onError: (err) => {
        console.error('[useNotificationPreferences] Fetch failed:', err);
      },
    }
  );

  return {
    preferences: data ?? {},
    isLoading,
    error,
    refresh: mutateLocal,
  };
}

// Hook for accumulating paginated notifications across multiple pages
// Used by both full page and modal views to eliminate duplicate pagination logic
export function useAccumulatedNotifications(initialLimit: number = 20, searchQuery?: string) {
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<NotificationDocument[]>([]);
  const prevPageRef = useRef(1);
  const prevSearchRef = useRef(searchQuery);

  const { notifications, hasMore, isLoading, error, refresh } = useNotifications(page, initialLimit, searchQuery);

  // Accumulate notifications as pages load and sync updates from SWR cache
  useEffect(() => {
    const prevPage = prevPageRef.current;
    const prevSearch = prevSearchRef.current;

    // Reset accumulated if search query changed
    if (searchQuery !== prevSearch) {
      setAccumulated(notifications);
      setPage(1);
      prevPageRef.current = 1;
      prevSearchRef.current = searchQuery;
      return;
    }

    if (page === 1 && prevPage !== 1) {
      // Reset to page 1 - replace all
      setAccumulated(notifications);
      prevPageRef.current = 1;
    } else if (page > prevPage && notifications.length > 0) {
      // Append new page, dedupe by _id
      setAccumulated((prev) => {
        const existingIds = new Set(prev.map(n => n._id));
        const newNotifications = notifications.filter(n => !existingIds.has(n._id));
        return [...prev, ...newNotifications];
      });
      prevPageRef.current = page;
    } else if (page === 1 && notifications.length > 0 && accumulated.length === 0) {
      // Initial load
      setAccumulated(notifications);
      prevPageRef.current = 1;
    } else if (page === prevPage && notifications.length > 0 && accumulated.length > 0) {
      setAccumulated((prev) => {
        const notificationMap = new Map(notifications.map(n => [n._id, n]));

        return prev.map(existing => {
          const updated = notificationMap.get(existing._id);
          return updated ? updated : existing;
        });
      });
    }
  }, [page, notifications, accumulated.length, searchQuery]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setPage(p => p + 1);
    }
  }, [isLoading, hasMore]);

  const reset = useCallback(() => {
    setPage(1);
    setAccumulated([]);
    prevPageRef.current = 1;
  }, []);

  return {
    notifications: accumulated,
    hasMore,
    isLoading,
    error,
    loadMore,
    reset,
    refresh,
    page,
  };
}

// Mark notification as read with optimistic update
// Updates cache immediately for instant UI feedback
export async function markNotificationAsRead(notificationId: string, orgID?: string) {
  if (typeof window === 'undefined') return;

  // Optimistic update: update cache immediately
  mutate(
    (key: string) => typeof key === 'string' && key.startsWith('/api/notifications/fetch'),
    (data: NotificationResponse | undefined) => {
      if (!data) return data;

      return {
        ...data,
        notifications: data.notifications.map((n) =>
          n._id === notificationId ? { ...n, isRead: true } : n
        ),
      };
    },
    { revalidate: false }
  );

  // Also update unread count optimistically
  mutate(
    (key: string) => typeof key === 'string' && key.startsWith('/api/notifications/count-unread'),
    (data: { count: number } | undefined) => {
      if (!data) return data;
      return { count: Math.max(0, data.count - 1) };
    },
    { revalidate: false }
  );

  // Make API call
  try {
    await api.post('/api/notifications/mark-read', { notificationId, orgID });
    // Success - optimistic update is already applied
  } catch (error) {
    // On error, refresh to restore correct state
    refreshNotificationCache();
  }
}

// Mark all notifications as read with optimistic update
export async function markAllNotificationsAsRead(orgID?: string) {
  if (typeof window === 'undefined') return;

  // Optimistic update
  mutate(
    (key: string) => typeof key === 'string' && key.startsWith('/api/notifications/fetch'),
    (data: NotificationResponse | undefined) => {
      if (!data) return data;

      return {
        ...data,
        notifications: data.notifications.map((n) => ({ ...n, isRead: true })),
      };
    },
    { revalidate: false }
  );

  mutate(
    (key: string) => typeof key === 'string' && key.startsWith('/api/notifications/count-unread'),
    { count: 0 },
    { revalidate: false }
  );

  try {
    await api.post('/api/notifications/mark-all-read', { orgID });
    // Success - optimistic update is already applied
  } catch (error) {
    // On error, refresh to restore correct state
    refreshNotificationCache();
  }
}

// Centralized function to refresh all notification caches
// Called by service worker listeners, mark-as-read error handlers, etc.
export function refreshNotificationCache() {
  // Revalidate unread count
  mutate(
    (key: string) => typeof key === 'string' && key.startsWith('/api/notifications/count-unread'),
    undefined,
    { revalidate: true }
  );

  // Revalidate all notification list pages
  mutate(
    (key: string) => typeof key === 'string' && key.startsWith('/api/notifications/fetch'),
    undefined,
    { revalidate: true }
  );
}
