"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/utils/apiClient";
import { clearUserSession, errorToast } from "@/lib/Utils";
import { firebaseAuth } from "@/lib/firebase/firebaseClient";
import Swal from "sweetalert2";
import { useFirebaseTokenRefresh } from "@/lib/hooks/useFirebaseTokenRefresh";

export default function GuestAuthGuard() {
  const [blocked, setBlocked] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get orgId from URL query params (source of truth)
  const orgIdFromUrl = searchParams.get("orgId");

  useFirebaseTokenRefresh();

  useEffect(() => {
    async function validateGuestAccess() {
      // Check if user is logged in
      if (!localStorage.user) {
        errorToast("Please log in to access this page", 1500);
        setTimeout(() => {
          window.location.href = "/login";
        }, 1500);
        return;
      }

      try {
        const userData = JSON.parse(localStorage.user);
        
        // Fetch user's member record
        const response = await api.post("/api/get-org", {
          user: userData,
        });

        const orgList = response.data;

        if (!orgList || orgList.length === 0) {
          errorToast("No organization access found", 1500);
          setTimeout(() => {
            clearUserSession();
            window.location.href = "/login";
          }, 1500);
          return;
        }

        // Find if user is a guest in any organization
        // If orgId is provided in URL, validate against that specific org
        let guestOrg;
        if (orgIdFromUrl) {
          // Validate that user has guest access to the specific org in URL
          guestOrg = orgList.find((org: any) => org.role === "guest" && org._id === orgIdFromUrl);
          
          if (!guestOrg) {
            // Check if they have any guest role but not for this org
            const hasAnyGuestRole = orgList.some((org: any) => org.role === "guest");
            if (hasAnyGuestRole) {
              errorToast("You don't have access to this organization", 1500);
            } else {
              errorToast("You are not authorized to access the guest portal", 1500);
            }
            setTimeout(() => {
              const firstOrg = orgList[0];
              if (firstOrg.role === "admin" || firstOrg.role === "hiring_manager") {
                window.location.href = `/recruiter-dashboard?orgID=${firstOrg._id}`;
              } else if (firstOrg.role === "guest") {
                // Redirect to the org they do have access to
                window.location.href = `/guest-portal/careers?orgId=${firstOrg._id}`;
              } else {
                window.location.href = "/";
              }
            }, 1500);
            return;
          }
        } else {
          let preferredOrgId: string | null = null;
          try {
            const cachedGuestOrg = localStorage.guestOrg ? JSON.parse(localStorage.guestOrg) : null;
            preferredOrgId = cachedGuestOrg?._id || localStorage.getItem("lastGuestOrgId");
          } catch (e) {
            preferredOrgId = localStorage.getItem("lastGuestOrgId");
          }

          guestOrg = preferredOrgId
            ? orgList.find((org: any) => org.role === "guest" && org._id === preferredOrgId)
            : undefined;

          if (!guestOrg) {
            guestOrg = orgList.find((org: any) => org.role === "guest");
          }

          if (guestOrg) {
            const url = new URL(window.location.href);
            url.searchParams.set("orgId", guestOrg._id);
            window.location.href = `${url.pathname}?${url.searchParams.toString()}`;
            return;
          }
        }

        if (!guestOrg) {
          console.log("No guest role found. User roles:", orgList.map((o: any) => o.role));
          errorToast("You are not authorized to access the guest portal", 1500);
          setTimeout(() => {
            // Redirect based on their actual role
            const firstOrg = orgList[0];
            if (firstOrg.role === "admin" || firstOrg.role === "hiring_manager") {
              window.location.href = `/recruiter-dashboard?orgID=${firstOrg._id}`;
            } else {
              window.location.href = "/";
            }
          }, 1500);
          return;
        }

        console.log("Guest org found:", { 
          role: guestOrg.role, 
          status: guestOrg.status, 
          orgName: guestOrg.name 
        });

        const guestPortalEnabledEffective =
          typeof guestOrg.guestPortalEnabled === "boolean"
            ? guestOrg.guestPortalEnabled
            : !!guestOrg.projectsEnabled;

        // Guest portal should only be available when guestPortalEnabled is true.
        if (!guestPortalEnabledEffective) {
          console.error("Guest portal access blocked: projectsEnabled is false for org", {
            orgId: guestOrg._id,
            orgName: guestOrg.name,
          });
          errorToast(
            "Guest portal is disabled for this organization.",
            2000
          );
          setTimeout(() => {
            // Redirect guest away from portal; keep this generic for now
            window.location.href = "/";
          }, 2000);
          return;
        }

        // Check if guest account is active (status should be "joined" or "invited")
        if (guestOrg.status !== "joined" && guestOrg.status !== "invited") {
          console.error("Invalid guest status:", guestOrg.status);
          errorToast("Your guest account is not active", 1500);
          setTimeout(() => {
            clearUserSession();
            window.location.href = "/login";
          }, 1500);
          return;
        }

        // Store guest org info in localStorage for caching (not source of truth)
        localStorage.guestOrg = JSON.stringify(guestOrg);
        localStorage.setItem("lastGuestOrgId", guestOrg._id);
        localStorage.role = "guest";

        // All checks passed, allow access
        setBlocked(false);
      } catch (error) {
        console.error("Guest auth error:", error);
        errorToast("Authentication failed", 1500);
        setTimeout(() => {
          clearUserSession();
          window.location.href = "/login";
        }, 1500);
      }
    }

    validateGuestAccess();
  }, [pathname, orgIdFromUrl]);

  // Refresh auth token from Firebase
  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged((user: any) => {
      if (user) {
        // Refresh auth token
        user
          .getIdToken(/* forceRefresh */ true)
          .then(function (idToken: string) {
            localStorage.authToken = idToken;
          })
          .catch(function (error: any) {
            console.log("Firebase Error=>", error);
          });
      }

      if (!user && !["/", "/login"].includes(pathname)) {
        // Check if user is intentionally logging out - don't show popup
        if (localStorage.getItem("isLoggingOut") === "true") {
          localStorage.removeItem("isLoggingOut");
          return;
        }
        
        Swal.fire({
          title: "Session Expired",
          text: "Please log in again.",
          icon: "info",
          confirmButtonText: "OK",
          allowOutsideClick: false,
          allowEscapeKey: false,
          showCancelButton: false,
        }).then((result) => {
          if (result.isConfirmed) {
            clearUserSession();
            firebaseAuth.signOut();
            window.location.href = "/login";
          }
        });
      }
    });

    return () => unsubscribe();
  }, [pathname]);

  return (
    <>
      {blocked && (
        <div className="auth-guard">
          <h1>
            <i className="la la-circle-notch spin la-2x text-primary"></i>
          </h1>
        </div>
      )}
    </>
  );
}
