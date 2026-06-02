// TODO (Job Portal) - Check API

"use client";

import styles from "@/lib/styles/commonV2/sidebar.module.scss";
import { useAppContext } from "@/lib/context/ContextV2";
import { assetConstants, pathConstants } from "@/lib/utils/constantsV2";
import { extractSubdomain } from "@/lib/utils/subdomainUtils";
import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/app/(talent-vault)/components/base/Badge";
import { isTalentVaultEnabled } from "@/app/(talent-vault)/lib/helpers";
import Swal from "sweetalert2";

export default function ({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [actveLink, setActiveLink] = useState(null);
  const { user, setModalType, setOrganizationBranding } = useAppContext();

  const showTalentVault = isTalentVaultEnabled(user?.email ?? "");

  const generalLinks = [
    {
      href: pathConstants.dashboard,
      image: assetConstants.dashboard,
      name: "Dashboard",
    },
    {
      href: pathConstants.dashboardJobOpenings,
      image: assetConstants.briefcase,
      name: "Job Openings",
    },
    ...(showTalentVault
      ? [
          {
            href: pathConstants.talentVault,
            image: assetConstants.talentVault,
            name: "Talent Vault",
          },
        ]
      : []),
    {
      href: pathConstants.manageCV,
      image: assetConstants.file,
      name: "Manage CV",
    },
  ];

  const otherLinks = [
    {
      href: pathConstants.dashboardSettings,
      image: assetConstants.settings,
      name: "Settings",
    },
    {
      href: pathConstants.home,
      image: assetConstants.logout,
      name: "Logout",
    },
  ];

  const links = [...generalLinks, ...otherLinks];

  async function resolveTalentVaultPath(path: string) {
    if (path !== pathConstants.talentVault) {
      return path;
    }

    if (user?.talentVault?.profileId) {
      return pathConstants.talentVault;
    }

    try {
      const response = await api.get("/api/talent-vault/profiles");
      const profile = response?.data?.data;

      if (profile) {
        return pathConstants.talentVault;
      }

      setModalType("talentVaultSetupPrompt");
      return null;
    } catch (error) {
      console.error("Error resolving Talent Vault route:", error);
      setModalType("talentVaultSetupPrompt");
      return null;
    }
  }

  async function proceedRedirection(path: string) {
    const resolvedPath = await resolveTalentVaultPath(path);

    if (resolvedPath === null) {
      return;
    }

    if (resolvedPath == pathConstants.home) {
      setModalType("logout");
    } else {
      router.push(resolvedPath);
    }
  }

  function handleRedirection(path) {
    if (path == pathname) {
      return null;
    }

    const hasChanges = sessionStorage.getItem("hasChanges");

    if (hasChanges == "true") {
      Swal.fire({
        title: "Unsaved Changes",
        text: "You have unsaved changes. Are you sure you want to leave this page?",
        icon: "info",
        showCancelButton: true,
        confirmButtonColor: "#000",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Yes, leave",
        cancelButtonText: "Stay",
        allowOutsideClick: true,
        customClass: {
          popup: "fade-in",
          confirmButton: "button",
          cancelButton: "button",
        },
      }).then((result) => {
        if (result.isConfirmed) {
          void proceedRedirection(path);
        }
      });
    } else {
      void proceedRedirection(path);
    }
  }

  useEffect(() => {
    if (user == null) {
      alert("Please sign in to continue.");
      handleRedirection(
        `${
          window.location.origin.includes("localhost")
            ? "/job-portal"
            : pathConstants.employee
        }`
      );
    } else {
      links.forEach((link) => {
        if (link.href == pathname) {
          setActiveLink(link.name);
        }
      });

      fetchUserCV();
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const fetchOrgBranding = async () => {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      const subdomain = extractSubdomain(hostname);
      
      if (subdomain) {
        try {
          const response = await axios.post('/api/job-portal/resolve-subdomain', { subdomain });
          if (response.data && response.data.logo) {
            setOrganizationBranding({
              enabled: true,
              logo: response.data.logo,
              name: response.data.name || '',
            });
          }
        } catch (error) {
          console.error("Error fetching organization branding:", error);
          setOrganizationBranding(null);
        }
      } else {
        setOrganizationBranding(null);
      }
    };

    fetchOrgBranding();
  }, []);

  function fetchUserCV() {
    api
      .post("/api/whitecloak/fetch-cv")
      .then((res) => {
        const result = res.data;
        const manageCV = sessionStorage.getItem("manageCV");

        if (
          !result &&
          manageCV != "true" &&
          pathname != pathConstants.uploadCV
        ) {
          setModalType("manageCV");
        }
      })
      .catch((err) => {
        alert("Error fetching CV. Please try again.");
        console.log(err);
      });
  }

  if (user == null) return null;

  if (
    pathname == pathConstants.uploadCV ||
    pathname == pathConstants.talentVaultSetup
  ) {
    return children;
  }

  return (
    <>
      <aside className={`webView ${styles.sidebarContainer}`}>
        <span className={styles.groupName}>General</span>
        {generalLinks.map((link, index) => (
          <span
            key={index}
            className={`${styles.link} ${
              actveLink == link.name ? styles.active : ""
            }`}
            onClick={() => handleRedirection(link.href)}
          >
            <img alt={link.image.split(".")[0]} src={link.image} />
            <span>{link.name}</span>
            {link.name === "Talent Vault" && (
              <Badge
                content={
                  user?.talentVault?.status === "active" ? "Active" : "Inactive"
                }
                variant={
                  user?.talentVault?.status === "active" ? "success" : "error"
                }
              />
            )}
          </span>
        ))}

        <hr />

        <span className={styles.groupName}>Others</span>
        {otherLinks.map((link, index) => (
          <span
            key={index}
            className={`${styles.link} ${
              actveLink == link.name ? styles.active : ""
            }`}
            onClick={() => handleRedirection(link.href)}
          >
            <img alt={link.image.split(".")[0]} src={link.image} />
            <span>{link.name}</span>
          </span>
        ))}

        <div className={styles.footerContainer}>
          © 2025
          <span>White Cloak Technologies, Inc.</span>
        </div>
      </aside>

      <section>{children}</section>
    </>
  );
}
