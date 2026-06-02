import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { logActivity } from "@/lib/utils/activityLogger";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { interviewData, body, interviewTransaction } = await request.json();
  const userEmail = request.user.email;

  if (!interviewData || !body) {
    return NextResponse.json(
      {
        error: "INTERVIEW_NOT_FOUND",
        message:
          "Interview data could not be found for the given credentials. Unable to proceed with the operation.",
      },
      { status: 404 }
    );
  }

  const { db } = await connectMongoDB();
  const interviewInstance = await db
    .collection("interviews")
    .findOne({ email: userEmail, _id: new ObjectId(interviewData._id) });

  if (!interviewInstance) {
    return NextResponse.json(
      {
        error: "INTERVIEW_NOT_FOUND",
        message:
          "Interview data could not be found for the given credentials. Unable to proceed with the operation.",
      },
      { status: 404 }
    );
  }

  if (body.forDeletion) {
    // await db.collection("interviews").deleteOne({
    //   _id: new ObjectId(interviewData._id),
    //   email,
    // });
  }

  if (!body.forDeletion) {
    await db.collection("interviews").updateOne(
      {
        _id: new ObjectId(interviewData._id),
        email: userEmail,
      },
      {
        $set: {
          ...body,
        },
      }
    );
  }

  if (interviewTransaction) {
    await db.collection("interview-history").insertOne({
      ...interviewTransaction,
      createdAt: Date.now(),
    });
  }

  // Record candidate withdrawal in activity history
  if (body.applicationStatus === "Cancelled") {
    await logActivity({
      db,
      kind: "candidate_withdrew",
      interview: interviewInstance,
      actor: {
        type: "candidate",
        email: request.user?.email,
        name: interviewInstance.name || request.user?.name,
        image: request.user?.image,
      },
    });
  }

  // Record candidate retake request in activity history
  if (body.retakeRequest && body.retakeRequest.status === "Pending") {
    await logActivity({
      db,
      kind: "candidate_requested_ai_interview_retake",
      interview: interviewInstance,
      actor: {
        type: "candidate",
        email: request.user?.email,
        name: interviewInstance.name || request.user?.name,
        image: request.user?.image,
      },
      extraMetadata: {
        reason: body.retakeRequest.reason,
      },
    });
  }

  // Update career lastActivityAt to current date
  await db.collection("careers").updateOne(
    { id: interviewInstance.id },
    { $set: { lastActivityAt: new Date() } }
  );

  return NextResponse.json({
    message: "Job application updated successfully.",
  });
});
