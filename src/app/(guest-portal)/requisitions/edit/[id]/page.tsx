"use client";

import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

export default function EditRequisitionRoute() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const mode = searchParams.get("mode") || "edit";
  const orgId = searchParams.get("orgId");

  useEffect(() => {
    // Build query params
    const queryParams = new URLSearchParams();
    if (orgId) queryParams.set("orgId", orgId);
    queryParams.set("mode", mode);
    
    // Redirect to new guest-portal route
    window.location.href = `/guest-portal/requisitions/edit/${id}?${queryParams.toString()}`;
  }, [id, mode, orgId]);

  return (
    <div className="auth-guard">
      <h1>
        <i className="la la-circle-notch spin la-2x text-primary"></i>
      </h1>
    </div>
  );
}
