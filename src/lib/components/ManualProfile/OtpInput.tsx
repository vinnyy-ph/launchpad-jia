"use client";

import { usePasscodeFieldController } from "@/lib/hooks/usePasscodeFieldController";
import styles from "./manual-profile.module.scss";

// Local 6-box OTP input for the manual profile phone verification modal.
// Reuses the shared field controller (auto-advance, backspace, paste) for
// behaviour, but owns its presentation so the boxes match the Figma frame:
// six even square cells, no group separator, contained inside the modal.

const OTP_LENGTH = 6;

interface OtpInputProps {
  onComplete?(code: string): void;
  onDigitChange?(index: number, digit: string | null): void;
  placeholder?: string;
  error?: boolean;
  autoFocus?: boolean;
}

export default function OtpInput({
  onComplete,
  onDigitChange,
  placeholder = "0",
  error = false,
  autoFocus = false,
}: OtpInputProps) {
  const { digits, registerInput, handleChange, handleKeyDown, handlePaste } =
    usePasscodeFieldController({ length: OTP_LENGTH, onComplete, onDigitChange });

  return (
    <div className={styles.otpInput} role="group" aria-label="6-digit verification code">
      {Array.from({ length: OTP_LENGTH }).map((_, index) => (
        <input
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          ref={registerInput(index)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={1}
          placeholder={placeholder}
          aria-label={`Digit ${index + 1}`}
          autoFocus={autoFocus && index === 0}
          className={`${styles.otpBox}${error ? ` ${styles.otpBoxError}` : ""}`}
          value={digits[index] ?? ""}
          onChange={handleChange(index)}
          onKeyDown={handleKeyDown(index)}
          onPaste={handlePaste(index)}
        />
      ))}
    </div>
  );
}
