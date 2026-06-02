"use client";

import { signInWithGoogle, signInWithMicrosoft } from "@/lib/firebase/firebaseClient";
import { useState } from "react";
import styles from "../styles/SignInModal.module.scss";
import { assetConstants } from "@/lib/utils/constantsV2";
import { tvAssets } from "@/lib/utils/constantsV2";

export default function SignInModal({ isOpen, onClose, variant = "student" }: {
  isOpen: boolean;
  onClose: () => void;
  variant?: "employer" | "student";
}) {
  const [rememberMe, setRememberMe] = useState(true);
  const isEmployer = variant === "employer";

  if (!isOpen) return null;

  const handleGoogleSignIn = () => {
    if (isEmployer) {
      signInWithGoogle();
    } else {
      signInWithGoogle("job-portal", { rememberMe });
    }
  };

  const handleMicrosoftSignIn = () => {
    signInWithMicrosoft();
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <img alt="Jia Talent Vault Logo" src={tvAssets.tvIcon} className={styles.logo} />

        <h2 className={styles.title}>Let's get you set up!</h2>

        <button className={styles.googleButton} onClick={handleGoogleSignIn}>
          <img alt="Google" src={assetConstants.google} />
          Continue with Google
        </button>

        {isEmployer && (
          <button className={styles.googleButton} onClick={handleMicrosoftSignIn} style={{ marginTop: 12 }}>
            <img alt="Microsoft" src="/icons/microsoft.svg" />
            Continue with Microsoft
          </button>
        )}

        {!isEmployer && (
          <label className={styles.rememberMe}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Remember me</span>
          </label>
        )}

        <p className={styles.terms}>
          By continuing, you agree to our<br />
          <a href="/terms-of-service" target="_blank"><strong>Terms of Service</strong></a> and <a href="/privacy-policy" target="_blank"><strong>Privacy Policy</strong></a>
        </p>
      </div>
    </div>
  );
}
