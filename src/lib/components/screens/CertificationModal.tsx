"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Field, Modal, Select, Stack } from "@/lib/components/ui";
import { useDisclosure } from "@/lib/components/ui/hooks";
import { Award04 } from "@untitledui/icons";
import { api } from "@/lib/utils/apiClient";
import styles from "./form-modal.module.scss";

export interface CertificationItem {
  id: string;
  name: string;
  issuingOrganization: string;
  issuingOrganizationDomain?: string;
  issuingOrganizationLogoUrl?: string;
  issueDate: { month: string; year: string };
  expirationDate: { month: string; year: string };
  credentialId: string;
  credentialUrl: string;
}

interface CertificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (certification: CertificationItem) => void;
  onDelete?: (id: string) => void;
  initialData?: CertificationItem | null;
}

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const years = Array.from({ length: 50 }, (_, i) =>
  (new Date().getFullYear() - i).toString(),
);

type LogoFormat = "webp" | "png" | "jpg";

interface BrandSuggestion {
  name: string;
  domain: string;
  logoUrl: string;
}

const LOGO_FORMATS: LogoFormat[] = ["webp", "png", "jpg"];
const LOGO_SIZE = 40;
const LOGODEV_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_LOGODEV_PUBLISHABLE_KEY || "";

function createEmptyCertification(): CertificationItem {
  return {
    id: Date.now().toString(),
    name: "",
    issuingOrganization: "",
    issuingOrganizationDomain: "",
    issuingOrganizationLogoUrl: "",
    issueDate: { month: "", year: "" },
    expirationDate: { month: "", year: "" },
    credentialId: "",
    credentialUrl: "",
  };
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

function buildFaviconUrl(domain: string): string {
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

function IssuerLogo({
  issuerName,
  domain,
  logoUrl,
  size = "md",
}: {
  issuerName: string;
  domain: string;
  logoUrl?: string;
  size?: "sm" | "md";
}) {
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [useFavicon, setUseFavicon] = useState(false);
  const [useFallbackIcon, setUseFallbackIcon] = useState(false);

  useEffect(() => {
    setAttemptIndex(0);
    setUseFavicon(false);
    setUseFallbackIcon(false);
  }, [domain, logoUrl, issuerName]);

  const normalizedDomain = normalizeDomain(domain);
  const preferredUrl =
    logoUrl && logoUrl.trim().length > 0
      ? logoUrl
      : buildLogoDevUrl(normalizedDomain, LOGO_FORMATS[0]);
  const currentLogoUrl =
    attemptIndex === 0 && preferredUrl
      ? preferredUrl
      : buildLogoDevUrl(
          normalizedDomain,
          LOGO_FORMATS[Math.min(attemptIndex, LOGO_FORMATS.length - 1)],
        );
  const fallbackFavicon = buildFaviconUrl(normalizedDomain);
  const isSmall = size === "sm";

  return (
    <div
      className={`${styles.schoolLogoWrap} ${isSmall ? styles.schoolLogoWrapSmall : ""}`}
    >
      {!useFallbackIcon && currentLogoUrl ? (
        <img
          src={useFavicon ? fallbackFavicon : currentLogoUrl}
          alt=""
          width={isSmall ? 18 : 24}
          height={isSmall ? 18 : 24}
          loading="lazy"
          decoding="async"
          className={`${styles.schoolLogoImg} ${isSmall ? styles.schoolLogoImgSmall : ""}`}
          onError={() => {
            if (!useFavicon && attemptIndex < LOGO_FORMATS.length - 1) {
              setAttemptIndex((prev) => prev + 1);
              return;
            }

            if (!useFavicon && fallbackFavicon) {
              setUseFavicon(true);
              return;
            }

            setUseFallbackIcon(true);
          }}
        />
      ) : (
        <Award04
          width={isSmall ? 16 : 20}
          height={isSmall ? 16 : 20}
          className={styles.schoolLogoHatIcon}
        />
      )}
    </div>
  );
}

function toSelectData(options: string[]) {
  return options.map((option) => ({ value: option, label: option }));
}

export default function CertificationModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
}: CertificationModalProps) {
  const [opened, { open, close }] = useDisclosure(isOpen);
  const organizationAutocompleteRef = useRef<HTMLDivElement>(null);
  const [certification, setCertification] = useState<CertificationItem>(() =>
    createEmptyCertification(),
  );
  const [brandSuggestions, setBrandSuggestions] = useState<BrandSuggestion[]>([]);
  const [isBrandLoading, setIsBrandLoading] = useState(false);
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [isOrganizationFocused, setIsOrganizationFocused] = useState(false);
  const [isOrganizationSelectionLocked, setIsOrganizationSelectionLocked] =
    useState(false);
  const monthOptions = useMemo(() => toSelectData(months), []);
  const yearOptions = useMemo(() => toSelectData(years), []);

  useEffect(() => {
    if (isOpen) {
      open();
      return;
    }

    close();
  }, [close, isOpen, open]);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setCertification(initialData);
      setIsOrganizationSelectionLocked(Boolean(initialData.issuingOrganizationDomain));
      setIsBrandDropdownOpen(false);
      setBrandSuggestions([]);
      return;
    }

    setCertification(createEmptyCertification());
    setIsOrganizationSelectionLocked(false);
    setIsBrandDropdownOpen(false);
    setBrandSuggestions([]);
  }, [initialData, isOpen]);

  useEffect(() => {
    if (!opened || !isOrganizationFocused || isOrganizationSelectionLocked) return;

    const query = certification.issuingOrganization.trim();
    if (query.length < 2) {
      setBrandSuggestions([]);
      setIsBrandDropdownOpen(false);
      setIsBrandLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsBrandLoading(true);
      try {
        const response = await api.get(
          `/api/whitecloak/logo-brand-search?q=${encodeURIComponent(query)}&strategy=typeahead`,
        );
        const rawResults = Array.isArray(response?.data?.results)
          ? response.data.results
          : [];

        const suggestions = rawResults
          .map((item: any) => {
            const name = typeof item?.name === "string" ? item.name.trim() : "";
            const domain =
              typeof item?.domain === "string" ? normalizeDomain(item.domain) : "";
            const logoUrl =
              typeof item?.logoUrl === "string" ? item.logoUrl.trim() : "";

            return { name, domain, logoUrl };
          })
          .filter((item: BrandSuggestion) => item.name && item.domain)
          .slice(0, 10);

        setBrandSuggestions(suggestions);
        setIsBrandDropdownOpen(suggestions.length > 0);
      } catch {
        setBrandSuggestions([]);
        setIsBrandDropdownOpen(false);
      } finally {
        setIsBrandLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    certification.issuingOrganization,
    isOrganizationFocused,
    isOrganizationSelectionLocked,
    opened,
  ]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        organizationAutocompleteRef.current &&
        !organizationAutocompleteRef.current.contains(event.target as Node)
      ) {
        setIsBrandDropdownOpen(false);
        setIsOrganizationFocused(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleClose() {
    close();
    onClose();
  }

  function handleSave() {
    if (!certification.name.trim() || !certification.issuingOrganization.trim()) {
      alert("Certification name and issuing organization are required");
      return;
    }

    onSave(certification);
    handleClose();
  }

  function handleDelete() {
    if (!onDelete || !certification.id) return;

    onDelete(certification.id);
    handleClose();
  }

  function updateCertification<K extends keyof CertificationItem>(
    field: K,
    value: CertificationItem[K],
  ) {
    setCertification((current) => ({ ...current, [field]: value }));
  }

  function updateDate(
    type: "issueDate" | "expirationDate",
    field: "month" | "year",
    value: string,
  ) {
    setCertification((current) => ({
      ...current,
      [type]: { ...current[type], [field]: value },
    }));
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      size={800}
      radius={16}
      classNames={{
        body: styles.modalBody,
        content: styles.modalContent,
        header: styles.modalHeader,
        title: styles.modalTitle,
      }}
      title={
        <span className={styles.titleBlock}>
          <span className={styles.heading}>
            {initialData ? "Edit Certification" : "Add Certification"}
          </span>
          <span className={styles.subtitle}>
            List certifications, courses, or training that support your expertise.
          </span>
        </span>
      }
      closeButtonLabel="Close certification modal"
    >
      <div className={styles.formLayout}>
        <div className={styles.fields}>
          <p className={styles.requiredHint}>
            <span className={styles.requiredHintAsterisk}>*</span> Indicates required
          </p>

          <Field
            label="Name"
            withAsterisk
            placeholder="E.g. Microsoft certified network associate security"
            value={certification.name}
            onChange={(event) => updateCertification("name", event.target.value)}
          />

          <div className={styles.schoolAutocomplete} ref={organizationAutocompleteRef}>
            <Field
              label="Issuing organization"
              withAsterisk
              placeholder="E.g. Microsoft"
              value={certification.issuingOrganization}
              section={
                <IssuerLogo
                  issuerName={certification.issuingOrganization}
                  domain={certification.issuingOrganizationDomain || ""}
                  logoUrl={certification.issuingOrganizationLogoUrl}
                  size="sm"
                />
              }
              sectionPosition="left"
              onFocus={() => {
                setIsOrganizationFocused(true);
                if (
                  !isOrganizationSelectionLocked &&
                  brandSuggestions.length > 0 &&
                  certification.issuingOrganization.trim().length >= 2
                ) {
                  setIsBrandDropdownOpen(true);
                }
              }}
              onInput={() => {
                setIsOrganizationSelectionLocked(false);
              }}
              onChange={(event) =>
                setCertification((current) => ({
                  ...current,
                  issuingOrganization: event.target.value,
                  issuingOrganizationDomain: "",
                  issuingOrganizationLogoUrl: "",
                }))
              }
            />
            {isBrandDropdownOpen && (
              <div className={styles.schoolDropdown}>
                {isBrandLoading ? (
                  <div className={styles.schoolDropdownState}>Searching organizations...</div>
                ) : brandSuggestions.length > 0 ? (
                  brandSuggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.domain}-${index}`}
                      type="button"
                      className={styles.schoolSuggestion}
                      onClick={() => {
                        setCertification((current) => ({
                          ...current,
                          issuingOrganization: suggestion.name,
                          issuingOrganizationDomain: suggestion.domain,
                          issuingOrganizationLogoUrl:
                            suggestion.logoUrl || buildLogoDevUrl(suggestion.domain, "webp"),
                        }));
                        setIsOrganizationSelectionLocked(true);
                        setIsBrandDropdownOpen(false);
                      }}
                    >
                      <IssuerLogo
                        issuerName={suggestion.name}
                        domain={suggestion.domain}
                        logoUrl={suggestion.logoUrl}
                      />
                      <span className={styles.schoolSuggestionText}>
                        <span className={styles.schoolSuggestionName}>{suggestion.name}</span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className={styles.schoolDropdownState}>No brands found.</div>
                )}
                <div className={styles.schoolDropdownFooter}>
                  <a
                    href="https://logo.dev"
                    target="_blank"
                    rel="noreferrer"
                    className={styles.schoolDropdownAttribution}
                  >
                    Suggestions by logo.dev
                  </a>
                </div>
              </div>
            )}
          </div>

          <Stack gap={20}>
            <div className={styles.dateGroup}>
              <p className={styles.groupLabel}>Issue date</p>
              <div className={styles.dateRow}>
                <Select
                  data={monthOptions}
                  placeholder="Month"
                  value={certification.issueDate.month || null}
                  onChange={(value) => updateDate("issueDate", "month", value ?? "")}
                />
                <Select
                  data={yearOptions}
                  placeholder="Year"
                  value={certification.issueDate.year || null}
                  onChange={(value) => updateDate("issueDate", "year", value ?? "")}
                />
              </div>
            </div>

            <div className={styles.dateGroup}>
              <p className={styles.groupLabel}>Expiration date</p>
              <div className={styles.dateRow}>
                <Select
                  data={monthOptions}
                  placeholder="Month"
                  value={certification.expirationDate.month || null}
                  onChange={(value) =>
                    updateDate("expirationDate", "month", value ?? "")
                  }
                />
                <Select
                  data={yearOptions}
                  placeholder="Year"
                  value={certification.expirationDate.year || null}
                  onChange={(value) =>
                    updateDate("expirationDate", "year", value ?? "")
                  }
                />
              </div>
            </div>
          </Stack>

          <Field
            label="Credential ID"
            placeholder="Enter credential ID"
            value={certification.credentialId}
            onChange={(event) =>
              updateCertification("credentialId", event.target.value)
            }
          />

          <Field
            label="Credential URL"
            placeholder="www.example.com"
            section={<span className={styles.urlPrefix}>http://</span>}
            sectionPosition="left"
            sectionDivider
            value={certification.credentialUrl}
            onChange={(event) =>
              updateCertification("credentialUrl", event.target.value)
            }
          />
        </div>

        <div className={styles.footer}>
          {initialData && onDelete ? (
            <Button
              label="Delete Certification"
              variant="secondary"
              onClick={handleDelete}
              pill
            />
          ) : (
            <span className={styles.footerSpacer} />
          )}

          <div className={styles.actions}>
            <Button label="Cancel" variant="secondary" pill onClick={handleClose} />
            <Button label="Save" variant="primary" pill onClick={handleSave} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
