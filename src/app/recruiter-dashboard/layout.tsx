"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import AuthGuard from "@/lib/components/AuthGuard/AuthGuard";
import SidebarV2 from "@/lib/PageComponent/SidebarV2";
import { RecruiterContextProvider } from "@/lib/context/RecruiterContext";
import UploadProgressIndicator from "@/lib/components/UploadProgressIndicator/UploadProgressIndicator";
import { UploadProvider } from "@/lib/context/UploadContext";
import { NotificationProvider } from "@/lib/context/NotificationContext";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import NotificationAutoPrompt from "@/lib/components/NotificationComponents/NotificationAutoPrompt";
import { useTabBadges } from "@/lib/hooks/useTabBadges";
import { api } from "@/lib/utils/apiClient";
import { LowCreditBanner } from "@/lib/components/LimitBanner";

export default function Layout({ children }) {
  const [activeLink, setActiveLink] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const [activeOrg] = useLocalStorage("activeOrg", null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Backwards-compatible effective flag:
  // - old orgs might not have guestPortalEnabled saved yet (fallback to projectsEnabled)
  const projectsEnabled = !!activeOrg?.projectsEnabled;
  const requisitionsEnabledEffective =
    typeof activeOrg?.guestPortalEnabled === "boolean"
      ? activeOrg.guestPortalEnabled
      : projectsEnabled;

  // Fetch tab badge counts
  const { counts: badgeCounts, refresh: refreshBadges } = useTabBadges(
    activeOrg?._id || null,
    isMounted
  );

  // Handle tab click to mark as visited and refresh badges
  const handleTabClick = useCallback(
    async (tabName: string) => {
      if (!activeOrg?._id) return;

      try {
        await api.post("/api/tabs/mark-visited", {
          tabName,
          orgID: activeOrg._id,
        });
        refreshBadges();
      } catch (error) {
        console.error("Failed to mark tab as visited:", error);
      }
    },
    [activeOrg?._id, refreshBadges]
  );

  // Redirect away from requisitions routes when disabled (e.g. direct URL navigation)
  useEffect(() => {
    if (!isMounted) return;
    if (!requisitionsEnabledEffective && pathname?.includes("/requisitions")) {
      router.replace("/recruiter-dashboard/careers");
    }
  }, [isMounted, pathname, requisitionsEnabledEffective, router]);

  const navItems = [
    // Hide Dashboard for now
    {
      label: "Dashboard",
      href: "/recruiter-dashboard",
      iconImage: "/dashboard-icon.svg",
    },
    {
      label: "Careers",
      href: "/recruiter-dashboard/careers",
      iconImage: "/careers-icon.svg",
      icon: "la la-suitcase",
      badgeCount: badgeCounts.careers,
    },
    {
      label: "Candidates",
      href: "/recruiter-dashboard/candidates",
      iconImage: "/candidates-icon.svg",
    },
    {
      label: "Tasks",
      href: "/recruiter-dashboard/to-do",
      icon: "la la-cogs",
      iconImage: "/tasks-icon.svg",
    },
    {
      label: "Inbox",
      href: "/recruiter-dashboard/inbox",
      icon: "la la-envelope",
      iconImage: "/inbox-icon.svg",
    },
    // {
    //   label: "Inbox",
    //   href: "/recruiter-dashboard/inbox",
    //   icon: "la la-envelope",
    // },
  ];

  const hiringToolNavItems = [
    ...(isMounted && activeOrg?.projectsEnabled
      ? [
        {
          label: "Projects",
          href: "/recruiter-dashboard/projects",
          icon: "la la-folder",
          iconImage: "/projects-icon.svg",
        },
      ]
      : []),
    ...(isMounted && requisitionsEnabledEffective
      ? [
        {
          label: "Requisitions",
          href: "/recruiter-dashboard/requisitions/employer",
          icon: "la la-file-alt",
          iconImage: "/requisitions-icon.svg",
          badgeCount: badgeCounts.requisitions,
        },
      ]
      : []),
  ];

  const footerNavItems = [
    // {
    //   label: "Email Templates",
    //   href: "/recruiter-dashboard/email-templates",
    //   icon: "la la-envelope-open-text",
    //   iconImage: "/inbox-icon.svg",
    // },
    {
      label: "Email Reminders",
      href: "/recruiter-dashboard/email-automation",
      icon: "la la-cubes",
      iconImage: "/reminders-icon.svg",
    },
    {
      label: "Feedback",
      href: "/recruiter-dashboard/feedback",
      icon: "la la-comments",
      iconImage: "/feedback-icon.svg",
    },
    {
      label: "Members",
      href: "/recruiter-dashboard/members",
      icon: "la la-users",
      iconImage: "/members-icon.svg",
    },
    {
      label: "Settings",
      href: "/recruiter-dashboard/settings",
      icon: "la la-cog",
      iconImage: "/settings-icon.svg",
    },
  ];

  const superAdminNavItems = [
    // {
    //   label: "Inbox",
    //   href: "/recruiter-dashboard/inbox",
    //   icon: "la la-envelope",
    //   iconImage: "/inbox-icon.svg",
    // },
    // {
    //   label: "Inbox",
    //   href: "/recruiter-dashboard/inbox",
    //   icon: "la la-envelope",
    //   iconImage: "/inbox-icon.svg",
    // },
    {
      label: "Scheduled Emails",
      href: "/recruiter-dashboard/scheduled-emails",
      icon: "la la-clock",
      iconImage: "/inbox-icon.svg",
    },
    {
      label: "Log Watch",
      href: "/log-watch",
      icon: "la la-chart-area",
      iconImage: "/settings-icon.svg",
    },
  ];

  // Check active link from the url
  useEffect(() => {
    if (pathname) {
      const applicantLinkSet = [
        ...navItems,
        ...footerNavItems,
        ...superAdminNavItems,
        ...hiringToolNavItems,
      ];

      const pathSplit = pathname.split("/");
      let activeMenu;

      // Check if pathname is a candidate-related route (e.g., email)
      if (pathname.includes("/email") && !pathname.includes("/scheduled-emails")) {
        activeMenu = applicantLinkSet.find((x) => x.label === "Candidates");
      } else if (pathname.includes("/scheduled-emails")) {
        activeMenu = applicantLinkSet.find((x) => x.label === "Scheduled Emails");
      } else if (pathname.includes("/requisitions")) {
        // Handle requisitions routes (e.g., /requisitions/employer, /requisitions/admin)
        activeMenu = applicantLinkSet.find((x) => x.label === "Requisitions");
      } else if (pathSplit.length <= 3) {
        activeMenu = applicantLinkSet.find((x) => x.href === pathname);
      } else if (pathSplit.length > 3) {
        let path = "/" + pathSplit[1] + "/" + pathSplit[2];
        activeMenu = applicantLinkSet.find((x) => x.href === path);
      }

      if (!activeMenu) {
        // Default to careers
        activeMenu = applicantLinkSet.find(
          (x) => x.href === "/recruiter-dashboard/careers"
        );
      }

      setActiveLink(activeMenu?.label ?? "");
    }
  }, [pathname, navItems]);

  const isGlobalSettingsRoute =
    pathname === "/recruiter-dashboard/settings" ||
    pathname.startsWith("/recruiter-dashboard/settings/");
  const isPathnameIncluded = isGlobalSettingsRoute;

  // Show low credit banner only on specific pages
  const showLowCreditBanner =
    isGlobalSettingsRoute ||
    pathname?.includes("/careers/manage");

  return (
    <>
      <AuthGuard />
      <title>JIA | AI-Powered End-to-End Hiring Tool</title>
      <UploadProvider>
        <RecruiterContextProvider refreshTabBadges={refreshBadges}>
          {/* Low Credit Banner - shows at very top on specific pages */}
          {showLowCreditBanner && <LowCreditBanner />}
          <NotificationProvider>
            <SidebarV2
              suppressHydrationWarning={true}
              activeLink={activeLink}
              navItems={navItems}
              footerNavItems={footerNavItems}
              superAdminNavItems={superAdminNavItems}
              hiringToolNavItems={hiringToolNavItems}
              onTabClick={handleTabClick}
            />
            <div
              className={`recruiter-dashboard-content ${
                isPathnameIncluded ? "with-padding" : "no-padding"
              }`}
            >
              {children}
            </div>
            <UploadProgressIndicator />
            <NotificationAutoPrompt />
          </NotificationProvider>
        </RecruiterContextProvider>
      </UploadProvider>
    </>
  );
}
