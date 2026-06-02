"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Field, Modal, Select, Stack, Textarea } from "@/lib/components/ui";
import { useDisclosure } from "@/lib/components/ui/hooks";
import { GraduationHat01 } from "@untitledui/icons";
import styles from "./form-modal.module.scss";

interface EducationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (education: EducationItem) => void;
  onDelete?: (id: string) => void;
  initialData?: EducationItem | null;
}

export interface EducationItem {
  id: string;
  school: string;
  schoolDomain?: string;
  schoolLogoUrl?: string;
  degree: string;
  fieldOfStudy: string;
  startDate: { month: string; year: string };
  endDate: { month: string; year: string }; // Graduation date
  description: string;
}

type LogoFormat = "webp" | "png" | "jpg";

interface HipolabsUniversity {
  name?: string;
  country?: string;
  domains?: string[];
  web_pages?: string[];
  "state-province"?: string | null;
}

interface SchoolSuggestion {
  id: string;
  name: string;
  country: string;
  domain: string;
  website: string;
}

const LOGO_FORMATS: LogoFormat[] = ["webp", "png", "jpg"];
const LOGO_SIZE = 40;
const HIPOLABS_MIN_QUERY = 2;
const LOGODEV_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_LOGODEV_PUBLISHABLE_KEY || "";
// TODO: Move to environment variables
const BRANDFETCH_PUBLIC_CLIENT_ID =
  process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID || "1idbHCuB66Z-QiSsg0M";

const months = [
  { name: "January" }, { name: "February" }, { name: "March" },
  { name: "April" }, { name: "May" }, { name: "June" },
  { name: "July" }, { name: "August" }, { name: "September" },
  { name: "October" }, { name: "November" }, { name: "December" },
];

const years = Array.from({ length: 50 }, (_, i) => ({
  name: (new Date().getFullYear() + 5 - i).toString(), // Allow future years for expected graduation
}));

function createEmptyEducation(): EducationItem {
  return {
    id: Date.now().toString(),
    school: "",
    schoolDomain: "",
    schoolLogoUrl: "",
    degree: "",
    fieldOfStudy: "",
    startDate: { month: "", year: "" },
    endDate: { month: "", year: "" },
    description: "",
  };
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

function normalizeDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();
}

function SchoolLogo({
  schoolName,
  domain,
  logoUrl,
  size = "md",
}: {
  schoolName: string;
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
  }, [domain, logoUrl, schoolName]);

  const normalizedDomain = normalizeDomain(domain);
  const preferredUrl =
    logoUrl && logoUrl.trim().length > 0
      ? logoUrl
      : buildSchoolLogoUrl(normalizedDomain, LOGO_FORMATS[0]);
  const currentLogoUrl =
    attemptIndex === 0 && preferredUrl
      ? preferredUrl
      : buildSchoolLogoUrl(
          normalizedDomain,
          LOGO_FORMATS[Math.min(attemptIndex, LOGO_FORMATS.length - 1)],
        );
  const fallbackFavicon = buildFaviconUrl(normalizedDomain);
  const displayLogoUrl = useFavicon ? fallbackFavicon : currentLogoUrl || fallbackFavicon;
  const isSmall = size === "sm";

  return (
    <div className={`${styles.schoolLogoWrap} ${isSmall ? styles.schoolLogoWrapSmall : ""}`}>
      {!useFallbackIcon && displayLogoUrl ? (
        <img
          src={displayLogoUrl}
          alt=""
          width={isSmall ? 18 : 24}
          height={isSmall ? 18 : 24}
          loading="lazy"
          decoding="async"
          className={`${styles.schoolLogoImg} ${isSmall ? styles.schoolLogoImgSmall : ""}`}
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

            if (!useFavicon && fallbackFavicon && currentLogoUrl) {
              setUseFavicon(true);
              return;
            }

            setUseFallbackIcon(true);
          }}
        />
      ) : (
        <GraduationHat01
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

export default function EducationModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
}: EducationModalProps) {
  const [opened, { open, close }] = useDisclosure(isOpen);
  const [education, setEducation] = useState<EducationItem>(() =>
    createEmptyEducation(),
  );
  const schoolAutocompleteRef = useRef<HTMLDivElement>(null);
  const [schoolSuggestions, setSchoolSuggestions] = useState<SchoolSuggestion[]>([]);
  const [isSchoolLoading, setIsSchoolLoading] = useState(false);
  const [isSchoolDropdownOpen, setIsSchoolDropdownOpen] = useState(false);
  const [isSchoolFocused, setIsSchoolFocused] = useState(false);
  const [isSchoolSelectionLocked, setIsSchoolSelectionLocked] = useState(false);
  const monthOptions = useMemo(() => toSelectData(months.map((month) => month.name)), []);
  const yearOptions = useMemo(() => toSelectData(years.map((year) => year.name)), []);

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
      setEducation(initialData);
      setIsSchoolSelectionLocked(true);
      setIsSchoolDropdownOpen(false);
      setSchoolSuggestions([]);
      return;
    }

    setEducation(createEmptyEducation());
    setIsSchoolSelectionLocked(false);
    setIsSchoolDropdownOpen(false);
    setSchoolSuggestions([]);
  }, [initialData, isOpen]);

  useEffect(() => {
    if (!opened || !isSchoolFocused || isSchoolSelectionLocked) return;

    const query = education.school.trim();
    if (query.length < HIPOLABS_MIN_QUERY) {
      setSchoolSuggestions([]);
      setIsSchoolDropdownOpen(false);
      setIsSchoolLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSchoolLoading(true);

      try {
        const response = await fetch(
          `http://universities.hipolabs.com/search?name=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const payload = (await response.json()) as HipolabsUniversity[];

        const uniqueMap = new Map<string, SchoolSuggestion>();
        (Array.isArray(payload) ? payload : []).forEach((item, index) => {
          const name = (item?.name || "").trim();
          const country = (item?.country || "").trim();
          const domain = normalizeDomain((item?.domains || [])[0] || "");
          const website = ((item?.web_pages || [])[0] || "").trim();

          if (!name) return;

          const key = `${name.toLowerCase()}|${country.toLowerCase()}|${domain}`;
          if (uniqueMap.has(key)) return;

          uniqueMap.set(key, {
            id: `${index}-${domain || "no-domain"}-${name.toLowerCase().replace(/\s+/g, "-")}`,
            name,
            country,
            domain,
            website,
          });
        });

        const suggestions = Array.from(uniqueMap.values()).slice(0, 12);
        setSchoolSuggestions(suggestions);
        setIsSchoolDropdownOpen(suggestions.length > 0);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSchoolSuggestions([]);
          setIsSchoolDropdownOpen(false);
        }
      } finally {
        setIsSchoolLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [education.school, isSchoolFocused, isSchoolSelectionLocked, opened]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        schoolAutocompleteRef.current &&
        !schoolAutocompleteRef.current.contains(event.target as Node)
      ) {
        setIsSchoolDropdownOpen(false);
        setIsSchoolFocused(false);
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
    onSave(education);
    handleClose();
  }

  function handleDelete() {
    if (!onDelete || !education.id) return;

    onDelete(education.id);
    handleClose();
  }

  function updateEducation<K extends keyof EducationItem>(
    field: K,
    value: EducationItem[K],
  ) {
    setEducation((current) => ({ ...current, [field]: value }));
  }

  function updateDate(
    type: "startDate" | "endDate",
    field: "month" | "year",
    value: string,
  ) {
    setEducation((current) => ({
      ...current,
      [type]: { ...current[type], [field]: value },
    }));
  }

  const descriptionCharactersLeft = 2000 - (education.description?.length ?? 0);

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
            {initialData ? "Edit Education" : "Add Education"}
          </span>
          <span className={styles.subtitle}>
            Add your academic background, degree and relevant coursework.
          </span>
        </span>
      }
      closeButtonLabel="Close education modal"
    >
      <div className={styles.formLayout}>
        <div className={styles.fields}>
          <p className={styles.requiredHint}>
            <span className={styles.requiredHintAsterisk}>*</span> Indicates required
          </p>

          <div className={styles.schoolAutocomplete} ref={schoolAutocompleteRef}>
            <Field
              label="School"
              withAsterisk
              placeholder="E.g. Ateneo De Manila University"
              value={education.school}
              section={
                <SchoolLogo
                  schoolName={education.school}
                  domain={education.schoolDomain || ""}
                  logoUrl={education.schoolLogoUrl}
                  size="sm"
                />
              }
              sectionPosition="left"
              onFocus={() => {
                setIsSchoolFocused(true);
                if (
                  !isSchoolSelectionLocked &&
                  schoolSuggestions.length > 0 &&
                  education.school.trim().length >= HIPOLABS_MIN_QUERY
                ) {
                  setIsSchoolDropdownOpen(true);
                }
              }}
              onInput={() => {
                setIsSchoolSelectionLocked(false);
              }}
              onChange={(event) =>
                setEducation((current) => ({
                  ...current,
                  school: event.target.value,
                  schoolDomain: "",
                  schoolLogoUrl: "",
                }))
              }
            />
            {isSchoolDropdownOpen && (
              <div className={styles.schoolDropdown}>
                {isSchoolLoading ? (
                  <div className={styles.schoolDropdownState}>Searching schools...</div>
                ) : schoolSuggestions.length > 0 ? (
                  schoolSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      className={styles.schoolSuggestion}
                      onClick={() => {
                        setEducation((current) => ({
                          ...current,
                          school: suggestion.name,
                          schoolDomain: suggestion.domain,
                          schoolLogoUrl: buildSchoolLogoUrl(suggestion.domain, "webp"),
                        }));
                        setIsSchoolSelectionLocked(true);
                        setIsSchoolDropdownOpen(false);
                      }}
                    >
                      <SchoolLogo
                        schoolName={suggestion.name}
                        domain={suggestion.domain || suggestion.website}
                        logoUrl={buildSchoolLogoUrl(suggestion.domain, "webp")}
                      />
                      <span className={styles.schoolSuggestionText}>
                        <span className={styles.schoolSuggestionName}>{suggestion.name}</span>
                        <span className={styles.schoolSuggestionMeta}>
                          {suggestion.country}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className={styles.schoolDropdownState}>No schools found.</div>
                )}
                {/* <div className={styles.schoolDropdownFooter}>
                  <a
                    href="https://github.com/Hipo/university-domains-list"
                    target="_blank"
                    rel="noreferrer"
                    className={styles.schoolDropdownAttribution}
                  >
                    School data by HipoLabs
                  </a>
                </div> */}
              </div>
            )}
          </div>

          <div className={styles.row}>
            <Field
              label="Degree"
              placeholder="E.g. Bachelor of Science"
              value={education.degree}
              onChange={(event) => updateEducation("degree", event.target.value)}
            />
            <Field
              label="Field of Study"
              placeholder="E.g. Management Engineering"
              value={education.fieldOfStudy}
              onChange={(event) =>
                updateEducation("fieldOfStudy", event.target.value)
              }
            />
          </div>

          <Stack gap={20}>
            <div className={styles.dateGroup}>
              <p className={styles.groupLabel}>Start date</p>
              <div className={styles.dateRow}>
                <Select
                  data={monthOptions}
                  placeholder="Month"
                  value={education.startDate.month || null}
                  onChange={(value) => updateDate("startDate", "month", value ?? "")}
                />
                <Select
                  data={yearOptions}
                  placeholder="Year"
                  value={education.startDate.year || null}
                  onChange={(value) => updateDate("startDate", "year", value ?? "")}
                />
              </div>
            </div>

            <div className={styles.dateGroup}>
              <p className={styles.groupLabel}>Graduation date (or expected)</p>
              <div className={styles.dateRow}>
                <Select
                  data={monthOptions}
                  placeholder="Month"
                  value={education.endDate.month || null}
                  onChange={(value) => updateDate("endDate", "month", value ?? "")}
                />
                <Select
                  data={yearOptions}
                  placeholder="Year"
                  value={education.endDate.year || null}
                  onChange={(value) => updateDate("endDate", "year", value ?? "")}
                />
              </div>
            </div>
          </Stack>

          <div className={styles.textareaGroup}>
            <Textarea
              id="education-description"
              label="Description"
              placeholder="List your awards, activities, societies etc."
              value={education.description}
              maxLength={2000}
              autosize
              minRows={5}
              maxRows={12}
              onChange={(event) =>
                updateEducation("description", event.target.value)
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
              label="Delete Education"
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
