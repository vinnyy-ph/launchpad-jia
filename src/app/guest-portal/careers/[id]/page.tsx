"use client";

import React from "react";
import { useParams } from "next/navigation";
import { GuestPortalContainer } from "@/lib/components/GuestPortalComponents";
import ViewCareer from "@/lib/components/GuestPortalComponents/Careers/ViewCareer";
import { useCareerById } from "@/lib/components/GuestPortalComponents/Careers/useGuestCareersData";
import SkeletonViewCareer from "@/lib/components/GuestPortalComponents/Careers/ViewCareer/SkeletonViewCareer";
import Link from "next/link";
import { useGuestOrg } from "@/lib/context/GuestOrgContext";

export default function CareerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { orgId, buildUrl } = useGuestOrg();
  const { data: item, isLoading, error } = useCareerById(id, orgId);

  if (isLoading) {
    return (
      <GuestPortalContainer activeTab="careers" hideHeaderControls>
        <SkeletonViewCareer />
      </GuestPortalContainer>
    );
  }

  if (error || !item) {
    return (
      <GuestPortalContainer activeTab="careers">
        <div
          style={{
            border: "1px solid #EAECF0",
            borderRadius: 16,
            padding: "16px 24px",
            background: "#fff",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Career not found</h2>
          <p style={{ color: "#667085", marginTop: 0 }}>
            The career you are looking for does not exist or may have been removed.
          </p>
          <Link href={buildUrl("/guest-portal/careers")} style={{ color: "#344054", textDecoration: "none", fontWeight: 500 }}>
            ← Back to careers
          </Link>
        </div>
      </GuestPortalContainer>
    );
  }

  return (
    <GuestPortalContainer activeTab="careers" hideHeaderControls>
      <ViewCareer item={item} />
    </GuestPortalContainer>
  );
}
