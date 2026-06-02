"use client";

import React, { useEffect, useRef, useState } from "react";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import { useSearchParams } from "next/navigation";
import EmailModule from "@/lib/components/MailgunComponents/EmailModuleV2";
import { api } from "@/lib/utils/apiClient";
import axios from "axios";
import type { MailgunAccount } from "@/lib/components/MailgunComponents/EmailEditor";
import Button from "@/lib/components/ui/button/Button";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";

export default function () {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [hasUserMailgunAccount, setHasUserMailgunAccount] = useState(false);
  const [hasGmailConnected, setHasGmailConnected] = useState(false);
  const [activeOrg] = useLocalStorage("activeOrg", null);

  const orgID =
    searchParams.get("orgID") ||
    searchParams.get("orgId") ||
    searchParams.get("org");

  const currentOrgRole =
    activeOrg && orgID != null && String(activeOrg._id) === String(orgID)
      ? activeOrg.role
      : null;
  const canShowCampaigns =
    currentOrgRole === "admin" || currentOrgRole === "super_admin";

  // Fetch mailgun accounts/role once per page so both EmailModule and Compose modal can reuse
  useEffect(() => {
    if (!orgID) return;
    let cancelled = false;

    const activeOrgRaw =
      typeof window !== "undefined" ? localStorage.getItem("activeOrg") : null;
    const activeOrg = activeOrgRaw ? JSON.parse(activeOrgRaw) : null;
    const orgSlugSource =
      (activeOrg && (activeOrg.slug || activeOrg.name || activeOrg._id)) ||
      String(orgID || "");
    const orgSlug =
      String(orgSlugSource)
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 30) || "org";
    const domain = (activeOrg && activeOrg.domain) || "hellojia.ai";
    const fallbackEmails = [
      `hr-${orgSlug}@${domain}`,
      `no-reply-${orgSlug}@${domain}`,
    ];
    const fallbackAccounts: MailgunAccount[] = fallbackEmails.map((fb) => ({
      _id: `fallback:${fb}`,
      userId: null,
      organizationId: null,
      email: fb,
      mailboxName: undefined,
      domain: undefined,
      routeId: null,
      isActive: false,
    }));

    const prefetchAccounts = async () => {
      try {
        const [meRes, orgAccountsRes] = await Promise.allSettled([
          api.get("/api/mailgun-module/mg-fetch-account", {
            params: { orgId: orgID },
          }),
          api.get(`/api/mailgun-module/mg-fetch-org-accounts?orgId=${orgID}`),
        ]);

        let userAccount: MailgunAccount | null = null;
        let currentUserRole: string | null = "hiring_manager";
        if (meRes.status === "fulfilled") {
          userAccount = meRes.value.data?.account || null;
          currentUserRole = meRes.value.data?.role || "hiring_manager";
        }

        let orgAccountsData: MailgunAccount[] = [];
        if (orgAccountsRes.status === "fulfilled") {
          const data = orgAccountsRes.value.data;
          if (Array.isArray(data?.accounts)) orgAccountsData = data.accounts;
        }

        let finalAccounts: MailgunAccount[] = orgAccountsData.slice();
        if (
          userAccount &&
          !finalAccounts.find((a) => a && a._id === userAccount!._id)
        ) {
          finalAccounts = [userAccount, ...finalAccounts];
        }

        for (const fb of fallbackEmails) {
          if (!finalAccounts.find((a) => a && a.email === fb)) {
            finalAccounts.push({
              _id: `fallback:${fb}`,
              userId: null,
              organizationId: null,
              email: fb,
              mailboxName: undefined,
              domain: undefined,
              routeId: null,
              isActive: false,
            });
          }
        }

        // Fetch Gmail accounts for the organization
        try {
          const res = await axios.get(`/api/gmail/users?orgID=${orgID}`);
          const gmailAccounts = res.data.result.map((item: any) => ({
            _id: item._id,
            domain: "google",
            image: item.userDetails.picture,
            email: item.userDetails.email,
            userId: item.userID,
            routeId: null,
            organizationId: JSON.parse(localStorage.getItem("activeOrg") || "{}")._id,
            mailboxName: item.userDetails.email.split("@")[0],
            isActive: item.enableGmailSending,
          }));
          finalAccounts = [...finalAccounts, ...gmailAccounts];
        } catch (err) {
          console.debug("Could not fetch Gmail accounts", err);
        }

        const user = JSON.parse(localStorage.getItem("user") || "{}");
        const userGmailAccount = finalAccounts.find(
          (a) => a.email == user.email && a.isActive,
        );
        const initialSelectedId = userGmailAccount
          ? userGmailAccount._id
          : userAccount
            ? userAccount._id
            : finalAccounts[0]?._id || null;

        if (cancelled) return;
      } catch (err) {
        if (cancelled) return;
        // keep fallback seeded; log quietly
        console.debug("mailgun accounts prefetch failed (inbox page)", err);
        setHasUserMailgunAccount(false);
      }
    };

    prefetchAccounts();

    const handleAccountEnabled = (evt: any) => {
      try {
        const evtOrg = evt?.detail?.orgId || evt?.detail?.orgID;
        if (evtOrg && String(evtOrg) !== String(orgID)) return;
      } catch (e) {
        // ignore malformed events
      }
      prefetchAccounts();
    };

    if (typeof window !== "undefined") {
      window.addEventListener(
        "mailgun:account-enabled",
        handleAccountEnabled as EventListener
      );
    }

    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "mailgun:account-enabled",
          handleAccountEnabled as EventListener
        );
      }
    };
  }, [orgID]);

  // Fetch Gmail connection status
  useEffect(() => {
    if (!orgID) return;
    let cancelled = false;

    const fetchGmailStatus = async () => {
      try {
        const token = localStorage.getItem("authToken");
        if (!token) {
          setHasGmailConnected(false);
          return;
        }
        const response = await api.get("/api/emails/settings", {
          params: { orgID: orgID },
          headers: { Authorization: token },
        });
        const emailSettings = response?.data?.emailSettings;
        if (cancelled) return;
        setHasGmailConnected(emailSettings?.connected === true);
      } catch (err) {
        if (cancelled) return;
        console.debug("Gmail status fetch failed (inbox page)", err);
        setHasGmailConnected(false);
      }
    };

    fetchGmailStatus();

    return () => {
      cancelled = true;
    };
  }, [orgID]);

  return (
    <>
      <HeaderBar
        activeLink="Inbox"
        currentPage="Overview"
        icon="la la-envelope"
      />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
        <div className="row">
          <div className="col">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  marginBottom: "35px",
                }}
              >
                <h1
                  style={{
                    fontSize: "24px",
                    fontWeight: 550,
                    color: "#111827",
                  }}
                >
                  Emails
                </h1>
                <span
                  style={{
                    fontSize: "16px",
                    color: "#717680",
                    fontWeight: 500,
                  }}
                >
                  Easily keep track of all emails from all your career openings.
                </span>
              </div>

              {canShowCampaigns && (
                <Button variant="secondary" label="Email Campaigns" onClick={() => router.push(`/recruiter-dashboard/inbox/campaigns?orgId=${orgID}`)} />
              )}
            </div>

            {/* Email Inbox Component */}
            <EmailModule />
          </div>
        </div>
      </div>
    </>
  );
}
