"use client";

import React from "react";
import { useParams, useSearchParams } from "next/navigation";
import EditRequisitionPage from "@/lib/components/GuestPortalComponents/Requisitions/EditRequisitions";
import { useGuestOrg } from "@/lib/context/GuestOrgContext";

export default function EditRequisitionRoute() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { orgId } = useGuestOrg();
  const id = params.id as string;
  const mode = searchParams.get("mode") as "view" | "edit" | null;

  return <EditRequisitionPage requisitionId={id} mode={mode || "edit"} orgId={orgId} />;
}
