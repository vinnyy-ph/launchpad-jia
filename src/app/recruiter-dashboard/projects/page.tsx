"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import ProjectsModule from "@/lib/components/ProjectsComponents/ProjectsModule";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";

export default function () {
  const [activeOrg] = useLocalStorage("activeOrg", null);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && activeOrg && !activeOrg.projectsEnabled) {
      const orgID = searchParams.get("orgID");
      router.replace(`/recruiter-dashboard${orgID ? `?orgID=${orgID}` : ""}`);
    }
  }, [isMounted, activeOrg, router, searchParams]);

  if (!isMounted) {
    return null;
  }

  if (!activeOrg || !activeOrg.projectsEnabled) {
    return null;
  }

  return (
    <>
      <HeaderBar
        activeLink="Projects"
        currentPage="Overview"
        icon="la la-folder"
      />
      <ProjectsModule />
    </>
  );
}
