import type { DecodedIdToken } from "firebase-admin/auth";
import type { Db } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { superAdminList } from "@/lib/SuperAdminUtils";
import { decryptPasscode } from "@/lib/EncryptionUtils";
import { NameVisibility } from "../components/CandidateProfileComponents/candidateProfileUtils";
import { slugify } from "../Utils";

export interface ShareableAssessmentAccessResult {
  authorized: boolean;
  assessment?: any;
  interview?: any;
  isSuperAdmin?: boolean;
  isOrgAdmin?: boolean;
  isLinkCreator?: boolean;
}

export async function getShareableAssessmentWithAccess(
  profileId: string,
  user: DecodedIdToken | undefined | null,
  dbInstance?: Db
): Promise<ShareableAssessmentAccessResult> {
  if (!profileId) {
    return { authorized: false };
  }

  if (!user?.email) {
    return { authorized: false };
  }

  const db = dbInstance ?? (await connectMongoDB()).db;

  const assessment = await db
    .collection("shareable-assessments")
    .findOne({ profileId });

  if (!assessment) {
    return { authorized: false };
  }

  const interview = await db.collection("interviews").findOne({
    interviewID: assessment.interviewId,
    orgID: assessment.orgID,
  });

  const normalizedEmail = user.email.toLowerCase();

  const adminRecord = await db
    .collection("admins")
    .findOne({ email: normalizedEmail });

  const memberRecord = await db.collection("members").findOne({
    email: normalizedEmail,
    orgID: assessment.orgID,
  });

  const isSuperAdmin =
    superAdminList
      .map((email) => email.toLowerCase())
      .includes(normalizedEmail) || Boolean(adminRecord);

  const isOrgAdmin = memberRecord?.role === "admin";
  const isLinkCreator =
    assessment.createdBy?.email?.toLowerCase?.() === normalizedEmail;

  const authorized = Boolean(isSuperAdmin || isOrgAdmin || isLinkCreator);

  return {
    authorized,
    assessment,
    interview,
    isSuperAdmin,
    isOrgAdmin,
    isLinkCreator,
  };
}

export interface ValidatePasscodeResult {
  valid: boolean;
  assessment?: any;
  authorized?: boolean;
  status?: number;
  message?: string;
}

export async function validateShareableAssessmentPasscode(
  profileId: string,
  passcode: string,
  user: DecodedIdToken | undefined | null,
  dbInstance?: Db
): Promise<ValidatePasscodeResult> {
  if (!profileId || !passcode) {
    return {
      valid: false,
      message: "Assessment ID and passcode are required",
      status: 400,
    };
  }

  const db = dbInstance ?? (await connectMongoDB()).db;

  const assessment = await db
    .collection("shareable-assessments")
    .findOne({ profileId });

  if (!assessment) {
    return { valid: false, message: "Assessment not found", status: 404 };
  }

  if (!assessment.active) {
    return {
      valid: false,
      message: "This link is no longer active",
      status: 403,
    };
  }

  const storedPassword = decryptPasscode(assessment.password, profileId);
  const isValid = storedPassword === passcode;

  return {
    valid: isValid,
    assessment: assessment,
    authorized: true,
  };
}

export function buildLinkDisplayName(
  fullName: string | null | undefined,
  visibility?: NameVisibility
): string {
  const safeName = (fullName ?? "").trim();

  if (!safeName) {
    return "candidate";
  }

  switch (visibility) {
    case "Initials only": {
      const parts = safeName.split(/\s+/).filter(Boolean);
      const initials = parts
        .map((part) => part[0]?.toUpperCase())
        .filter(Boolean)
        .join("");
      return initials || "candidate";
    }
    case "First name only": {
      const parts = safeName.split(/\s+/).filter(Boolean);
      return parts[0] || "candidate";
    }
    case "Full Name":
    default:
      return safeName;
  }
}

export function buildShareableAssessmentLink(profileId: string) {
  const link = `/candidate-profile/${profileId}`;

  // Return nulls for slugs (backward compatibility)
  return { 
    link, 
    userNameSlug: null, 
    jobTitleSlug: null 
  };
}
