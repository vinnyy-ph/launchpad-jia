// Draft persistence for the manual-profile wizard. Pure (de)serialization +
// keying; the wizard performs the actual localStorage read/write so this stays
// SSR-safe and unit-testable.

export interface ProfileDraft<T> {
  data: T;
  stepIndex: number;
  /**
   * Per-section Skip/Submit intent. Optional: drafts saved before this field
   * existed lack it. Kept opaque here — consumers must sanitize (the wizard
   * runs it through sanitizeSectionStatus) so a legacy or hand-edited draft
   * can never restore an invalid status map.
   */
  sectionStatus?: unknown;
  savedAt: number;
}

export function draftKey(email?: string): string {
  const id = email?.trim() ? email.trim() : "anon";
  return `manual-profile-draft:v1:${id}`;
}

export function serializeDraft<T>(
  data: T,
  stepIndex: number,
  sectionStatus?: unknown,
  now: number = Date.now(),
): string {
  // JSON.stringify drops the key entirely when sectionStatus is undefined, so
  // payloads stay byte-identical to the pre-sectionStatus shape in that case.
  const draft: ProfileDraft<T> = { data, stepIndex, sectionStatus, savedAt: now };
  return JSON.stringify(draft);
}

export function parseDraft<T>(raw: string | null | undefined): ProfileDraft<T> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "data" in parsed &&
      "stepIndex" in parsed &&
      typeof (parsed as ProfileDraft<T>).stepIndex === "number"
    ) {
      return parsed as ProfileDraft<T>;
    }
    return null;
  } catch {
    return null;
  }
}
