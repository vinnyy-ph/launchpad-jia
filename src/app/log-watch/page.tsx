"use client";

import LogWatchPage from "@/lib/components/AdminComponents/LogWatchPage";
import SuperAdminFeature from "@/lib/components/SuperAdminFeature";

export default function Page() {
  return (
    <>
      <SuperAdminFeature>
        <LogWatchPage />
      </SuperAdminFeature>
    </>
  );
}
