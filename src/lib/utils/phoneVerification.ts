// Will be used with twilio later
import crypto from "crypto";
import twilio from "twilio";

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_SECONDS = 5 * 60;
export const OTP_RESEND_COOLDOWN_SECONDS = 105;
export const OTP_MAX_ATTEMPTS = 5;

const DEFAULT_DEV_OTP_CODE = "000000";
const DEFAULT_VERIFY_CHANNEL = "sms";
const DEFAULT_PROVIDER_NAME = "firebase-auth";

let cachedTwilioClient: any | null = null;

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

function getTwilioVerifyConfig() {
  const accountSid = `${process.env.TWILIO_ACCOUNT_SID || ""}`.trim();
  const authToken = `${process.env.TWILIO_AUTH_TOKEN || ""}`.trim();
  const serviceSid = `${process.env.TWILIO_VERIFY_SERVICE_SID || ""}`.trim();

  if (!accountSid || !authToken || !serviceSid) {
    return null;
  }

  return {
    accountSid,
    authToken,
    serviceSid,
  };
}

function getTwilioVerifyChannel() {
  const configuredChannel = `${process.env.TWILIO_VERIFY_CHANNEL || ""}`
    .trim()
    .toLowerCase();

  if (!configuredChannel) {
    return DEFAULT_VERIFY_CHANNEL;
  }

  // Verify supports sms/call/email/whatsapp; keep sms default and allow explicit override.
  return configuredChannel;
}

function isProductionEnvironment() {
  return `${process.env.NODE_ENV || ""}`.trim().toLowerCase() === "production";
}

function normalizeProviderName(value?: string | null): OtpProviderName {
  const normalized = `${value || ""}`.trim().toLowerCase();

  if (normalized === "twilio" || normalized === "twilio-verify") {
    return "twilio-verify";
  }

  if (normalized === "firebase" || normalized === "firebase-auth") {
    return "firebase-auth";
  }

  if (normalized === "console") {
    return "console";
  }

  return DEFAULT_PROVIDER_NAME;
}

export function getActiveOtpProviderName() {
  return normalizeProviderName(process.env.PHONE_VERIFICATION_PROVIDER);
}

export function getOtpFlowForProvider(
  provider?: OtpProviderName | string | null,
): OtpVerificationFlow {
  return normalizeProviderName(provider || getActiveOtpProviderName()) ===
    "firebase-auth"
    ? "client"
    : "server";
}

export function getDevOtpCode() {
  const configured = `${process.env.PHONE_VERIFICATION_DEV_OTP || ""}`.trim();
  const isSixDigits = /^\d{6}$/.test(configured);

  return isSixDigits ? configured : DEFAULT_DEV_OTP_CODE;
}

export function isTwilioVerifyConfigured() {
  return !!getTwilioVerifyConfig();
}

function getTwilioClient() {
  if (cachedTwilioClient) {
    return cachedTwilioClient;
  }

  const config = getTwilioVerifyConfig();

  if (!config) {
    return null;
  }

  cachedTwilioClient = twilio(config.accountSid, config.authToken);
  return cachedTwilioClient;
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
  const countryCodePrefix = countryCodeLength > 0 ? `+${digits.slice(0, countryCodeLength)}` : "";
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

const twilioProvider: OtpProviderAdapter = {
  providerName: "twilio-verify",
  flow: "server",
  async requestCode({ mobileNumber }) {
    const client = getTwilioClient();

    if (!client) {
      if (isProductionEnvironment()) {
        throw new Error("Twilio Verify is not configured.");
      }

      const devCode = getDevOtpCode();
      console.log(`[Phone Verification][DEV] OTP for ${mobileNumber}: ${devCode}`);

      return {
        flow: "server",
        messageId: null,
        provider: "console",
        requestId: null,
        status: "pending",
      };
    }

    const config = getTwilioVerifyConfig();

    if (!config) {
      throw new Error("Twilio Verify is not configured.");
    }

    const verification = await client.verify.v2
      .services(config.serviceSid)
      .verifications.create({
        channel: getTwilioVerifyChannel(),
        to: mobileNumber,
      });

    return {
      flow: "server",
      messageId:
        Array.isArray(verification?.sendCodeAttempts) &&
        verification.sendCodeAttempts.length > 0
          ? verification.sendCodeAttempts[0]?.attemptSid || null
          : null,
      provider: "twilio-verify",
      requestId: verification?.sid || null,
      status: verification?.status || "pending",
    };
  },
  async verifyCode({ code, mobileNumber, provider }) {
    if (provider === "console") {
      const approved = `${code || ""}` === getDevOtpCode();

      return {
        approved,
        checkId: null,
        provider: "console",
        status: approved ? "approved" : "pending",
      };
    }

    if (!isTwilioVerifyConfigured()) {
      if (isProductionEnvironment()) {
        throw new Error("Twilio Verify is not configured.");
      }

      const approved = `${code || ""}` === getDevOtpCode();

      return {
        approved,
        checkId: null,
        provider: "console",
        status: approved ? "approved" : "pending",
      };
    }

    if (!/^\d{6}$/.test(`${code || ""}`)) {
      throw new Error("Please enter the 6-digit verification code.");
    }

    const client = getTwilioClient();
    const config = getTwilioVerifyConfig();

    if (!client || !config) {
      throw new Error("Twilio Verify is not configured.");
    }

    const verificationCheck = await client.verify.v2
      .services(config.serviceSid)
      .verificationChecks.create({
        code,
        to: mobileNumber,
      });

    return {
      approved: verificationCheck?.status === "approved",
      checkId: verificationCheck?.sid || null,
      provider: "twilio-verify",
      status: verificationCheck?.status || "pending",
    };
  },
};

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
  provider?: OtpProviderName | string | null,
): OtpProviderAdapter {
  const normalized = normalizeProviderName(provider || getActiveOtpProviderName());

  if (normalized === "firebase-auth") {
    return firebaseProvider;
  }

  return twilioProvider;
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
