"use client";

import { assetConstants } from "@/lib/utils/constantsV2";
import { CertificationItem } from "./CertificationModal";
import { Award02 } from "@untitledui/icons";
import { useEffect, useState } from "react";

type CertificationsSectionContentProps = {
  value?: string;
  defaultCertificationsData: CertificationItem[];
  onEditCertificationItem: (id: string) => void;
  showEditIcon?: boolean;
};

function parseCertificationsData(
  value: string | undefined,
  defaultCertificationsData: CertificationItem[]
): CertificationItem[] {
  if (!value) return defaultCertificationsData;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultCertificationsData;
    }
    return parsed;
  } catch {
    return defaultCertificationsData;
  }
}

type LogoFormat = "webp" | "png" | "jpg";

const LOGO_FORMATS: LogoFormat[] = ["webp", "png", "jpg"];
const LOGO_SIZE = 56;
const LOGODEV_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_LOGODEV_PUBLISHABLE_KEY || "";

function normalizeDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();
}

function buildLogoDevUrl(domain: string, format: LogoFormat): string {
  if (!domain || !LOGODEV_PUBLISHABLE_KEY) return "";

  const encodedDomain = encodeURIComponent(domain.trim().toLowerCase());
  const params = new URLSearchParams({
    token: LOGODEV_PUBLISHABLE_KEY,
    size: String(LOGO_SIZE),
    format,
  });

  return `https://img.logo.dev/${encodedDomain}?${params.toString()}`;
}

function IssuerAvatar({ cert }: { cert: CertificationItem }) {
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [useFallbackIcon, setUseFallbackIcon] = useState(false);

  const normalizedDomain = normalizeDomain(cert.issuingOrganizationDomain || "");
  const preferredUrl = (cert.issuingOrganizationLogoUrl || "").trim();
  const currentUrl =
    attemptIndex === 0 && preferredUrl
      ? preferredUrl
      : buildLogoDevUrl(normalizedDomain, LOGO_FORMATS[Math.min(attemptIndex, LOGO_FORMATS.length - 1)]);

  useEffect(() => {
    setAttemptIndex(0);
    setUseFallbackIcon(false);
  }, [cert.issuingOrganization, cert.issuingOrganizationDomain, cert.issuingOrganizationLogoUrl]);

  if (useFallbackIcon || !currentUrl) {
    return (
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "#F2F4F7",
          border: "1px solid #E4E7EC",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Award02 width={24} height={24} color="#667085" />
      </div>
    );
  }

  return (
    <div
      style={{
        width: "56px",
        height: "56px",
        borderRadius: "50%",
        background: "#F2F4F7",
        border: "1px solid #E4E7EC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <img
        src={currentUrl}
        alt=""
        width={40}
        height={40}
        loading="lazy"
        decoding="async"
        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
        onError={() => {
          if (attemptIndex < LOGO_FORMATS.length - 1 && normalizedDomain) {
            setAttemptIndex((prev) => prev + 1);
            return;
          }
          setUseFallbackIcon(true);
        }}
      />
    </div>
  );
}

export default function CertificationsSectionContent({
  value,
  defaultCertificationsData,
  onEditCertificationItem,
  showEditIcon = true,
}: CertificationsSectionContentProps) {
  const certificationsList = parseCertificationsData(
    value,
    defaultCertificationsData
  );

  if (!certificationsList.length) {
    return <span>Upload your CV to auto-fill this section.</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {certificationsList.map((cert, index) => (
        <div
          key={cert.id}
          style={{
            display: "flex",
            gap: "16px",
            paddingTop: index === 0 ? "8px" : "14px",
            paddingBottom:
              index === certificationsList.length - 1 ? "8px" : "14px",
            borderBottom:
              index === certificationsList.length - 1 ? "none" : "1px solid #E9EAEB",
          }}
        >
          <IssuerAvatar cert={cert} />

          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "2px",
              }}
            >
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#344054" }}>
                {cert.name}
              </h4>
              {showEditIcon && (
                <img
                  alt="Edit"
                  src={assetConstants.edit}
                  onClick={() => onEditCertificationItem(cert.id)}
                  style={{ width: "16px", height: "16px", cursor: "pointer", opacity: 0.6 }}
                />
              )}
            </div>

            <div style={{ fontSize: "16px", color: "#667085", marginBottom: "6px" }}>
              {cert.issuingOrganization}
            </div>

            <div style={{ fontSize: "15px", color: "#98A2B3", marginBottom: "4px" }}>
              Issued {cert.issueDate.month} {cert.issueDate.year}
            </div>

            {cert.credentialId && (
              <div style={{ fontSize: "15px", color: "#98A2B3" }}>
                Credential ID {cert.credentialId}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
