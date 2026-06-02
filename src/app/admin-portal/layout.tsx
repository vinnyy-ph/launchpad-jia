"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import SidebarV2 from "@/lib/PageComponent/SidebarV2";
import SuperAdminAuthGuard from "@/lib/components/AuthGuard/SuperAdminAuthGuard";


export default function Layout({ children }) {
  const [activeLink, setActiveLink] = useState("");
  const pathname = usePathname();
  const navItems = [
    // Hide Dashboard for now
    { label: 'Dashboard', href: '/admin-portal', iconImage: "/dashboard-icon.svg", },
    { label: 'Organizations', href: '/admin-portal/organizations', iconImage: "/careers-icon.svg" },
    { label: 'Talent Vault', href: '/admin-portal/talent-vault', iconImage: "/iconsV3/tv-icon.svg" },
    { label: 'Inquiries', href: '/admin-portal/inquiries', iconImage: "/requisitions-icon.svg", },
    { label: 'Pricing Plans', href: '/admin-portal/pricing-plans', iconImage: "/pricing-plan-icon.svg" },
    // { label: 'Applicants', href: '/admin-portal/applicants', icon: "la la-id-badge" },
  ];

  const footerNavItems = [
    // { label: 'Members', href: '/admin-portal/members', icon: "la la-users" },
    // { label: 'Settings', href: '/admin-portal/settings', icon: "la la-cog" },
  ];
  // Check active link from the url
  useEffect(() => {
    if (pathname) {
      let pathSplit = pathname.split("/");

      let activeMenu = null;
      const applicantLinkSet = [...navItems, ...footerNavItems];

      if (pathSplit.length <= 3) {
        activeMenu = applicantLinkSet.find((x) => x.href === pathname);
      }

      if (pathSplit.length > 3) {
        let path = "/" + pathSplit[1] + "/" + pathSplit[2];
        activeMenu = applicantLinkSet.find((x) => x.href === path);
      }

      if (!activeMenu) {
        // Default to dashboard
        activeMenu = applicantLinkSet.find((x) => x.href === "/admin-portal");
      }

      setActiveLink(activeMenu.label);
    }
  }, [pathname]);

  return (
    <>
      <SuperAdminAuthGuard />
      <title>Jia Admin Portal - WhiteCloak Technologies</title>
      <SidebarV2 activeLink={activeLink} navItems={navItems} footerNavItems={footerNavItems} isAdmin={true} />
      <div
        className="recruiter-dashboard-content no-padding"
      >
        {children}
      </div>
    </>
  );
}