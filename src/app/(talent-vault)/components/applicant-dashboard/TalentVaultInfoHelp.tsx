"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "@/app/(talent-vault)/styles/modules/talent-vault-info-help.module.scss";
import { assetConstants } from "@/lib/utils/constantsV2";

function normalizeDomain(domain: string) {
  let normalizedDomain = domain.trim();

  if (normalizedDomain.startsWith("https://")) {
    normalizedDomain = normalizedDomain.slice("https://".length);
  } else if (normalizedDomain.startsWith("http://")) {
    normalizedDomain = normalizedDomain.slice("http://".length);
  }

  const firstSlashIndex = normalizedDomain.indexOf("/");
  if (firstSlashIndex >= 0) {
    normalizedDomain = normalizedDomain.slice(0, firstSlashIndex);
  }

  while (normalizedDomain.endsWith("/")) {
    normalizedDomain = normalizedDomain.slice(0, -1);
  }

  return normalizedDomain;
}

function getStudentsPortalUrl(domain: string, localPath: string) {
  const normalizedDomain = normalizeDomain(domain);
  const isLocalDomain =
    normalizedDomain.includes("localhost") ||
    normalizedDomain.includes("127.0.0.1");

  if (!normalizedDomain || isLocalDomain) {
    return localPath;
  }

  const host = normalizedDomain.startsWith("talentvault.")
    ? normalizedDomain
    : `talentvault.${normalizedDomain}`;

  return `https://${host}`;
}

export function TalentVaultInfoHelp() {
  const [isOpen, setIsOpen] = useState(false);
  const applicantAppDomain = process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN || "";
  const studentsPortalUrl = getStudentsPortalUrl(
    applicantAppDomain,
    "/talent-vault/students"
  );

  const handleLearnMore = () => {
    setIsOpen(false);
    const newTab = window.open(studentsPortalUrl, "_blank", "noopener,noreferrer");
    if (!newTab) {
      window.location.href = studentsPortalUrl;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setIsOpen(true)}>
        What is Talent Vault?
      </button>

      {isOpen &&
        typeof window !== "undefined" &&
        createPortal(
          <div className={styles.overlay} onClick={() => setIsOpen(false)} role="presentation">
            <section
              className={styles.modal}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="talent-vault-info-help-title"
            >
              <header className={styles.header}>
                <h2 id="talent-vault-info-help-title">What is Talent Vault?</h2>
                <button
                  type="button"
                  className={styles.closeButton}
                  onClick={() => setIsOpen(false)}
                  aria-label="Close Talent Vault information"
                >
                  <img alt="close" src={assetConstants.x} />
                </button>
              </header>

              <div className={styles.body}>
                <p>
                  Talent Vault is your profile space where Jia helps match you with jobs
                  that fit your goals, skills, and preferences.
                </p>

                <ul>
                  <li>Set up your profile once through this guided flow.</li>
                  <li>Complete pre-screening and AI interview to strengthen your profile.</li>
                  <li>Get discovered by relevant employers more quickly.</li>
                </ul>

                <p>
                  You stay in control at every step and can update your details anytime.
                </p>
              </div>

              <footer className={styles.footer}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleLearnMore}
                >
                  Learn More
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => setIsOpen(false)}
                >
                  Got it
                </button>
              </footer>
            </section>
          </div>,
          document.body
        )}
    </>
  );
}
