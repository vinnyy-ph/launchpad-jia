import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const orgId = searchParams.get("orgId");

    if (!email || !orgId) {
      console.error("[applicant-avatar] Missing required data: email or orgId");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Normalize orgId to ObjectId if valid
    const orgObjectId = ObjectId.isValid(String(orgId))
      ? new ObjectId(String(orgId))
      : null;

    // 1. Check applicants collection for image
    let applicantRecord = await db
      .collection("applicants")
      .findOne({ email: email.toLowerCase() });

    if (applicantRecord?.image) {
      return NextResponse.json({
        avatar: applicantRecord.image,
        source: "applicants",
      });
    }

    // 2. Check members collection for image
    let memberRecord = await db
      .collection("members")
      .findOne({ email: email.toLowerCase() });

    if (memberRecord?.image) {
      return NextResponse.json({
        avatar: memberRecord.image,
        source: "members",
      });
    }

    // 3. Check mailgun-accounts collection for email and get displayName/image
    let mailgunRecord = await db
      .collection("mailgun-accounts")
      .findOne({
        email: email.toLowerCase(),
        $or: [
          { organizationId: orgObjectId },
          { organizationId: String(orgId) },
        ],
      });

    if (mailgunRecord?.image) {
      return NextResponse.json({
        avatar: mailgunRecord.image,
        source: "mailgun-accounts",
      });
    }

    // No image found
    return NextResponse.json({
      avatar: null,
      source: null,
    });
  } catch (err: any) {
    console.error("[GET /api/applicant/avatar] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch applicant avatar" },
      { status: 500 }
    );
  }
}
