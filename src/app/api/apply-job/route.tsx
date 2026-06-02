import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { sendEmail } from "@/lib/Email";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { logActivity } from "@/lib/utils/activityLogger";


export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    let jobApplicationData = await request.json();

    const { jobTitle, description, questions, name, email, status, origin } =
      jobApplicationData;

    // Validate required fields
    if (!jobTitle || !description || !questions || !name || !email) {
      console.error("[apply-job] Missing required data: jobTitle, description, questions, name, or email");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    const interviewData = {
      ...jobApplicationData,
      reviewers: [],
    };
    // Remove origin from interviewData
    if (interviewData.origin) {
      delete interviewData.origin;
    }

    let interviewInstance = await db
      .collection("interviews")
      .findOne({ id: interviewData.id, email: interviewData.email });

    if (interviewInstance) {
      return NextResponse.json({
        error: "Job Application Failed.",
        message: "You have a pending application for this role.",
      });
    }

    const insertResult = await db.collection("interviews").insertOne(interviewData);

    const careerDetails = await db.collection("careers").findOne({ id: interviewData.id });

    // Record candidate application activity
    await logActivity({
      db,
      kind: "candidate_applied",
      interview: { ...interviewData, _id: insertResult.insertedId },
      career: careerDetails,
      actor: {
        type: "candidate",
        email: interviewData.email,
        name: interviewData.name,
        image: interviewData.image,
      },
    });

    // Create org-scoped skill snapshot from candidate's global skills
    const orgID = interviewData.orgID;
    const candidateEmail = interviewData.email;

    if (orgID && candidateEmail) {
      try {
        const globalSkills = await db
          .collection("candidate-skills")
          .find({ candidateEmail })
          .toArray();

        const now = new Date();

        for (const skill of globalSkills) {
          await db.collection("org-candidate-skills").updateOne(
            { candidateEmail, orgID, skillName: skill.skillName },
            {
              $setOnInsert: {
                candidateEmail,
                orgID,
                skillName: skill.skillName,
                source: "candidate", // seeded from candidate profile
                createdAt: now,
              },
              $set: { updatedAt: now },
            },
            { upsert: true },
          );
        }
      } catch (skillError) {
        console.error("Error creating org skill snapshot:", skillError);
        // Don't fail the application if skill sync fails
      }
    }

    const existingAffiliation = await db.collection("affiliations").findOne({
      "applicantInfo.email": interviewData.email,
      orgID: interviewData.orgID,
    });

    if (!existingAffiliation) {
      await db.collection("affiliations").insertOne({
        type: "applicant",
        applicantInfo: {
          name: interviewData.name,
          email: interviewData.email,
          image: interviewData.image,
        },
        createdAt: new Date(),
        orgID: interviewData.orgID,
      });
    } else {
      // Update affiliation with latest name and image to ensure search works correctly
      // This fixes cases where the name was incorrect or missing initially
      await db.collection("affiliations").updateOne(
        {
          "applicantInfo.email": interviewData.email,
          orgID: interviewData.orgID,
        },
        {
          $set: {
            "applicantInfo.name": interviewData.name,
            "applicantInfo.image": interviewData.image,
          },
        }
      );
    }

    await sendEmail({
      recipient: interviewData.email,
      html: `
      <div>
        <p>Dear ${interviewData.name},</p>
        <p>Your job application has been successfully submitted for the role of ${interviewData.jobTitle}.</p>
        <p>You can access your interview here: <a href="https://www.hellojia.ai/interview/${interviewData.interviewID}">Interview Link</a></p>
      </div>
    `,
    });

    if (status === "For Interview" && origin === "direct-interview") {
      const interviewDetails = await db.collection("interviews").findOne({ id: interviewData.id, email: interviewData.email });
      if (interviewDetails) {
        await db.collection("interview-history").insertOne({
          interviewUID: interviewDetails._id.toString(),
          toStage: "Pending AI Interview",
          action: "Direct Link Promotion",
          createdAt: Date.now(),
        });

        // Update career lastActivityAt to current date
        await db.collection("careers").updateOne(
          { id: interviewDetails.id },
          { $set: { lastActivityAt: new Date() } }
        );
      }
    }

    return NextResponse.json({
      message: "Interview added successfully",
      interviewData,
    });
  } catch (error) {
    console.error("Error adding career:", error);
    return NextResponse.json(
      { error: "Failed to add career" },
      { status: 500 }
    );
  }
});
