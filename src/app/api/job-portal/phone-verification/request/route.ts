import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { AuthenticatedRequest, withAuth } from "@/lib/utils/authMiddleware";
import {
  getActiveOtpProviderName,
  getOtpFlowForProvider,
  getSecondsUntil,
  maskMobileNumber,
  normalizeMobileNumber,
  OTP_EXPIRY_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  requestPhoneVerificationCode,
} from "@/lib/utils/firebasePhoneVerification";

function buildApplicantDetails(request: AuthenticatedRequest) {
  return {
    createdAt: new Date(),
    email: request.user.email,
    image:
      request.user.picture ||
      `https://api.dicebear.com/8.x/shapes/svg?seed=${request.user.email}`,
    lastSeen: new Date(),
    name: request.user.name || request.user.email?.split("@")[0] || "User",
    role: "applicant",
    status: "joined",
  };
}

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const email = request.user.email;

  if (!email) {
    return NextResponse.json({ error: "User email not found" }, { status: 401 });
  }

  let mobileNumber = "";

  try {
    const body = await request.json();
    mobileNumber = normalizeMobileNumber(body?.mobileNumber || "");
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Please enter a valid mobile number." },
      { status: 400 },
    );
  }

  const { db } = await connectMongoDB();
  const now = new Date();

  const applicant = await db.collection("applicants").findOne({ email });

  if (!applicant) {
    await db.collection("applicants").insertOne(buildApplicantDetails(request));
  } else {
    await db.collection("applicants").updateOne(
      { email },
      {
        $set: {
          image: applicant.image || request.user.picture || applicant.image,
          lastSeen: now,
          name: applicant.name || request.user.name || email.split("@")[0],
        },
      },
    );
  }

  const existingPendingChallenge = await db
    .collection("phone-verification-challenges")
    .findOne(
      {
        email,
        mobileNumber,
        status: "pending",
      },
      { sort: { createdAt: -1 } },
    );

  if (existingPendingChallenge && new Date(existingPendingChallenge.expiresAt).getTime() <= now.getTime()) {
    await db.collection("phone-verification-challenges").updateOne(
      { _id: existingPendingChallenge._id },
      { $set: { status: "expired", updatedAt: now } },
    );
  }

  const freshPendingChallenge =
    existingPendingChallenge && new Date(existingPendingChallenge.expiresAt).getTime() > now.getTime()
      ? existingPendingChallenge
      : null;

  if (
    freshPendingChallenge &&
    new Date(freshPendingChallenge.resendAvailableAt).getTime() > now.getTime()
  ) {
    const challengeProvider =
      freshPendingChallenge.provider || getActiveOtpProviderName();
    const challengeFlow =
      freshPendingChallenge.providerFlow ||
      getOtpFlowForProvider(challengeProvider);

    return NextResponse.json(
      {
        challengeId: freshPendingChallenge._id?.toString?.() || "",
        error: "resend_cooldown_active",
        expiresInSeconds: getSecondsUntil(freshPendingChallenge.expiresAt),
        maskedMobileNumber: maskMobileNumber(mobileNumber),
        flow: challengeFlow,
        provider: challengeProvider,
        resendAvailableInSeconds: getSecondsUntil(freshPendingChallenge.resendAvailableAt),
      },
      { status: 429 },
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

  const challengeId = new ObjectId();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_SECONDS * 1000);
  const resendAvailableAt = new Date(
    now.getTime() + OTP_RESEND_COOLDOWN_SECONDS * 1000,
  );

  let providerResult;

  try {
    providerResult = await requestPhoneVerificationCode({
      mobileNumber,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "failed_to_send_verification_code",
        message:
          error?.message || "Unable to send verification code. Please try again.",
      },
      { status: 502 },
    );
  }

  await db.collection("phone-verification-challenges").insertOne({
    _id: challengeId,
    attemptCount: 0,
    createdAt: now,
    email,
    expiresAt,
    maxAttempts: OTP_MAX_ATTEMPTS,
    mobileNumber,
    provider: providerResult.provider,
    providerFlow: providerResult.flow,
    providerMessageId: providerResult.messageId || null,
    providerRequestId: providerResult.requestId || null,
    providerStatus: providerResult.status || null,
    resendAvailableAt,
    status: "pending",
    updatedAt: now,
  });

  return NextResponse.json({
    challengeId: challengeId.toString(),
    expiresInSeconds: OTP_EXPIRY_SECONDS,
    flow: providerResult.flow,
    maskedMobileNumber: maskMobileNumber(mobileNumber),
    provider: providerResult.provider,
    resendAvailableInSeconds: OTP_RESEND_COOLDOWN_SECONDS,
  });
});
