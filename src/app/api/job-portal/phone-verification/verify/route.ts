import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { AuthenticatedRequest, withAuth } from "@/lib/utils/authMiddleware";
import {
  createOtpHash,
  getActiveOtpProviderName,
  getSecondsUntil,
  maskMobileNumber,
  normalizeMobileNumber,
  OTP_MAX_ATTEMPTS,
  verifyPhoneVerificationCode,
} from "@/lib/utils/firebasePhoneVerification";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const email = request.user.email;

  if (!email) {
    return NextResponse.json({ error: "User email not found" }, { status: 401 });
  }

  let code = "";
  let mobileNumber = "";
  let challengeId = "";
  let verificationState = "";
  let verificationErrorCode = "";

  try {
    const body = await request.json();
    code = `${body?.code || ""}`.trim();
    challengeId = `${body?.challengeId || ""}`.trim();
    mobileNumber = normalizeMobileNumber(body?.mobileNumber || "");
    verificationState = `${body?.verificationState || ""}`.trim().toLowerCase();
    verificationErrorCode = `${body?.verificationErrorCode || ""}`.trim();
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Invalid verification request." },
      { status: 400 },
    );
  }

  if (challengeId && !ObjectId.isValid(challengeId)) {
    return NextResponse.json(
      { error: "Invalid verification challenge." },
      { status: 400 },
    );
  }

  if (!challengeId && !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Please enter the 6-digit verification code." },
      { status: 400 },
    );
  }

  const { db } = await connectMongoDB();
  const now = new Date();
  const challenge = challengeId
    ? await db.collection("phone-verification-challenges").findOne({
        _id: new ObjectId(challengeId),
        email,
        mobileNumber,
        status: "pending",
      })
    : await db.collection("phone-verification-challenges").findOne(
        {
          email,
          mobileNumber,
          status: "pending",
        },
        { sort: { createdAt: -1 } },
      );

  if (!challenge) {
    return NextResponse.json(
      {
        challengeId,
        error: "verification_code_not_found",
        message: "Please request a new verification code.",
      },
      { status: 404 },
    );
  }

  if (new Date(challenge.expiresAt).getTime() <= now.getTime()) {
    await db.collection("phone-verification-challenges").updateOne(
      { _id: challenge._id },
      { $set: { status: "expired", updatedAt: now } },
    );

    return NextResponse.json(
      {
        error: "verification_code_expired",
        message: "Verification code has expired. Please request a new one.",
      },
      { status: 410 },
    );
  }

  if ((challenge.attemptCount || 0) >= (challenge.maxAttempts || OTP_MAX_ATTEMPTS)) {
    await db.collection("phone-verification-challenges").updateOne(
      { _id: challenge._id },
      { $set: { status: "expired", updatedAt: now } },
    );

    return NextResponse.json(
      {
        error: "verification_code_locked",
        message: "Too many attempts. Please request a new verification code.",
      },
      { status: 429 },
    );
  }

  const maxAttempts = challenge.maxAttempts || OTP_MAX_ATTEMPTS;
  const isLegacyHashChallenge =
    typeof challenge.otpHash === "string" && challenge.otpHash.length > 0;
  const providerName = challenge.provider || getActiveOtpProviderName();
  const isFirebaseProvider = providerName === "firebase-auth";

  let verificationApproved = false;
  let verificationStatus = "pending";

  if (isLegacyHashChallenge) {
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Please enter the 6-digit verification code." },
        { status: 400 },
      );
    }

    const otpHash = createOtpHash({
      challengeId: challenge._id.toString(),
      code,
      email,
      mobileNumber,
    });
    verificationApproved = otpHash === challenge.otpHash;
    verificationStatus = verificationApproved ? "approved" : "pending";
  } else {
    if (isFirebaseProvider && !verificationState) {
      return NextResponse.json(
        { error: "Verification state is required for Firebase OTP." },
        { status: 400 },
      );
    }

    if (!isFirebaseProvider && !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Please enter the 6-digit verification code." },
        { status: 400 },
      );
    }

    try {
      const verificationResult = await verifyPhoneVerificationCode({
        code,
        mobileNumber,
        provider: providerName,
        verificationState,
      });
      verificationApproved = verificationResult.approved;
      verificationStatus = verificationResult.status || "pending";
    } catch (error: any) {
      return NextResponse.json(
        {
          error: "failed_to_verify_verification_code",
          message:
            error?.message || "Unable to verify code right now. Please try again.",
        },
        { status: 502 },
      );
    }
  }

  if (isFirebaseProvider && verificationApproved) {
    let normalizedTokenPhone = "";

    try {
      normalizedTokenPhone = normalizeMobileNumber(request.user.phone_number || "");
    } catch {
      normalizedTokenPhone = "";
    }

    if (!normalizedTokenPhone || normalizedTokenPhone !== mobileNumber) {
      return NextResponse.json(
        {
          error: "firebase_phone_mismatch",
          message:
            "Unable to confirm this verified number. Please request a new code and try again.",
        },
        { status: 409 },
      );
    }
  }

  if (!verificationApproved) {
    if (verificationStatus === "expired") {
      await db.collection("phone-verification-challenges").updateOne(
        { _id: challenge._id },
        { $set: { status: "expired", updatedAt: now } },
      );

      return NextResponse.json(
        {
          error: "verification_code_expired",
          message: "Verification code has expired. Please request a new one.",
        },
        { status: 410 },
      );
    }

    const twilioLocked = verificationStatus === "max_attempts_reached";
    const nextAttemptCount = twilioLocked
      ? maxAttempts
      : (challenge.attemptCount || 0) + 1;
    const nextStatus = nextAttemptCount >= maxAttempts ? "expired" : "pending";

    await db.collection("phone-verification-challenges").updateOne(
      { _id: challenge._id },
      {
        $set: {
          attemptCount: nextAttemptCount,
          providerErrorCode: verificationErrorCode || null,
          providerStatus: verificationStatus,
          status: nextStatus,
          updatedAt: now,
        },
      },
    );

    if (nextStatus === "expired") {
      return NextResponse.json(
        {
          error: "verification_code_locked",
          message: "Too many attempts. Please request a new verification code.",
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        attemptsRemaining: Math.max(0, maxAttempts - nextAttemptCount),
        challengeId: challenge._id.toString(),
        error: "incorrect_verification_code",
        message: "Incorrect verification code. Please try again.",
      },
      { status: 400 },
    );
  }

  await db.collection("phone-verification-challenges").updateMany(
    {
      email,
      status: "pending",
    },
    {
      $set: {
        status: "cancelled",
        updatedAt: now,
      },
    },
  );

  await db.collection("phone-verification-challenges").updateOne(
    { _id: challenge._id },
    {
      $set: {
        attemptCount: (challenge.attemptCount || 0) + 1,
        providerErrorCode: verificationErrorCode || null,
        providerStatus: verificationStatus,
        status: "verified",
        updatedAt: now,
        verifiedAt: now,
      },
    },
  );

  await db.collection("applicant-cv").updateOne(
    { email },
    {
      $set: {
        "structuredCV.contactInfo.phone": mobileNumber,
        "structuredCV.contactInfo.isPhoneVerified": true,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
        email,
      },
    },
    { upsert: true },
  );

  return NextResponse.json({
    applicant: {
      isPhoneVerified: true,
      mobileNumber,
    },
    challengeId: challenge._id.toString(),
    expiresInSeconds: getSecondsUntil(challenge.expiresAt),
    maskedMobileNumber: maskMobileNumber(mobileNumber),
    message: "Mobile number verified successfully.",
  });
});
