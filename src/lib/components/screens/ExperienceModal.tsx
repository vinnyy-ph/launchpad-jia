"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, Field, Modal, Select, Stack, Textarea } from "@/lib/components/ui";
import { useDisclosure } from "@/lib/components/ui/hooks";
import { Building05 } from "@untitledui/icons";
import { api } from "@/lib/utils/apiClient";
import styles from "./form-modal.module.scss";

interface ExperienceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (experience: ExperienceItem) => void;
  onDelete?: (id: string) => void;
  initialData?: ExperienceItem | null;
}

export interface ExperienceItem {
  id: string;
  title: string;
  company: string;
  companyDomain?: string;
  companyLogoUrl?: string;
  employmentType: string;
  location: string;
  workSetup: string;
  startDate: { month: string; year: string };
  endDate: { month: string; year: string };
  isCurrentRole: boolean;
  description: string;
}

const employmentTypes = [
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
  "Freelance",
  "Self-employed",
];

const workSetups = ["On-site", "Remote", "Hybrid"];

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

const years = Array.from({ length: 50 }, (_, index) =>
  (new Date().getFullYear() - index).toString(),
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

function createEmptyExperience(): ExperienceItem {
  return {
    id: Date.now().toString(),
    title: "",
    company: "",
    companyDomain: "",
    companyLogoUrl: "",
    employmentType: "",
    location: "",
    workSetup: "",
    startDate: { month: "", year: "" },
    endDate: { month: "", year: "" },
    isCurrentRole: false,
    description: "",
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

function CompanyLogo({
  companyName,
  domain,
  logoUrl,
  size = "md",
}: {
  companyName: string;
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
  }, [domain, logoUrl, companyName]);

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
        <Building05
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

export default function ExperienceModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
}: ExperienceModalProps) {
  const [opened, { open, close }] = useDisclosure(isOpen);
  const companyAutocompleteRef = useRef<HTMLDivElement>(null);
  const [experience, setExperience] = useState<ExperienceItem>(() =>
    createEmptyExperience(),
  );
  const [brandSuggestions, setBrandSuggestions] = useState<BrandSuggestion[]>([]);
  const [isBrandLoading, setIsBrandLoading] = useState(false);
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [isCompanyFocused, setIsCompanyFocused] = useState(false);
  const [isCompanySelectionLocked, setIsCompanySelectionLocked] = useState(false);

  const employmentTypeOptions = useMemo(() => toSelectData(employmentTypes), []);
  const workSetupOptions = useMemo(() => toSelectData(workSetups), []);
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
      setExperience(initialData);
      setIsCompanySelectionLocked(Boolean(initialData.companyDomain));
      setIsBrandDropdownOpen(false);
      setBrandSuggestions([]);
      return;
    }

    setExperience(createEmptyExperience());
    setIsCompanySelectionLocked(false);
    setIsBrandDropdownOpen(false);
    setBrandSuggestions([]);
  }, [initialData, isOpen]);

  useEffect(() => {
    if (!opened || !isCompanyFocused || isCompanySelectionLocked) return;

    const query = experience.company.trim();
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
  }, [experience.company, isCompanyFocused, isCompanySelectionLocked, opened]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        companyAutocompleteRef.current &&
        !companyAutocompleteRef.current.contains(event.target as Node)
      ) {
        setIsBrandDropdownOpen(false);
        setIsCompanyFocused(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function updateExperience<K extends keyof ExperienceItem>(
    field: K,
    value: ExperienceItem[K],
  ) {
    setExperience((current) => ({ ...current, [field]: value }));
  }

  function updateDate(
    type: "startDate" | "endDate",
    field: "month" | "year",
    value: string,
  ) {
    setExperience((current) => ({
      ...current,
      [type]: { ...current[type], [field]: value },
    }));
  }

  function handleClose() {
    close();
    onClose();
  }

  function handleSave() {
    onSave(experience);
    handleClose();
  }

  function handleDelete() {
    if (!onDelete || !experience.id) return;

    onDelete(experience.id);
    handleClose();
  }

  const descriptionCharactersLeft = 2000 - (experience.description?.length ?? 0);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      size={800}
      radius={16}
      classNames={{
        body: styles.modalBody,
        content: `${styles.modalContent} ${styles.modalContentTall}`,
        header: styles.modalHeader,
        title: styles.modalTitle,
      }}
      title={
        <span className={styles.titleBlock}>
          <span className={styles.heading}>
            {initialData ? "Edit Experience" : "Add Experience"}
          </span>
          <span className={styles.subtitle}>
            Share where you have worked, your roles, and what you accomplished.
          </span>
        </span>
      }
      closeButtonLabel="Close experience modal"
    >
      <div className={styles.formLayout}>
        <div className={styles.fields}>
          <p className={styles.requiredHint}>
            <span className={styles.requiredHintAsterisk}>*</span> Indicates required
          </p>

          <Field
            label="Title"
            withAsterisk
            placeholder="What is your title?"
            value={experience.title}
            onChange={(event) => updateExperience("title", event.target.value)}
          />

          <div className={styles.row}>
            <div className={styles.schoolAutocomplete} ref={companyAutocompleteRef}>
              <Field
                label="Company or organization"
                withAsterisk
                placeholder="E.g. Google, Inc."
                value={experience.company}
                section={
                  <CompanyLogo
                    companyName={experience.company}
                    domain={experience.companyDomain || ""}
                    logoUrl={experience.companyLogoUrl}
                    size="sm"
                  />
                }
                sectionPosition="left"
                onFocus={() => {
                  setIsCompanyFocused(true);
                  if (
                    !isCompanySelectionLocked &&
                    brandSuggestions.length > 0 &&
                    experience.company.trim().length >= 2
                  ) {
                    setIsBrandDropdownOpen(true);
                  }
                }}
                onInput={() => {
                  setIsCompanySelectionLocked(false);
                }}
                onChange={(event) =>
                  setExperience((current) => ({
                    ...current,
                    company: event.target.value,
                    companyDomain: "",
                    companyLogoUrl: "",
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
                          setExperience((current) => ({
                            ...current,
                            company: suggestion.name,
                            companyDomain: suggestion.domain,
                            companyLogoUrl:
                              suggestion.logoUrl || buildLogoDevUrl(suggestion.domain, "webp"),
                          }));
                          setIsCompanySelectionLocked(true);
                          setIsBrandDropdownOpen(false);
                        }}
                      >
                        <CompanyLogo
                          companyName={suggestion.name}
                          domain={suggestion.domain}
                          logoUrl={suggestion.logoUrl}
                        />
                        <span className={styles.schoolSuggestionText}>
                          <span className={styles.schoolSuggestionName}>{suggestion.name}</span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className={styles.schoolDropdownState}>No organization found.</div>
                  )}
                  {/* <div className={styles.schoolDropdownFooter}>
                    <a
                      href="https://logo.dev"
                      target="_blank"
                      rel="noreferrer"
                      className={styles.schoolDropdownAttribution}
                    >
                      Suggestions by logo.dev
                    </a>
                  </div> */}
                </div>
              )}
            </div>
            <Select
              label="Employment type"
              data={employmentTypeOptions}
              placeholder="Select employment type"
              value={experience.employmentType || null}
              onChange={(value) => updateExperience("employmentType", value ?? "")}
            />
          </div>

          <div className={styles.row}>
            <Field
              label="Location"
              placeholder="E.g. Manila, Philippines"
              value={experience.location}
              onChange={(event) => updateExperience("location", event.target.value)}
            />
            <Select
              label="Work setup"
              data={workSetupOptions}
              placeholder="Select"
              value={experience.workSetup || null}
              onChange={(value) => updateExperience("workSetup", value ?? "")}
            />
          </div>

          <div className={styles.currentRole}>
            <Checkbox
              checked={experience.isCurrentRole}
              label="I am currently working in this role"
              onCheckedChange={(checked) =>
                updateExperience("isCurrentRole", checked)
              }
            />
          </div>

          <Stack gap={20}>
            <div className={styles.dateGroup}>
              <p className={styles.groupLabel}>
                Start date <span className={styles.required}>*</span>
              </p>
              <div className={styles.dateRow}>
                <Select
                  data={monthOptions}
                  placeholder="Month"
                  value={experience.startDate.month || null}
                  onChange={(value) => updateDate("startDate", "month", value ?? "")}
                />
                <Select
                  data={yearOptions}
                  placeholder="Year"
                  value={experience.startDate.year || null}
                  onChange={(value) => updateDate("startDate", "year", value ?? "")}
                />
              </div>
            </div>

            <div className={styles.dateGroup}>
              <p className={styles.groupLabel}>
                End date
                {!experience.isCurrentRole ? (
                  <span className={styles.required}>*</span>
                ) : null}
              </p>
              <div className={styles.dateRow}>
                <Select
                  data={monthOptions}
                  placeholder="Month"
                  disabled={experience.isCurrentRole}
                  value={experience.endDate.month || null}
                  onChange={(value) => updateDate("endDate", "month", value ?? "")}
                />
                <Select
                  data={yearOptions}
                  placeholder="Year"
                  disabled={experience.isCurrentRole}
                  value={experience.endDate.year || null}
                  onChange={(value) => updateDate("endDate", "year", value ?? "")}
                />
              </div>
            </div>
          </Stack>

          <div className={styles.textareaGroup}>
            <Textarea
              id="experience-description"
              label="Description"
              placeholder="List your major duties and success, highlighting specific projects"
              value={experience.description}
              maxLength={2000}
              autosize
              minRows={5}
              maxRows={12}
              onChange={(event) =>
                updateExperience("description", event.target.value)
              }
            />
            <p className={styles.charCount}>
              {descriptionCharactersLeft} characters left
            </p>
          </div>
        </div>

        <div className={styles.footer}>
          {initialData && onDelete ? (
            <Button
              label="Delete Experience"
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
