// TODO (Vince) - Replace alert and windows.confirm
// TODO (Vince) - Merge API

"use client";

import styles from "@/lib/styles/common/sidebar.module.scss";
import { contextProvider } from "@/lib/context/Context";
import { api } from "@/lib/utils/apiClient";
import { usePathname } from "next/navigation";
import { useState, Fragment, useEffect } from "react";
import Swal from "sweetalert2";

export default function ({ children }) {
  const pathname = usePathname();
  const { user, modalType, setModalType } = contextProvider();
  const [activeLink, setActiveLink] = useState(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const links = [
    {
      icon: "home",
      text: "Dashboard",
      function: (link) => {
        if (link === activeLink) {
          return false;
        }

        checkChanges("/whitecloak/applicant");
      },
    },
    {
      icon: "briefcase",
      text: "Job Openings",
      function: (link) => {
        if (link === activeLink) {
          return false;
        }

        checkChanges("/whitecloak/applicant/job-openings");
      },
    },
    {
      icon: "user",
      text: "Manage CV",
      function: (link) => {
        if (link === activeLink) {
          return false;
        }

        checkChanges("/whitecloak/applicant/manage-cv");
      },
    },
    {
      icon: "settings",
      text: "Settings",
      function: (link) => {
        if (link === activeLink) {
          return false;
        }

        setActiveLink(link);
      },
    },
    {
      icon: "log-out",
      text: "Log out",
      function: () => {
        checkChanges("/whitecloak");
      },
    },
  ];

  function checkChanges(route) {
    setModalType("loading");

    if (sessionStorage.getItem("hasChanges") == "true") {
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
          if (route == "/whitecloak") {
            localStorage.clear();
            sessionStorage.clear();
          }
          window.location.href = route;
        } else {
          setModalType(null);
        }
      });
    } else {
      if (route == "/whitecloak") {
        localStorage.clear();
        sessionStorage.clear();
      }
      window.location.href = route;
    }
  }

  useEffect(() => {
    if (isHydrated) return;

    const welcomePrompt = sessionStorage.getItem("welcomePrompt");

    if (!welcomePrompt) {
      setModalType("welcomePrompt");
    }

    if (pathname.includes("applicant")) {
      if (pathname.includes("job-openings")) {
        setActiveLink("Job Openings");
      } else if (pathname.includes("manage-cv")) {
        setActiveLink("Manage CV");
      } else {
        setActiveLink("Dashboard");
      }
    }

    if (user == null) {
      Swal.fire({
        title: "Sign In Required",
        text: "Please sign in to continue",
        icon: "info",
        confirmButtonColor: "#000",
        confirmButtonText: "OK",
        allowOutsideClick: true,
        customClass: {
          popup: "fade-in",
          confirmButton: "button",
        },
      }).then(() => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = "/whitecloak";
      });
    } else {
      const userCV = localStorage.getItem("userCV");
      // const navType = (
      //   performance.getEntriesByType(
      //     "navigation"
      //   )[0] as PerformanceNavigationTiming
      // ).type;

      // if (!userCV || navType == "reload") {
      fetchUserCV();
      // }
    }
  }, []);

  useEffect(() => {
    if (modalType == "welcomePrompt") {
      setIsHydrated(false);
    } else {
      setIsHydrated(true);
    }
  }, [modalType]);

  async function fetchUserCV() {
    await api
      .post("/api/whitecloak/fetch-cv")
      .then((res) => {
        localStorage.setItem("userCV", JSON.stringify(res.data));
      })
      .catch((err) => {
        alert("Error fetching CV. Please try again.");
        console.log(err);
      });
  }

  if (pathname.includes("upload-cv")) {
    return <>{user && isHydrated && children}</>;
  }

  return (
    <>
      <aside className={`${styles.sidebar} webView`}>
        {links.map((link, index) => (
          <Fragment key={index}>
            <div
              className={activeLink === link.text ? styles.active : ""}
              onClick={() => link.function(link.text)}
            >
              <img alt={link.icon} src={`/icons/${link.icon}.svg`} />
              <span>{link.text}</span>
            </div>
          </Fragment>
        ))}
      </aside>

      <section>{user && isHydrated && children}</section>
    </>
  );
}
