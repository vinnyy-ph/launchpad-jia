import crypto from "crypto";
import type { NameVisibility } from "@/lib/components/CandidateProfileComponents/candidateProfileUtils";

type ViewableStageConfig = {
  viewable: boolean;
  disabled?: boolean;
  stageName?: string;
};

type ViewableStagesMap = Record<string, ViewableStageConfig>;

export type ShareableAssessmentPreviewPayload = {
  previewId: string;
  orgID: string;
  interviewId: string;
  interviewUID: string;
  applicantEmail: string;
  nameVisibility: NameVisibility;
  viewableStages: ViewableStagesMap;
  cvVersionLabel?: string | null;
  showContactDetails?: boolean;
  showDisplayPhoto?: boolean;
  showJiaAssessments?: boolean;
  showRecruiterAssessments?: boolean;
  isContactVisible?: boolean;
  exp: number;
};

type VerifyPreviewResult =
  | { valid: true; payload: ShareableAssessmentPreviewPayload }
  | { valid: false; message: string };

const PREVIEW_TOKEN_SECRET =
  process.env.SHAREABLE_ASSESSMENT_PREVIEW_SECRET || "jia-shareable-preview-secret";

function toBase64Url(input: string) {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function signBody(encodedBody: string) {
  return crypto.createHmac("sha256", PREVIEW_TOKEN_SECRET).update(encodedBody).digest("base64url");
}

export function createShareableAssessmentPreviewToken(
  payload: Omit<ShareableAssessmentPreviewPayload, "exp">,
  ttlSeconds = 10 * 60
) {
  const tokenPayload: ShareableAssessmentPreviewPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const encodedBody = toBase64Url(JSON.stringify(tokenPayload));
  const signature = signBody(encodedBody);
  return `${encodedBody}.${signature}`;
}

export function verifyShareableAssessmentPreviewToken(token: string): VerifyPreviewResult {
  if (!token || typeof token !== "string") {
    return { valid: false, message: "Preview token is required." };
  }

  const [encodedBody, signature] = token.split(".");
  if (!encodedBody || !signature) {
    return { valid: false, message: "Invalid preview token format." };
  }

  const expectedSignature = signBody(encodedBody);
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const providedBuffer = Buffer.from(signature, "utf8");

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return { valid: false, message: "Invalid preview token signature." };
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedBody)) as ShareableAssessmentPreviewPayload;

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, message: "Preview link has expired." };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, message: "Invalid preview token payload." };
  }
}
