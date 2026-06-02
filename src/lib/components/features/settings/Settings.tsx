"use client";

import styles from "./settings.module.scss";
import DomainSettings from "./DomainSettings";
import EmailSettings from "./EmailIntegration";
import NotificationSettings from "./NotificationSettings";
import { PlanUsageTab } from "./PlanUsageTab";
import { GlobalCareerSettings } from "./GlobalCareerSettings";
import Settings from "../../screens/Settings";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { superAdminList } from "@/lib/SuperAdminUtils";


const tabItems = [
  { key: "general", label: "Career Settings" },
  { key: "ai", label: "AI Model" },
  { key: "email", label: "Email Settings & Integrations" },
  { key: "notifications", label: "Notifications" },
  { key: "plan", label: "Plan and Usage" },
  { key: "domains", label: "Domains" },
] as const;

type TabItem = (typeof tabItems)[number];
type TabKey = TabItem["key"];

const tabParamMap: Record<string, TabKey> = {
  general: "general",
  ai: "ai",
  email: "email",
  notifications: "notifications",
  plan: "plan",
  domains: "domains",
};

const tabToParamMap: Record<TabKey, string> = {
  general: "general",
  ai: "ai",
  email: "email",
  notifications: "notifications",
  plan: "plan",
  domains: "domains",
};

const canViewTab = (
  tab: TabKey,
  {
    isSuper,
    hasDomainAccess,
  }: {
    isSuper: boolean;
    hasDomainAccess: boolean;
  }
) => {
  if (tab === "ai") return isSuper;
  if (tab === "domains") return hasDomainAccess;
  return true;
};

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>(tabItems[0].key);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdminRole, setIsAdminRole] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const activeOrg = localStorage.getItem("activeOrg");

    if (storedUser) {
      const parsedStoredUser = JSON.parse(storedUser);
      const isSuper = superAdminList.includes(parsedStoredUser?.email || "");
      setIsSuperAdmin(isSuper);
    }

    if (activeOrg) {
      const parsedOrg = JSON.parse(activeOrg);
      setIsAdminRole(parsedOrg?.role === "admin");
    }
  }, []);

  const canAccessDomains = isSuperAdmin || isAdminRole;

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const storedUser = localStorage.getItem("user");
    const activeOrg = localStorage.getItem("activeOrg");

    const isSuper = storedUser
      ? superAdminList.includes(JSON.parse(storedUser)?.email || "")
      : false;
    const isOrgAdmin = activeOrg ? JSON.parse(activeOrg)?.role === "admin" : false;
    const hasDomainAccess = isSuper || isOrgAdmin;
    const firstVisibleTab =
      tabItems.find((item) =>
        canViewTab(item.key, { isSuper, hasDomainAccess })
      )?.key ?? tabItems[0].key;

    const orgID = searchParams.get("orgID");

    if (tabParam && tabParamMap[tabParam]) {
      const requestedTab = tabParamMap[tabParam];

      if (!canViewTab(requestedTab, { isSuper, hasDomainAccess })) {
        setActiveTab(firstVisibleTab);
        const newTabParam = tabToParamMap[firstVisibleTab];
        const newUrl = orgID
          ? `?tab=${newTabParam}&orgID=${orgID}`
          : `?tab=${newTabParam}`;
        router.replace(newUrl, { scroll: false });
      } else {
        setActiveTab(requestedTab);
      }
    } else {
      const defaultTab = firstVisibleTab;
      setActiveTab(defaultTab);
      const newUrl = orgID
        ? `?tab=${defaultTab}&orgID=${orgID}`
        : `?tab=${defaultTab}`;
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, router]);

  const handleTabChange = (newTab: TabKey) => {
    const navigate = () => {
      setActiveTab(newTab);
      const tabParam = tabToParamMap[newTab];
      const orgID = searchParams.get("orgID");
      const newUrl = orgID ? `?tab=${tabParam}&orgID=${orgID}` : `?tab=${tabParam}`;
      router.push(newUrl, { scroll: false });
    };

    if (activeTab === 'notifications' && newTab !== 'notifications') {
      const event = new CustomEvent('confirmTabChange', { detail: { onConfirm: navigate } });
      window.dispatchEvent(event);
    } else {
      navigate();
    }
  };

  return (
    <div className={styles.settings}>
      <div className={styles.mainHeader}>
        <span className={styles.label}>Settings</span>
        <span className={styles.description}>
          Manage your personal preferences including email settings,
          notifications, and other account-related options.
        </span>
      </div>

      <div className={styles.tabGroup}>
        {tabItems
          .filter((item) =>
            canViewTab(item.key, {
              isSuper: isSuperAdmin,
              hasDomainAccess: canAccessDomains,
            })
          )
          .map((item, index) => (
            <span
              className={activeTab == item.key ? styles.active : styles.inactive}
              key={index}
              onClick={() => handleTabChange(item.key)}
            >
              {item.label}
            </span>
          ))}
      </div>

      {activeTab == "general" && <GlobalCareerSettings />}
      {activeTab == "ai" && isSuperAdmin && <Settings />}
      {activeTab == "email" && <EmailSettings />}
      {activeTab == "notifications" && <NotificationSettings />}
      {activeTab == "plan" && <PlanUsageTab />}
      {activeTab == "domains" && canAccessDomains && <DomainSettings />}
    </div>
  );
}
