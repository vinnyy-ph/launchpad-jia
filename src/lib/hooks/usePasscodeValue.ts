import { useState } from 'react';

interface Props {
  onComplete?(code: string): void;
}

export function usePasscodeValue({ onComplete }: Props = {}) {
  const [passcode, setPasscode] = useState('');

  const handleDigitChange = (index: number, digit: string | null) => {
    const newPasscode = passcode.split('');
    newPasscode[index] = digit || '';
    const updatedPasscode = newPasscode.join('');
    setPasscode(updatedPasscode);
  };

  const handleComplete = (code: string) => {
    setPasscode(code);
    onComplete?.(code);
  };

  const reset = () => {
    setPasscode('');
  };

  return {
    passcode,
    onDigitChange: handleDigitChange,
    onComplete: handleComplete,
    reset,
  };
}
