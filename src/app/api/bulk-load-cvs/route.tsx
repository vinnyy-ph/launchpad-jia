import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { verifyUserIsMember } from "@/lib/utils/adminAuth";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const body = await request.json();
  const { db } = await connectMongoDB();

  let { emails, orgID } = body;

  if (!emails || !Array.isArray(emails)) {
    return NextResponse.json({ error: "emails array is required" }, { status: 400 });
  }

  // Security Check: Verify if the requester is a member of the organization
  const requesterEmail = request.user.email;
  if (!requesterEmail) {
    return NextResponse.json(
      { error: "User email not found in token" },
      { status: 401 }
    );
  }

  const authResult = await verifyUserIsMember(db, requesterEmail, orgID);
  if (!authResult.authorized) {
    return NextResponse.json(
      { error: authResult.reason },
      { status: 403 }
    );
  }

  // Remove duplicates and filter out empty emails
  const uniqueEmails = [...new Set(emails.filter((email: string) => email && email.trim()))];

  if (uniqueEmails.length === 0) {
    return NextResponse.json({ cvs: {} });
  }

  try {
    // Fetch CVs for all emails at once
    const cvs = await db.collection("applicant-cv")
      .find({ email: { $in: uniqueEmails } })
      .toArray();

    // Create a map of email -> CV data for easy lookup
    const cvMap: Record<string, any> = {};
    cvs.forEach((cv) => {
      if (cv.email) {
        cvMap[cv.email] = cv;
      }
    });

    return NextResponse.json({ cvs: cvMap });
  } catch (error) {
    console.error("Error fetching CVs:", error);
    return NextResponse.json({ error: "Failed to fetch CVs" }, { status: 500 });
  }
});

