"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/lib/components/ui";
import { ChevronLeft, ChevronRight, PlusCircle, Stars02 } from "@untitledui/icons";
import ContactInformationStep, {
  type ContactStepValue,
  createEmptyContact,
} from "./ContactInformationStep";
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
import ReplaceIntroductionModal from "./ReplaceIntroductionModal";
import { useGenerateIntroduction } from "./useGenerateIntroduction";
import styles from "./manual-profile.module.scss";
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
import {
  draftKey,
  parseDraft,
  serializeDraft,
  type ProfileDraft,
} from "@/lib/utils/profileDraft";
import {
  assembleStructuredCV,
  INITIAL_SECTION_STATUS,
  nextSectionStatus,
  sanitizeSectionStatus,
  type ProfileSectionStatus,
  type WizardData,
} from "@/lib/utils/assembleProfile";
import { hasProfileContentForIntro } from "@/lib/utils/introductionAI";
import { htmlToPlainText } from "@/lib/utils/sanitizeRichText";

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

interface ManualProfileWizardProps {
  onExit: () => void;
  userEmail?: string;
  onSubmitted?: () => void;
  /** When provided, shows the "Already have a CV?" banner that bails to upload. */
  onUploadCv?: () => void;
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

// NOTE: the step-index cases here must stay in sync with STEP_SECTION in
// assembleProfile.ts (asserted by its test) and with renderStep below.
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
  const [sectionStatus, setSectionStatus] = useState<ProfileSectionStatus>(INITIAL_SECTION_STATUS);

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

  const {
    generating: generatingIntro,
    error: generateError,
    generate: generateIntro,
    reset: resetGenerate,
  } = useGenerateIntroduction();
  const [introGenId, setIntroGenId] = useState(0);
  const [introHint, setIntroHint] = useState<string | null>(null);
  const [showReplaceIntro, setShowReplaceIntro] = useState(false);

  const draftStorageKey = draftKey(userEmail);
  const [pendingDraft, setPendingDraft] = useState<ProfileDraft<WizardData> | null>(null);
  // Bumped on draft resume. Keys the contact step so resuming AT step 0 forces
  // a remount — its local state (country/manualMode/addressParts) is snapshotted
  // from props at mount and would otherwise desync from the restored data. Every
  // other resume index is safe (step 0 remounts when navigated back to).
  const [resumeGen, setResumeGen] = useState(0);

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
      const structuredCV = assembleStructuredCV(data, sectionStatus);
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

  async function runGenerateIntro() {
    setIntroHint(null);
    resetGenerate();
    const profile = assembleStructuredCV(data, sectionStatus);
    if (!hasProfileContentForIntro(profile)) {
      setIntroHint(
        "Add some experience or skills first so Jia can write your introduction.",
      );
      return;
    }
    const html = await generateIntro(profile);
    if (html) {
      patch({ introduction: html });
      setIntroGenId((n) => n + 1);
      markTouched("introduction");
    }
  }

  function handleGenerateIntroClick() {
    if (generatingIntro) return;
    setIntroHint(null);
    // Confirm before overwriting text the user already has in the editor.
    if (htmlToPlainText(data.introduction).trim() !== "") {
      setShowReplaceIntro(true);
      return;
    }
    runGenerateIntro();
  }

  useEffect(() => {
    setTouched(new Set());
    setShowAllErrors(false);
    // Re-entering a section resets its intent so a fresh Next/Skip re-establishes it.
    setSectionStatus((s) => nextSectionStatus(s, stepIndex, "enter"));
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
      window.localStorage.setItem(
        draftStorageKey,
        serializeDraft(data, stepIndex, sectionStatus),
      );
    } catch {
      /* ignore quota / disabled storage */
    }
  }, [data, stepIndex, sectionStatus, isDirty, pendingDraft, draftStorageKey]);

  // Final silent save on tab close/reload (no native prompt — resume is offered on return).
  useEffect(() => {
    const onBeforeUnload = () => {
      if (isDirty) {
        try {
          window.localStorage.setItem(
            draftStorageKey,
            serializeDraft(data, stepIndex, sectionStatus),
          );
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, data, stepIndex, sectionStatus, draftStorageKey]);

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
            key={resumeGen}
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
            genId={introGenId}
            generating={generatingIntro}
            generateError={generateError}
            generateHint={introHint}
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
    setSectionStatus((s) => nextSectionStatus(s, stepIndex, "submit"));
    if (isLast) {
      handleSubmit();
      return;
    }
    setStepIndex((current) => Math.min(TOTAL_STEPS - 1, current + 1));
  }

  // Skip = "this section isn't part of my CV": mark it skipped (dropped at assemble)
  // without destroying the entries — they're still there if the user navigates back.
  function goSkip() {
    setSectionStatus((s) => nextSectionStatus(s, stepIndex, "skip"));
    setStepIndex((current) => Math.min(TOTAL_STEPS - 1, current + 1));
  }

  return (
    <div className={styles.wizard}>
      <DiscardProfileModal
        opened={showDiscard}
        onGoBack={() => setShowDiscard(false)}
        onSaveExit={() => {
          try {
            window.localStorage.setItem(
              draftStorageKey,
              serializeDraft(data, stepIndex, sectionStatus),
            );
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
            // Clamp: parseDraft only checks the index is a number; a malformed
            // or legacy draft must not land on a non-existent (blank) step.
            setStepIndex(
              Math.min(Math.max(0, pendingDraft.stepIndex), TOTAL_STEPS - 1),
            );
            // v1 drafts have no sectionStatus → INITIAL (same as before); the
            // sanitizer also rejects tampered/invalid values per section.
            setSectionStatus(sanitizeSectionStatus(pendingDraft.sectionStatus));
            setResumeGen((n) => n + 1);
          }
          setPendingDraft(null);
        }}
        onStartOver={() => {
          clearDraft();
          setPendingDraft(null);
        }}
      />

      <ReplaceIntroductionModal
        opened={showReplaceIntro}
        onConfirm={() => {
          setShowReplaceIntro(false);
          runGenerateIntro();
        }}
        onCancel={() => setShowReplaceIntro(false)}
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
          className={`${styles.footer}${
            footerAdd || isLast ? ` ${styles.footerSpread}` : ""
          }`}
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
          {isLast && (
            <Button
              label={generatingIntro ? "Generating…" : "Generate Introduction"}
              variant="primary"
              iconJsx={
                generatingIntro ? (
                  <span className={styles.spinner} aria-hidden />
                ) : (
                  <Stars02 width={20} height={20} aria-hidden />
                )
              }
              iconPosition="left"
              onClick={handleGenerateIntroClick}
              disabled={generatingIntro || submitting}
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
              disabled={submitting || generatingIntro}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
