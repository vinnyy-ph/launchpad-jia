"use client";
import { Textarea } from "@/lib/components/ui";

export default function IntroductionStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Textarea
      label="Introduction"
      placeholder="Tell us about yourself — what you do, what you're good at, and what you're looking for."
      minRows={6}
      value={value}
      onChange={(e) => onChange((e as React.ChangeEvent<HTMLTextAreaElement>).target.value)}
    />
  );
}
