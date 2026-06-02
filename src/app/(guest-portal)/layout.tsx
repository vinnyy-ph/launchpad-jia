"use client";

import React from "react";
import GuestPortalHeader from "@/lib/components/GuestPortalComponents/GuestPortalHeader";
import GuestAuthGuard from "@/lib/components/AuthGuard/GuestAuthGuard";
import styles from "@/lib/styles/guestPortal/layout.module.scss";

export default function GuestPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GuestAuthGuard />
      <main className={styles.mainContainer}>
        <GuestPortalHeader />
        <div className={styles.contentWrapper}>
          {children}
        </div>
      </main>
    </>
  );
}

