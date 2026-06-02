'use client';

// Notification Context
// Provides UI state management and push subscription actions
// Data fetching is handled by SWR hooks in components

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { usePushNotifications } from '@/lib/hooks/usePushNotifications';
import { refreshNotificationCache } from '@/lib/hooks/useNotificationData';
import { registerServiceWorker } from '@/lib/utils/serviceWorkerRegistration';
import { getAuth } from 'firebase/auth';

interface NotificationContextType {
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  subscribeToPush: () => Promise<{ success: boolean; reason: string; error?: string }>;
  unsubscribeFromPush: () => Promise<void>;
  isPushEnabled: boolean;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { subscribe, unsubscribe, isSubscribed } = usePushNotifications();
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Register service worker on mount (even if permission not granted yet)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      registerServiceWorker();
    }
  }, []);

  // Wait for Firebase auth to be ready
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setIsAuthReady(true);
      } else {
        setIsAuthReady(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Listen for service worker messages (push received while app is open)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'PUSH_RECEIVED') {
          refreshNotificationCache();
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, []);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const subscribeToPush = useCallback(async () => {
    return subscribe();
  }, [subscribe]);

  const unsubscribeFromPush = useCallback(async () => {
    return unsubscribe();
  }, [unsubscribe]);

  const value: NotificationContextType = {
    isModalOpen,
    openModal,
    closeModal,
    subscribeToPush,
    unsubscribeFromPush,
    isPushEnabled: isSubscribed,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// Custom hook to use notification context
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
