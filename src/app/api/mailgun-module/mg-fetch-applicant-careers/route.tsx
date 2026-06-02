import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const { applicantEmail, orgId } = body;

    if (!applicantEmail) {
      return NextResponse.json(
        { error: "Applicant email is required" },
        { status: 400 }
      );
    }

    if (!orgId || !ObjectId.isValid(orgId)) {
      return NextResponse.json(
        { error: "Valid organization ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    const userEmail = req.user?.email;
    if (!userEmail) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const orgObjectId = new ObjectId(orgId);

    // Verify membership
    const memberInOrg = await db.collection("members").findOne({
      email: userEmail,
      $or: [
        { orgID: orgId },
        { orgID: orgObjectId },
        { organizationId: orgId },
        { organizationId: orgObjectId },
      ],
    });

    if (!memberInOrg) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Normalize email for comparison
    const normalizedEmail = String(applicantEmail).toLowerCase().trim();

    // Find all interviews for this applicant in this organization
    const interviews = await db
      .collection("interviews")
      .find({
        email: normalizedEmail,
        orgID: orgId,
        // Only include active applications
        $or: [
          { applicationStatus: "Ongoing" },
          { applicationStatus: null },
          { applicationStatus: { $exists: false } },
        ],
      })
      .toArray();

    // Extract unique career IDs from interviews
    const careerIds = Array.from(
      new Set(interviews.map((interview) => interview.id).filter(Boolean))
    );

    if (careerIds.length === 0) {
      return NextResponse.json({ careers: [] });
    }

    // Fetch career details
    const careers = await db
      .collection("careers")
      .find({
        id: { $in: careerIds },
        orgID: orgId,
      })
      .toArray();

    // Map to the format expected by the frontend
    const careerOptions = careers.map((career) => ({
      id: career.id,
      jobTitle: career.jobTitle || "Untitled Career",
    }));

    return NextResponse.json({ careers: careerOptions });
  } catch (error: any) {
    console.error("Error fetching applicant careers:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch careers",
        details: error.message,
      },
      { status: 500 }
    );
  }
});
