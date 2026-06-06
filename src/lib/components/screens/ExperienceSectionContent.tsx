"use client";

import styles from "@/lib/styles/screens/manageCV.module.scss";
import { assetConstants } from "@/lib/utils/constantsV2";
import { ExperienceItem } from "./ExperienceModal";
import RichText from "@/lib/components/ManualProfile/RichText";
import { Badge } from "@/lib/components/ui";
import { Building05 } from "@untitledui/icons";
import { useEffect, useState } from "react";

type ExperienceSectionContentProps = {
  buildingCV: boolean;
  loading: boolean;
  value?: string;
  defaultExperienceData: ExperienceItem[];
  onEditExperienceItem: (id: string) => void;
  showEditIcon?: boolean;
  editedItemIds?: string[];
};

type ExperienceGroup = {
  company: string;
  items: ExperienceItem[];
};

type LogoFormat = "webp" | "png" | "jpg";

const LOGO_FORMATS: LogoFormat[] = ["webp", "png", "jpg"];
const LOGO_SIZE = 48;
const LOGODEV_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_LOGODEV_PUBLISHABLE_KEY || "";

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

function parseExperienceData(
  value: string | undefined,
  defaultExperienceData: ExperienceItem[]
): ExperienceItem[] {
  if (!value) return defaultExperienceData;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultExperienceData;
    }
    return parsed;
  } catch {
    return defaultExperienceData;
  }
}

function getExperienceDateValue(exp: ExperienceItem, isStart: boolean): number {
  const datePart = isStart ? exp.startDate : exp.endDate;
  if (exp.isCurrentRole && !isStart) return Date.now() + 100000;
  if (!datePart.year || !datePart.month) return 0;
  return new Date(parseInt(datePart.year), monthMap[datePart.month]).getTime();
}

function calculateDuration(
  start: { month: string; year: string },
  end: { month: string; year: string },
  isCurrent: boolean
): string {
  if (!start.month || !start.year) return "";

  const startDate = new Date(parseInt(start.year), monthMap[start.month]);
  const endDate = isCurrent
    ? new Date()
    : new Date(parseInt(end.year), monthMap[end.month]);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return "";

  let months = (endDate.getFullYear() - startDate.getFullYear()) * 12;
  months -= startDate.getMonth();
  months += endDate.getMonth();
  months += 1;

  if (months <= 0) return "";

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  let duration = "";
  if (years > 0) duration += `${years} yr${years > 1 ? "s" : ""} `;
  if (remainingMonths > 0) duration += `${remainingMonths} mos`;
  return duration.trim();
}

function calculateTotalDuration(items: ExperienceItem[]): string {
  if (!items.length) return "";

  let minDate = new Date(8640000000000000);
  let maxDate = new Date(-8640000000000000);

  items.forEach((item) => {
    if (item.startDate.year && item.startDate.month) {
      const d = new Date(
        parseInt(item.startDate.year),
        monthMap[item.startDate.month]
      );
      if (d < minDate) minDate = d;
    }

    let endD = new Date();
    if (!item.isCurrentRole && item.endDate.year && item.endDate.month) {
      endD = new Date(parseInt(item.endDate.year), monthMap[item.endDate.month]);
    }
    if (endD > maxDate) maxDate = endD;
  });

  if (
    minDate.getFullYear() === 8640000000000000 ||
    maxDate.getFullYear() === -8640000000000000
  ) {
    return "";
  }

  let months = (maxDate.getFullYear() - minDate.getFullYear()) * 12;
  months -= minDate.getMonth();
  months += maxDate.getMonth();
  months += 1;

  if (months <= 0) return "";

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  let duration = "";
  if (years > 0) duration += `${years} yr${years > 1 ? "s" : ""} `;
  if (remainingMonths > 0) duration += `${remainingMonths} mos`;
  return duration.trim();
}

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

function CompanyAvatar({
  company,
  companyDomain,
  companyLogoUrl,
}: {
  company: string;
  companyDomain?: string;
  companyLogoUrl?: string;
}) {
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [useFallbackIcon, setUseFallbackIcon] = useState(false);

  const normalizedDomain = normalizeDomain(companyDomain || "");
  const preferredUrl = (companyLogoUrl || "").trim();
  const currentUrl =
    attemptIndex === 0 && preferredUrl
      ? preferredUrl
      : buildLogoDevUrl(normalizedDomain, LOGO_FORMATS[Math.min(attemptIndex, LOGO_FORMATS.length - 1)]);

  useEffect(() => {
    setAttemptIndex(0);
    setUseFallbackIcon(false);
  }, [company, companyDomain, companyLogoUrl]);

  if (useFallbackIcon || !currentUrl) {
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
        <Building05 width={20} height={20} color="#667085" />
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
        src={currentUrl}
        alt=""
        width={36}
        height={36}
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

export default function ExperienceSectionContent({
  buildingCV,
  loading,
  value,
  defaultExperienceData,
  onEditExperienceItem,
  showEditIcon = true,
  editedItemIds = [],
}: ExperienceSectionContentProps) {
  if (buildingCV || loading) {
    return (
      <div className={styles.sectionDetails}>
        <div className={styles.loading} />
        <div className={styles.loading} />
      </div>
    );
  }

  const data = parseExperienceData(value, defaultExperienceData)
    .slice()
    .sort((a, b) => {
      const endA = getExperienceDateValue(a, false);
      const endB = getExperienceDateValue(b, false);
      if (endA !== endB) return endB - endA;

      const startA = getExperienceDateValue(a, true);
      const startB = getExperienceDateValue(b, true);
      return startB - startA;
    });

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className={styles.sectionDetails}>
        Upload your CV to auto-fill this section.
      </div>
    );
  }

  const grouped = data.reduce((acc: ExperienceGroup[], curr: ExperienceItem) => {
    const lastGroup = acc[acc.length - 1];
    if (lastGroup && lastGroup.company === curr.company) {
      lastGroup.items.push(curr);
    } else {
      acc.push({ company: curr.company, items: [curr] });
    }
    return acc;
  }, []);
  const editedIdSet = new Set(editedItemIds);

  return (
    <div className={styles.sectionDetails}>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {grouped.map((group, groupIndex) => {
          if (group.items.length === 1) {
            const exp = group.items[0];
            const duration = calculateDuration(
              exp.startDate,
              exp.endDate,
              exp.isCurrentRole
            );

            return (
              <div
                key={exp.id}
                style={{
                  display: "flex",
                  gap: "16px",
                  paddingBottom: "24px",
                  borderBottom:
                    groupIndex === grouped.length - 1 ? "none" : "1px solid #E9EAEB",
                }}
              >
                <CompanyAvatar
                  company={exp.company}
                  companyDomain={exp.companyDomain}
                  companyLogoUrl={exp.companyLogoUrl}
                />

                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ fontSize: "16px", fontWeight: 600, color: "#181D27" }}>
                      {exp.title}
                    </div>
                    {showEditIcon && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        {editedIdSet.has(exp.id) ? (
                          <Badge
                            backgroundColor="#FFFAEB"
                            borderColor="#FEC84B"
                            textColor="#B54708"
                            radius="md"
                            size="md"
                            variant="outline"
                          >
                            Edited
                          </Badge>
                        ) : null}
                        <img
                          alt="Edit"
                          src={assetConstants.edit}
                          onClick={() => onEditExperienceItem(exp.id)}
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
                    {exp.company}
                    {exp.employmentType ? ` • ${exp.employmentType}` : ""}
                  </div>

                  <div style={{ fontSize: "14px", color: "#667085" }}>
                    {exp.startDate.month} {exp.startDate.year} —{" "}
                    {exp.isCurrentRole
                      ? "Present"
                      : `${exp.endDate.month} ${exp.endDate.year}`}
                    {duration ? ` • ${duration}` : ""}
                  </div>

                  <div style={{ fontSize: "14px", color: "#667085" }}>
                    {[exp.location, exp.workSetup].filter(Boolean).join(" • ")}
                  </div>

                  {exp.description && (
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#475467",
                        marginTop: "12px",
                        whiteSpace: "pre-wrap",
                        lineHeight: "1.5",
                      }}
                    >
                      <RichText html={exp.description} />
                    </div>
                  )}
                </div>
              </div>
            );
          }

          const groupTotalDuration = calculateTotalDuration(group.items);
          const firstItem = group.items[0];

          return (
            <div
              key={groupIndex}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "24px",
                paddingBottom: "24px",
                borderBottom:
                  groupIndex === grouped.length - 1 ? "none" : "1px solid #E9EAEB",
              }}
            >
              <div style={{ display: "flex", gap: "16px" }}>
                <div
                  style={{
                    width: "48px",
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    position: "relative",
                  }}
                >
                  <div style={{ zIndex: 1 }}>
                    <CompanyAvatar
                      company={group.company}
                      companyDomain={firstItem.companyDomain}
                      companyLogoUrl={firstItem.companyLogoUrl}
                    />
                  </div>
                  <div
                    style={{
                      width: "2px",
                      background: "#E9EAEB",
                      flex: 1,
                      minHeight: "24px",
                      position: "absolute",
                      top: "48px",
                      bottom: "-24px",
                      left: "50%",
                      transform: "translateX(-1px)",
                    }}
                  />
                </div>

                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ fontSize: "16px", fontWeight: 600, color: "#181D27" }}>
                    {group.company}
                  </div>
                  <div style={{ fontSize: "14px", color: "#667085" }}>
                    {firstItem.employmentType ? `${firstItem.employmentType} • ` : ""}
                    {groupTotalDuration}
                  </div>
                  <div style={{ fontSize: "14px", color: "#667085" }}>
                    {[firstItem.location, firstItem.workSetup].filter(Boolean).join(" • ")}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {group.items.map((exp, idx) => {
                  const duration = calculateDuration(
                    exp.startDate,
                    exp.endDate,
                    exp.isCurrentRole
                  );
                  const isLast = idx === group.items.length - 1;

                  return (
                    <div key={exp.id} style={{ display: "flex", gap: "16px", position: "relative" }}>
                      <div style={{ width: "48px", flexShrink: 0, position: "relative" }}>
                        <div
                          style={{
                            position: "absolute",
                            left: "50%",
                            transform: "translateX(-1px)",
                            width: "2px",
                            background: "#E9EAEB",
                            top: "-24px",
                            height: "30px",
                          }}
                        />

                        {!isLast && (
                          <div
                            style={{
                              position: "absolute",
                              left: "50%",
                              transform: "translateX(-1px)",
                              width: "2px",
                              background: "#E9EAEB",
                              top: "6px",
                              bottom: "-24px",
                            }}
                          />
                        )}

                        <div
                          style={{
                            position: "absolute",
                            top: "6px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: "#E9EAEB",
                            border: "2px solid #FFF",
                            zIndex: 1,
                          }}
                        />
                      </div>

                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                          }}
                        >
                          <div style={{ fontSize: "16px", fontWeight: 600, color: "#181D27" }}>
                            {exp.title}
                          </div>
                          {showEditIcon && (
                            <div style={{ display: "flex", gap: "8px" }}>
                              {editedIdSet.has(exp.id) ? (
                                <Badge
                                  backgroundColor="#FFFAEB"
                                  borderColor="#FEC84B"
                                  textColor="#B54708"
                                  radius="md"
                                  size="md"
                                  variant="outline"
                                >
                                  Edited
                                </Badge>
                              ) : null}
                              <img
                                alt="Edit"
                                src={assetConstants.edit}
                                onClick={() => onEditExperienceItem(exp.id)}
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
                        <div style={{ fontSize: "14px", color: "#667085" }}>
                          {exp.startDate.month} {exp.startDate.year} —{" "}
                          {exp.isCurrentRole
                            ? "Present"
                            : `${exp.endDate.month} ${exp.endDate.year}`}
                          {duration ? ` • ${duration}` : ""}
                        </div>

                        {exp.description && (
                          <div
                            style={{
                              fontSize: "14px",
                              color: "#475467",
                              marginTop: "12px",
                              whiteSpace: "pre-wrap",
                              lineHeight: "1.5",
                            }}
                          >
                            <RichText html={exp.description} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
