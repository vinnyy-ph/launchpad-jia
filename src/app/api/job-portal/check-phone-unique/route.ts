import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { isPhoneTaken, type ExistingPhoneRecord } from "@/lib/utils/phoneValidation";

/**
 * Phone uniqueness check for manual profile creation (T5).
 * Validates that a mobile number is not already linked to another applicant.
 * Deliberately does NOT use Firebase phone auth — uniqueness is checked against
 * our own `applicant-cv` collection per the ticket brief.
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { phone, email } = await request.json();

  if (typeof phone !== "string" || !phone.trim()) {
    return NextResponse.json({ error: "Phone is required" }, { status: 400 });
  }

  const { db } = await connectMongoDB();

  // Pull only docs that carry a phone; project just the two fields we compare.
  const docs = await db
    .collection("applicant-cv")
    .find(
      { "structuredCV.contactInfo.phone": { $exists: true, $ne: "" } },
      { projection: { email: 1, "structuredCV.contactInfo.phone": 1 } },
    )
    .toArray();

  const existing: ExistingPhoneRecord[] = docs.map((d: any) => ({
    email: d.email ?? "",
    phone: d?.structuredCV?.contactInfo?.phone ?? "",
  }));

  const taken = isPhoneTaken(existing, phone, typeof email === "string" ? email : "");
  return NextResponse.json({ unique: !taken });
});
