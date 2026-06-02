import crypto from "crypto";

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_SECONDS = 5 * 60;
export const OTP_RESEND_COOLDOWN_SECONDS = 105;
export const OTP_MAX_ATTEMPTS = 5;

const DEFAULT_PROVIDER_NAME: OtpProviderName = "firebase-auth";

export type OtpProviderName = "firebase-auth" | "twilio-verify" | "console";
export type SmsProviderName = OtpProviderName;
export type OtpVerificationFlow = "client" | "server";
export type FirebaseVerificationState =
  | "approved"
  | "failed"
  | "expired"
  | "max_attempts_reached";

export interface SmsSendResult {
  provider: OtpProviderName;
  flow: OtpVerificationFlow;
  requestId?: string | null;
  messageId?: string | null;
  status?: string | null;
}

export interface VerificationCheckResult {
  approved: boolean;
  checkId?: string | null;
  provider: OtpProviderName;
  status: string;
}

export interface RequestPhoneVerificationResult extends SmsSendResult {}

interface ProviderRequestInput {
  mobileNumber: string;
}

interface ProviderVerifyInput {
  code?: string;
  mobileNumber: string;
  provider?: OtpProviderName | string;
  verificationState?: FirebaseVerificationState | string;
}

interface OtpProviderAdapter {
  providerName: OtpProviderName;
  flow: OtpVerificationFlow;
  requestCode: (
    input: ProviderRequestInput,
  ) => Promise<RequestPhoneVerificationResult>;
  verifyCode: (
    input: ProviderVerifyInput,
  ) => Promise<VerificationCheckResult>;
}

function normalizeProviderName(value?: string | null): OtpProviderName {
  const normalized = `${value || ""}`.trim().toLowerCase();

  if (normalized === "firebase" || normalized === "firebase-auth") {
    return "firebase-auth";
  }

  // Firebase-first mode: keep legacy type compatibility, but default to Firebase.
  return DEFAULT_PROVIDER_NAME;
}

export function getActiveOtpProviderName() {
  return DEFAULT_PROVIDER_NAME;
}

export function getOtpFlowForProvider(
  provider?: OtpProviderName | string | null,
): OtpVerificationFlow {
  return normalizeProviderName(provider || getActiveOtpProviderName()) ===
    "firebase-auth"
    ? "client"
    : "server";
}

function getOtpPepper() {
  return (
    process.env.PHONE_VERIFICATION_OTP_SECRET ||
    process.env.ENCRYPTION_KEY ||
    "jia-phone-verification-dev-secret"
  );
}

export function generateOtpCode() {
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH;
  return `${Math.floor(min + Math.random() * (max - min))}`;
}

export function normalizeMobileNumber(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Mobile number is required.");
  }

  const compact = trimmed.replace(/[\s()-]/g, "");

  if (/^\+[1-9]\d{7,14}$/.test(compact)) {
    return compact;
  }

  const digits = compact.replace(/\D/g, "");

  if (/^9\d{9}$/.test(digits)) {
    return `+63${digits}`;
  }

  if (/^09\d{9}$/.test(digits)) {
    return `+63${digits.slice(1)}`;
  }

  if (/^639\d{9}$/.test(digits)) {
    return `+${digits}`;
  }

  throw new Error("Please enter a valid mobile number.");
}

export function maskMobileNumber(value: string) {
  const normalized = normalizeMobileNumber(value);
  const digits = normalized.replace(/\D/g, "");

  if (digits.length < 4) {
    return normalized;
  }

  const countryCodeLength = digits.length > 10 ? digits.length - 10 : 0;
  const countryCodePrefix =
    countryCodeLength > 0 ? `+${digits.slice(0, countryCodeLength)}` : "";
  const lastFourDigits = digits.slice(-4);

  return `${countryCodePrefix ? `${countryCodePrefix} ` : ""}*** *** ${lastFourDigits}`.trim();
}

export function createOtpHash({
  challengeId,
  code,
  email,
  mobileNumber,
}: {
  challengeId: string;
  code: string;
  email: string;
  mobileNumber: string;
}) {
  return crypto
    .createHash("sha256")
    .update(`${getOtpPepper()}:${challengeId}:${email}:${mobileNumber}:${code}`)
    .digest("hex");
}

export function getSecondsUntil(date: Date | string | number) {
  const target = new Date(date).getTime();
  const diff = Math.ceil((target - Date.now()) / 1000);
  return Math.max(0, diff);
}

const firebaseProvider: OtpProviderAdapter = {
  providerName: "firebase-auth",
  flow: "client",
  async requestCode() {
    return {
      flow: "client",
      messageId: null,
      provider: "firebase-auth",
      requestId: null,
      status: "client_confirmation_required",
    };
  },
  async verifyCode({ verificationState }) {
    const normalizedState = `${verificationState || ""}`.trim().toLowerCase();

    if (!normalizedState) {
      throw new Error("Verification state is required for Firebase OTP.");
    }

    if (normalizedState === "approved") {
      return {
        approved: true,
        checkId: null,
        provider: "firebase-auth",
        status: "approved",
      };
    }

    if (normalizedState === "expired") {
      return {
        approved: false,
        checkId: null,
        provider: "firebase-auth",
        status: "expired",
      };
    }

    if (
      normalizedState === "max_attempts_reached" ||
      normalizedState === "locked"
    ) {
      return {
        approved: false,
        checkId: null,
        provider: "firebase-auth",
        status: "max_attempts_reached",
      };
    }

    return {
      approved: false,
      checkId: null,
      provider: "firebase-auth",
      status: "pending",
    };
  },
};

function getProviderAdapter(
  _provider?: OtpProviderName | string | null,
): OtpProviderAdapter {
  return firebaseProvider;
}

export async function requestPhoneVerificationCode({
  mobileNumber,
  provider,
}: {
  mobileNumber: string;
  provider?: OtpProviderName | string;
}): Promise<RequestPhoneVerificationResult> {
  const adapter = getProviderAdapter(provider);
  return adapter.requestCode({ mobileNumber });
}

export async function verifyPhoneVerificationCode({
  code,
  mobileNumber,
  provider,
  verificationState,
}: {
  code?: string;
  mobileNumber: string;
  provider?: OtpProviderName | string;
  verificationState?: FirebaseVerificationState | string;
}): Promise<VerificationCheckResult> {
  const adapter = getProviderAdapter(provider);

  return adapter.verifyCode({
    code,
    mobileNumber,
    provider,
    verificationState,
  });
}

// Backward-compatible wrappers for existing imports.
export async function sendVerificationCode({
  mobileNumber,
}: {
  mobileNumber: string;
}): Promise<RequestPhoneVerificationResult> {
  return requestPhoneVerificationCode({ mobileNumber });
}

export async function checkVerificationCode({
  code,
  mobileNumber,
  provider,
  verificationState,
}: {
  code?: string;
  mobileNumber: string;
  provider?: SmsProviderName | string;
  verificationState?: FirebaseVerificationState | string;
}): Promise<VerificationCheckResult> {
  return verifyPhoneVerificationCode({
    code,
    mobileNumber,
    provider,
    verificationState,
  });
}
