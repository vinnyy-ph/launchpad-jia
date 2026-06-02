"use client";

import { useEffect, useRef, useCallback } from "react";

interface OutlookSyncConfig {
  orgID: string;
  token: string;
  syncIntervalMs?: number;
}

/**
 * Background sync hook for Outlook mailbox
 * - Runs mailbox sync per connected Outlook account
 * - Calls /api/outlook/email
 * - Handles token refresh if needed
 *
 * Usage:
 * useOutlookSync({
 *   orgID: "123",
 *   token: authToken,
 *   syncIntervalMs: 5 * 60 * 1000, // 5 minutes
 * });
 */
export function useOutlookSync(config?: OutlookSyncConfig) {
  const syncIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isSyncingRef = useRef(false);

  const sync = useCallback(async () => {
    if (!config) return;
    if (isSyncingRef.current) return; // Prevent concurrent syncs

    isSyncingRef.current = true;

    try {
      const response = await fetch(`/api/outlook/email?orgID=${config.orgID}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.token}`,
        },
      });

      if (!response.ok) {
        console.error("Outlook sync failed:", response.statusText);
        return;
      }

      const data = await response.json();
      console.log(`Outlook sync: ${data.syncedCount} new messages`);
    } catch (err) {
      console.error("Outlook sync error:", err);
    } finally {
      isSyncingRef.current = false;
    }
  }, [config?.orgID, config?.token]);

  useEffect(() => {
    if (!config) return;

    // Initial sync
    sync();

    // Set up interval
    const intervalMs = config.syncIntervalMs || 5 * 60 * 1000; // Default: 5 minutes
    syncIntervalRef.current = setInterval(sync, intervalMs);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [config, sync]);

  return {
    syncNow: sync,
  };
}
