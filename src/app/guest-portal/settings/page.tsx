"use client";

import { Suspense } from 'react';
import GuestNotificationSettings from '@/lib/components/GuestPortalComponents/Settings/GuestNotificationSettings';

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    }>
      <GuestNotificationSettings />
    </Suspense>
  );
}
