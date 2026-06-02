import styles from "@/lib/styles/screens/manageCV.module.scss";
import { assetConstants } from "@/lib/utils/constantsV2";
import {
  Globe01,
  AtSign,
  MarkerPin01,
  Phone,
  Copy02,
} from "@untitledui/icons";
import { ReactNode } from "react";
import Stack from "@/lib/components/ui/stack/Stack";
import Badge from "@/lib/components/ui/badge/Badge";
import Tooltip from "@/lib/components/ui/tooltip/Tooltip";

type ContactWebsite = {
  id?: string;
  url?: string;
  type?: string;
};

type ContactInfoData = {
  email?: string;
  phone?: string;
  isPhoneVerified?: boolean;
  countryCode?: string;
  address?: string;
  linkedin?: string;
  websites?: ContactWebsite[];
};

type ContactInfoSectionContentProps = {
  buildingCV: boolean;
  loading: boolean;
  value?: string;
  defaultContactInfo: ContactInfoData;
  isInterviewAnalysis?: boolean;
  showPrimaryBadge?: boolean;
  showCopyButton?: boolean;
  showPhoneVerifiedBadge?: boolean;
  showPhoneVerifyButton?: boolean;
  onPhoneVerifyClick?: () => void;
};

type ContactDisplayItem = {
  key: string;
  label: string;
  value: ReactNode;
  icon: ReactNode;
  href?: string;
  openInNewTab?: boolean;
};

function parseContactInfo(
  value: string | undefined,
  defaultContactInfo: ContactInfoData
): ContactInfoData {
  if (!value) return defaultContactInfo;

  try {
    return JSON.parse(value);
  } catch {
    return defaultContactInfo;
  }
}

export default function ContactInfoSectionContent({
  buildingCV,
  loading,
  value,
  defaultContactInfo,
  isInterviewAnalysis = false,
  showPrimaryBadge = false,
  showCopyButton = false,
  showPhoneVerifiedBadge = false,
  showPhoneVerifyButton = false,
  onPhoneVerifyClick,
}: ContactInfoSectionContentProps) {
  const contactData = parseContactInfo(value, defaultContactInfo);
  const isPhoneVerified = contactData?.isPhoneVerified === true;
  const iconBoxStyle = {
    width: "48px",
    height: "48px",
    borderRadius: "10px",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#344054",
    border: "1.5px solid #D5D7DA",
    flexShrink: 0,
  };
  const itemStyle = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  } as const;
  const textWrapStyle = { display: "flex", flexDirection: "column" } as const;
  const labelStyle = { fontSize: "15px", color: "#475467" } as const;
  const linkStyle = {
    fontSize: "14px",
    color: "#155EEF",
    textDecoration: "none",
    fontWeight: 500,
  } as const;
  const valueStyle = { fontSize: "14px", color: "#181D27", fontWeight: 500 } as const;
  const websiteTypeStyle = { color: "#667085", fontWeight: 500 } as const;
  const rightRowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    width: "100%",
  } as const;
  const labelRowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  } as const;
  const textWrapWithGrowStyle = {
    ...textWrapStyle,
    flex: 1,
    minWidth: 0,
  } as const;
  const copyButtonStyle = {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    border: "1px solid #D5D7DA",
    background: "#FFFFFF",
    color: "#667085",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  } as const;
  const valueRowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  } as const;
  const verifyButtonStyle = {
    border: "1px solid #D5D7DA",
    borderRadius: "999px",
    background: "#FFFFFF",
    color: "#344054",
    fontSize: "12px",
    fontWeight: 600,
    height: "26px",
    padding: "0 12px",
    cursor: "pointer",
    lineHeight: 1,
  } as const;
  const verifyTooltipMessage =
    "Some employers require a verified mobile number to proceed with the application.";
  const handleCopy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  const items: ContactDisplayItem[] = [];

  if (contactData.email) {
    items.push({
      key: "email",
      label: "Email",
      value: contactData.email,
      href: `mailto:${contactData.email}`,
      openInNewTab: false,
      icon: <AtSign width={26} height={26} />,
    });
  }

  if (contactData.phone) {
    items.push({
      key: "phone",
      label: "Phone Number",
      value: contactData.phone,
      icon: <Phone width={26} height={26} />,
    });
  }

  if (contactData.linkedin) {
    const rawLinkedin = contactData.linkedin.trim();
    const href = rawLinkedin.startsWith("http")
      ? rawLinkedin
      : `https://linkedin.com/in/${rawLinkedin.replace(/^@/, "")}`;
    const normalizedLinkedin = rawLinkedin
      .replace(/^https?:\/\/(www\.)?/i, "")
      .replace(/^linkedin\.com\/?/i, "linkedin.com/");
    const value = normalizedLinkedin.startsWith("linkedin.com/")
      ? normalizedLinkedin
      : `linkedin.com/in/${rawLinkedin.replace(/^@/, "")}`;

    items.push({
      key: "linkedin",
      label: "Linkedin Profile",
      value,
      href,
      openInNewTab: true,
      icon: <img src={assetConstants.linkedin} alt="linkedin" style={{ width: 26, height: 26 }} />,
    });
  }

  if (contactData.address) {
    items.push({
      key: "address",
      label: "Address",
      value: contactData.address,
      icon: <MarkerPin01 width={26} height={26} />,
    });
  }

  (contactData.websites || []).forEach((site, index) => {
    if (!site.url) return;
    items.push({
      key: site.id || `website-${index}`,
      label: "Website",
      value: (
        <>
          {(site.url || "").replace(/^https?:\/\//, "")}
          {site.type ? <span style={websiteTypeStyle}> ({site.type})</span> : null}
        </>
      ),
      href: site.url,
      openInNewTab: true,
      icon: <Globe01 width={26} height={26} />,
    });
  });

  return (
    <div className={styles.sectionDetails}>
      {buildingCV || loading ? (
        <>
          <div className={styles.loading} />
          <div className={styles.loading} />
        </>
      ) : (
        <>
          {items.length === 0 ? (
            "Upload your CV to auto-fill this section."
          ) : (
            <>
              {isInterviewAnalysis ? (
                <Stack gap={16}>
                  {items.map((item) => (
                    <div key={item.key} style={itemStyle}>
                      <div style={iconBoxStyle}>{item.icon}</div>
                      <div style={rightRowStyle}>
                        <div style={textWrapWithGrowStyle}>
                          <div style={labelRowStyle}>
                            <span style={labelStyle}>{item.label}</span>
                            {showPrimaryBadge && item.key === "email" ? (
                              <Badge
                                backgroundColor="#ECFDF3"
                                borderColor="#ABEFC6"
                                textColor="#067647"
                                radius="md"
                                size="md"
                                variant="outline"
                              >
                                Primary
                              </Badge>
                            ) : null}
                          </div>
                          {item.href ? (
                            <a
                              href={item.href}
                              target={item.openInNewTab ? "_blank" : undefined}
                              rel={item.openInNewTab ? "noreferrer" : undefined}
                              style={linkStyle}
                            >
                              {item.value}
                            </a>
                          ) : item.key === "phone" && showPhoneVerifyButton && !isPhoneVerified ? (
                            <div style={valueRowStyle}>
                              <span style={valueStyle}>{item.value}</span>
                              <button
                                type="button"
                                onClick={() => onPhoneVerifyClick?.()}
                                style={verifyButtonStyle}
                              >
                                Verify
                              </button>
                              <Tooltip
                                message={verifyTooltipMessage}
                                position="top"
                                width={360}
                              />
                            </div>
                          ) : item.key === "phone" &&
                            (showPhoneVerifiedBadge || isPhoneVerified) ? (
                            <div style={valueRowStyle}>
                              <span style={valueStyle}>{item.value}</span>
                              <img
                                alt="Verified"
                                src={assetConstants.verifiedTick}
                                style={{ width: 20, height: 20 }}
                              />
                            </div>
                          ) : (
                            <span style={valueStyle}>{item.value}</span>
                          )}
                        </div>
                        {showCopyButton && item.key === "email" && contactData.email ? (
                          <button
                            type="button"
                            aria-label="Copy email"
                            onClick={() => void handleCopy(contactData.email || "")}
                            style={copyButtonStyle}
                          >
                            <Copy02 width={20} height={20} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </Stack>
              ) : (
                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}
                >
                  {items.map((item) => (
                    <div key={item.key} style={itemStyle}>
                      <div style={iconBoxStyle}>{item.icon}</div>
                      <div style={rightRowStyle}>
                        <div style={textWrapWithGrowStyle}>
                          <div style={labelRowStyle}>
                            <span style={labelStyle}>{item.label}</span>
                            {showPrimaryBadge && item.key === "email" ? (
                              <Badge
                                backgroundColor="#ECFDF3"
                                borderColor="#ABEFC6"
                                textColor="#067647"
                                radius="md"
                                size="md"
                                variant="outline"
                              >
                                Primary
                              </Badge>
                            ) : null}
                          </div>
                          {item.href ? (
                            <a
                              href={item.href}
                              target={item.openInNewTab ? "_blank" : undefined}
                              rel={item.openInNewTab ? "noreferrer" : undefined}
                              style={linkStyle}
                            >
                              {item.value}
                            </a>
                          ) : item.key === "phone" && showPhoneVerifyButton && !isPhoneVerified ? (
                            <div style={valueRowStyle}>
                              <span style={valueStyle}>{item.value}</span>
                              <button
                                type="button"
                                onClick={() => onPhoneVerifyClick?.()}
                                style={verifyButtonStyle}
                              >
                                Verify
                              </button>
                              <Tooltip
                                message={verifyTooltipMessage}
                                position="top"
                                width={360}
                              />
                            </div>
                          ) : item.key === "phone" &&
                            (showPhoneVerifiedBadge || isPhoneVerified) ? (
                            <div style={valueRowStyle}>
                              <span style={valueStyle}>{item.value}</span>
                              <img
                                alt="Verified"
                                src={assetConstants.verifiedTick}
                                style={{ width: 20, height: 20 }}
                              />
                            </div>
                          ) : (
                            <span style={valueStyle}>{item.value}</span>
                          )}
                        </div>
                        {showCopyButton && item.key === "email" && contactData.email ? (
                          <button
                            type="button"
                            aria-label="Copy email"
                            onClick={() => void handleCopy(contactData.email || "")}
                            style={copyButtonStyle}
                          >
                            <Copy02 width={20} height={20} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
