import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";


export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { rating, feedback, interviewID, orgID, id, allowTestimonial } =
    await request.json();
  const { db } = await connectMongoDB();

  await db.collection("feedback").insertOne({
    rating,
    feedback,
    interviewID,
    createdAt: new Date(),
    orgID,
    id,
    allowTestimonial,
  });
  return NextResponse.json({ message: "Feedback submitted" });
});
