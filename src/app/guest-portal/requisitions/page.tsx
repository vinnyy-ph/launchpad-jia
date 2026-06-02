"use client";

import React from "react";
import { RequisitionsGuestPortal } from "@/lib/components/GuestPortalComponents";
import { useGuestOrg } from "@/lib/context/GuestOrgContext";

export default function RequisitionsGuestPortalPage() {
  const { orgId } = useGuestOrg();
  
  return <RequisitionsGuestPortal orgId={orgId} />;
}
