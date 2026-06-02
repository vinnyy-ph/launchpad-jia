"use client";

import styles from "@/lib/styles/commonV2/navbar.module.scss";
import { useAppContext } from "@/lib/context/ContextV2";
import { assetConstants, pathConstants } from "@/lib/utils/constantsV2";
import { extractSubdomain } from "@/lib/utils/subdomainUtils";
import Field from "@/lib/components/ui/field/Field";
import { SearchMd } from "@untitledui/icons";
import { api } from "@/lib/utils/apiClient";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/app/(talent-vault)/components/base/Badge";
import { isTalentVaultEnabled } from "@/app/(talent-vault)/lib/helpers";
import Swal from "sweetalert2";

export default function () {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const querySearch = searchParams.get("search");
  const [search, setSearch] = useState("");
  const [dropdown, setDropdown] = useState(false);
  const [viewSearch, setViewSearch] = useState(false);
  const [isChrome, setIsChrome] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isHostResolved, setIsHostResolved] = useState(false);
  const [hasTriedOrgBranding, setHasTriedOrgBranding] = useState(false);
  const { user, setModalType, organizationBranding, setOrganizationBranding } =
    useAppContext();
  
  const hasSubdomain = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(extractSubdomain(window.location.hostname));
  }, []);
  
  const orgLogo = organizationBranding?.enabled && organizationBranding?.logo
    ? organizationBranding.logo
    : null;
  const useOrgBrandingLogo = !pathname.includes("/dashboard") && hasSubdomain;
  
  const brandLogo = pathname.includes("/dashboard")
    ? assetConstants.jiaLogo2
    : hasSubdomain
    ? orgLogo || assetConstants.jiaLogo2
    : assetConstants.jiaLogo2;
    
  const shouldHideBrandLogo =
    !isHostResolved ||
    (useOrgBrandingLogo &&
      !organizationBranding?.logo &&
      !hasTriedOrgBranding);

  const showTalentVault = isTalentVaultEnabled(user?.email ?? "");

  const links = [
    {
      href: pathConstants.jobOpenings,
      name: "Find Jobs",
    },
    {
      href: `${pathConstants.employer}/#how-it-works`,
      name: "How it works",
    },
    {
      href: `${pathConstants.home}#`,
      name: "Testimonials",
    },
    {
      href: `${pathConstants.home}#`,
      name: "About",
    },
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
    {
      href: pathConstants.dashboardSettings,
      image: assetConstants.settings,
      name: "Settings",
    },
  ];

  function handleSearch() {
    const jobSearchPath = `${pathname}${
      search && search.trim() ? `?search=${search.trim()}` : ""
    }`;

    handleRedirection(jobSearchPath);
  }

  function handleSignIn() {
    setModalType("signIn");
  }

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
      window.location.href = resolvedPath;
    }
  }

  function handleRedirection(path) {
    if (path.includes(pathConstants.employer)) {
      window.open(path, "_blank");
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
    if (
      pathname.includes("/job-openings") &&
      querySearch &&
      querySearch.trim()
    ) {
      setSearch(querySearch.trim());
    } else {
      setSearch("");
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    // Check if browser is Chrome and if device is mobile
    const userAgent = navigator.userAgent;
    const isChromeBrowser =
      /Chrome/.test(userAgent) &&
      /Google Inc/.test(navigator.vendor) &&
      !/Edg/.test(userAgent) && // Not Edge
      !/OPR/.test(userAgent) && // Not Opera
      !/Opera/.test(userAgent); // Not Opera (older versions)
    
    // Detect mobile devices
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    setIsChrome(isChromeBrowser);
    setIsMobile(isMobileDevice);
    setIsHostResolved(true);
  }, []);

  useEffect(() => {
    const subdomain =
      typeof window !== "undefined"
        ? extractSubdomain(window.location.hostname)
        : null;

    if (!subdomain || organizationBranding?.logo) {
      setHasTriedOrgBranding(true);
      return;
    }

    let isCancelled = false;

    const fetchOrgBranding = async () => {
      try {
        const response = await fetch("/api/job-portal/resolve-subdomain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subdomain }),
        });

        if (!response.ok) {
          throw new Error("Failed to resolve subdomain");
        }

        const result = await response.json();

        if (!isCancelled && result?.logo) {
          setOrganizationBranding({
            enabled: true,
            logo: result.logo,
            name: result.name || "",
          });
        }
      } catch (error) {
        if (!isCancelled) {
          setOrganizationBranding(null);
        }
      } finally {
        if (!isCancelled) {
          setHasTriedOrgBranding(true);
        }
      }
    };

    fetchOrgBranding();

    return () => {
      isCancelled = true;
    };
  }, [organizationBranding?.logo, setOrganizationBranding]);

  if (pathname.includes("/dashboard") && user == null) {
    return null;
  }

  return (
    <nav
      className={`${styles.navbarContainer} ${
        pathname == pathConstants.home ||
        (window.location.origin.includes("localhost") &&
          pathname.includes("job-portal"))
          ? styles.home
          : ""
      }`}
      style={{
        position: isMobile ? "relative" : (isChrome ? "fixed" : "relative"),
        top: isMobile ? "0" : (isChrome ? "0" : "-40px"),
      }}
    >
      <div
        className={styles.brandContainer}
        onClick={() => {
          const subdomain = extractSubdomain(window.location.hostname);
          if (subdomain) {
            handleRedirection(pathConstants.jobOpenings);
          } else {
            handleRedirection(
              `${
                window.location.origin.includes("localhost")
                  ? "/job-portal"
                  : pathConstants.employee
              }`
            );
          }
        }}
      >
        {brandLogo && (
          <img
            alt=""
            className={`${styles.jia} ${
              useOrgBrandingLogo ? styles.orgLogo : styles.defaultLogo
            }`}
            src={brandLogo}
            style={{ 
              visibility: shouldHideBrandLogo ? "hidden" : "visible",
              maxWidth: "56px",
              maxHeight: "56px"
            }}
            onContextMenu={(e) => e.preventDefault()}
          />
        )}
        <div className={styles.brandText}>
          <span>
            {pathname.includes("/dashboard") ? "JOB" : hasSubdomain ? "CAREER" : "JOB"}
          </span>
          <span>
            {pathname.includes("/dashboard") ? "PORTAL" : hasSubdomain ? "PAGE" : "PORTAL"}
          </span>
        </div>
      </div>

      {(pathname == pathConstants.home ||
        (window.location.origin.includes("localhost") &&
          pathname.includes("job-portal"))) && (
        <div className={`webView ${styles.linkContainer}`}>
          {links.slice(0, 2).map((item, index) => (
            <span key={index} onClick={() => handleRedirection(item.href)}>
              {item.name}
            </span>
          ))}
        </div>
      )}

      {[pathConstants.jobOpenings, pathConstants.dashboardJobOpenings].includes(
        pathname
      ) && (
        <div className={`webView ${styles.searchContainer}`}>
          <Field
            autoComplete="off"
            className={styles.searchField}
            name="navbar-job-search"
            section={<SearchMd />}
            type="search"
            placeholder="Job title or keyword"
            value={search}
            onBlur={(e) => (e.target.placeholder = "Job title or keyword")}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={(e) => ((e.target as HTMLInputElement).placeholder = "")}
            onKeyDown={(e) => {
              if (e.key == "Enter") {
                handleSearch();
              }
            }}
          />
          <button onClick={handleSearch}>Search Jobs</button>
        </div>
      )}

      {user ? (
        <div className={`webView ${styles.userItems}`}>
          {pathname == pathConstants.uploadCV ? (
            <span onClick={() => handleRedirection(pathConstants.dashboard)}>
              Dashboard
            </span>
          ) : (
            <></>
            // <img alt="" src={assetConstants.bell} />
          )}
          <img
            alt=""
            className={styles.user}
            src={user.image}
            onClick={() => handleRedirection(pathConstants.dashboard)}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      ) : (
        <div className={`webView ${styles.loginItems}`}>
          <button className="secondaryBtn" onClick={handleSignIn}>
            Sign In
          </button>
          <span onClick={() => handleRedirection(pathConstants.employer)}>
            For Employers
          </span>
        </div>
      )}

      {[pathConstants.jobOpenings, pathConstants.dashboardJobOpenings].includes(
        pathname
      ) && (
        <img
          alt=""
          className={`mobileView ${styles.menu}`}
          src={assetConstants.search}
          onClick={() => {
            if (dropdown) {
              setDropdown(false);
            }

            setViewSearch((prev) => !prev);
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
      )}

      <img
        alt=""
        className={`mobileView ${styles.menu}`}
        src={`${
          user == null && dropdown == false
            ? assetConstants.menu
            : user != null && dropdown == false
            ? user.image
            : assetConstants.x
        }`}
        onClick={() => {
          if (viewSearch) {
            setViewSearch(false);
          }

          setDropdown((prev) => !prev);
        }}
        onContextMenu={(e) => e.preventDefault()}
      />

      {viewSearch && (
        <div className={`mobileView ${styles.searchContainer}`}>
          <Field
            autoComplete="off"
            className={styles.searchField}
            name="navbar-mobile-job-search"
            section={<SearchMd />}
            type="search"
            placeholder="Job title or keyword"
            value={search}
            onBlur={(e) => (e.target.placeholder = "Job title or keyword")}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={(e) => ((e.target as HTMLInputElement).placeholder = "")}
            onKeyDown={(e) => {
              if (e.key == "Enter") {
                handleSearch();
              }
            }}
          />
          <button onClick={handleSearch}>Search Jobs</button>
        </div>
      )}

      {dropdown && (
        <div className={`mobileView ${styles.dropdownContainer}`}>
          {user == null ? (
            <>
              {links.slice(0, 2).map((link, index) => (
                <span key={index} onClick={() => handleRedirection(link.href)}>
                  {link.name}
                </span>
              ))}
              <span
                className={styles.employer}
                onClick={() => handleRedirection(pathConstants.employer)}
              >
                For Employers
              </span>
              <div className={styles.buttonContainer}>
                <button className="secondaryBtn" onClick={handleSignIn}>
                  Sign In
                </button>
              </div>
            </>
          ) : (
            <>
              {links.slice(4).map((link, index) => (
                <span key={index} onClick={() => handleRedirection(link.href)}>
                  <img alt="" src={link.image} />
                  {link.name}
                  {link.name === "Talent Vault" && (
                    <Badge
                      content={
                        user?.talentVault?.status === "active"
                          ? "Active"
                          : "Inactive"
                      }
                      variant={
                        user?.talentVault?.status === "active"
                          ? "success"
                          : "error"
                      }
                    />
                  )}
                </span>
              ))}
              <div className={styles.buttonContainer}>
                <button
                  className="secondaryBtn"
                  onClick={() => handleRedirection(pathConstants.home)}
                >
                  <img alt="" src={assetConstants.logoutV2} />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
