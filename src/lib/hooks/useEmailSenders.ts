import { useState, useEffect } from "react";
import { apiClient } from "@/lib/utils/apiClient";

export interface OrgAccountOption {
  id: string;
  value: string;
  label: string;
  subtitle: string;
  email: string;
  imageSrc: string;
  userId?: string;
}

export function useEmailSenders(
  orgID: string | null,
  orgNameFromContext: string | null,
  userEmail?: string | null,
  userId?: string | null,
  userRoles?: string[] | null,
  userOrgRoles?: Record<string, string[]> | null,
  currentOrgRole?: string | null,
) {
  const [orgAccounts, setOrgAccounts] = useState<any[]>([]);
  const [senderOptions, setSenderOptions] = useState<OrgAccountOption[]>([]);
  const [orgName, setOrgName] = useState<string | null>(orgNameFromContext);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [gmailEmails, setGmailEmails] = useState<string[]>([]);
  const [outlookEmails, setOutlookEmails] = useState<string[]>([]);
  const [defaultSender, setDefaultSender] = useState<OrgAccountOption[]>([]);
  const [outlookUser, setOutlookUser] = useState<any>(null);
  const [outlookEmail, setOutlookEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!orgID) {
      setIsLoadingAccounts(false);
      return;
    }

    async function fetchOrgAccountsAndSettings() {
      try {
        setIsLoadingAccounts(true);

        // Best-effort org name from localStorage
        if (typeof window !== "undefined") {
          const activeOrgRaw = localStorage.getItem("activeOrg");
          if (activeOrgRaw) {
            try {
              const parsed = JSON.parse(activeOrgRaw);
              if (parsed?.name) setOrgName(parsed.name);
            } catch (_) {}
          }
        }

        // Fetch org accounts, domains, gmail/outlook accounts, and email settings
        const [
          orgAccountsRes,
          domainsRes,
          gmailRes,
          outlookRes,
          emailSettingsRes,
        ] = await Promise.allSettled([
          apiClient.get(
            `/api/mailgun-module/mg-fetch-org-accounts?orgId=${orgID}`,
          ),
          apiClient.get("/api/mailgun-module/fetch-org-domains", {
            params: { orgId: orgID },
          }),
          apiClient.get(`/api/gmail/users?orgID=${orgID}`),
          apiClient.get(`/api/outlook/users?orgID=${orgID}`),
          apiClient.get(`/api/emails/settings?orgID=${orgID}`),
        ]);

        let accounts: any[] = [];
        let orgNameFromApi: string | null = null;
        if (orgAccountsRes.status === "fulfilled") {
          const data = orgAccountsRes.value.data;
          if (Array.isArray(data?.accounts)) {
            accounts = data.accounts;
          }
          if (data?.orgName) {
            orgNameFromApi = String(data.orgName);
          }
        }

        // Add Gmail accounts to accounts array and collect their emails
        let gmailEmailsList: string[] = [];
        if (
          gmailRes &&
          gmailRes.status === "fulfilled" &&
          Array.isArray(gmailRes.value.data?.result)
        ) {
          const gmailAccounts = gmailRes.value.data.result.map((item: any) => {
            const memberImage =
              item.userDetails && item.userDetails.image
                ? item.userDetails.image
                : null;
            const email = item.userDetails.email;
            gmailEmailsList.push(email);
            return {
              _id: `gmail:${item._id}`,
              email,
              image: memberImage || null,
              displayName: item.userDetails.name || email.split("@")[0],
              mailboxName: email.split("@")[0],
              domain: "google",
              userId:
                item.userID != null
                  ? String(item.userID)
                  : item.userDetails?.userId != null
                    ? String(item.userDetails.userId)
                    : null,
            };
          });
          // Only add if not already present (dedupe by email)
          for (const gmail of gmailAccounts) {
            if (!accounts.find((a) => a.email === gmail.email)) {
              accounts.push(gmail);
            }
          }
        }
        setGmailEmails(gmailEmailsList);

        // Add Outlook accounts to accounts array and collect their emails
        let outlookEmailsList: string[] = [];
        let outlookUser: any = null;
        let outlookEmail: string | null = null;

        let outlookUserLocal: any = null;
        let outlookEmailLocal: string | null = null;
        if (
          emailSettingsRes &&
          emailSettingsRes.status === "fulfilled" &&
          emailSettingsRes.value.data?.emailSettings
        ) {
          const settings = emailSettingsRes.value.data.emailSettings;
          outlookUserLocal = settings.outlookUser ?? null;
          outlookEmailLocal = settings.outlookEmail ?? null;
          setOutlookUser(outlookUserLocal);
          setOutlookEmail(outlookEmailLocal);
        }

        if (
          outlookRes &&
          outlookRes.status === "fulfilled" &&
          Array.isArray(outlookRes.value.data?.users)
        ) {
          const outlookAccountsRes = outlookRes.value.data.users.map(
            (item: any) => {
              // item matches { userId, email, mode: 'outlook', connected, lastSyncedAt, userName, userEmail }
              const email = item.email; // Outlook email
              outlookEmailsList.push(email);

              // Check if this is the connected outlookUser and has a picture 
              let imageSrc = null;
              if (
                outlookUserLocal &&
                outlookEmailLocal &&
                email &&
                outlookEmailLocal.toLowerCase() === email.toLowerCase() &&
                outlookUserLocal.picture
              ) {
                imageSrc = outlookUserLocal.picture;
              }

              const displayName =
                outlookUserLocal &&
                outlookEmailLocal &&
                email &&
                outlookEmailLocal.toLowerCase() === email.toLowerCase()
                  ? outlookUserLocal.name || item.userName || email.split("@")[0]
                  : item.userName || email.split("@")[0];

              return {
                _id: `outlook:${item.userId}`, // Using userId as unique suffix or a unique mapping
                email: email,
                image: imageSrc,
                displayName,
                mailboxName: email.split("@")[0],
                domain: "outlook", // Custom domain indicator
                userId: String(item.userId),
              };
            },
          );

          for (const outlook of outlookAccountsRes) {
            // Dedupe: if same email already exists (e.g. gmail and outlook same address?! unlikely but safe)
            if (!accounts.find((a) => a.email === outlook.email)) {
              accounts.push(outlook);
            }
          }
        }
        setOutlookEmails(outlookEmailsList);

        let domainsList: string[] = [];
        if (domainsRes.status === "fulfilled") {
          const domainsData = domainsRes.value.data;
          if (Array.isArray(domainsData)) {
            domainsList = domainsData
              .filter((d: any) => d?.fullDomain)
              .map((d: any) => d.fullDomain);
          }
        }
        if (domainsList.length === 0) {
          domainsList = ["hellojia.ai"];
        }
        const fallbackEmails = domainsList.flatMap((d: string) => [
          `hr@${d}`,
          `noreply@${d}`,
        ]);
        for (const fb of fallbackEmails) {
          if (!accounts.find((a) => a.email === fb)) {
            accounts.push({
              _id: `fallback:${fb}`,
              email: fb,
              image: null,
            });
          }
        }
        const resolvedOrgName = orgNameFromApi || orgName || null;
        if (resolvedOrgName) setOrgName(resolvedOrgName);
        const options = accounts.map((account) => {
          const email = account.email || "";
          const [local, domain] = email.split("@");
          let displayName =
            account.displayName || account.mailboxName || local || "";
          if (local === "hr") {
            displayName = `${resolvedOrgName || domain || "HR"} Recruitment Team`;
          } else if (local === "noreply") {
            displayName = resolvedOrgName || domain || displayName;
          }
          return {
            id: account._id,
            value: account._id,
            label: displayName || account.email,
            subtitle: account.email,
            email: account.email,
            imageSrc:
              account.image ||
              `https://api.dicebear.com/9.x/glass/svg?seed=${account.email}`,
            userId: account.userId,
          };
        });

        // Apply role-based filtering for hiring managers
        // Role comes from activeOrg.role (AuthGuard) or user.roles / user.orgRoles
        let filteredOptions = options;
        const isHiringManager =
          currentOrgRole === "hiring_manager" ||
          userRoles?.includes("hiring_manager") ||
          userOrgRoles?.[orgID || ""]?.includes("hiring_manager");

        if (isHiringManager && userEmail) {
          const normalizedUserEmail = userEmail.toLowerCase();
          // Check if Gmail/Outlook integration is enabled
          let gmailIntegrationEnabled = false;
          let outlookIntegrationEnabled = false;

          if (
            emailSettingsRes &&
            emailSettingsRes.status === "fulfilled" &&
            emailSettingsRes.value.data?.emailSettings
          ) {
            const emailSettings = emailSettingsRes.value.data.emailSettings;
            gmailIntegrationEnabled =
              emailSettings?.gmailIntegrationEnabled || false;
            outlookIntegrationEnabled =
              emailSettings?.enableOutlookSending || false;
          }

          filteredOptions = options.filter((option) => {
            // Always exclude fallback accounts
            if (option.id?.startsWith("fallback:")) {
              return false;
            }
            // Gmail: include only the logged-in user's Gmail
            if (option.id?.startsWith("gmail:")) {
              return (
                gmailIntegrationEnabled &&
                option.email?.toLowerCase() === normalizedUserEmail
              );
            }
            // Outlook: include only the logged-in user's Outlook
            if (option.id?.startsWith("outlook:")) {
              return (
                outlookIntegrationEnabled &&
                accounts.find((a) => a._id === option.id)?.userId === userId
              );
            }

            // Mailgun: for hiring managers, mg-fetch-org-accounts already returns only this user's accounts.
            // Include all Mailgun options (non-Gmail, non-fallback) when isHiringManager.
            // If API didn't filter (e.g. admin path), still require userId or email match and org match.
            const accountData = accounts.find(
              (a) => a._id === option.id || a.email === option.email,
            );
            if (!accountData) return false;
            const orgMatch =
              accountData.organizationId == null ||
              String(accountData.organizationId) === String(orgID);
            if (!orgMatch) return false;

            // Hiring manager: API already filtered to their accounts; include all Mailgun from list
            // (Exclude Gmail/Outlook/Fallback which are handled above)
            const isMailgunOption =
              !option.id?.startsWith("gmail:") &&
              !option.id?.startsWith("outlook:") &&
              !option.id?.startsWith("fallback:");
            if (isMailgunOption) return true;
            return false;
          });
        }
        setOrgAccounts(accounts);
        setSenderOptions(filteredOptions);

        // --- Default sender logic ---
        let preferredSender: OrgAccountOption | undefined;
        if (
          emailSettingsRes &&
          emailSettingsRes.status === "fulfilled" &&
          emailSettingsRes.value.data?.emailSettings
        ) {
          const emailSettings = emailSettingsRes.value.data.emailSettings;
          if (emailSettings?.preferGmail && emailSettings?.user?.email) {
            preferredSender = filteredOptions.find(
              (opt) =>
                opt.email.toLowerCase() ===
                emailSettings.user.email.toLowerCase(),
            );
          }
          // Todo: preference for Outlook?
        }
        if (!preferredSender) {
          // Fallback: first Mailgun account from filtered options
          preferredSender = filteredOptions.find(
            (opt) =>
              !gmailEmailsList.includes(opt.email) &&
              !outlookEmailsList.includes(opt.email),
          );
        }
        if (!preferredSender && filteredOptions.length > 0) {
          preferredSender = filteredOptions[0];
        }
        setDefaultSender(preferredSender ? [preferredSender] : []);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to fetch org accounts:", error);
      } finally {
        setIsLoadingAccounts(false);
      }
    }
    fetchOrgAccountsAndSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgID, userEmail, userId, userRoles, userOrgRoles, currentOrgRole]);

  return {
    orgAccounts,
    senderOptions,
    orgName,
    isLoadingAccounts,
    gmailEmails,
    outlookEmails,
    defaultSender,
    outlookUser,
    outlookEmail,
  };
}
