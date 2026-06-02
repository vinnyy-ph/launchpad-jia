// TODO (Vince) - For Merging

import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { db } = await connectMongoDB();
  const userEmail = request.user.email;
  const cv = await db.collection("applicant-cv").findOne({ email: userEmail });

  return NextResponse.json(cv);
});
