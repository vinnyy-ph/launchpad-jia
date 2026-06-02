"use client";

import { useRouter } from "next/navigation";
import AvatarImage from "../components/AvatarImage/AvatarImage";
import { useAppContext } from "../context/AppContext";
import { useContext, useEffect, useState, useRef } from "react";
import useDateTimer from "../hooks/useDateTimerHook";
import { performLogout } from "../Utils";
import { useRecruiterContext } from "../context/RecruiterContext";
import NotificationBell from "../components/NotificationComponents/NotificationBell";
import NotificationModal from "../components/NotificationComponents/NotificationModal";
import { NotificationContext } from "../context/NotificationContext";

const ChevronLeftIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 5L8 10L12 15"
      stroke="#A4A7AE"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 5L12 10L8 15"
      stroke="#A4A7AE"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function HeaderBar(props: {
  activeLink: string;
  currentPage?: string;
  icon?: string;
  subpage?: string;
  subpageHref?: string;
  iconImage?: string;
  iconJsx?: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAppContext();
  const [role, setRole] = useState<string>("");
  const { activeLink, currentPage, icon, iconImage, iconJsx, subpage, subpageHref } = props;
  const [showAuthUserOptions, setShowAuthUserOptions] = useState(false);
  const date = useDateTimer();
  const { hasUnsavedChanges, setModalType } = useRecruiterContext();

  // Check if NotificationProvider is available in the component tree
  // This is safe because useContext returns undefined if the provider is not found
  const notificationContext = useContext(NotificationContext);
  const hasNotificationProvider = notificationContext !== undefined;

  useEffect(() => {
    if (user) {
      const activeOrg = localStorage.activeOrg;
      if (activeOrg) {
        const parsedActiveOrg = JSON.parse(activeOrg);
        setRole(parsedActiveOrg.role);
      }
    }
  }, [user]);

  const userProfileRef = useContext(NotificationContext) ? undefined : useRef<HTMLDivElement>(null);
  // We need refs, but hook rules say hooks shouldn't be conditional.
  // Since we already imported useRef, we can just use it.
  const profileRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setShowAuthUserOptions(false);
      }
    };

    if (showAuthUserOptions) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAuthUserOptions]);

  return (
    <div className="header dashboard-header">
      <div className="container-fluid">
        <div className="header-body">
          <div className="row align-items-center justify-content-between py-4 header-row">
            <div className="col-auto d-none d-lg-block">
              <nav aria-label="breadcrumb" className="breadcrumb-nav">
                <ol
                  className="breadcrumb breadcrumb-links"
                  style={{
                    backgroundColor: "transparent",
                    padding: 0,
                    marginBottom: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginRight: 10,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      if (hasUnsavedChanges) {
                        setModalType("inactive");
                        return;
                      }
                      router.back();
                    }}
                  >
                    <ChevronLeftIcon />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginRight: 10,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      if (hasUnsavedChanges) {
                        setModalType("inactive");
                        return;
                      }
                      router.forward();
                    }}
                  >
                    <ChevronRightIcon />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginRight: 10,
                      color: "gray",
                    }}
                  >
                    |
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginRight: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', marginRight: 10 }}>
                      {iconJsx ? (
                        iconJsx
                      ) : iconImage ? (
                        <img src={iconImage} alt={`${activeLink} icon`} style={{ width: 24, height: 24 }} />
                      ) : (
                        <i className={icon || "la la-home"} style={{ color: "#414651", fontSize: 24 }}></i>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <h4
                      className="text-gray d-inline-block mb-0"
                      style={{ fontSize: "16px", fontWeight: 550 }}
                    >
                      {activeLink}
                    </h4>
                  </div>
                  {currentPage && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        margin: "0 10px",
                      }}
                    >
                      <ChevronRightIcon />
                    </div>
                  )}
                  {/* If subpage is provided, show currentPage as plain and highlight subpage. Else, highlight currentPage */}
                  {!subpage ? (
                    <li className="breadcrumb-item">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          border: "1px solid #F8F9FC",
                          borderRadius: 10,
                          padding: "5px 10px",
                          backgroundColor: "#F8F9FC",
                        }}
                      >
                        <h4
                          className="text-black d-inline-block mb-0"
                          style={{ fontSize: "16px", fontWeight: 550 }}
                        >
                          {typeof window !== "undefined" ? new DOMParser().parseFromString(currentPage || "", "text/html").body.textContent : currentPage}
                        </h4>
                      </div>
                    </li>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        <h4
                          className="text-gray d-inline-block mb-0"
                          style={{ fontSize: "16px", fontWeight: 550 }}
                        >
                          {currentPage}
                        </h4>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          margin: "0 10px",
                        }}
                      >
                        <ChevronRightIcon />
                      </div>
                      <li className="breadcrumb-item">
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            border: "1px solid #F8F9FC",
                            borderRadius: 10,
                            padding: "5px 10px",
                            backgroundColor: "#F8F9FC",
                          }}
                        >
                          {subpageHref ? (
                            <a
                              href={subpageHref}
                              style={{ textDecoration: "none" }}
                            >
                              <h4
                                className="text-black d-inline-block mb-0"
                                style={{ fontSize: "16px", fontWeight: 550 }}
                              >
                                {subpage}
                              </h4>
                            </a>
                          ) : (
                            <h4
                              className="text-black d-inline-block mb-0"
                              style={{ fontSize: "16px", fontWeight: 550 }}
                            >
                              {subpage}
                            </h4>
                          )}
                        </div>
                      </li>
                    </>
                  )}
                </ol>
              </nav>
            </div>

            <div className="col-auto header-right-col">
              <div
                className="header-right-side"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  width: "100%",
                }}
              >
                <div className="header-date-time">
                  <span
                    style={{ fontSize: 14, fontWeight: 500, color: "#414651" }}
                  >
                    {date?.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: true,
                    })}
                  </span>
                  <span
                    style={{ fontSize: 14, fontWeight: 500, color: "#717680" }}
                  >
                    {date?.toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {user && hasNotificationProvider && <NotificationBell />}
                {user && (
                  <div
                    className="header-user-profile"
                    ref={profileRef}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                    }}
                    onClick={() => setShowAuthUserOptions(!showAuthUserOptions)}
                  >
                    <AvatarImage src={user?.image} alt="Avatar" />
                    <div
                      className="header-user-info"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: "#414651",
                        }}
                      >
                        {user?.name}
                      </span>
                      <span
                        style={{
                          fontWeight: 500,
                          fontSize: 14,
                          color: "#717680",
                          textTransform: "capitalize",
                        }}
                      >
                        {role?.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div
                className={`dropdown-menu dropdown-menu-right mt-1 org-dropdown-anim${
                  showAuthUserOptions ? " show" : ""
                }`}
                ref={menuRef}
                style={{
                  maxWidth: "300px",
                  borderRadius: 10,
                  boxShadow: "0 8px 32px rgba(30,32,60,0.18)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    borderBottom: "1px solid #E9EAEB",
                    padding: "10px",
                  }}
                >
                  <AvatarImage src={user?.image} alt="Avatar" />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 14,
                        color: "#414651",
                      }}
                    >
                      {user?.name}
                    </span>
                    <span
                      style={{
                        fontWeight: 500,
                        fontSize: 14,
                        color: "#717680",
                      }}
                    >
                      {user?.email}
                    </span>
                  </div>
                </div>
                <button
                  className="dropdown-item d-flex align-items-center"
                  style={{ fontWeight: 600, fontSize: 15 }}
                  onClick={() => {
                    window.location.href = "/privacy-policy";
                  }}
                >
                  <i className="la la-shield-alt"></i> Privacy Policy
                </button>
                <button
                  className="dropdown-item d-flex align-items-center"
                  style={{ fontWeight: 600, fontSize: 15 }}
                  onClick={() => {
                    window.location.href = "/terms-of-service";
                  }}
                >
                  <i className="la la-file-alt"></i> Terms of Service
                </button>
                <div
                  style={{
                    height: 1,
                    width: "100%",
                    backgroundColor: "#E9EAEB",
                  }}
                ></div>
                {/* Log out button */}
                <button
                  className="dropdown-item d-flex align-items-center"
                  style={{ fontWeight: 600, fontSize: 15 }}
                  onClick={() => {
                    localStorage.setItem("isLoggingOut", "true");
                    performLogout("/")
                  }}
                >
                  <i className="la la-sign-out"></i> Log out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {hasNotificationProvider && <NotificationModal />}
    </div>
  );
}
