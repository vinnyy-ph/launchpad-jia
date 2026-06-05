"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/lib/components/ui";
import { ChevronLeft, ChevronRight } from "@untitledui/icons";
import ContactInformationStep, {
  type ContactStepValue,
  createEmptyContact,
} from "./ContactInformationStep";
import MultiEntryStep from "./MultiEntryStep";
import DiscardProfileModal from "./DiscardProfileModal";
import WebsitesStep from "./WebsitesStep";
import SkillsStep from "./SkillsStep";
import ReferenceModal from "./ReferenceModal";
import IntroductionStep from "./IntroductionStep";
import EducationModal from "@/lib/components/screens/EducationModal";
import ExperienceModal from "@/lib/components/screens/ExperienceModal";
import ProjectsModal from "@/lib/components/screens/ProjectsModal";
import CertificationModal from "@/lib/components/screens/CertificationModal";
import AwardModal from "@/lib/components/screens/AwardModal";
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
import { validatePhoneFormat } from "@/lib/utils/phoneValidation";
import { api } from "@/lib/utils/apiClient";
import { inferPhoneCountry } from "@/lib/utils/phoneInput";

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
      "Highlight the skills, tools, and technologies you use in your work.",
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
      websites: d.websites,
    },
    experience: d.experience,
    skills: d.skills,
    education: d.education,
    projects: d.projects,
    certifications: d.certifications,
    awards: d.awards,
    references: d.references,
  };
}

function fullName(c: ContactStepValue): string {
  return [c.firstName, c.middleInitial ? `${c.middleInitial}.` : "", c.lastName]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function ManualProfileWizard({
  onExit,
  userEmail = "",
  onSubmitted,
}: ManualProfileWizardProps) {
  const [stepIndex, setStepIndex] = useState(0); // 0-based

  const [data, setData] = useState<WizardData>(() => ({
    contact: createEmptyContact(userEmail),
    websites: [],
    education: [],
    experience: [],
    skills: [],
    projects: [],
    certifications: [],
    awards: [],
    references: [],
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

  function renderStep() {
    switch (stepIndex) {
      case 0:
        return (
          <ContactInformationStep
            value={data.contact}
            onChange={(contact) => patch({ contact })}
            lockEmail={Boolean(userEmail)}
          />
        );
      case 2:
        return (
          <MultiEntryStep items={data.education} onChange={(education) => patch({ education })}
            EditorModal={EducationModal}
            rowLabel={(e) => `${e.degree || "Degree"}: ${e.school || "School-name"}`}
            addLabel="Add education" />
        );
      case 3:
        return (
          <MultiEntryStep items={data.experience} onChange={(experience) => patch({ experience })}
            EditorModal={ExperienceModal}
            rowLabel={(x) => `${x.title || "Job Title"}: ${x.company || "Company"}`}
            addLabel="Add experience" />
        );
      case 5:
        return (
          <MultiEntryStep items={data.projects} onChange={(projects) => patch({ projects })}
            EditorModal={ProjectsModal}
            rowLabel={(p) => p.name || "Project"}
            addLabel="Add project" />
        );
      case 6:
        return (
          <MultiEntryStep items={data.certifications} onChange={(certifications) => patch({ certifications })}
            EditorModal={CertificationModal}
            rowLabel={(c) => c.name || "Certificate"}
            addLabel="Add certification" />
        );
      case 7:
        return (
          <MultiEntryStep items={data.awards} onChange={(awards) => patch({ awards })}
            EditorModal={AwardModal}
            rowLabel={(a) => a.title || "Award"}
            addLabel="Add award" />
        );
      case 1:
        return <WebsitesStep value={data.websites} onChange={(websites) => patch({ websites })} />;
      case 4:
        return <SkillsStep value={data.skills} onChange={(skills) => patch({ skills })} />;
      case 8:
        return (
          <MultiEntryStep items={data.references} onChange={(references) => patch({ references })}
            EditorModal={ReferenceModal}
            rowLabel={(r) => r.name || "Reference"}
            addLabel="Add reference" />
        );
      case 9:
        return <IntroductionStep value={data.introduction} onChange={(introduction) => patch({ introduction })} />;
      default:
        // All 10 steps (0–9) are handled above; this is an unreachable safety fallback.
        return null;
    }
  }

  function canAdvance(i: number): boolean {
    if (i === 0) {
      const c = data.contact;
      return (
        [c.firstName, c.lastName, c.middleInitial, c.email, c.address].every(
          (v) => v.trim() !== "",
        ) && validatePhoneFormat(c.phone).valid
      );
    }
    if (i === 9) return data.introduction.trim() !== "";
    // Steps 2–10 use Skip / optional rows; row validation lives in the editors.
    return true;
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
    if (isLast) {
      handleSubmit();
      return;
    }
    setStepIndex((current) => Math.min(TOTAL_STEPS - 1, current + 1));
  }

  return (
    <div className={styles.wizard}>
      <DiscardProfileModal
        opened={showDiscard}
        onGoBack={() => setShowDiscard(false)}
        onSaveExit={onExit}
        onExitWithoutSaving={onExit}
      />

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

        <div className={styles.footer}>
          {step.hasSkip && (
            <Button label="Skip" variant="secondary" pill onClick={goNext} />
          )}
          <Button
            label={isLast ? (submitting ? "Submitting…" : "Submit") : "Next"}
            variant="primary"
            pill
            iconJsx={!isLast ? <ChevronRight /> : undefined}
            iconPosition="right"
            onClick={goNext}
            disabled={submitting || !canAdvance(stepIndex)}
          />
        </div>
      </div>
    </div>
  );
}
