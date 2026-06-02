import React from "react";
import { api } from "@/lib/utils/apiClient";
import styles from "@/lib/components/features/settings/settings.module.scss";

type RecordRow = { type: string; host: string; value: string };
type RecordStatus = { valid?: boolean; status?: string };

interface VerificationInfo {
  success?: boolean;
  attempts?: number;
  recordStatus?: Record<string, RecordStatus>;
  error?: unknown;
}

interface SubdomainStatus {
  status: string;
  message: string;
  subdomain?: string;
  fullDomain?: string;
  cloudflareCreated?: boolean;
  mailgunDomainCreated?: boolean;
  verificationRecords?: {
    sending?: any[];
    receiving?: any[];
    dkim?: any[];
    spf?: any;
    cname?: any;
  };
}

interface Props {
  open: boolean;
  domain: string;
  records: RecordRow[];
  loading?: boolean;
  verifying?: boolean;
  verification?: VerificationInfo;
  orgId?: string;
  useFetchSubdomainStatus?: boolean;
  onClose: () => void;
  onVerifyStatus: () => void;
}

export default function DomainRecordsModal({
  open,
  domain,
  records,
  loading,
  verifying,
  verification,
  orgId,
  useFetchSubdomainStatus,
  onClose,
  onVerifyStatus,
}: Props) {
  if (!open) return null;

  const [subStatus, setSubStatus] = React.useState<SubdomainStatus | null>(
    null
  );
  const [subStatusLoading, setSubStatusLoading] = React.useState(false);
  const [subStatusError, setSubStatusError] = React.useState<string | null>(
    null
  );

  const handleVerifyClick = async () => {
    if (useFetchSubdomainStatus && orgId) {
      try {
        setSubStatusLoading(true);
        setSubStatusError(null);
        // Pass domain parameter to check specific company domain status
        const res = await api.get(
          `/api/mailgun-module/fetch-domain-status?orgId=${encodeURIComponent(
            orgId
          )}&domain=${encodeURIComponent(domain)}`
        );
        if (res.status !== 200) {
          setSubStatusError(
            String(res.data?.message || "Failed to fetch status")
          );
        } else {
          setSubStatus(res.data);
        }
      } catch (e: any) {
        setSubStatusError(
          String(
            e?.response?.data?.message || e?.message || e || "Unknown error"
          )
        );
      } finally {
        setSubStatusLoading(false);
      }
    } else {
      // Only call parent's verify handler if we're not handling our own fetch
      onVerifyStatus();
    }
  };

  const statusEntries = React.useMemo(() => {
    const entries: { key: string; valid?: boolean; status?: string }[] = [];

    // Prefer subdomain status records if available
    const vr = subStatus?.verificationRecords;
    const collectFromArray = (arr?: any[]) => {
      (arr || []).forEach((rec) => {
        const key = `${rec.record_type || rec.type || ""} ${
          rec.name || rec.host || ""
        }`.trim();
        const validVal = rec.valid;
        const isValid =
          validVal === true || validVal === "valid" || rec.is_active === true;
        const statusVal = rec.valid || (rec.is_active ? "active" : "pending");
        entries.push({ key, valid: isValid, status: statusVal });
      });
    };
    if (vr) {
      collectFromArray(vr.sending);
      collectFromArray(vr.receiving);
      collectFromArray(vr.dkim);
    }

    // Fall back to supplied verification map
    if (entries.length === 0) {
      const rs = verification?.recordStatus || {};
      for (const [key, val] of Object.entries(rs)) {
        entries.push({ key, valid: val?.valid, status: val?.status });
      }
    }

    return entries;
  }, [verification, subStatus]);

  const overallText = React.useMemo(() => {
    // Use subdomain status message if available
    if (subStatus) {
      if (subStatus.status === "active") return "All records verified";
      if (statusEntries.length === 0)
        return subStatus.message || "No verification details yet";
      const pending = statusEntries.filter((e) => !e.valid).length;
      return pending === 0
        ? "All records valid"
        : `${pending} record(s) pending`;
    }

    if (!verification) return "";
    if (verification.success) return "All records verified";
    if (statusEntries.length === 0) return "No verification details yet";
    const pending = statusEntries.filter((e) => !e.valid).length;
    return pending === 0 ? "All records valid" : `${pending} record(s) pending`;
  }, [verification, statusEntries, subStatus]);

  const getStatusIcon = (status?: string, loading?: boolean) => {
    if (loading) {
      return <i className="las la-spinner la-spin"></i>;
    }
    if (status === "active") {
      return <i className="las la-check"></i>;
    }
    if (status === "pending" || status === "unverified") {
      return <i className="las la-clock"></i>;
    }
    if (
      status === "not_configured" ||
      status === "error" ||
      status === "disabled" ||
      status === "unknown"
    ) {
      return <i className="las la-exclamation-triangle"></i>;
    }
    return null;
  };

  const getStatusClass = (status?: string, loading?: boolean) => {
    if (loading) return styles.iconLoading;
    if (status === "active") return styles.iconActive;
    if (status === "pending" || status === "unverified")
      return styles.iconPending;
    if (
      status === "not_configured" ||
      status === "error" ||
      status === "disabled" ||
      status === "unknown"
    )
      return styles.iconError;
    return "";
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal} style={{ width: "900px" }}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <span className={styles.title}>DNS records required</span>
            <span className={styles.domain}>{domain}</span>
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

        <div className={styles.recordsContainer}>
          <div className={styles.recordsContent}>
            <div className={styles.recordsHeader}>
              <span>Type</span>
              <span>Host</span>
              <span>Value</span>
              <span style={{ textAlign: "center" }}>Priority</span>
            </div>
            <div className={styles.recordsList}>
              {loading ? (
                <div className={styles.loadingMessage}>Loading records...</div>
              ) : records.length === 0 ? (
                <div className={styles.emptyMessage}>
                  No records returned yet.
                </div>
              ) : (
                records.map((rec, idx) => (
                  <div
                    key={`${rec.type}-${rec.host}-${idx}`}
                    className={styles.recordRow}
                  >
                    <span>{rec.type}</span>
                    <span>{rec.host}</span>
                    <span>{rec.value}</span>
                    <span className={styles.priority}>
                      {rec.type === "MX" ? "0" : "-"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          {/* Verification status section */}
          {subStatusLoading && (
            <div className={styles.statusGroup}>
              <div className={`${styles.icon} ${styles.iconLoading}`}>
                {getStatusIcon(undefined, true)}
              </div>
              <span className={styles.text}>Checking...</span>
            </div>
          )}
          {subStatus && !subStatusLoading && (
            <div className={styles.statusGroup}>
              <div
                className={`${styles.icon} ${getStatusClass(subStatus.status)}`}
              >
                {getStatusIcon(subStatus.status)}
              </div>
              <span className={styles.text}>{subStatus.message}</span>
            </div>
          )}
          {subStatusError && (
            <div className={styles.statusGroup}>
              <div className={`${styles.icon} ${styles.iconError}`}>
                <i className="las la-exclamation-triangle"></i>
              </div>
              <span className={styles.text}>Error: {subStatusError}</span>
            </div>
          )}

          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={`${styles.secondaryButton}`}
              onClick={onClose}
              disabled={loading || verifying}
            >
              Done
            </button>
            <button
              type="button"
              className={`${styles.primaryButton}`}
              onClick={handleVerifyClick}
              disabled={
                loading ||
                verifying ||
                subStatusLoading ||
                (!orgId && useFetchSubdomainStatus)
              }
            >
              {subStatusLoading || verifying ? "Checking..." : "Check status"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
