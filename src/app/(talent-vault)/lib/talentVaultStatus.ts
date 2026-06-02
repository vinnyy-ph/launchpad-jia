type TalentVaultStatus = "active" | "inactive";
export type TalentVaultSetupState = "pending" | "in_progress" | "done" | "skipped";
export type TalentVaultSetupStepKey =
  | "cvProfile"
  | "goalSetting"
  | "preScreening"
  | "aiInterview";

export type TalentVaultSetupCurrentStep =
  | "submitCV"
  | "verifyProfile"
  | "goalSetting"
  | "preScreening"
  | "aiInterview";

const SETUP_FLOW: TalentVaultSetupStepKey[] = [
  "cvProfile",
  "goalSetting",
  "preScreening",
  "aiInterview",
];

const REQUIRED_SETUP_STEPS = [
  "cvProfile",
  "goalSetting",
  "preScreening",
  "aiInterview",
] as const;

export const TALENT_VAULT_ACTIVE_DURATION_DAYS = 30;
const TALENT_VAULT_ACTIVE_DURATION_MS = TALENT_VAULT_ACTIVE_DURATION_DAYS * 24 * 60 * 60 * 1000;

function toDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  return null;
}

function toProfileId(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    return value;
  }

  if (typeof (value as any).toString === "function") {
    const profileId = (value as any).toString();
    return profileId && profileId !== "[object Object]" ? profileId : null;
  }

  return null;
}

function toTalentVaultCompletedAt(value: unknown): Date | null {
  return toDate(value);
}

export function getTalentVaultExpiresAtFromCompletedAt(completedAtValue: unknown) {
  const completedAt = toTalentVaultCompletedAt(completedAtValue);

  if (!completedAt) {
    return null;
  }

  return new Date(completedAt.getTime() + TALENT_VAULT_ACTIVE_DURATION_MS);
}

export function resolveTalentVaultExpiresAt(
  expiresAtValue: unknown,
  completedAtValue: unknown
) {
  const explicitExpiresAt = toDate(expiresAtValue);

  if (explicitExpiresAt) {
    return explicitExpiresAt;
  }

  return getTalentVaultExpiresAtFromCompletedAt(completedAtValue);
}

export function isTalentVaultExpired(
  expiresAtValue: unknown,
  now: Date = new Date()
) {
  const expiresAt = toDate(expiresAtValue);

  if (!expiresAt) {
    return false;
  }

  return expiresAt.getTime() < now.getTime();
}

export function deriveTalentVaultSummary(
  profile: any,
  now: Date = new Date()
) {
  if (!profile) {
    return {
      profileId: null,
      status: "inactive" as TalentVaultStatus,
      state: null,
      completedAt: null,
      expiresAt: null,
      setup: null,
    };
  }

  const completedAt = toDate(profile.completedAt);
  const expiresAt = resolveTalentVaultExpiresAt(
    profile.expiresAt || profile.expirationDate,
    completedAt
  );
  const expired = isTalentVaultExpired(expiresAt, now);
  const persistedState = typeof profile.state === "string" ? profile.state : null;
  const persistedStatus =
    typeof profile.status === "string" ? profile.status.toLowerCase() : null;
  const normalizedPersistedStatus =
    persistedStatus === "active" || persistedStatus === "inactive"
      ? persistedStatus
      : null;
  const setup = profile.setup || null;
  const setupComplete = isTalentVaultSetupComplete(setup);
  const state =
    expired
      ? "expired"
      : persistedState === "completed" || setupComplete
        ? "completed"
        : persistedState || "draft";
  const status: TalentVaultStatus =
    state === "completed"
      ? (normalizedPersistedStatus || "active")
      : "inactive";

  return {
    profileId: toProfileId(profile._id),
    status,
    state,
    completedAt,
    expiresAt,
    setup,
  };
}

export function isTalentVaultSetupComplete(setup: any) {
  if (!setup || typeof setup !== "object") {
    return false;
  }

  return REQUIRED_SETUP_STEPS.every((step) => setup[step] === "done" || setup[step] === "skipped");
}

export function shouldShowCvAndProfile(talentVault: any) {
  return isTalentVaultSetupComplete(talentVault?.setup);
}

export function getTalentVaultInProgressStep(
  setup: Record<string, unknown> | null | undefined
): TalentVaultSetupStepKey | null {
  if (!setup || typeof setup !== "object") {
    return "cvProfile";
  }

  for (const step of SETUP_FLOW) {
    if (setup[step] !== "done" && setup[step] !== "skipped") {
      return step;
    }
  }

  return null;
}

export function getTalentVaultInterviewID(profile: any): string | null {
  const interviewID = profile?.latestAssessment?.aiInterviewAssessmentId;

  if (typeof interviewID !== "string") {
    return null;
  }

  const normalizedInterviewID = interviewID.trim();
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalizedInterviewID
    );

  return isUuid ? normalizedInterviewID : null;
}
