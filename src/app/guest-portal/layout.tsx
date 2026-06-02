"use client";

import React, { Suspense } from "react";
import GuestPortalHeader from "@/lib/components/GuestPortalComponents/GuestPortalHeader";
import GuestAuthGuard from "@/lib/components/AuthGuard/GuestAuthGuard";
import { GuestOrgProvider } from "@/lib/context/GuestOrgContext";
import { NotificationProvider } from "@/lib/context/NotificationContext";
import styles from "@/lib/styles/guestPortal/layout.module.scss";

function GuestPortalContent({ children }: { children: React.ReactNode }) {
  return (
    <GuestOrgProvider>
      <NotificationProvider>
        <GuestAuthGuard />
        <main className={styles.mainContainer}>
          <GuestPortalHeader />
          <div className={styles.contentWrapper}>
            {children}
          </div>
        </main>
      </NotificationProvider>
    </GuestOrgProvider>
  );
}

export default function GuestPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="auth-guard">
        <h1>
          <i className="la la-circle-notch spin la-2x text-primary"></i>
        </h1>
      </div>
    }>
      <GuestPortalContent>{children}</GuestPortalContent>
    </Suspense>
  );
}
