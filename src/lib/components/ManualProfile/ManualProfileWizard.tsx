"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/lib/components/ui";
import { ChevronLeft, ChevronRight, PlusCircle } from "@untitledui/icons";
import ContactInformationStep, {
  type ContactStepValue,
  createEmptyContact,
} from "./ContactInformationStep";
import MultiEntryStep from "./MultiEntryStep";
import InlineMultiEntryStep from "./InlineMultiEntryStep";
import EducationEntryForm, { createEmptyEducation } from "./EducationEntryForm";
import ExperienceEntryForm, { createEmptyExperience } from "./ExperienceEntryForm";
import ProjectEntryForm, { createEmptyProject } from "./ProjectEntryForm";
import CertificationEntryForm, { createEmptyCertification } from "./CertificationEntryForm";
import AwardEntryForm, { createEmptyAward } from "./AwardEntryForm";
import ReferenceEntryForm, { createEmptyReference } from "./ReferenceEntryForm";
import DiscardProfileModal from "./DiscardProfileModal";
import ResumeDraftModal from "./ResumeDraftModal";
import CvUploadBanner from "./CvUploadBanner";
import WebsitesStep, { createWebsite } from "./WebsitesStep";
import SkillsStep from "./SkillsStep";
import IntroductionStep from "./IntroductionStep";
import styles from "./manual-profile.module.scss";
import type {
  ExperienceSectionItem,
  EducationSectionItem,
  ProjectSectionItem,
  CertificationSectionItem,
  AwardSectionItem,
  ReferenceSectionItem,
  ContactWebsite,
  StructuredCV,
} from "@/lib/utils/structuredCV";
import {
  validateContact,
  validateWebsite,
  validateEducationItem,
  validateExperienceItem,
  validateProjectItem,
  validateCertificationItem,
  validateAwardItem,
  validateReferenceItem,
  validateIntroduction,
  type FieldErrors,
} from "@/lib/utils/profileValidation";
import { api } from "@/lib/utils/apiClient";
import { inferPhoneCountry } from "@/lib/utils/phoneInput";
import {
  draftKey,
  parseDraft,
  serializeDraft,
  type ProfileDraft,
} from "@/lib/utils/profileDraft";

interface StepDef {
  title: string;
  subtitle: string;
  hasSkip?: boolean;
}

// Order + copy taken from the Figma "Create a Profile Manually" frames.
const STEPS: StepDef[] = [
  {
    title: "Contact Information",
    subtitle:
      "Add your contact details and professional links so recruiters can reach you easily.",
  },
  {
    title: "Websites",
    subtitle: "Add your professional websites and links for the recruiter's review.",
  },
  {
    title: "Education",
    subtitle: "Add your academic background, degree and relevant coursework.",
  },
  {
    title: "Experience",
    subtitle: "Share where you've worked, your roles, and what you accomplished.",
    hasSkip: true,
  },
  {
    title: "Skills",
    subtitle:
      "Highlight the skills, tools, and technologies you use in your work. Jia automatically extracts skills from your CV. You can add more relevant skills if needed.",
  },
  {
    title: "Projects",
    subtitle:
      "Showcase projects that demonstrate your skills, impact, or problem-solving approach.",
    hasSkip: true,
  },
  {
    title: "Certifications",
    subtitle: "List certifications, courses, or training that support your expertise.",
    hasSkip: true,
  },
  {
    title: "Awards",
    subtitle:
      "Include awards or recognitions you've received for your work or achievements.",
    hasSkip: true,
  },
  {
    title: "Character References",
    subtitle:
      "Add character references who can confirm your credentials and professional experience.",
    hasSkip: true,
  },
  {
    title: "Introduction",
    subtitle:
      "Share a short professional summary about your background, experience, and strengths.",
  },
];

const TOTAL_STEPS = STEPS.length;

interface WizardData {
  contact: ContactStepValue;
  websites: ContactWebsite[];
  education: EducationSectionItem[];
  experience: ExperienceSectionItem[];
  skills: string[];
  projects: ProjectSectionItem[];
  certifications: CertificationSectionItem[];
  awards: AwardSectionItem[];
  references: ReferenceSectionItem[];
  introduction: string;
}

interface ManualProfileWizardProps {
  onExit: () => void;
  userEmail?: string;
  onSubmitted?: () => void;
  /** When provided, shows the "Already have a CV?" banner that bails to upload. */
  onUploadCv?: () => void;
}

// Pure helpers — assembled outside the component to avoid re-creation on renders.
function assembleStructuredCV(d: WizardData): StructuredCV {
  const linkedin = d.websites.find((w) => w.type === "Linkedin")?.url ?? "";
  return {
    introduction: d.introduction,
    contactInfo: {
      email: d.contact.email,
      phone: d.contact.phone,
      isPhoneVerified: d.contact.isPhoneVerified,
      countryCode: inferPhoneCountry(d.contact.phone),
      address: d.contact.address,
      linkedin,
      websites: d.websites.filter((website) => website.url.trim() !== ""),
    },
    experience: d.experience.filter(
      (entry) => entry.title.trim() !== "" || entry.company.trim() !== "",
    ),
    skills: d.skills,
    education: d.education.filter((entry) => entry.school.trim() !== ""),
    projects: d.projects.filter((entry) => entry.name.trim() !== ""),
    certifications: d.certifications.filter(
      (entry) => entry.name.trim() !== "" || entry.issuingOrganization.trim() !== "",
    ),
    awards: d.awards.filter((entry) => entry.title.trim() !== ""),
    references: d.references.filter((entry) => entry.name.trim() !== ""),
  };
}

function fullName(c: ContactStepValue): string {
  return [c.firstName, c.middleInitial ? `${c.middleInitial}.` : "", c.lastName]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// Multi-entry steps key field errors by `${itemId}.${field}` so each accordion
// form can surface its own.
function prefixItemErrors<T extends { id: string }>(
  items: T[],
  validate: (item: T) => FieldErrors,
): FieldErrors {
  const out: FieldErrors = {};
  for (const item of items) {
    const errs = validate(item);
    for (const key in errs) out[`${item.id}.${key}`] = errs[key];
  }
  return out;
}

function computeStepErrors(stepIndex: number, d: WizardData): FieldErrors {
  switch (stepIndex) {
    case 0:
      return validateContact(d.contact);
    case 1:
      return prefixItemErrors(d.websites, validateWebsite);
    case 2:
      return prefixItemErrors(d.education, validateEducationItem);
    case 3:
      return prefixItemErrors(d.experience, validateExperienceItem);
    case 5:
      return prefixItemErrors(d.projects, validateProjectItem);
    case 6:
      return prefixItemErrors(d.certifications, validateCertificationItem);
    case 7:
      return prefixItemErrors(d.awards, validateAwardItem);
    case 8:
      return prefixItemErrors(d.references, validateReferenceItem);
    case 9:
      return validateIntroduction(d.introduction);
    default:
      return {}; // Skills (4) has no required fields
  }
}

export default function ManualProfileWizard({
  onExit,
  userEmail = "",
  onSubmitted,
  onUploadCv,
}: ManualProfileWizardProps) {
  const [stepIndex, setStepIndex] = useState(0); // 0-based
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [showAllErrors, setShowAllErrors] = useState(false);

  const [data, setData] = useState<WizardData>(() => ({
    contact: createEmptyContact(userEmail),
    websites: [createWebsite()],
    education: [createEmptyEducation()],
    experience: [createEmptyExperience()],
    skills: [],
    projects: [createEmptyProject()],
    certifications: [createEmptyCertification()],
    awards: [createEmptyAward()],
    references: [createEmptyReference()],
    introduction: "",
  }));

  // Capture the initial data snapshot once (for dirty tracking).
  const initialDataRef = useRef<WizardData | null>(null);
  if (initialDataRef.current === null) {
    initialDataRef.current = data;
  }

  const [showDiscard, setShowDiscard] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const draftStorageKey = draftKey(userEmail);
  const [pendingDraft, setPendingDraft] = useState<ProfileDraft<WizardData> | null>(null);

  function clearDraft() {
    try {
      window.localStorage.removeItem(draftStorageKey);
    } catch {
      /* ignore disabled storage */
    }
  }

  function patch(p: Partial<WizardData>) {
    setData((d) => ({ ...d, ...p }));
  }

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const uniqRes = await api.post("/api/job-portal/check-phone-unique", {
        phone: data.contact.phone,
        email: data.contact.email,
      });
      if (uniqRes?.data?.unique === false) {
        setSubmitError("That mobile number is already linked to another account.");
        setStepIndex(0);
        return;
      }
      const structuredCV = assembleStructuredCV(data);
      await api.post("/api/whitecloak/store-cv", {
        name: fullName(data.contact),
        email: data.contact.email,
        cvData: { structuredCV },
        fileInfo: null,
      });
      clearDraft();
      (onSubmitted ?? onExit)();
    } catch {
      setSubmitError("Something went wrong saving your profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOTAL_STEPS - 1;

  // Inline multi-entry steps surface an "Add <entry>" button in the footer that
  // appends a blank entry to the relevant list.
  function resolveFooterAdd(): { label: string; onAdd: () => void } | null {
    switch (stepIndex) {
      case 1:
        return {
          label: "Add website",
          onAdd: () => patch({ websites: [...data.websites, createWebsite()] }),
        };
      case 2:
        return {
          label: "Add education",
          onAdd: () => patch({ education: [...data.education, createEmptyEducation()] }),
        };
      case 3:
        return {
          label: "Add experience",
          onAdd: () => patch({ experience: [...data.experience, createEmptyExperience()] }),
        };
      case 5:
        return {
          label: "Add project",
          onAdd: () => patch({ projects: [...data.projects, createEmptyProject()] }),
        };
      case 6:
        return {
          label: "Add certification",
          onAdd: () =>
            patch({ certifications: [...data.certifications, createEmptyCertification()] }),
        };
      case 7:
        return {
          label: "Add award",
          onAdd: () => patch({ awards: [...data.awards, createEmptyAward()] }),
        };
      case 8:
        return {
          label: "Add reference",
          onAdd: () => patch({ references: [...data.references, createEmptyReference()] }),
        };
      default:
        return null;
    }
  }
  const footerAdd = resolveFooterAdd();

  const progressPct = ((stepIndex + 1) / TOTAL_STEPS) * 100;
  // Reveal only the left slice of the full gradient, proportional to progress.
  const progressFillStyle = {
    width: `${progressPct}%`,
    backgroundSize: `${(10000 / progressPct).toFixed(2)}% 100%`,
  };

  const isDirty = useMemo(
    () =>
      initialDataRef.current !== null &&
      JSON.stringify(data) !== JSON.stringify(initialDataRef.current),
    [data],
  );

  // Per-step validation. A field's error shows once it's blurred (touched) or
  // after a Next attempt reveals them all.
  const stepErrors = useMemo(() => computeStepErrors(stepIndex, data), [stepIndex, data]);
  const visibleErrors = useMemo(() => {
    const out: FieldErrors = {};
    for (const key in stepErrors) {
      if (showAllErrors || touched.has(key)) out[key] = stepErrors[key];
    }
    return out;
  }, [stepErrors, showAllErrors, touched]);
  const markTouched = (key: string) =>
    setTouched((current) => (current.has(key) ? current : new Set(current).add(key)));

  useEffect(() => {
    setTouched(new Set());
    setShowAllErrors(false);
  }, [stepIndex]);

  // ----- Draft persistence -----
  // On mount, offer to resume a saved draft (Resume / Start over).
  useEffect(() => {
    const existing = parseDraft<WizardData>(
      typeof window !== "undefined" ? window.localStorage.getItem(draftStorageKey) : null,
    );
    if (existing) setPendingDraft(existing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save on every change once dirty (not while the resume prompt is open).
  useEffect(() => {
    if (!isDirty || pendingDraft) return;
    try {
      window.localStorage.setItem(draftStorageKey, serializeDraft(data, stepIndex));
    } catch {
      /* ignore quota / disabled storage */
    }
  }, [data, stepIndex, isDirty, pendingDraft, draftStorageKey]);

  // Final silent save on tab close/reload (no native prompt — resume is offered on return).
  useEffect(() => {
    const onBeforeUnload = () => {
      if (isDirty) {
        try {
          window.localStorage.setItem(draftStorageKey, serializeDraft(data, stepIndex));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, data, stepIndex, draftStorageKey]);

  // Browser Back while editing → show the discard prompt instead of leaving.
  useEffect(() => {
    if (!isDirty) return;
    window.history.pushState(null, "", window.location.href);
    const onPop = () => {
      setShowDiscard(true);
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isDirty]);

  function renderStep() {
    switch (stepIndex) {
      case 0:
        return (
          <ContactInformationStep
            value={data.contact}
            onChange={(contact) => patch({ contact })}
            lockEmail={Boolean(userEmail)}
            errors={visibleErrors}
            onFieldBlur={markTouched}
          />
        );
      case 2:
        return (
          <InlineMultiEntryStep
            items={data.education}
            onChange={(education) => patch({ education })}
            entryNoun="education"
            entryLabel={(entry, index) => entry.school.trim() || `Education ${index + 1}`}
            errors={visibleErrors}
            onFieldBlur={markTouched}
            renderForm={(value, onChange, errors, onFieldBlur) => (
              <EducationEntryForm
                value={value}
                onChange={onChange}
                errors={errors}
                onFieldBlur={onFieldBlur}
              />
            )}
          />
        );
      case 3:
        return (
          <InlineMultiEntryStep
            items={data.experience}
            onChange={(experience) => patch({ experience })}
            entryNoun="experience"
            entryLabel={(entry, index) =>
              entry.title.trim() || entry.company.trim() || `Experience ${index + 1}`
            }
            errors={visibleErrors}
            onFieldBlur={markTouched}
            renderForm={(value, onChange, errors, onFieldBlur) => (
              <ExperienceEntryForm
                value={value}
                onChange={onChange}
                errors={errors}
                onFieldBlur={onFieldBlur}
              />
            )}
          />
        );
      case 5:
        return (
          <InlineMultiEntryStep
            items={data.projects}
            onChange={(projects) => patch({ projects })}
            entryNoun="project"
            entryLabel={(entry, index) => entry.name.trim() || `Project ${index + 1}`}
            errors={visibleErrors}
            onFieldBlur={markTouched}
            renderForm={(value, onChange, errors, onFieldBlur) => (
              <ProjectEntryForm
                value={value}
                onChange={onChange}
                errors={errors}
                onFieldBlur={onFieldBlur}
              />
            )}
          />
        );
      case 6:
        return (
          <InlineMultiEntryStep
            items={data.certifications}
            onChange={(certifications) => patch({ certifications })}
            entryNoun="certification"
            entryLabel={(entry, index) => entry.name.trim() || `Certification ${index + 1}`}
            errors={visibleErrors}
            onFieldBlur={markTouched}
            renderForm={(value, onChange, errors, onFieldBlur) => (
              <CertificationEntryForm
                value={value}
                onChange={onChange}
                errors={errors}
                onFieldBlur={onFieldBlur}
              />
            )}
          />
        );
      case 7:
        return (
          <InlineMultiEntryStep
            items={data.awards}
            onChange={(awards) => patch({ awards })}
            entryNoun="award"
            entryLabel={(entry, index) => entry.title.trim() || `Award ${index + 1}`}
            errors={visibleErrors}
            onFieldBlur={markTouched}
            renderForm={(value, onChange, errors, onFieldBlur) => (
              <AwardEntryForm
                value={value}
                onChange={onChange}
                errors={errors}
                onFieldBlur={onFieldBlur}
              />
            )}
          />
        );
      case 1:
        return (
          <WebsitesStep
            value={data.websites}
            onChange={(websites) => patch({ websites })}
            errors={visibleErrors}
            onFieldBlur={markTouched}
          />
        );
      case 4:
        return <SkillsStep value={data.skills} onChange={(skills) => patch({ skills })} />;
      case 8:
        return (
          <InlineMultiEntryStep
            items={data.references}
            onChange={(references) => patch({ references })}
            entryNoun="reference"
            entryLabel={(entry, index) => entry.name.trim() || `Reference ${index + 1}`}
            errors={visibleErrors}
            onFieldBlur={markTouched}
            renderForm={(value, onChange, errors, onFieldBlur) => (
              <ReferenceEntryForm
                value={value}
                onChange={onChange}
                errors={errors}
                onFieldBlur={onFieldBlur}
              />
            )}
          />
        );
      case 9:
        return (
          <IntroductionStep
            value={data.introduction}
            onChange={(introduction) => patch({ introduction })}
            errors={visibleErrors}
            onFieldBlur={markTouched}
          />
        );
      default:
        // All 10 steps (0–9) are handled above; this is an unreachable safety fallback.
        return null;
    }
  }

  function goBack() {
    if (isFirst) {
      if (isDirty) {
        setShowDiscard(true);
      } else {
        onExit();
      }
      return;
    }
    setStepIndex((current) => Math.max(0, current - 1));
  }

  function goNext() {
    // Block + reveal all errors when the step is invalid.
    if (Object.keys(stepErrors).length > 0) {
      setShowAllErrors(true);
      return;
    }
    if (isLast) {
      handleSubmit();
      return;
    }
    setStepIndex((current) => Math.min(TOTAL_STEPS - 1, current + 1));
  }

  // Skip bypasses validation (the step is optional); blank rows are filtered on submit.
  function goSkip() {
    setStepIndex((current) => Math.min(TOTAL_STEPS - 1, current + 1));
  }

  return (
    <div className={styles.wizard}>
      <DiscardProfileModal
        opened={showDiscard}
        onGoBack={() => setShowDiscard(false)}
        onSaveExit={() => {
          try {
            window.localStorage.setItem(draftStorageKey, serializeDraft(data, stepIndex));
          } catch {
            /* ignore */
          }
          onExit();
        }}
        onExitWithoutSaving={() => {
          clearDraft();
          onExit();
        }}
      />

      <ResumeDraftModal
        opened={pendingDraft !== null}
        savedAt={pendingDraft?.savedAt}
        onResume={() => {
          if (pendingDraft) {
            setData(pendingDraft.data);
            setStepIndex(pendingDraft.stepIndex);
          }
          setPendingDraft(null);
        }}
        onStartOver={() => {
          clearDraft();
          setPendingDraft(null);
        }}
      />

      {onUploadCv && !bannerDismissed && (
        <CvUploadBanner
          onUploadCv={onUploadCv}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      <div className={styles.header}>
        <button
          type="button"
          className={styles.back}
          onClick={goBack}
          aria-label="Go back"
        >
          <ChevronLeft />
        </button>
        <span className={styles.title}>Create a Profile Manually</span>
        <span className={styles.stepCount}>
          Step {stepIndex + 1} of {TOTAL_STEPS}
        </span>
      </div>

      <div className={styles.card}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={progressFillStyle} />
        </div>

        <div className={styles.sectionHeading}>
          <h2>{step.title}</h2>
          <p>{step.subtitle}</p>
        </div>

        {renderStep()}

        {submitError && (
          <p className={styles.submitError} role="alert">
            {submitError}
          </p>
        )}

        <div
          className={`${styles.footer}${footerAdd ? ` ${styles.footerSpread}` : ""}`}
        >
          {footerAdd && (
            <Button
              label={footerAdd.label}
              variant="secondary"
              iconJsx={<PlusCircle className={styles.footerAddIcon} aria-hidden />}
              iconPosition="left"
              onClick={footerAdd.onAdd}
            />
          )}
          <div className={styles.footerActions}>
            {step.hasSkip && (
              <Button label="Skip" variant="secondary" onClick={goSkip} />
            )}
            <Button
              label={isLast ? (submitting ? "Submitting…" : "Submit") : "Next"}
              variant="primary"
              iconJsx={!isLast ? <ChevronRight width={20} height={20} /> : undefined}
              iconPosition="right"
              onClick={goNext}
              disabled={submitting}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
