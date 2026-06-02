import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { DEFAULT_JOB_PIPELINE } from "@/lib/utils/constants";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { isValidGUID, isValidStringParameter, validateEmail } from "@/lib/Utils";
import { verifyUserIsMember } from "@/lib/utils/adminAuth";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { db } = await connectMongoDB();
  const { email, interviewID, orgID } = await request.json();
  const interviewModel = db.collection("interviews");
  const matchConditions: any = [{ email }];
  const authUserEmail = request.user?.email;

  // Validate email is valid
  if ((email !== 'all' && !validateEmail(email)) || !isValidStringParameter(email)) {
    return NextResponse.json({
      error: "Invalid email address.",
    }, { status: 400 });
  }

  if (interviewID != "all" && !isValidGUID(interviewID)) {
    return NextResponse.json({
      error: "Invalid interview ID.",
    }, { status: 400 });
  }

  if (interviewID != "all") {
    matchConditions.push({ id: interviewID });
  }

  if (authUserEmail !== email) {
    // Ensure user is recruiter or admin
    const authResult = await verifyUserIsMember(db, authUserEmail, orgID);
    if (!authResult.authorized) {
      return NextResponse.json({
        error: authResult.reason,
      }, { status: 403 });
    }
  }

  matchConditions.push({
    applicationStatus: {
      $in: ["Ongoing", "Dropped", "Cancelled"],
    },
  });

  const interviews = await interviewModel
    .aggregate([
      {
        $lookup: {
          from: "organizations",
          let: { orgID: "$orgID" },
          pipeline: [
            {
              $addFields: {
                _id: { $toString: "$_id" },
              },
            },
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$orgID"],
                },
              },
            },
          ],
          as: "organization",
        },
      },
      {
        $unwind: {
          path: "$organization",
          preserveNullAndEmptyArrays: true,
        },
      },
      { $match: { $and: matchConditions } },
      {
        $sort: {
          createdAt: -1,
        },
      },
    ])
    .toArray();

  if (interviewID != "all" && interviews.length == 0) {
    return NextResponse.json({
      error: "No application found for the given ID.",
    });
  }

  const careers = await db.collection("careers").find({ id: { $in: [...new Set(interviews.map((i) => i.id))] } }).toArray();

  return NextResponse.json(interviews.map((i) => {
    const career = careers.find((c) => c.id === i.id);
    return {
      ...i,
      careerId: career?._id?.toString(),
      pipelineStages: career?.pipelineStages || DEFAULT_JOB_PIPELINE,
      preScreeningQuestions: (i.currentStep === "Applied" ? career?.preScreeningQuestions : i.preScreeningQuestions) || [],
    }
  }));
});
