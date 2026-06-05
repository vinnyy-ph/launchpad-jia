"use client";

import { useMemo, useState } from "react";
import { Button } from "@/lib/components/ui";
import { ChevronLeft, ChevronRight } from "@untitledui/icons";
import ContactInformationStep, {
  type ContactStepValue,
  createEmptyContact,
} from "./ContactInformationStep";
import styles from "./manual-profile.module.scss";

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

interface ManualProfileWizardProps {
  onExit: () => void;
  userEmail?: string;
}

export default function ManualProfileWizard({
  onExit,
  userEmail = "",
}: ManualProfileWizardProps) {
  const [stepIndex, setStepIndex] = useState(0); // 0-based
  const [contact, setContact] = useState<ContactStepValue>(() =>
    createEmptyContact(userEmail),
  );

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOTAL_STEPS - 1;

  const progressPct = ((stepIndex + 1) / TOTAL_STEPS) * 100;
  // Reveal only the left slice of the full gradient, proportional to progress.
  const progressFillStyle = {
    width: `${progressPct}%`,
    backgroundSize: `${(10000 / progressPct).toFixed(2)}% 100%`,
  };

  const isContactValid = useMemo(() => {
    if (stepIndex !== 0) return true;
    return (
      contact.firstName.trim() !== "" &&
      contact.lastName.trim() !== "" &&
      contact.middleInitial.trim() !== "" &&
      contact.email.trim() !== "" &&
      contact.address.trim() !== ""
    );
  }, [stepIndex, contact]);

  function goBack() {
    if (isFirst) {
      onExit();
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
            value={contact}
            onChange={setContact}
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
            disabled={!isContactValid}
          />
        </div>
      </div>
    </div>
  );
}
