"use client";
import { Textarea } from "@/lib/components/ui";

export default function IntroductionStep({
  value,
  onChange,
  errors,
  onFieldBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  errors?: Record<string, string>;
  onFieldBlur?: (key: string) => void;
}) {
  return (
    <Textarea
      label="Introduction"
      placeholder="Tell us about yourself — what you do, what you're good at, and what you're looking for."
      minRows={6}
      value={value}
      error={errors?.introduction}
      onBlur={() => onFieldBlur?.("introduction")}
      onChange={(e) => onChange((e as React.ChangeEvent<HTMLTextAreaElement>).target.value)}
    />
  );
}
