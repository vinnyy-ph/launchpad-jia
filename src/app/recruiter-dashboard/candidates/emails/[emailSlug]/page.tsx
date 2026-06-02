"use client";

import React, { useEffect, useState } from "react";
import HeaderBar from "@/lib/PageComponent/HeaderBar";
import { useAppContext } from "@/lib/context/AppContext";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/utils/apiClient";
import axios from "axios";
import EmailModule from "@/lib/components/MailgunComponents/EmailModuleV2";
import type { MailgunAccount } from "@/lib/components/MailgunComponents/EmailEditor";

export default function () {
  const { orgID } = useAppContext();
  const params = useParams();
  const searchParams = useSearchParams();
  const emailSlug = params?.emailSlug;
  const queryCareeerId = searchParams?.get("careerId");

  const [candidate, setCandidate] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState<any>(null);

  const [mailgunAccounts, setMailgunAccounts] = useState<MailgunAccount[]>([]);
  const [mailgunRole, setMailgunRole] = useState<string | null>(null);
  const [selectedMailgunAccountId, setSelectedMailgunAccountId] = useState<
    string | null
  >(null);
  const [hasUserMailgunAccount, setHasUserMailgunAccount] = useState(false);
  const [hasGmailConnected, setHasGmailConnected] = useState(false);

  // Load candidate info: try sessionStorage quick-preview, else, fetch from API
  useEffect(() => {
    async function fetchCandidate() {
      if (!emailSlug) return;

      // Try session storage preview first
      try {
        const previewRaw = sessionStorage.getItem("candidatePreview");
        if (previewRaw) {
          const preview = JSON.parse(previewRaw);
          if (preview.affiliationId === emailSlug && preview.orgID === orgID) {
            const applicant =
              preview.applicant || preview.applicantInfo || preview;
            setCandidate({
              uid: emailSlug,
              name: applicant.name || applicant.applicantInfo?.name,
              email: applicant.email || applicant.applicantInfo?.email,
              image: applicant.image || applicant.applicantInfo?.image,
            });
          }
        }
      } catch (e) {
        // ignore
      }

      try {
        setIsLoading(true);

        // Prefer email from session preview when available, else, pass user identifiers
        let emailFromPreview: string | null = null;
        try {
          const previewRaw = sessionStorage.getItem("candidatePreview");
          if (previewRaw) {
            const preview = JSON.parse(previewRaw);
            if (
              preview.affiliationId === emailSlug &&
              preview.orgID === orgID
            ) {
              const applicant =
                preview.applicant || preview.applicantInfo || preview;
              emailFromPreview =
                applicant.email || applicant.applicantInfo?.email || null;
            }
          }
        } catch (e) {
          // ignore preview parse errors
        }

        // Fetch all applications for this applicant (within org and ongoing)
        const interviewsRes = await api.post("/api/fetch-interviews", {
          orgID,
          email: emailFromPreview || undefined,
          userID: emailSlug,
          affiliationId: emailSlug,
        });
        const allInterviews = interviewsRes?.data || [];

        // Cache key derived from org + applicant identifier so we can fallback
        const cacheKey = `fetch-interviews:${orgID}:${
          emailFromPreview || emailSlug
        }`;
        try {
          // persist successful non-empty fetches to sessionStorage for quick fallback
          if (Array.isArray(allInterviews) && allInterviews.length > 0) {
            try {
              sessionStorage.setItem(cacheKey, JSON.stringify(allInterviews));
            } catch (e) {
              // ignore storage errors (quota, disabled)
            }
          }
        } catch (e) {}

        // If candidate info wasn't available from preview, try deriving from the interviews
        if (!candidate && allInterviews.length > 0) {
          const first = allInterviews[0] || {};
          const derivedEmail =
            first.email || first.applicantEmail || first.candidateEmail || null;
          const derivedName =
            first.name || first.applicantName || first.candidateName || null;
          const derivedImage = first.image || first.avatar || null;
          if (derivedEmail || derivedName || derivedImage) {
            setCandidate({
              uid: emailSlug,
              name: derivedName,
              email: derivedEmail,
              image: derivedImage,
            });
          }
        }

        // First filter to the current org (if orgID provided)
        let orgInterviewsAll = Array.isArray(allInterviews)
          ? allInterviews.filter((i) =>
              orgID ? String(i.orgID) === String(orgID) : true
            )
          : [];

        // Then keep only those with applicationStatus === 'Ongoing' (case-insensitive)
        let ongoingInterviews = orgInterviewsAll.filter((i) => {
          const status = (i.applicationStatus || i.status || "").toString();
          return status.toLowerCase() === "ongoing";
        });

        // If the server returned no interviews (or none marked ongoing), try to use cached interviews
        if (
          !Array.isArray(allInterviews) ||
          allInterviews.length === 0 ||
          (orgInterviewsAll.length === 0 && ongoingInterviews.length === 0)
        ) {
          try {
            const raw = sessionStorage.getItem(cacheKey);
            if (raw) {
              const cached = JSON.parse(raw);
              if (Array.isArray(cached) && cached.length > 0) {
                // prefer cached org-filtered items
                const cachedOrg = cached.filter((i: any) =>
                  orgID ? String(i.orgID) === String(orgID) : true
                );
                if (cachedOrg.length > 0) {
                  orgInterviewsAll = cachedOrg;
                  ongoingInterviews = cachedOrg.filter((i: any) => {
                    const status = (
                      i.applicationStatus ||
                      i.status ||
                      ""
                    ).toString();
                    return status.toLowerCase() === "ongoing";
                  });
                  // If still no ongoing, fall back to orgInterviewsAll as a last resort
                  if (ongoingInterviews.length === 0)
                    ongoingInterviews = orgInterviewsAll;
                  // Debug note
                  try {
                    // eslint-disable-next-line no-console
                    console.debug(
                      "fetch-interviews: using cached interviews fallback",
                      cacheKey,
                      orgInterviewsAll.length
                    );
                  } catch (e) {}
                }
              }
            }
          } catch (e) {
            // ignore parse/storage errors
          }
        }

        // Debug logging to help diagnose why none may be returned
        try {
          // eslint-disable-next-line no-console
          console.log(
            "fetch-interviews:",
            { email: emailFromPreview || emailSlug },
            "returned",
            allInterviews.length,
            "orgMatched",
            orgInterviewsAll.length,
            "ongoing",
            ongoingInterviews.length
          );
        } catch (e) {}

        const orgInterviews = ongoingInterviews;

        // Map to a simplified applications list (unique by career id)
        const mapped: any[] = [];
        const seenCareerIds = new Set();
        for (const it of orgInterviews) {
          // interviews may store career id in `id`/`careerID`/`careerId`
          const careerId = it.id || it.careerID || it.careerId || null;
          const jobTitle = it.jobTitle || it.name || it.title || "Job";
          const status = it.applicationStatus || it.status || "Unknown";

          // If no careerId, fall back to interview UID to still list it
          const uniqKey = careerId ? String(careerId) : String(it._id);
          if (!seenCareerIds.has(uniqKey)) {
            seenCareerIds.add(uniqKey);
            mapped.push({ careerId, jobTitle, status, interview: it });
          }
        }
        setApplications(mapped);
      } catch (err) {
        console.error("Failed to load candidate data", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCandidate();
  }, [emailSlug, orgID]);

  // Prefetch mailgun accounts/role once for this page to share between inbox module and compose modal
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

    setMailgunAccounts((prev) => (prev.length ? prev : fallbackAccounts));
    setMailgunRole((prev) => prev || "hiring_manager");
    setSelectedMailgunAccountId((prev) =>
      prev !== null ? prev : fallbackAccounts[0]?._id || null
    );

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
            isActive: true,
          }));
          finalAccounts = [...finalAccounts, ...gmailAccounts];
        } catch (err) {
          console.debug("Could not fetch Gmail accounts", err);
        }

        const initialSelectedId = userAccount
          ? userAccount._id
          : finalAccounts[0]?._id || null;

        if (cancelled) return;
        setMailgunAccounts(finalAccounts);
        setMailgunRole(currentUserRole);
        setSelectedMailgunAccountId(initialSelectedId);
        setHasUserMailgunAccount(!!userAccount);
      } catch (err) {
        if (cancelled) return;
        console.debug(
          "mailgun accounts prefetch failed (candidate email page)",
          err
        );
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
        console.debug("Gmail status fetch failed (candidate email page)", err);
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
        activeLink="Candidates"
        currentPage={candidate?.name || "Candidate Name"}
        subpage="Emails"
        icon="la la-id-badge"
      />
      <div className="container-fluid mt--7" style={{ paddingTop: "6rem" }}>
        <div className="row">
          <div className="col">
            <div style={{ padding: "16px 20px" }}>
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  marginBottom: 24,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "16px" }}
                >
                  {/* Candidate Image */}
                  <img
                    src={candidate?.image || "/bad-fit-avatar.png"}
                    alt={candidate?.name || "Candidate Image"}
                    style={{ width: 56, height: 56, borderRadius: "50%" }}
                  />
                  {/* Candidate Name and Positions */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <h1
                        style={{
                          fontSize: "24px",
                          fontWeight: 550,
                          color: "#111827",
                        }}
                      >
                        {candidate?.name || "Candidate Name"}
                      </h1>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span style={{ color: "#111827" }}>
                          Active Applications:
                        </span>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          {applications.length === 0 ? (
                            <span style={{ color: "#6172F3", fontWeight: 500 }}>
                              None
                            </span>
                          ) : (
                            applications.map((app, idx) => (
                              <div
                                key={
                                  app.careerId
                                    ? String(app.careerId)
                                    : app.interview?._id || idx
                                }
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <a
                                  href={`/recruiter-dashboard/careers/manage/${
                                    app.careerId ||
                                    app.interview.id ||
                                    app.interview.careerID
                                  }?orgID=${orgID}`}
                                  style={{
                                    color: "#6172F3",
                                    fontWeight: 500,
                                    fontSize: 16,
                                    textDecoration: "underline",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={`${app.jobTitle} — ${app.status}`}
                                >
                                  <span>{app.jobTitle}</span>
                                  <i
                                    className="la la-external-link-alt"
                                    style={{
                                      fontSize: 16,
                                      color: "#6172F3",
                                      marginLeft: 4,
                                    }}
                                  ></i>
                                </a>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              {/* Email Inbox Component */}
              <EmailModule
                email={candidate?.email}
                careerId={queryCareeerId || undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
