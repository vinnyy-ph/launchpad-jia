import { useRef, useState } from "react";

interface Props {
  length?: number;
  onComplete?(code: string): void;
  onDigitChange?(index: number, digit: string | null): void;
}

interface UsePasscodeFieldControllerReturn {
  digits: string[];
  registerInput: (index: number) => (element: HTMLInputElement | null) => void;
  handleChange: (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleKeyDown: (index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => void;
  handlePaste: (index: number) => (event: React.ClipboardEvent<HTMLInputElement>) => void;
}

export function usePasscodeFieldController({
  length = 6,
  onComplete,
  onDigitChange,
}: Props = {}): UsePasscodeFieldControllerReturn {
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(length).fill(null));
  const [digits, setDigits] = useState<string[]>(Array(length).fill(""));

  const isDigit = (char: string) => char >= "0" && char <= "9";

  const focusInput = (index: number) => {
    if (index < 0 || index >= length) {
      return;
    }
    inputRefs.current[index]?.focus();
  };

  const commitDigits = (nextDigits: string[], changedIndexes: number[], nextFocus?: number) => {
    setDigits(nextDigits);

    changedIndexes.forEach((digitIndex) => {
      const digit = nextDigits[digitIndex];
      onDigitChange?.(digitIndex, digit === "" ? null : digit);
    });

    if (nextDigits.every((digit) => digit !== "")) {
      onComplete?.(nextDigits.join(""));
    }

    if (typeof nextFocus === "number") {
      focusInput(nextFocus);
    }
  };

  const handleChange = (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const char = event.target.value.slice(0, 1);
    const nextDigits = [...digits];

    if (isDigit(char)) {
      nextDigits[index] = char;
      const nextFocus = index < length - 1 ? index + 1 : index;
      commitDigits(nextDigits, [index], nextFocus);
      return;
    }

    if (nextDigits[index] === "") {
      event.target.value = "";
      return;
    }

    nextDigits[index] = "";
    commitDigits(nextDigits, [index]);
  };

  const handleKeyDown = (index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey || event.metaKey) {
      return;
    }

    const char = event.key;
    const isNumber = isDigit(char);
    if (!(isNumber || char === "Backspace" || char === "Delete" || char === "Tab" || char === "Enter")) {
      event.preventDefault();
    }

    if (char === "Backspace" && !event.currentTarget.value && index > 0) {
      focusInput(index - 1);
    }
  };

  const handlePaste = (index: number) => (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const clipboard = event.clipboardData?.getData("text") ?? "";
    if (!clipboard) {
      return;
    }

    const digitsOnly = clipboard.split("").filter(isDigit);
    if (digitsOnly.length === 0) {
      return;
    }

    const nextDigits = [...digits];
    const changedIndexes: number[] = [];
    let cursor = index;

    for (let i = 0; i < digitsOnly.length && cursor < length; i += 1) {
      const digit = digitsOnly[i];
      if (nextDigits[cursor] !== digit) {
        nextDigits[cursor] = digit;
        changedIndexes.push(cursor);
      }
      cursor += 1;
    }

    if (changedIndexes.length === 0) {
      focusInput(cursor < length ? cursor : length - 1);
      return;
    }

    const nextFocus = cursor < length ? cursor : length - 1;
    commitDigits(nextDigits, changedIndexes, nextFocus);
  };

  const registerInput = (index: number) => (element: HTMLInputElement | null) => {
    inputRefs.current[index] = element;
  };

  return {
    digits,
    registerInput,
    handleChange,
    handleKeyDown,
    handlePaste,
  };
}
