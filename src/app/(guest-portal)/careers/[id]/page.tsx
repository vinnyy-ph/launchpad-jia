"use client";

import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

export default function CareerDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const orgId = searchParams.get("orgId");

  useEffect(() => {
    // Redirect to new guest-portal route
    if (orgId) {
      window.location.href = `/guest-portal/careers/${id}?orgId=${orgId}`;
    } else {
      // Let GuestAuthGuard handle the orgId resolution
      window.location.href = `/guest-portal/careers/${id}`;
    }
  }, [id, orgId]);

  return (
    <div className="auth-guard">
      <h1>
        <i className="la la-circle-notch spin la-2x text-primary"></i>
      </h1>
    </div>
  );
}
