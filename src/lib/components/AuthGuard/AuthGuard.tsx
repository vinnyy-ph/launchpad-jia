"use client";

import { useAppContext } from "@/lib/context/AppContext";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
// import axios from "axios";
import { api } from "@/lib/utils/apiClient";
import { clearUserSession, errorToast } from "@/lib/Utils";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { firebaseAuth } from "@/lib/firebase/firebaseClient";
import Swal from "sweetalert2";
import { superAdminList } from "@/lib/SuperAdminUtils";
import { useFirebaseTokenRefresh } from "@/lib/hooks/useFirebaseTokenRefresh";

export default function AuthGuard() {
  const { orgID } = useAppContext();
  const [animation, setAnimation] = useState("");
  const [blocked, setBlocked] = useState(true);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeOrg, setActiveOrg] = useLocalStorage("activeOrg", null);

  useFirebaseTokenRefresh();

  useEffect(() => {
    async function fetchOrg() {
      const userData = JSON.parse(localStorage.user);
      const org = await api.post("/api/get-org", {
        user: userData,
      });

      const orgList = org.data;
      localStorage.orgList = JSON.stringify(orgList);

      if (!orgList.length && !activeOrg) {
        errorToast("Invalid Access", 1500);

        setTimeout(() => {
          window.location.href = "/";
        }, 1500);
      }

      const orgIDparams = searchParams.get("orgID");

      // Validate that activeOrg is in the user's orgList
      if (activeOrg && !orgList.find((o: any) => o._id === activeOrg._id)) {
        // Clear invalid activeOrg
        setActiveOrg(null);
      }

      if (
        !orgIDparams &&
        activeOrg &&
        orgList.find((o: any) => o._id === activeOrg._id)
      ) {
        const params = new URLSearchParams(searchParams);
        params.delete("orgID");
        const existingParams = params.toString();
        router.replace(
          `${pathname}?orgID=${activeOrg._id}${
            existingParams ? `&${existingParams}` : ""
          }`
        );
      } else if (orgIDparams) {
        const foundOrg = orgList.find((o: any) => o._id === orgIDparams);
        const isSuperAdmin = superAdminList.includes(userData.email);

        if (!foundOrg && !isSuperAdmin) {
          errorToast("Invalid organization", 1500);

          setTimeout(() => {
            window.location.href = `${pathname}?orgID=${
              activeOrg ? activeOrg._id : orgList[0]._id
            }`;
          }, 1500);

          return;
        }

        if (!foundOrg && isSuperAdmin) {
          const orgDetails = await api.get(
            "/api/admin/get-organization-details",
            {
              params: {
                id: orgIDparams,
              },
            }
          );
          if (orgDetails.data.status === "inactive") {
            clearUserSession();
            errorToast("Your organization is inactive", 1500);
            setTimeout(() => {
              window.location.href = "/";
            }, 1500);
            return;
          }
          setActiveOrg(orgDetails.data);
        }

        if (foundOrg) {
          setActiveOrg(foundOrg);
        }
      }

      if (!activeOrg && orgList.length > 0) {
        setActiveOrg(orgList[0]);
        // Redirect to the first org if no orgID in URL
        if (!orgIDparams) {
          const params = new URLSearchParams(searchParams);
          params.delete("orgID");
          const existingParams = params.toString();
          router.replace(
            `${pathname}?orgID=${orgList[0]._id}${
              existingParams ? `&${existingParams}` : ""
            }`
          );
        }
      }

      if (activeOrg) {
        if (!userData.email.includes("@whitecloak.com")) {
          if (pathname.includes("/settings")) {
            errorToast("You are not authorized to access this page", 1500);
            setTimeout(() => {
              window.location.href = "/recruiter-dashboard/careers";
            }, 1500);
            return;
          }
        }

        if (activeOrg.role == "hiring_manager") {
          const allowedPaths = [
            "/dashboard/careers",
            "/dashboard/feedback",
            "/dashboard/interviews",
            "/dashboard/candidates",
            "/recruiter-dashboard/careers",
            "/recruiter-dashboard/feedback",
            "/recruiter-dashboard/candidates",
            "/recruiter-dashboard/projects",
            "/recruiter-dashboard/email",
            "/recruiter-dashboard/inbox",
            "/recruiter-dashboard/settings",
          ];

          if (!allowedPaths.some((path) => pathname.includes(path))) {
            errorToast("You are not authorized to access this page", 1500);
            setTimeout(() => {
              window.location.href = "/recruiter-dashboard/careers";
            }, 1500);
            return;
          }
        }

        // Check if org is active
        const orgDetails = await api.get(
          "/api/admin/get-organization-details",
          {
            params: {
              id: activeOrg._id,
            },
          }
        );
        if (orgDetails.data.status === "inactive") {
          clearUserSession();
          errorToast("Your organization is inactive", 1500);
          setTimeout(() => {
            window.location.href = "/";
          }, 1500);
          return;
        }
      }

      setBlocked(false);
    }

    function fetchCV(email: string) {
      api.post(`/api/load-user-cv`, { email: email }).then((res) => {
        localStorage.isCVAvailable = res.data ? true : false;
      });
    }

    if (!localStorage.user) {
      setBlocked(true);
      window.location.href = "/";
    }

    if (localStorage.user) {
      try {
        const userData = JSON.parse(localStorage.user);
        const role = localStorage.role;

        if (role === "admin") {
          if (window.location.pathname.includes("applicant")) {
            fetchCV(userData.email);
            setBlocked(false);
          }
          if (window.location.pathname.includes("dashboard")) {
            fetchOrg();
          }
        }

        if (role === "applicant") {
          localStorage.removeItem("activeOrg");
          localStorage.removeItem("orgList");
          if (window.location.pathname.includes("applicant")) {
            fetchCV(userData.email);
            setBlocked(false);
          }

          if (window.location.pathname.includes("dashboard")) {
            errorToast("You are not authorized to access this page", 1500);
            setTimeout(() => {
              window.location.href = "/";
            }, 1500);
          }
        }
      } catch (error) {
        setBlocked(true);
        window.location.href = "/";
      }
    }
  }, []);

  // Refresh auth token from Firebase
  useEffect(() => {
    const unsubscribe = firebaseAuth.onAuthStateChanged((user: any) => {
      let userData = null;

      if (localStorage.user) {
        userData = JSON.parse(localStorage.user);
      }

      if (user) {
        // refresh auth token
        user
          .getIdToken(/* forceRefresh */ true)
          .then(function (idToken) {
            localStorage.authToken = idToken;
          })
          .catch(function (error) {
            console.log("Firebase Error=>", error);
          });
      }

      if (!user) {
        if (!["/", "/login"].includes(window.location.pathname)) {

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
            customClass: {
              popup: "fade-in-bottom",
            },
          }).then((result) => {
            if (result.isConfirmed) {
              clearUserSession();
              firebaseAuth.signOut();

              window.location.href = "/";
            }
          });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <>
      {blocked && (
        <div className={`auth-guard ${animation}`}>
          <h1>
            <i className="la la-circle-notch spin la-2x text-primary"></i>
          </h1>
        </div>
      )}
    </>
  );
}
