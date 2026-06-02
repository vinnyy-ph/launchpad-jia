import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { AuthenticatedRequest, withAuth } from "@/lib/utils/authMiddleware";
import { normalizeMobileNumber } from "@/lib/utils/firebasePhoneVerification";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AdditionalEmailEntry = {
  email: string;
  isPrimary: boolean;
};

export const PATCH = withAuth(async (request: AuthenticatedRequest) => {
  const email = request.user.email;

  if (!email) {
    return NextResponse.json({ error: "User email not found" }, { status: 401 });
  }

  let body: {
    additionalEmails?: string[];
    additionalMobileNumbers?: string[];
    firstName?: string;
    lastName?: string;
    primaryEmail?: string;
    primaryMobileNumber?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const firstName = `${body?.firstName || ""}`.trim();
  const lastName = `${body?.lastName || ""}`.trim();
  const primaryEmail = `${body?.primaryEmail || applicantEmailFallback(email)}`.trim().toLowerCase();

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "First name and last name are required." },
      { status: 400 },
    );
  }

  const rawAdditionalEmails = Array.isArray(body?.additionalEmails)
    ? body.additionalEmails
    : [];
  const rawAdditionalMobileNumbers = Array.isArray(body?.additionalMobileNumbers)
    ? body.additionalMobileNumbers
    : [];

  if (!EMAIL_REGEX.test(primaryEmail)) {
    return NextResponse.json(
      { error: "Invalid primary email address." },
      { status: 400 },
    );
  }

  const additionalEmails = Array.from(
    new Set(
      rawAdditionalEmails
        .map((value) => `${value || ""}`.trim().toLowerCase())
        .filter((value) => value && value !== primaryEmail),
    ),
  );

  for (const candidateEmail of additionalEmails) {
    if (!EMAIL_REGEX.test(candidateEmail)) {
      return NextResponse.json(
        { error: `Invalid email address: ${candidateEmail}` },
        { status: 400 },
      );
    }
  }

  const { db } = await connectMongoDB();
  const applicantCV = await db.collection("applicant-cv").findOne({ email });

  const cvPrimaryMobileNumber = `${applicantCV?.structuredCV?.contactInfo?.phone || ""}`.trim();
  const requestedPrimaryMobile = `${body?.primaryMobileNumber || cvPrimaryMobileNumber || ""}`.trim();
  const mobileNumberForVerificationCheck =
    requestedPrimaryMobile || cvPrimaryMobileNumber;
  const isPhoneVerified =
    applicantCV?.structuredCV?.contactInfo?.isPhoneVerified === true;

  if (
    !mobileNumberForVerificationCheck ||
    !isPhoneVerified
  ) {
    return NextResponse.json(
      { error: "A verified mobile number is required before saving contact details." },
      { status: 400 },
    );
  }

  let normalizedPrimaryMobileNumber = mobileNumberForVerificationCheck;
  let additionalMobileNumbers: string[];

  try {
    normalizedPrimaryMobileNumber = requestedPrimaryMobile
      ? normalizeMobileNumber(requestedPrimaryMobile)
      : cvPrimaryMobileNumber;
    additionalMobileNumbers = Array.from(
      new Set(
        rawAdditionalMobileNumbers
          .map((value) => `${value || ""}`.trim())
          .filter(Boolean)
          .map((value) => normalizeMobileNumber(value)),
      ),
    ).filter((value) => value !== normalizedPrimaryMobileNumber);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Invalid mobile number." },
      { status: 400 },
    );
  }

  const now = new Date();
  const additionalInfo = {
    additionalEmails: [
      {
        email: primaryEmail,
        isPrimary: true,
      },
      ...additionalEmails.map(
        (email): AdditionalEmailEntry => ({
          email,
          isPrimary: false,
        }),
      ),
    ],
  };

  await db.collection("applicant-cv").updateOne(
    { email },
    {
      $set: {
        additionalInfo,
        "structuredCV.contactInfo.phone": normalizedPrimaryMobileNumber,
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
      additionalInfo,
    },
    message: "Contact details saved successfully.",
  });
});

function applicantEmailFallback(email: string) {
  return email;
}
