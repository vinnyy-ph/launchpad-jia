"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function RequisitionsGuestPortalPage() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get("orgId");

  useEffect(() => {
    // Redirect to new guest-portal route
    if (orgId) {
      window.location.href = `/guest-portal/requisitions?orgId=${orgId}`;
    } else {
      // Let GuestAuthGuard handle the orgId resolution
      window.location.href = "/guest-portal/requisitions";
    }
  }, [orgId]);

  return (
    <div className="auth-guard">
      <h1>
        <i className="la la-circle-notch spin la-2x text-primary"></i>
      </h1>
    </div>
  );
}
