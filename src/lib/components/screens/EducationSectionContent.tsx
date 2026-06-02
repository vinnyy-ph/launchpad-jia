"use client";

import styles from "@/lib/styles/screens/manageCV.module.scss";
import { assetConstants } from "@/lib/utils/constantsV2";
import { EducationItem } from "./EducationModal";
import { useEffect, useState } from "react";
import { GraduationHat01 } from "@untitledui/icons";

type EducationSectionContentProps = {
  buildingCV: boolean;
  loading: boolean;
  value?: string;
  defaultEducationData: EducationItem[];
  onEditEducationItem: (id: string) => void;
  showEditIcon?: boolean;
};

const monthMap: { [key: string]: number } = {
  January: 0,
  February: 1,
  March: 2,
  April: 3,
  May: 4,
  June: 5,
  July: 6,
  August: 7,
  September: 8,
  October: 9,
  November: 10,
  December: 11,
};

function parseEducationData(
  value: string | undefined,
  defaultEducationData: EducationItem[]
): EducationItem[] {
  if (!value) return defaultEducationData;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultEducationData;
    }
    return parsed;
  } catch {
    return defaultEducationData;
  }
}

function getEducationDateValue(edu: EducationItem, isStart: boolean): number {
  const datePart = isStart ? edu.startDate : edu.endDate;
  if (!datePart.year || !datePart.month) return 0;
  return new Date(parseInt(datePart.year), monthMap[datePart.month]).getTime();
}

type LogoFormat = "webp" | "png" | "jpg";

const LOGO_FORMATS: LogoFormat[] = ["webp", "png", "jpg"];
const LOGO_SIZE = 48;
const LOGODEV_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_LOGODEV_PUBLISHABLE_KEY || "";

// TODO: Move to environment variables
const BRANDFETCH_PUBLIC_CLIENT_ID =
  process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID || "1idbHCuB66Z-QiSsg0M";

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

function buildBrandfetchLogoUrl(domain: string): string {
  if (!domain || !BRANDFETCH_PUBLIC_CLIENT_ID) return "";

  return `https://cdn.brandfetch.io/${encodeURIComponent(
    domain.trim().toLowerCase(),
  )}/w/80/h/80?c=${encodeURIComponent(BRANDFETCH_PUBLIC_CLIENT_ID)}`;
}

function buildSchoolLogoUrl(domain: string, format: LogoFormat): string {
  const logoDevUrl = buildLogoDevUrl(domain, format);
  if (logoDevUrl) return logoDevUrl;

  return buildBrandfetchLogoUrl(domain);
}

function buildFaviconUrl(domain: string): string {
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

function SchoolAvatar({ education }: { education: EducationItem }) {
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [useFavicon, setUseFavicon] = useState(false);
  const [useFallbackIcon, setUseFallbackIcon] = useState(false);

  const normalizedDomain = normalizeDomain(education.schoolDomain || "");
  const preferredUrl = (education.schoolLogoUrl || "").trim();
  const currentUrl =
    attemptIndex === 0 && preferredUrl
      ? preferredUrl
      : buildSchoolLogoUrl(
          normalizedDomain,
          LOGO_FORMATS[Math.min(attemptIndex, LOGO_FORMATS.length - 1)],
        );
  const fallbackFavicon = buildFaviconUrl(normalizedDomain);
  const displayUrl = useFavicon ? fallbackFavicon : currentUrl || fallbackFavicon;

  useEffect(() => {
    setAttemptIndex(0);
    setUseFavicon(false);
    setUseFallbackIcon(false);
  }, [education.school, education.schoolDomain, education.schoolLogoUrl]);

  if (useFallbackIcon || !displayUrl) {
    return (
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background: "#F2F4F7",
          border: "1px solid #E4E7EC",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <GraduationHat01 width={22} height={22} color="#667085" />
      </div>
    );
  }

  return (
    <div
      style={{
        width: "48px",
        height: "48px",
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
        src={displayUrl}
        alt=""
        width={36}
        height={36}
        loading="lazy"
        decoding="async"
        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
        onError={() => {
          if (
            !useFavicon &&
            Boolean(LOGODEV_PUBLISHABLE_KEY) &&
            Boolean(normalizedDomain) &&
            attemptIndex < LOGO_FORMATS.length - 1
          ) {
            setAttemptIndex((prev) => prev + 1);
            return;
          }

          if (!useFavicon && fallbackFavicon && currentUrl) {
            setUseFavicon(true);
            return;
          }

          setUseFallbackIcon(true);
        }}
      />
    </div>
  );
}

export default function EducationSectionContent({
  buildingCV,
  loading,
  value,
  defaultEducationData,
  onEditEducationItem,
  showEditIcon = true,
}: EducationSectionContentProps) {
  if (buildingCV || loading) {
    return (
      <div className={styles.sectionDetails}>
        <div className={styles.loading} />
        <div className={styles.loading} />
      </div>
    );
  }

  const data = parseEducationData(value, defaultEducationData)
    .slice()
    .sort((a, b) => {
      const endA = getEducationDateValue(a, false);
      const endB = getEducationDateValue(b, false);
      if (endA !== endB) return endB - endA;

      const startA = getEducationDateValue(a, true);
      const startB = getEducationDateValue(b, true);
      return startB - startA;
    });

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className={styles.sectionDetails}>
        Upload your CV to auto-fill this section.
      </div>
    );
  }

  return (
    <div className={styles.sectionDetails}>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {data.map((edu, i) => (
          <div
            key={edu.id || i}
            style={{
              display: "flex",
              gap: "16px",
              paddingBottom: "24px",
              borderBottom: i === data.length - 1 ? "none" : "1px solid #E9EAEB",
            }}
          >
            <SchoolAvatar education={edu} />

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "16px", color: "#181D27" }}>
                  {edu.school}
                </div>
                {showEditIcon && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <img
                      alt="Edit"
                      src={assetConstants.edit}
                      onClick={() => onEditEducationItem(edu.id)}
                      style={{
                        width: "16px",
                        height: "16px",
                        cursor: "pointer",
                        opacity: 0.6,
                      }}
                    />
                  </div>
                )}
              </div>

              <div style={{ fontSize: "14px", color: "#181D27" }}>
                {edu.degree}
                {edu.fieldOfStudy ? `, ${edu.fieldOfStudy}` : ""}
              </div>

              <div style={{ fontSize: "14px", color: "#667085" }}>
                {edu.startDate.year} — {edu.endDate.year}
              </div>

              {edu.description && (
                <div
                  style={{
                    fontSize: "14px",
                    color: "#475467",
                    marginTop: "12px",
                    whiteSpace: "pre-wrap",
                    lineHeight: "1.5",
                  }}
                >
                  {edu.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
