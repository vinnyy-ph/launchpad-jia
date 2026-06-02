// TODO (Vince) - For Merging

import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { DEFAULT_JOB_PIPELINE } from "../../../../lib/utils/constants";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { db } = await connectMongoDB();
  const userEmail = request.user.email;
  const interviews = await db
    .collection("interviews")
    .find({ email: userEmail })
    .sort({ updatedAt: -1 })
    .toArray();

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
