"use client";
import React, { useState } from "react";
import Link from "next/link";
import OrgDropdownV2 from "../components/Dropdown/OrgDropdownV2";
import AddOrgModal from "../Modal/AddOrgModal";
import SuperAdminFeature from "../components/SuperAdminFeature";
import { useRecruiterContext } from "../context/RecruiterContext";
import { useRouter, useSearchParams } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  /**
   * @deprecated Use iconImage instead
   */
  icon?: string;
  iconImage?: string;
  badgeCount?: number;
}

interface SidebarV2Props {
  activeLink: string;
  navItems: NavItem[];
  footerNavItems: NavItem[];
  superAdminNavItems?: NavItem[];
  hiringToolNavItems?: NavItem[];
  isAdmin?: boolean;
  onTabClick?: (tabName: string) => void;
  suppressHydrationWarning?: boolean;
}

export default function SidebarV2(props: SidebarV2Props) {
  const {
    activeLink,
    navItems,
    footerNavItems,
    superAdminNavItems,
    hiringToolNavItems,
    isAdmin = false,
    onTabClick,
  } = props;
  const [showAddOrgModal, setShowAddOrgModal] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { hasUnsavedChanges, setModalType } = useRecruiterContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgID = searchParams.get("orgID");

  const toggleSidebar = () => setIsOpen(!isOpen);
  const closeSidebar = () => setIsOpen(false);

  return (
    <>
      {showAddOrgModal && (
        <AddOrgModal onClose={() => setShowAddOrgModal(false)} />
      )}

      {/* Bubble Button for Mobile */}
      <button
        className={`sidebar-toggle-bubble ${isOpen ? "open" : ""}`}
        onClick={toggleSidebar}
        aria-label="Toggle Sidebar"
      >
        <i className={`la ${isOpen ? "la-times" : "la-bars"}`}></i>
      </button>

      {/* Overlay for Mobile */}
      {isOpen && (
        <div className="sidebar-mobile-overlay" onClick={closeSidebar} />
      )}

      <aside className={`sidebar-v2 ${isOpen ? "open" : ""}`}>
        {/* Header and Navigation - Scrollable */}
        <div className="sidebar-header">
          <div className="sidebar-subheader">
            <img src="/jia-dashboard-logo.png" alt="Logo" />
          </div>
          {isAdmin ? (
            <div
              style={{
                border: "1px solid #E0E0E0",
                borderRadius: "10px",
                padding: "8px 16px",
                backgroundColor: "#FFFFFF",
                color: "#181D27",
                fontSize: 14,
                fontWeight: 700,
                textAlign: "center",
                margin: "20px",
              }}
            >
              <span>Admin Portal</span>
            </div>
          ) : (
            <OrgDropdownV2 />
          )}

          {/* Navigation */}
          <nav className="nav-section" style={{ marginTop: 16 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#A4A7AE",
              }}
            >
              GENERAL
            </span>
            {navItems.map((item) => (
              <Link
                href={item.href}
                key={item.label}
                onClick={(e) => {
                  e.preventDefault();
                  if (hasUnsavedChanges) {
                    setModalType("inactive");
                    return;
                  }

                  // Call callback for badge-enabled tabs
                  const tabName = item.label.toLowerCase();
                  if (
                    onTabClick &&
                    (tabName === "careers" || tabName === "requisitions")
                  ) {
                    onTabClick(tabName);
                  }

                  closeSidebar();
                  router.push(`${item.href}?orgID=${orgID}`);
                }}
              >
                <div
                  className={`nav-item ${
                    activeLink === item.label ? "active" : ""
                  }`}
                >
                  <span>
                    {item.iconImage && <img src={item.iconImage} alt={item.label} style={{ width: 16, height: 16 }} />}
                  </span>
                  <span>{item.label}</span>
                  {item.badgeCount !== undefined && item.badgeCount > 0 && (
                    <span className="nav-badge">
                      {item.badgeCount > 99 ? "99+" : item.badgeCount}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </nav>

          {hiringToolNavItems?.length > 0 && <nav className="nav-section">
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#A4A7AE",
              }}
            >
              HIRING TOOLS
            </span>
            {hiringToolNavItems.map((item: any) => (
              <Link
                href={item.href}
                key={item.label}
                onClick={(e) => {
                  e.preventDefault();
                  if (hasUnsavedChanges) {
                    setModalType("inactive");
                    return;
                  }

                  // Call callback for badge-enabled tabs
                  const tabName = item.label.toLowerCase();
                  if (
                    onTabClick &&
                    (tabName === "careers" || tabName === "requisitions")
                  ) {
                    onTabClick(tabName);
                  }

                  closeSidebar();
                  const params = new URLSearchParams(searchParams.toString());
                  router.push(`${item.href}?${params.toString()}`);
                }}
              >
                <div
                  className={`nav-item ${
                    activeLink === item.label ? "active" : ""
                  }`}
                >
                  <span>
                    {item.iconImage && <img src={item.iconImage} alt={item.label} style={{ width: 16, height: 16 }} />}
                  </span>
                  <span>{item.label}</span>
                  {item.badgeCount !== undefined && item.badgeCount > 0 && (
                    <span className="nav-badge">
                      {item.badgeCount > 99 ? "99+" : item.badgeCount}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </nav>}

          {/* <div className="nav-divider" /> */}
          {footerNavItems?.length > 0 && <nav className="nav-section">
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#A4A7AE",
              }}
            >
              ORGANIZATION
            </span>
            {footerNavItems.map((item) => (
              <Link
                href={item.href}
                key={item.label}
                onClick={(e) => {
                  e.preventDefault();
                  if (hasUnsavedChanges) {
                    setModalType("inactive");
                    return;
                  }

                  // Call callback for badge-enabled tabs
                  const tabName = item.label.toLowerCase();
                  if (
                    onTabClick &&
                    (tabName === "careers" || tabName === "requisitions")
                  ) {
                    onTabClick(tabName);
                  }

                  closeSidebar();
                  const params = new URLSearchParams(searchParams.toString());
                  router.push(`${item.href}?${params.toString()}`);
                }}
              >
                <div
                  className={`nav-item ${
                    activeLink === item.label ? "active" : ""
                  }`}
                >
                  <span>
                    {item.iconImage && <img src={item.iconImage} alt={item.label} style={{ width: 16, height: 16 }} />}
                  </span>
                  <span>{item.label}</span>
                  {item.badgeCount !== undefined && item.badgeCount > 0 && (
                    <span className="nav-badge">
                      {item.badgeCount > 99 ? "99+" : item.badgeCount}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </nav>}

          {superAdminNavItems && superAdminNavItems.length > 0 && (
            <SuperAdminFeature>
              <nav className="nav-section">
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#A4A7AE",
                  }}
                >
                  ADMIN MENU
                </span>
                {superAdminNavItems.map((item) => (
                  <Link
                    href={item.href}
                    key={item.label}
                    onClick={(e) => {
                      e.preventDefault();
                      if (hasUnsavedChanges) {
                        setModalType("inactive");
                        return;
                      }

                      // Call callback for badge-enabled tabs
                      const tabName = item.label.toLowerCase();
                      if (
                        onTabClick &&
                        (tabName === "careers" || tabName === "requisitions")
                      ) {
                        onTabClick(tabName);
                      }

                      closeSidebar();
                      const params = new URLSearchParams(
                        searchParams.toString()
                      );
                      router.push(`${item.href}?${params.toString()}`);
                    }}
                  >
                    <div
                      className={`nav-item ${
                        activeLink === item.label ? "active" : ""
                      }`}
                    >
                      <span>
                        {item.iconImage && <img src={item.iconImage} alt={item.label} style={{ width: 16, height: 16 }} />}
                      </span>
                      <span>{item.label}</span>
                      {item.badgeCount !== undefined && item.badgeCount > 0 && (
                        <span className="nav-badge">
                          {item.badgeCount > 99 ? "99+" : item.badgeCount}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </nav>
            </SuperAdminFeature>
          )}
        </div>

        {/* Footer - Fixed at bottom */}
        <div className="sidebar-footer">
          <span style={{ fontSize: 12, fontWeight: 500, color: "#717680" }}>
            &copy; 2025
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#717680" }}>
            White Cloak Technologies Inc.
          </span>
        </div>
      </aside>
    </>
  );
}
