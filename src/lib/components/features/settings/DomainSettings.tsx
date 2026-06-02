"use client";

import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { useSearchParams } from "next/navigation";
import styles from "./settings.module.scss";
import { errorToast, successToast } from "@/lib/Utils";
import { api } from "@/lib/utils/apiClient";
import DomainRecordsModal from "@/lib/components/AdminComponents/DomainRecordsModal";
import { useAppContext } from "@/lib/context/AppContext";

const setupSteps = [
  {
    title: "Step 1: Add DNS Records",
    description:
      "Log in to your domain provider and navigate to the DNS management section. Add the required DNS records as shown in the domain records modal.",
  },
  {
    title: "Step 2: Wait for DNS Propagation",
    description:
      "DNS changes can take up to 24-48 hours to propagate globally. Most changes take effect within a few hours.",
    tip: "You can use online DNS checkers to monitor propagation status across different regions.",
  },
  {
    title: "Step 3: Verify Your Domain",
    description:
      "Once DNS records are added, click the 'Verify status' button in the domain records modal to check if your domain is properly configured.",
  },
  {
    title: "Step 4: Start Sending Emails",
    description:
      "After verification is complete, your domain will be active and ready to send interview and system emails on behalf of your organization.",
  },
];

export function InstructionsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <span className={styles.title}>DNS Setup Instructions</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
          >
            <i className="las la-times"></i>
          </button>
        </div>

        {/* Content */}
        <div className={styles.instructionsContainer}>
          <div className={styles.instructionsHeader}>
            <span className={styles.title}>How to verify your domain</span>
            <span className={styles.description}>
              To complete setup, you'll need to add the DNS records shown below
              to your domain provider (e.g. Cloudflare, GoDaddy, Namecheap).
            </span>
          </div>
          <div className={styles.stepsContainer}>
            {setupSteps.map((step, index) => (
              <div key={index} className={styles.step}>
                <img src="/jia-star.png" alt="Star" />
                <div className={styles.stepContent}>
                  <span className={styles.stepTitle}>{step.title}</span>
                  <span className={styles.stepDescription}>
                    {step.description}
                  </span>
                  {step.tip && (
                    <div className={styles.tip}>Tip: {step.tip}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={`${styles.secondaryButton}`}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function () {
  const searchParams = useSearchParams();
  const { user, orgID: orgIdFromContext } = useAppContext();
  const orgID = searchParams.get("orgID") || orgIdFromContext || "";

  const [organization, setOrganization] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [companySlug, setCompanySlug] = useState("");
  const [companyDomains, setCompanyDomains] = useState<string[]>([""]);
  const [domainButtonStates, setDomainButtonStates] = useState<
    Record<number, "save" | "view" | "loading" | "deleting">
  >({});
  const [recordsModalOpen, setRecordsModalOpen] = useState(false);
  const [recordsModalDomain, setRecordsModalDomain] = useState("");
  const [recordsModalRecords, setRecordsModalRecords] = useState<
    { type: string; host: string; value: string }[]
  >([]);
  const [recordsModalLoading, setRecordsModalLoading] = useState(false);
  const [recordsModalVerifying, setRecordsModalVerifying] = useState(false);
  const [subdomainStatus, setSubdomainStatus] = useState<{
    status: string;
    message: string;
    loading: boolean;
  } | null>(null);
  const [statusRequested, setStatusRequested] = useState(false);
  const [connectedDomainsCount, setConnectedDomainsCount] = useState(0);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [memberRoleLoading, setMemberRoleLoading] = useState(true);
  const MAX_DOMAINS = 5;
  const isAdminRole = memberRole === "admin" || memberRole === "super_admin";

  // Validation functions
  const isValidDomainFormat = (domain: string): boolean => {
    const domainRegex =
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:[a-z]{2,}|xn--[a-z0-9]+)$/i;
    return domainRegex.test(domain.toLowerCase());
  };

  const isValidSlugFormat = (slug: string): boolean => {
    const slugRegex = /^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$/;
    return slugRegex.test(slug) && slug.length >= 3 && slug.length <= 50;
  };

  const getEffectiveOrgId = () => organization?._id || orgID || "";

  useEffect(() => {
    const fetchMemberRole = async () => {
      if (!orgID || !user?.email) {
        setMemberRole(null);
        setMemberRoleLoading(false);
        return;
      }

      setMemberRoleLoading(true);
      try {
        const response = await api.post("/api/get-org-members", { orgID });

        if (response.status === 200 && Array.isArray(response.data?.members)) {
          const member = response.data.members.find(
            (m: any) => m.email === user.email
          );
          setMemberRole(member?.role ?? null);
        } else {
          setMemberRole(null);
        }
      } catch (error) {
        console.error("Error fetching member role:", error);
        setMemberRole(null);
      } finally {
        setMemberRoleLoading(false);
      }
    };

    fetchMemberRole();
  }, [orgID, user?.email]);

  // Fetch organization from database when orgID changes
  useEffect(() => {
    const fetchOrganization = async () => {
      if (!orgID || !isAdminRole) return;

      // Clear existing data to prevent showing stale info
      setOrganization(null);
      setCompanySlug("");
      setCompanyDomains([""]);
      setDomainButtonStates({});
      setConnectedDomainsCount(0);
      setSubdomainStatus(null);
      setStatusRequested(false);

      try {
        const response = await api.get(
          `/api/admin/get-organization-details?id=${orgID}`
        );

        if (response.status === 200 && response.data) {
          // Verify the fetched org matches the requested orgID
          if (response.data._id === orgID) {
            setOrganization(response.data);
            // Update localStorage with fresh data
            localStorage.setItem("activeOrg", JSON.stringify(response.data));
          }
        }
      } catch (error) {
        console.error("Error fetching organization:", error);
        errorToast("Failed to load organization data", 1300);
      }
    };

    fetchOrganization();
  }, [orgID, isAdminRole]); // Re-run when orgID changes or role updates

  useEffect(() => {
    if (memberRoleLoading || isAdminRole) return;

    setOrganization(null);
    setCompanySlug("");
    setCompanyDomains([""]);
    setDomainButtonStates({});
    setConnectedDomainsCount(0);
    setSubdomainStatus(null);
    setStatusRequested(false);
  }, [isAdminRole, memberRoleLoading]);

  // Load initial data
  useEffect(() => {
    if (organization) {
      setCompanySlug(organization.companySlug || "");
      const domains =
        Array.isArray(organization.companyDomains) &&
        organization.companyDomains.length > 0
          ? organization.companyDomains
          : [""];
      setCompanyDomains(domains);

      // Initialize button states for existing domains
      const initialStates: Record<number, "save" | "view"> = {};
      domains.forEach((domain: string, index: number) => {
        if (domain && domain.trim().length > 0) {
          initialStates[index] = "view";
        }
      });
      setDomainButtonStates(initialStates);

      // Count connected domains and subdomain (company slug)
      const domainCount = domains.filter(
        (d: string) => d && d.trim().length > 0
      ).length;
      const slugCount = organization.companySlug ? 1 : 0;
      setConnectedDomainsCount(domainCount + slugCount);
    }
  }, [organization]);

  // Only fetch status when user clicks 'Check status'
  useEffect(() => {
    if (statusRequested && organization?._id && organization?.companySlug) {
      fetchSubdomainStatus();
    }
  }, [statusRequested, organization?._id, organization?.companySlug]);

  const fetchSubdomainStatus = async () => {
    if (!organization?._id) return;

    setSubdomainStatus({ status: "", message: "", loading: true });
    try {
      const response = await api.get(
        `/api/mailgun-module/fetch-domain-status?orgId=${organization._id}`
      );
      if (response.status === 200) {
        setSubdomainStatus({
          status: response.data.status,
          message: response.data.message,
          loading: false,
        });
      }
    } catch (error) {
      console.error("Error fetching subdomain status:", error);
      setSubdomainStatus({
        status: "error",
        message: "Failed to fetch status",
        loading: false,
      });
    }
  };

  const saveSubdomain = async () => {
    const cleanSlug = (companySlug || "").trim();
    if (!cleanSlug) {
      errorToast("Enter a company slug first", 1300);
      return;
    }

    if (!isValidSlugFormat(cleanSlug)) {
      errorToast(
        "Slug must be 3-50 characters, lowercase letters, numbers, and hyphens only",
        1300
      );
      return;
    }

    const orgId = getEffectiveOrgId();
    if (!orgId) {
      errorToast("Organization not found", 1300);
      return;
    }

    setSubdomainStatus({ status: "", message: "", loading: true });

    try {
      await api.post("/api/admin/update-organization", {
        orgID: orgId,
        update: {
          companySlug: cleanSlug,
        },
      });

      const response = await api.post(
        `/api/mailgun-module/add-subdomain?orgId=${orgId}&skipVerification=true`,
        {}
      );
      if (response.status === 200) {
        successToast("Subdomain created successfully", 1300);
        setSubdomainStatus({
          status: "pending",
          message: "Subdomain created. Verification can be done later.",
          loading: false,
        });
        // Reflect slug presence locally and bump connected count if it was absent
        setOrganization((prev: any) =>
          prev ? { ...prev, companySlug: cleanSlug } : prev
        );
        setConnectedDomainsCount((prev) =>
          organization?.companySlug ? prev : prev + 1
        );
      }
    } catch (err: any) {
      console.error("Subdomain save failed", err);
      const errorMessage =
        err?.response?.data?.message || "Failed to save subdomain";
      errorToast(errorMessage, 1300);
      setSubdomainStatus({
        status: "error",
        message: errorMessage,
        loading: false,
      });
    }
  };

  const fetchMailgunDnsRecords = async (domain: string, orgId: string) => {
    setRecordsModalLoading(true);
    try {
      const res = await api.get(
        `/api/mailgun-module/fetch-dns-records?orgId=${orgId}&domain=${encodeURIComponent(
          domain
        )}`
      );
      const records = Array.isArray(res.data?.records) ? res.data.records : [];
      setRecordsModalDomain(domain);
      setRecordsModalRecords(records);
      setRecordsModalOpen(true);
    } catch (err) {
      console.error("Failed to fetch DNS records", err);
      errorToast("Failed to fetch DNS records", 1300);
    } finally {
      setRecordsModalLoading(false);
    }
  };

  const handleVerifyStatus = async () => {
    const orgId = getEffectiveOrgId();
    if (!orgId) return;
    setRecordsModalVerifying(true);
    try {
      const res = await api.get(
        `/api/mailgun-module/fetch-domain-status?orgId=${orgId}`
      );
      if (res.status === 200 && res.data) {
        setSubdomainStatus({
          status: res.data.status,
          message: res.data.message,
          loading: false,
        });
      }
    } catch (err) {
      console.error("Failed to check status", err);
      errorToast("Failed to check status", 1300);
    } finally {
      setRecordsModalVerifying(false);
    }
  };

  const saveDomain = async (domain: string, index: number) => {
    const cleanDomain = (domain || "").trim();
    if (!cleanDomain) {
      errorToast("Enter a domain first", 1300);
      return;
    }

    if (!isValidDomainFormat(cleanDomain)) {
      errorToast("Invalid domain format. Example: example.com", 1300);
      return;
    }

    const orgId = getEffectiveOrgId();
    if (!orgId) {
      errorToast("Organization not found", 1300);
      return;
    }

    setDomainButtonStates((prev) => ({ ...prev, [index]: "loading" }));

    try {
      const response = await api.post(
        `/api/mailgun-module/add-domain?orgId=${orgId}`,
        { domain: cleanDomain }
      );

      if (response.data?.error) {
        errorToast(response.data.error, 1300);
        setDomainButtonStates((prev) => ({ ...prev, [index]: "save" }));
        return;
      }

      // Update organization with new domain
      await api.post("/api/admin/update-organization", {
        orgID: orgId,
        update: {
          companyDomains: companyDomains
            .map((d) => (d || "").trim())
            .filter((d) => d.length > 0),
        },
      });

      setDomainButtonStates((prev) => ({ ...prev, [index]: "view" }));
      setConnectedDomainsCount((prev) => prev + 1);
      await fetchMailgunDnsRecords(cleanDomain, orgId);
    } catch (err: any) {
      console.error("Domain save failed", err);
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to save domain";
      errorToast(errorMsg, 1300);
      setDomainButtonStates((prev) => ({ ...prev, [index]: "save" }));
    }
  };

  const viewDomain = async (domain: string, index: number) => {
    const cleanDomain = (domain || "").trim();
    if (!cleanDomain) {
      errorToast("Enter a domain first", 1300);
      return;
    }

    const orgId = getEffectiveOrgId();
    if (!orgId) {
      errorToast("Organization not found", 1300);
      return;
    }

    setDomainButtonStates((prev) => ({ ...prev, [index]: "loading" }));

    try {
      await fetchMailgunDnsRecords(cleanDomain, orgId);
      setDomainButtonStates((prev) => ({ ...prev, [index]: "view" }));
    } catch (err) {
      console.error("Failed to view domain", err);
      errorToast("Failed to load records", 1300);
      setDomainButtonStates((prev) => ({ ...prev, [index]: "view" }));
    }
  };

  const updateDomainValue = (index: number, value: string) => {
    const newDomains = [...companyDomains];
    newDomains[index] = value;
    setCompanyDomains(newDomains);

    // Reset button state when domain is edited
    if (domainButtonStates[index] === "view") {
      setDomainButtonStates((prev) => ({ ...prev, [index]: "save" }));
    }
  };

  const getButtonText = (index: number) => {
    const state = domainButtonStates[index];
    if (state === "view") return "View records";
    if (state === "loading") return "Loading...";
    if (state === "deleting") return "Deleting...";
    return "Save";
  };

  const handleButtonClick = (index: number) => {
    const state = domainButtonStates[index];
    const domain = companyDomains[index];

    if (state === "view") {
      viewDomain(domain, index);
    } else {
      saveDomain(domain, index);
    }
  };

  const getStatusIcon = () => {
    if (subdomainStatus?.loading) {
      return <i className="las la-spinner la-spin"></i>;
    }
    if (subdomainStatus?.status === "active") {
      return <i className="las la-check"></i>;
    }
    if (
      subdomainStatus?.status === "pending" ||
      subdomainStatus?.status === "unverified"
    ) {
      return <i className="las la-clock"></i>;
    }
    if (
      subdomainStatus?.status === "not_configured" ||
      subdomainStatus?.status === "error" ||
      subdomainStatus?.status === "disabled" ||
      subdomainStatus?.status === "unknown"
    ) {
      return <i className="las la-exclamation-triangle"></i>;
    }
    return null;
  };

  const getStatusClass = () => {
    if (subdomainStatus?.loading) return styles.iconLoading;
    if (subdomainStatus?.status === "active") return styles.iconActive;
    if (
      subdomainStatus?.status === "pending" ||
      subdomainStatus?.status === "unverified"
    )
      return styles.iconPending;
    if (
      subdomainStatus?.status === "not_configured" ||
      subdomainStatus?.status === "error" ||
      subdomainStatus?.status === "disabled" ||
      subdomainStatus?.status === "unknown"
    )
      return styles.iconError;
    return "";
  };

  const getStatusText = () => {
    if (subdomainStatus?.loading) {
      return "Checking status...";
    }
    // Use the message from the API response
    if (subdomainStatus?.message) {
      return subdomainStatus.message;
    }
    return "";
  };

  const shouldShowSubdomainStatus =
    organization?.companySlug && subdomainStatus && statusRequested;

  const addDomain = () => {
    if (companyDomains.length < MAX_DOMAINS) {
      setCompanyDomains([...companyDomains, ""]);
    }
  };

  const removeDomain = (index: number) => {
    if (companyDomains.length > 1) {
      const newDomains = companyDomains.filter((_, i) => i !== index);
      setCompanyDomains(newDomains);

      // Remove button state for this index
      const newStates = { ...domainButtonStates };
      delete newStates[index];
      setDomainButtonStates(newStates);

      // Update count if it was a connected domain
      if (companyDomains[index] && companyDomains[index].trim().length > 0) {
        setConnectedDomainsCount((prev) => Math.max(0, prev - 1));
      }
    }
  };

  const handleDeleteDomain = async (index: number) => {
    const cleanDomain = (companyDomains[index] || "").trim();
    const domainExistsInOrg =
      organization?.companyDomains &&
      Array.isArray(organization.companyDomains) &&
      organization.companyDomains.includes(cleanDomain);
    const buttonState = domainButtonStates[index];
    const domainWasSaved = domainExistsInOrg || buttonState === "view";

    if (domainWasSaved && cleanDomain && organization?._id) {
      const result = await Swal.fire({
        icon: "warning",
        title: "Delete Domain?",
        text: `Are you sure you want to delete ${cleanDomain}? This action cannot be undone.`,
        showCancelButton: true,
        confirmButtonText: "Yes, delete it",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#ef4444",
        cancelButtonColor: "#6b7280",
        focusCancel: true,
      });

      if (!result.isConfirmed) return;

      setDomainButtonStates((prev) => ({ ...prev, [index]: "deleting" }));

      try {
        const response = await api.post(
          `/api/mailgun-module/delete-domain?orgId=${organization._id}`,
          { domain: cleanDomain }
        );

        if (response.status === 200) {
          successToast("Domain deleted successfully", 1300);
          setTimeout(() => {
            window.location.reload();
          }, 1300);
        }
      } catch (err) {
        console.error("Failed to delete domain", err);
        errorToast("Failed to delete domain", 1300);
        setDomainButtonStates((prev) => ({ ...prev, [index]: "view" }));
      }
    } else {
      // Not saved yet; just remove locally
      setCompanyDomains((prev) => {
        const next = prev.filter((_, i) => i !== index);
        return next.length > 0 ? next : [""];
      });
    }
  };

  if (memberRoleLoading) {
    return (
      <div className={styles.domainSettings}>
        <div className={styles.restrictionCard}>
          <div className={styles.restrictionIcon}>
            <i className="las la-spinner la-spin"></i>
          </div>
          <div>
            <div className={styles.restrictionTitle}>Checking your access</div>
            <div className={styles.restrictionText}>
              Verifying your permissions for this organization.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdminRole) {
    return (
      <div className={styles.domainSettings}>
        <div className={styles.restrictionCard}>
          <div
            className={`${styles.restrictionIcon} ${styles.restrictionIconWarning}`}
          >
            <i className="las la-user-shield"></i>
          </div>
          <div>
            <div className={styles.restrictionTitle}>
              Domains are admin-only
            </div>
            <div className={styles.restrictionText}>
              You're signed in without admin access. Contact an organization
              admin to add, update, or verify DNS records.
            </div>
            <div className={styles.restrictionHint}>
              Need updates? Ask an administrator to manage domains on your
              behalf.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.domainSettings}>
      <DomainRecordsModal
        open={recordsModalOpen}
        domain={recordsModalDomain}
        records={recordsModalRecords}
        loading={recordsModalLoading}
        verifying={recordsModalVerifying}
        orgId={organization?._id}
        useFetchSubdomainStatus={true}
        onClose={() => setRecordsModalOpen(false)}
        onVerifyStatus={handleVerifyStatus}
      />
      <InstructionsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <div className={styles.headerGroup}>
        <div className={styles.header}>
          <span className={styles.label}>Domains</span>
          <span className={styles.description}>
            Configure the domains used to send interview and system emails from
            your organization.
          </span>
        </div>
        <div className={styles.count}>
          <span className={styles.number}>{connectedDomainsCount}</span>
          <span className={styles.label}>connected domains</span>
        </div>
      </div>

      {/* Company Slug */}
      <div className={styles.contentGroup}>
        <div className={styles.textGroup}>
          <span className={styles.label}>Company Slug</span>
          <span className={styles.description}>
            Used to generate your Jia email subdomain (e.g.
            orgname.hellojia.ai). This cannot be changed after creation.
          </span>
        </div>
        <div className={styles.inputGroup}>
          <span className={styles.label}>Company Slug</span>
          <div className={styles.input}>
            <input
              type="text"
              placeholder="Enter company slug"
              value={companySlug}
              onChange={(e) => setCompanySlug(e.target.value)}
              disabled={!!organization?.companySlug}
            />
            {organization?.companySlug ? (
              <button
                className={styles.primaryButton}
                disabled={subdomainStatus?.loading}
                onClick={() => setStatusRequested(true)}
              >
                {subdomainStatus?.loading ? "Checking..." : "Check status"}
              </button>
            ) : (
              <button
                className={styles.primaryButton}
                disabled={!companySlug.trim() || subdomainStatus?.loading}
                onClick={saveSubdomain}
              >
                {subdomainStatus?.loading ? "Saving..." : "Save"}
              </button>
            )}
          </div>
          {shouldShowSubdomainStatus && (
            <div className={styles.statusGroup}>
              <div className={`${styles.icon} ${getStatusClass()}`}>
                {getStatusIcon()}
              </div>
              <span className={styles.text}>{getStatusText()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Company Domain/s */}
      <div className={styles.contentGroup}>
        <div className={styles.textGroup}>
          <span className={styles.label}>Company Domains</span>
          <span className={styles.description}>
            By connecting your domain, you allow Jia to send interview and
            system emails on behalf of your organization.
          </span>
          <button
            className={styles.secondaryButton}
            style={{ marginTop: "12px" }}
            onClick={() => setIsModalOpen(true)}
          >
            <i
              className="las la-book-open la-lg"
              style={{ color: "#A4A7AE" }}
            ></i>
            View setup instructions
          </button>
        </div>
        <div className={styles.inputGroup}>
          <span className={styles.label}>Company Domain</span>
          {companyDomains.map((domain, index) => (
            <div key={index} style={{ marginBottom: "8px" }}>
              <div className={styles.input}>
                <input
                  type="text"
                  placeholder="Enter company domain"
                  value={domain || ""}
                  onChange={(e) => updateDomainValue(index, e.target.value)}
                  disabled={
                    !!(
                      (organization?.companyDomains &&
                        Array.isArray(organization.companyDomains) &&
                        organization.companyDomains.includes(
                          (domain || "").trim()
                        )) ||
                      domainButtonStates[index] === "view" ||
                      domainButtonStates[index] === "loading" ||
                      domainButtonStates[index] === "deleting"
                    )
                  }
                />
                <button
                  className={styles.primaryButton}
                  disabled={
                    !domain?.trim() ||
                    domainButtonStates[index] === "loading" ||
                    domainButtonStates[index] === "deleting"
                  }
                  onClick={() => handleButtonClick(index)}
                >
                  {getButtonText(index)}
                </button>
                {companyDomains.length >= 1 && (
                  <button
                    className={styles.iconButton}
                    onClick={() => handleDeleteDomain(index)}
                    disabled={
                      domainButtonStates[index] === "deleting" ||
                      domainButtonStates[index] === "loading"
                    }
                  >
                    <i
                      className={
                        domainButtonStates[index] === "deleting" ||
                        domainButtonStates[index] === "loading"
                          ? "las la-spinner la-spin la-lg"
                          : "las la-trash-alt la-lg"
                      }
                    ></i>
                  </button>
                )}
              </div>
            </div>
          ))}
          <button
            className={styles.secondaryButton}
            onClick={addDomain}
            disabled={companyDomains.length >= MAX_DOMAINS}
          >
            <i
              className="las la-plus-circle la-lg"
              style={{ color: "#A4A7AE" }}
            ></i>
            Add more domains
          </button>
          {companyDomains.length >= MAX_DOMAINS && (
            <span className={styles.limitText}>
              You have reached the maximum limit of {MAX_DOMAINS} domains.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
