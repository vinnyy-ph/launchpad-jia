"use client";

import { useEffect, useRef, useState } from "react";
import { usePasscodeFieldController } from "@/lib/hooks/usePasscodeFieldController";
import styles from "@/lib/styles/candidate-profile.module.scss";

interface PasscodeDigitInputProps {
  error?: string;
  onComplete?(code: string): void;
  onDigitChange?(index: number, digit: string | null): void;
  placeholder?: string;
  masking?: boolean;
}

const PASSCODE_LENGTH = 6;
const GROUP_SPLIT_INDEX = 3;

export default function PasscodeInput({
  error,
  onComplete,
  onDigitChange,
  placeholder = "\u2022",
  masking = false,
}: PasscodeDigitInputProps) {
  const {
    digits,
    registerInput,
    handleChange,
    handleKeyDown,
    handlePaste,
  } = usePasscodeFieldController({
    length: PASSCODE_LENGTH,
    onComplete,
    onDigitChange,
  });

  const [visibleDigits, setVisibleDigits] = useState<boolean[]>(
    () => Array(PASSCODE_LENGTH).fill(false)
  );
  const maskTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout> | null>>(
    Array(PASSCODE_LENGTH).fill(null)
  );
  const previousDigitsRef = useRef<string[]>([...digits]);

  useEffect(() => {
    if (!masking) {
      previousDigitsRef.current = [...digits];
      return;
    }

    const prevDigits = previousDigitsRef.current;
    const changes: { show: number[]; hide: number[] } = { show: [], hide: [] };

    digits.forEach((digit, i) => {
      if (digit !== prevDigits[i]) {
        changes[digit ? "show" : "hide"].push(i);
      }
    });

    if (changes.show.length === 0 && changes.hide.length === 0) {
      previousDigitsRef.current = [...digits];
      return;
    }

    setVisibleDigits((prev) => {
      const next = [...prev];
      changes.hide.forEach((i) => next[i] = false);
      changes.show.forEach((i) => next[i] = true);
      return next;
    });

    [...changes.hide, ...changes.show].forEach((i) => {
      clearTimeout(maskTimeoutsRef.current[i]!);
      maskTimeoutsRef.current[i] = null;
    });

    changes.show.forEach((i) => {
      maskTimeoutsRef.current[i] = setTimeout(() => {
        setVisibleDigits((prev) => {
          const next = [...prev];
          next[i] = false;
          return next;
        });
        maskTimeoutsRef.current[i] = null;
      }, 200);
    });

    previousDigitsRef.current = [...digits];
  }, [digits, masking]);

  useEffect(() => {
    return () => {
      maskTimeoutsRef.current.forEach((timeoutId) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });
    };
  }, []);

  const getDisplayValue = (index: number) => {
    const digit = digits[index];
    if (!digit) {
      return "";
    }
    if (!masking) {
      return digit;
    }
    return visibleDigits[index] ? digit : "\u2022";
  };

  const renderInput = (index: number) => (
    <input
      key={index}
      ref={registerInput(index)}
      type="text"
      style={{
        border: `1px solid ${error ? "#FDA29B" : "#e9eaeb"}`,
        color: error ? "#FDA29B" : "#181D27",
      }}
      className={styles.digitBox}
      inputMode="numeric"
      maxLength={1}
      placeholder={placeholder}
      pattern="[0-9]*"
      autoComplete="off"
      value={getDisplayValue(index)}
      onChange={handleChange(index)}
      onKeyDown={handleKeyDown(index)}
      onPaste={handlePaste(index)}
    />
  );

  return (
    <>
      {Array.from({ length: GROUP_SPLIT_INDEX }).map((_, index) => renderInput(index))}

      <span className={styles.separator}>-</span>

      {Array.from({ length: PASSCODE_LENGTH - GROUP_SPLIT_INDEX }).map((_, offset) =>
        renderInput(offset + GROUP_SPLIT_INDEX)
      )}
    </>
  );
}
