import { sendEmail } from "@/lib/Email";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { logActivity } from "@/lib/utils/activityLogger";


export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const body = await request.json();
  const { db } = await connectMongoDB();

  let { cvData } = body;

  const { _id, ...updateData } = cvData;
  cvData = updateData;

  await db.collection("applicant-cv").updateOne(
    {
      email: cvData.email,
    },
    { $set: cvData },
    { upsert: true }
  );

  // Track CV submission in activity history for each related application
  try {
    const applicantEmail = cvData?.email || request.user?.email;
    const applicantName =
      cvData?.name ||
      request.user?.name ||
      (typeof applicantEmail === "string" ? applicantEmail.split("@")[0] : "Applicant");

    if (applicantEmail) {
      const relatedInterviews = await db
        .collection("interviews")
        .find({ email: applicantEmail })
        .toArray();

      const interviewCareerIds = Array.from(
        new Set(
          relatedInterviews
            .map((interview: any) => interview?.id)
            .filter((id: any) => typeof id === "string" && id.trim())
        )
      );

      const careers = interviewCareerIds.length
        ? await db.collection("careers").find({ id: { $in: interviewCareerIds as string[] } }).toArray()
        : [];

      for (const interview of relatedInterviews) {
        if (!interview?.orgID || !interview?._id) {
          continue;
        }
        // Only log "Submitted CV" for this role when the candidate's status for this career is "For CV Screening"
        if (interview.status !== "For CV Screening") {
          continue;
        }

        const matchedCareer = careers.find((career: any) => career?.id === interview?.id);

        await logActivity({
          db,
          kind: "candidate_submitted_cv",
          interview,
          career: matchedCareer,
          actor: {
            type: "candidate",
            email: applicantEmail,
            name: applicantName,
            image: cvData?.image || request.user?.picture,
          },
        });
      }
    }
  } catch (error) {
    console.error("Failed to track CV submission activity:", error);
  }

  await sendEmail({
    recipient: cvData.email,
    html: `
      <div>
        <p>Dear ${cvData.name || "Applicant"},</p>
        <p>Your CV has been successfully uploaded and is now under review.</p>
        <p>You can manage your CV here: <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/applicant/manage-cv">Manage CV</a></p>
      </div>
    `,
  });

  return NextResponse.json({
    message: "CV saved successfully",
  });
});
