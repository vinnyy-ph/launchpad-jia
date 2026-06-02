"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "@/lib/styles/guestPortal/header.module.scss";
import UserAvatar from "@/lib/components/RequisitionsComponents/UserAvatar";
import NotificationBell from "@/lib/components/NotificationComponents/NotificationBell";
import NotificationModal from "@/lib/components/NotificationComponents/NotificationModal";
import { performLogout } from "@/lib/Utils";

interface UserData {
  name: string;
  email: string;
  photoURL?: string;
}

export default function GuestPortalHeader() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get user data from localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.user) {
      try {
        const user = JSON.parse(localStorage.user);
        setUserData({
          name: user.name || user.displayName || "Guest User",
          email: user.email || "",
          photoURL: user.photoURL || user.avatar || `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(user.name || user.email || "Guest")}`,
        });
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleLogout = async () => {
    try {
      // Set flag to prevent GuestAuthGuard from showing "Session Expired" popup
      localStorage.setItem("isLoggingOut", "true");

      await performLogout("/");
    } catch (error) {
      console.error("Logout error:", error);
      // Still redirect even if logout fails
      window.location.href = "/";
    }
  };

  return (
    <>
    <header className={styles.headerContainer}>
      {/* Left side - Logo and Company Name */}
      <div className={styles.leftSection}>
        <img
          src="/iconsV3/jia-guest-portal-logo.png"
          alt="Jia Guest Portal"
          className={styles.logo}
        />
        <div className={styles.divider} />
        <div className={styles.companySection}>
          <img
            src="/iconsV3/circle-company-logo.svg"
            alt="Company Logo"
            className={styles.companyLogo}
          />
          <span className={styles.companyName}>
            White Cloak Technologies, Inc.
          </span>
        </div>
      </div>

      {/* Right side - Notification Bell and Avatar with Dropdown */}
      <div className={styles.rightSection} ref={dropdownRef}>
        <NotificationBell />
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={styles.avatarButton}
        >
          <UserAvatar
            name={userData?.name || "Guest User"}
            email={userData?.email || ""}
            avatar={userData?.photoURL}
            size={36}
          />
        </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className={styles.dropdownMenu}>
              {/* User Info Header */}
              <div className={styles.userInfo}>
                <UserAvatar
                  name={userData?.name || "Guest User"}
                  email={userData?.email || ""}
                  avatar={userData?.photoURL}
                  size={36}
                />
                <div className={styles.userDetails}>
                  <div className={styles.userName}>
                    {userData?.name || "Guest User"}
                  </div>
                  <div className={styles.userEmail}>
                    {userData?.email || ""}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className={styles.dividerLine} />

              {/* Privacy Policy Button */}
              <button
                onClick={() => window.location.href = "/privacy-policy"}
                className={styles.menuButton}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8 1.33334L2.66667 3.33334V7.33334C2.66667 10.76 4.95333 13.9267 8 14.6667C11.0467 13.9267 13.3333 10.76 13.3333 7.33334V3.33334L8 1.33334ZM8 7.66667H12C11.6933 10.04 10.0867 12.08 8 12.62V8.00001H4V4.16667L8 2.74667V7.66667Z"
                    fill="#667085"
                  />
                </svg>
                Privacy Policy
              </button>

              {/* Terms of Service Button */}
              <button
                onClick={() => window.location.href = "/terms-of-service"}
                className={styles.menuButton}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9.33333 1.33334H4C3.26667 1.33334 2.66667 1.93334 2.66667 2.66667V13.3333C2.66667 14.0667 3.26 14.6667 3.99333 14.6667H12C12.7333 14.6667 13.3333 14.0667 13.3333 13.3333V5.33334L9.33333 1.33334ZM12 13.3333H4V2.66667H8.66667V6H12V13.3333ZM5.33333 10H10.6667V11.3333H5.33333V10ZM5.33333 7.33334H10.6667V8.66667H5.33333V7.33334Z"
                    fill="#667085"
                  />
                </svg>
                Terms of Service
              </button>

              {/* Divider */}
              <div className={styles.dividerLine} />

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className={styles.logoutButton}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M11.3333 11.3333L14 8M14 8L11.3333 4.66667M14 8H6M6 14H3.46667C2.72 14 2.34667 14 2.06133 13.8547C1.81044 13.7268 1.60653 13.5229 1.47866 13.272C1.33333 12.9867 1.33333 12.6133 1.33333 11.8667V4.13333C1.33333 3.38667 1.33333 3.01333 1.47866 2.728C1.60653 2.47711 1.81044 2.2732 2.06133 2.14533C2.34667 2 2.72 2 3.46667 2H6"
                    stroke="#667085"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Logout
              </button>
            </div>
          )}
      </div>
    </header>
    <NotificationModal />
    </>
  );
}
