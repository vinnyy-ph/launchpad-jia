// Push Notifications Hook
// Handles Web Push API subscription management

import { useState, useEffect, useCallback } from 'react';
import { registerServiceWorker } from '@/lib/utils/serviceWorkerRegistration';
import { api } from '@/lib/utils/apiClient';

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    const checkSubscription = async () => {
      if (typeof window === 'undefined') return;
      if (!('serviceWorker' in navigator)) return;
      if (!('PushManager' in window)) return;

      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          setIsSubscribed(false);
          return;
        }

        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (err) {
        console.error('Error checking subscription status:', err);
        setIsSubscribed(false);
      }
    };

    checkSubscription();
  }, []);

  const subscribe = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_CLIENT;
      if (!publicKey) {
        throw new Error('VAPID public key not configured. Check NEXT_PUBLIC_VAPID_CLIENT in .env');
      }

      // Check browser support
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service workers not supported in this browser');
      }
      if (!('PushManager' in window)) {
        throw new Error('Push notifications not supported in this browser');
      }

      const registration = await registerServiceWorker();
      if (!registration) {
        throw new Error('Service worker registration failed');
      }

      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await api.post('/api/push/subscribe', {
          subscription: existingSubscription.toJSON(),
          userAgent: navigator.userAgent,
        });
        setIsSubscribed(true);
        setIsLoading(false);
        return { success: true, reason: 'granted' };
      }

      // Check current permission - only request if not already determined
      let perm = Notification.permission;
      if (perm === 'default') {
        perm = await Notification.requestPermission();
      }
      setPermission(perm);

      // Handle different permission results
      if (perm === 'denied') {
        // User explicitly denied - don't throw, just return result
        setIsLoading(false);
        return { success: false, reason: 'denied' };
      }

      if (perm === 'default') {
        // User dismissed dialog without choosing - don't throw, just return result
        setIsLoading(false);
        return { success: false, reason: 'dismissed' };
      }

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      // Save subscription to backend
      await api.post('/api/push/subscribe', {
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
      });

      setIsSubscribed(true);
      setIsLoading(false);
      return { success: true, reason: 'granted' };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      setError(errorMessage);
      setIsLoading(false);
      return { success: false, reason: 'error', error: errorMessage };
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        setIsLoading(false);
        return;
      }

      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setIsLoading(false);
        return;
      }

      await subscription.unsubscribe();

      await api.post('/api/push/unsubscribe', {
        endpoint: subscription.endpoint,
      });

      setIsSubscribed(false);
      setIsLoading(false);
    } catch (error: any) {
      setError(error.message);
      setIsLoading(false);
    }
  }, []);

  return {
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  };
}

// Convert VAPID key to Uint8Array
// Required format for pushManager.subscribe()
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
