"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/utils/apiClient";
import { candidateActionToast, errorToast, successToast } from "@/lib/Utils";
import { Organization } from "@/lib/types/organization";
import Swal from "sweetalert2";
import DomainRecordsModal from "../../DomainRecordsModal";

interface EmailDomainsCardProps {
    organization: Organization;
    onUpdate: (updates: Partial<Organization>) => void;
}

export default function EmailDomainsCard({ organization, onUpdate }: EmailDomainsCardProps) {
    const [companySlug, setCompanySlug] = useState(organization?.companySlug || "");
    const [companyDomains, setCompanyDomains] = useState<string[]>(
        Array.isArray(organization?.companyDomains) && organization.companyDomains.length > 0
            ? organization.companyDomains
            : [""]
    );
    const [domainButtonStates, setDomainButtonStates] = useState<Record<number, "save" | "view" | "loading" | "deleting">>({});
    const [subdomainStatus, setSubdomainStatus] = useState<{ status: string; message: string; loading: boolean } | null>(null);
    const [recordsModalOpen, setRecordsModalOpen] = useState(false);
    const [recordsModalDomain, setRecordsModalDomain] = useState("");
    const [recordsModalRecords, setRecordsModalRecords] = useState<{ type: string; host: string; value: string }[]>([]);
    const [recordsModalLoading, setRecordsModalLoading] = useState(false);
    const [recordsModalVerifying, setRecordsModalVerifying] = useState(false);

    const isValidDomainFormat = (domain: string): boolean => {
        const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:[a-z]{2,}|xn--[a-z0-9]+)$/i;
        return domainRegex.test(domain.toLowerCase());
    };

    const isValidSlugFormat = (slug: string): boolean => {
        const slugRegex = /^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$/;
        return slugRegex.test(slug) && slug.length >= 3 && slug.length <= 50;
    };

    const fetchSubdomainStatus = async () => {
        if (!organization?._id) return;

        setSubdomainStatus({ status: "", message: "", loading: true });
        try {
            const response = await api.get(`/api/mailgun-module/fetch-domain-status?orgId=${organization._id}`);
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
            errorToast("Slug must be 3-50 characters, lowercase letters, numbers, and hyphens only", 1300);
            return;
        }

        const orgId = organization?._id || "";
        if (!orgId) {
            errorToast("Save organization first", 1300);
            return;
        }

        setSubdomainStatus({ status: "", message: "", loading: true });

        try {
            await api.post("/api/admin/update-organization", {
                orgID: orgId,
                update: { companySlug: cleanSlug },
            });

            const response = await api.post(`/api/mailgun-module/add-subdomain?orgId=${orgId}&skipVerification=true`, {});
            if (response.status === 200) {
                successToast("Subdomain created successfully", 1300);
                setSubdomainStatus({
                    status: "pending",
                    message: "Subdomain created. Verification can be done later.",
                    loading: false,
                });
                onUpdate({ companySlug: cleanSlug });
            }
        } catch (err: any) {
            console.error("Subdomain save failed", err);
            const errorMessage = err?.response?.data?.message || "Failed to save subdomain";
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
            const res = await api.get(`/api/mailgun-module/fetch-dns-records?orgId=${orgId}&domain=${encodeURIComponent(domain)}`);
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
        const orgId = organization?._id || "";
        if (!orgId) return;
        setRecordsModalVerifying(true);
        try {
            const res = await api.get(`/api/mailgun-module/fetch-domain-status?orgId=${orgId}`);
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

        const orgId = organization?._id || "";
        if (!orgId) {
            errorToast("Save organization first", 1300);
            return;
        }

        setDomainButtonStates((prev) => ({ ...prev, [index]: "loading" }));

        try {
            const response = await api.post(`/api/mailgun-module/add-domain?orgId=${orgId}`, { domain: cleanDomain });

            if (response.data?.error) {
                errorToast(response.data.error, 1300);
                setDomainButtonStates((prev) => ({ ...prev, [index]: "save" }));
                return;
            }

            setDomainButtonStates((prev) => ({ ...prev, [index]: "view" }));
            await fetchMailgunDnsRecords(cleanDomain, orgId);
        } catch (err: any) {
            console.error("Domain save failed", err);
            const errorMsg = err?.response?.data?.error || err?.response?.data?.message || "Failed to save domain";
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

        const orgId = organization?._id || "";
        if (!orgId) {
            errorToast("Save organization first", 1300);
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

    const deleteDomain = async (domain: string, index: number) => {
        const cleanDomain = (domain || "").trim();
        const domainExistsInOrg = organization?.companyDomains?.includes(cleanDomain);
        const buttonState = domainButtonStates[index];
        const domainWasSaved = domainExistsInOrg || buttonState === "view";

        if (domainWasSaved && cleanDomain) {
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
                const response = await api.post(`/api/mailgun-module/delete-domain?orgId=${organization._id}`, { domain: cleanDomain });

                if (response.status === 200) {
                    candidateActionToast("Domain deleted successfully", 1300, <i className="la la-check-circle text-success"></i>);
                    // Remove from local state
                    const next = companyDomains.filter((_, i) => i !== index);
                    setCompanyDomains(next.length > 0 ? next : [""]);
                    // Update parent
                    const cleanedDomains = next.filter((d) => d && d.trim());
                    onUpdate({ companyDomains: cleanedDomains });
                }
            } catch (err) {
                console.error("Failed to delete domain", err);
                errorToast("Failed to delete domain", 1300);
                setDomainButtonStates((prev) => ({ ...prev, [index]: "view" }));
            }
        } else {
            setCompanyDomains((prev) => {
                const next = prev.filter((_, i) => i !== index);
                return next.length > 0 ? next : [""];
            });
        }
    };

    return (
        <>
            <div style={{ background: "#F8F9FC", borderRadius: 16, padding: 8 }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#181D27", margin: 0 }}>Email Domain</h3>
                    </div>
                </div>

                {/* Content */}
                <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "inset 0px 0px 2px 0px rgba(0,16,53,0.16)" }}>
                    {/* Subdomain Section */}
                    <div style={{ marginBottom: 24 }}>
                        <p style={{ fontSize: 14, color: "#717680", marginBottom: 8 }}>
                            Create company subdomain for email services (e.g., orgname.hellojia.ai).
                        </p>
                        <p style={{ fontSize: 14, color: "#717680", marginBottom: 8, fontWeight: 500 }}>Company Slug (eg. orgname)</p>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                                type="text"
                                value={companySlug}
                                onChange={(e) => setCompanySlug(e.target.value || "")}
                                disabled={!!organization?.companySlug}
                                style={{
                                    flex: 1,
                                    padding: "10px 14px",
                                    border: "1px solid #E9EAEB",
                                    borderRadius: 8,
                                    fontSize: 16,
                                    background: organization?.companySlug ? "#F8F9FC" : "#fff",
                                }}
                                placeholder="Enter company slug"
                            />
                            {organization?.companySlug ? (
                                <button
                                    type="button"
                                    onClick={fetchSubdomainStatus}
                                    disabled={subdomainStatus?.loading}
                                    style={{
                                        padding: "10px 20px",
                                        border: "none",
                                        borderRadius: 999,
                                        background: "#181D27",
                                        color: "#fff",
                                        fontSize: 14,
                                        fontWeight: 700,
                                        cursor: subdomainStatus?.loading ? "not-allowed" : "pointer",
                                        whiteSpace: "nowrap",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}
                                >
                                    <i className={subdomainStatus?.loading ? "la la-spinner la-spin" : "la la-check-circle"}></i>
                                    {subdomainStatus?.loading ? "Checking..." : "Check status"}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={saveSubdomain}
                                    disabled={!companySlug.trim() || subdomainStatus?.loading}
                                    style={{
                                        padding: "10px 20px",
                                        border: "none",
                                        borderRadius: 999,
                                        background: "#181D27",
                                        color: "#fff",
                                        fontSize: 14,
                                        fontWeight: 700,
                                        cursor: !companySlug.trim() || subdomainStatus?.loading ? "not-allowed" : "pointer",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {subdomainStatus?.loading ? "Saving..." : "Save"}
                                </button>
                            )}
                        </div>
                        {subdomainStatus && !subdomainStatus.loading && (
                            <p
                                style={{
                                    fontSize: 14,
                                    color:
                                        subdomainStatus.status === "active"
                                            ? "#10B981"
                                            : subdomainStatus.status === "unverified" || subdomainStatus.status === "pending"
                                                ? "#F59E0B"
                                                : "#EF4444",
                                    fontWeight: 500,
                                    marginTop: 8,
                                }}
                            >
                                {subdomainStatus.message}
                            </p>
                        )}
                        {!organization?.companySlug && (
                            <p style={{ fontSize: 12, color: "#717680", marginTop: 8 }}>
                                This can only be set once, it cannot be edited after creation.
                            </p>
                        )}
                    </div>

                    {/* Divider */}
                    <div style={{ width: "100%", height: 1, background: "#E9EAEB", marginBottom: 24 }}></div>

                    {/* Company Domains Section */}
                    <div>
                        <p style={{ fontSize: 14, color: "#717680", marginBottom: 8 }}>Add existing company domain(s)</p>
                        <p style={{ fontSize: 14, color: "#717680", marginBottom: 12, fontWeight: 500 }}>
                            Company Domain (eg. company.com)
                        </p>
                        {companyDomains.map((domain, index) => {
                            const cleanDomain = (domain || "").trim();
                            const domainExistsInOrg = organization?.companyDomains?.includes(cleanDomain);
                            const buttonState = domainButtonStates[index] || (domainExistsInOrg ? "view" : "save");
                            const isLoading = buttonState === "loading";
                            const isDeleting = buttonState === "deleting";

                            return (
                                <div key={index} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                                    <input
                                        type="text"
                                        value={domain}
                                        onChange={(e) => {
                                            const newDomains = [...companyDomains];
                                            newDomains[index] = e.target.value || "";
                                            setCompanyDomains(newDomains);
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: "10px 14px",
                                            border: "1px solid #E9EAEB",
                                            borderRadius: 8,
                                            fontSize: 16,
                                        }}
                                        placeholder="Enter company domain"
                                    />
                                    {isDeleting ? (
                                        <button
                                            type="button"
                                            disabled
                                            style={{
                                                padding: "10px 20px",
                                                border: "1px solid #D5D7DA",
                                                borderRadius: 999,
                                                background: "#fff",
                                                color: "#535862",
                                                fontSize: 14,
                                                fontWeight: 700,
                                                cursor: "not-allowed",
                                                whiteSpace: "nowrap",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                            }}
                                        >
                                            <i className="la la-spinner la-spin"></i>
                                            Deleting...
                                        </button>
                                    ) : domainExistsInOrg || buttonState === "view" ? (
                                        <button
                                            type="button"
                                            onClick={() => viewDomain(domain, index)}
                                            disabled={isLoading}
                                            style={{
                                                padding: "10px 20px",
                                                border: "none",
                                                borderRadius: 999,
                                                background: "#181D27",
                                                color: "#fff",
                                                fontSize: 14,
                                                fontWeight: 700,
                                                cursor: isLoading ? "not-allowed" : "pointer",
                                                whiteSpace: "nowrap",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                            }}
                                        >
                                            <i className={isLoading ? "la la-spinner la-spin" : "la la-eye"}></i>
                                            {isLoading ? "Loading..." : "View records"}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => saveDomain(domain, index)}
                                            disabled={isLoading}
                                            style={{
                                                padding: "10px 20px",
                                                border: "none",
                                                borderRadius: 999,
                                                background: "#181D27",
                                                color: "#fff",
                                                fontSize: 14,
                                                fontWeight: 700,
                                                cursor: isLoading ? "not-allowed" : "pointer",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {isLoading ? "Saving..." : "Save"}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => deleteDomain(domain, index)}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            padding: 6,
                                        }}
                                    >
                                        <i className="la la-trash" style={{ fontSize: 24, color: "#535862" }}></i>
                                    </button>
                                </div>
                            );
                        })}

                        <button
                            type="button"
                            onClick={() => {
                                if (companyDomains.length < 5) {
                                    setCompanyDomains((prev) => [...prev, ""]);
                                }
                            }}
                            disabled={companyDomains.length >= 5}
                            style={{
                                width: "fit-content",
                                padding: "8px 16px",
                                border: "1px solid #D5D7DA",
                                borderRadius: 999,
                                background: "#fff",
                                fontSize: 14,
                                fontWeight: 500,
                                cursor: companyDomains.length >= 5 ? "not-allowed" : "pointer",
                                opacity: companyDomains.length >= 5 ? 0.5 : 1,
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                marginTop: 8,
                            }}
                        >
                            <i className="la la-plus" style={{ fontSize: 16 }}></i>
                            Add domain {companyDomains.length >= 5 ? "(max 5)" : ""}
                        </button>
                    </div>
                </div>
            </div>

            {/* Domain Records Modal */}
            {recordsModalOpen && (
                <DomainRecordsModal
                    open={recordsModalOpen}
                    onClose={() => setRecordsModalOpen(false)}
                    domain={recordsModalDomain}
                    records={recordsModalRecords}
                    loading={recordsModalLoading}
                    verifying={recordsModalVerifying}
                    onVerifyStatus={handleVerifyStatus}
                />
            )}
        </>
    );
}
