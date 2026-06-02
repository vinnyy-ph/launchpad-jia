"use client";

import { useState } from "react";
import PasscodeInput from "@/lib/components/CandidateProfileComponents/PasscodeInput";
import { usePasscodeValue } from "@/lib/hooks/usePasscodeValue";
import styles from "@/lib/styles/candidate-profile.module.scss";
import buttonStyles from "@/lib/components/ui/button/button.module.scss";

interface Props {
  onValidatedAction?(passcode: string): Promise<void> | void;
}

export default function PasscodePromptModal({ onValidatedAction }: Props) {
  const { passcode, onDigitChange, onComplete, reset } = usePasscodeValue();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePasscodeComplete = (code: string) => {
    onComplete(code);
  };

  const handleComplete = async (code: string) => {
    if (!code || code.trim() === "") {
      setError("Incorrect passcode. Please try again.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await onValidatedAction?.(code);
      reset();
    } catch (err: any) {
      console.error("Passcode validation/fetch error:", err);
      setError(err?.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmClick = () => {
    void handleComplete(passcode);
  };

  const wrappedOnDigitChange = (index: number, digit: string | null) => {
    if (error) {
      setError(null);
    }
    onDigitChange(index, digit);
  };

  return (
    <div className="modal-background">
      <div className="modal-container">
        <div className={styles.passwordPrompt}>
          <div className={styles.passwordPromptContent}>
            <div className={`${styles.lockIcon} ${styles.lockIconOuter}`}>
              <div className={`${styles.lockIcon} ${styles.lockIconInner}`}>
                <img src="/icons/lock.svg" alt="Lock icon" />
              </div>
            </div>

            <div>
              <h1 className={styles.title}>This page is password-protected.</h1>
              <p className={styles.description}>Please enter the passcode to view.</p>
            </div>

            <div className={styles.passcodeField}>
              <p>Passcode</p>
              <div className={styles.inputWrapper}>
                <PasscodeInput
                  error={error}
                  onDigitChange={wrappedOnDigitChange}
                  onComplete={handlePasscodeComplete}
                  masking
                />
              </div>
              {error && <p className={styles.errorMessage}>{error}</p>}
            </div>

            <button
              onClick={handleConfirmClick}
              disabled={loading}
              style={{ width: "100%" }}
              className={`${buttonStyles.button} ${buttonStyles.large} ${buttonStyles.primary} ${buttonStyles.default} ${loading ? buttonStyles.disabled : ""}`}
            >
              <span>{loading ? "Checking..." : "Confirm"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
