import { useState, useEffect, useCallback } from 'react';
import { getAuth } from 'firebase/auth';

type ItemType = 'career' | 'requisition';

interface UseNewItemsOptions {
  itemType: ItemType;
  itemIds: string[];
  enabled?: boolean;
}

interface UseNewItemsReturn {
  newItems: Set<string>;
  isLoading: boolean;
  markAsSeen: (itemIds: string[]) => Promise<void>;
  checkNewItems: () => Promise<void>;
}

// Hook to check which items are "new" (unseen) for the current user
// and mark items as seen when the user views them
export function useNewItems({
  itemType,
  itemIds,
  enabled = true,
}: UseNewItemsOptions): UseNewItemsReturn {
  const [newItems, setNewItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Check which items are new
  const checkNewItems = useCallback(async () => {
    if (!enabled || itemIds.length === 0) {
      setNewItems(new Set());
      return;
    }

    setIsLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setNewItems(new Set());
        return;
      }

      const token = await user.getIdToken();
      const itemIdsStr = itemIds.join(',');

      const response = await fetch(
        `/api/seen-items/check-new?itemType=${itemType}&itemIds=${itemIdsStr}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setNewItems(new Set(data.newItems || []));
      } else {
        console.error('Failed to check new items:', await response.text());
        setNewItems(new Set());
      }
    } catch (error) {
      console.error('Error checking new items:', error);
      setNewItems(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [itemType, itemIds, enabled]);

  const markAsSeen = useCallback(
    async (idsToMark: string[]) => {
      if (idsToMark.length === 0) return;

      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (!user) return;

        const token = await user.getIdToken();

        const response = await fetch('/api/seen-items/mark-seen', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            itemType,
            itemIds: idsToMark,
          }),
        });

        if (response.ok) {
          setNewItems((prev) => {
            const updated = new Set(prev);
            idsToMark.forEach((id) => updated.delete(id));
            return updated;
          });
        } else {
          console.error('Failed to mark items as seen:', await response.text());
        }
      } catch (error) {
        console.error('Error marking items as seen:', error);
      }
    },
    [itemType]
  );

  useEffect(() => {
    checkNewItems();
  }, [checkNewItems]);

  // Listen for tab-activated event to auto-mark items as seen
  useEffect(() => {
    const handleTabActivated = async (event: CustomEvent) => {
      const tabName = event.detail?.tabName;
      const expectedTab = itemType === 'career' ? 'careers' : 'requisitions';

      if (tabName === expectedTab && newItems.size > 0) {
        await markAsSeen(Array.from(newItems));
      }
    };

    window.addEventListener('tab-activated', handleTabActivated as EventListener);
    return () => window.removeEventListener('tab-activated', handleTabActivated as EventListener);
  }, [itemType, newItems, markAsSeen]);

  return {
    newItems,
    isLoading,
    markAsSeen,
    checkNewItems,
  };
}