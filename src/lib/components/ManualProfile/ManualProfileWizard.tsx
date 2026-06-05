"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/lib/components/ui";
import { ChevronLeft, ChevronRight } from "@untitledui/icons";
import ContactInformationStep, {
  type ContactStepValue,
  createEmptyContact,
} from "./ContactInformationStep";
import DiscardProfileModal from "./DiscardProfileModal";
import styles from "./manual-profile.module.scss";
import type {
  ExperienceSectionItem,
  EducationSectionItem,
  ProjectSectionItem,
  CertificationSectionItem,
  AwardSectionItem,
  ReferenceSectionItem,
  ContactWebsite,
} from "@/lib/utils/structuredCV";
import { validatePhoneFormat } from "@/lib/utils/phoneValidation";

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
}

export default function ManualProfileWizard({
  onExit,
  userEmail = "",
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

  function patch(p: Partial<WizardData>) {
    setData((d) => ({ ...d, ...p }));
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

  function canAdvance(i: number): boolean {
    if (i === 0) {
      const c = data.contact;
      return (
        [c.firstName, c.lastName, c.middleInitial, c.email, c.address].every(
          (v) => v.trim() !== "",
        ) && validatePhoneFormat(c.phone).valid
      );
    }
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
      onExit();
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

        {stepIndex === 0 ? (
          <ContactInformationStep
            value={data.contact}
            onChange={(contact) => patch({ contact })}
            lockEmail={Boolean(userEmail)}
          />
        ) : (
          <div className={styles.placeholder}>
            {step.title} — step {stepIndex + 1} of {TOTAL_STEPS} (coming soon)
          </div>
        )}

        <div className={styles.footer}>
          {step.hasSkip && (
            <Button label="Skip" variant="secondary" pill onClick={goNext} />
          )}
          <Button
            label={isLast ? "Submit" : "Next"}
            variant="primary"
            pill
            iconJsx={!isLast ? <ChevronRight /> : undefined}
            iconPosition="right"
            onClick={goNext}
            disabled={!canAdvance(stepIndex)}
          />
        </div>
      </div>
    </div>
  );
}
