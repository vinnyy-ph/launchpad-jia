'use client';

import { useEffect } from 'react';
import { useNotifications } from '@/lib/context/NotificationContext';
import { errorToast } from '@/lib/Utils';

// Component that auto-prompts for notification permission once per session
// Shows the native browser permission dialog on first visit to /recruiter-dashboard
export default function NotificationAutoPrompt() {
  const { subscribeToPush } = useNotifications();

  useEffect(() => {
    const hasPromptedThisSession = sessionStorage.getItem('notificationPromptShown');

    // Only prompt if haven't prompted this session, browser supports notifications, and permission is still at default (not granted or denied)
    if (!hasPromptedThisSession && 'Notification' in window && Notification.permission === 'default') {
      // Mark as prompted immediately to avoid duplicate prompts
      sessionStorage.setItem('notificationPromptShown', 'true');
      setTimeout(() => {
        handleAutoPrompt();
      }, 1000);
    }
  }, [subscribeToPush]);

  const handleAutoPrompt = async () => {
    try {
      await subscribeToPush();
    } catch (error) {
      errorToast('Failed to show notification auto-prompt', 1200);
    }
  };

  // This component doesn't render anything - it just triggers the prompt
  return null;
}
