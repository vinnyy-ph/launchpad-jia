"use client";

import React from "react";
import { CareersGuestPortal } from "@/lib/components/GuestPortalComponents";
import { useGuestOrg } from "@/lib/context/GuestOrgContext";

export default function CareersGuestPortalPage() {
  const { orgId } = useGuestOrg();
  
  return <CareersGuestPortal orgId={orgId} />;
}
