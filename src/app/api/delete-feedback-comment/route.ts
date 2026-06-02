import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { ObjectId } from "mongodb";

// Soft delete a comment inside feedback.comments by setting deleted flags
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { interviewID, orgID, commentId, type, candidateEmail } = await request.json();
  const { user } = request;

  // Basic validations
  if (!orgID) {
    return NextResponse.json(
      { error: "Missing orgID" },
      { status: 400 }
    );
  }
    const resolvedType = typeof type === 'string' ? type : (interviewID ? 'application' : 'candidate');
    if (resolvedType === 'application' && !interviewID) {
      return NextResponse.json({ error: 'interviewID is required for application comments' }, { status: 400 });
    }
    if (resolvedType === 'candidate' && !candidateEmail) {
      return NextResponse.json({ error: 'candidateEmail is required for candidate comments' }, { status: 400 });
    }
  if (!commentId) {
    return NextResponse.json({ error: "Missing commentId" }, { status: 400 });
  }

  const { db } = await connectMongoDB();

  // Find the comment to verify authorship and not deleted
  let oid: ObjectId;
  try {
    oid = new ObjectId(commentId);
  } catch {
    return NextResponse.json({ error: "Invalid commentId" }, { status: 400 });
  }

  // Find comment in standalone comments collection
  const findQuery: any = { _id: oid, orgID };
  if (resolvedType === 'application') {
    findQuery.interviewID = interviewID;
    findQuery.type = 'application';
  } else {
    findQuery.interviewID = null;
    findQuery.type = 'candidate';
    findQuery.candidateEmail = candidateEmail;
  }
  const target = await db.collection("comments").findOne(findQuery);
  if (!target) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  const targetEmail =
    typeof target.createdBy === "string"
      ? target.createdBy
      : target.createdBy?.email;
  if (
    !targetEmail ||
    targetEmail.toLowerCase() !== (user.email || "").toLowerCase()
  ) {
    return NextResponse.json(
      { error: "Forbidden - not comment author" },
      { status: 403 }
    );
  }
  if ((target as any).deleted) {
    return NextResponse.json(
      { error: "Comment already deleted" },
      { status: 409 }
    );
  }
  // Perform the soft delete on comments collection
  const res = await db
    .collection("comments")
    .updateOne(
      findQuery,
      { $set: { deleted: true, deletedAt: new Date() } }
    );


  // Validate update result
  if (res.matchedCount === 0) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  if (res.modifiedCount === 0) {
    return NextResponse.json(
      { error: "Comment match found but not modified" },
      { status: 409 }
    );
  }

  await db.collection("recruiter-history").insertOne({
    interviewUID: interviewID,
    orgID: orgID,
    action: "Deleted Feedback Comment",
    recruiterEmail: user?.email,
    createdAt: Date.now(),
  });
  return NextResponse.json({ success: true });
});
