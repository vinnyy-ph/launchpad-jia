import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { ObjectId } from "mongodb";
import { sanitizeString, containsSuspiciousPatterns } from '@/lib/utils/sanitizeInput';

/*
  Update (edit) a comment's text using commentId only.
  Ensures only the original author can edit.
*/
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { interviewID, orgID, commentId, newText, type, candidateEmail, mentions } = await request.json();
  const { user } = request;

  // Basic validations
  if (!orgID) {
    return NextResponse.json({ error: "Missing orgID" }, { status: 400 });
  }
  if (!newText || !newText.trim()) {
    return NextResponse.json({ error: "Empty newText" }, { status: 400 });
  }
  if (!commentId) {
    return NextResponse.json({ error: "Missing commentId" }, { status: 400 });
  }

  const resolvedType = typeof type === 'string' ? type : (interviewID ? 'application' : 'candidate');
  if (resolvedType === 'application' && !interviewID) {
    return NextResponse.json({ error: 'interviewID is required for application comments' }, { status: 400 });
  }
  if (resolvedType === 'candidate' && !candidateEmail) {
    return NextResponse.json({ error: 'candidateEmail is required for candidate comments' }, { status: 400 });
  }

  const { db } = await connectMongoDB();

  // Find the comment to verify authorship and not deleted
  let oid: ObjectId;
  try {
    oid = new ObjectId(commentId);
  } catch {
    return NextResponse.json({ error: "Invalid commentId" }, { status: 400 });
  }

  // Find specified comment in standalone comments collection
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
  const targetEmail = typeof target.createdBy === 'string' ? target.createdBy : target.createdBy?.email;
  if (!targetEmail || targetEmail.toLowerCase() !== (user.email || '').toLowerCase()) {
    return NextResponse.json({ error: "Forbidden - not comment author" }, { status: 403 });
  }
  if (target.deleted) {
    return NextResponse.json({ error: "Cannot edit a deleted comment" }, { status: 409 });
  }

  // Sanitize incoming edit first
  const sanitized = sanitizeString(newText, 'strict');

  // If raw contains suspicious patterns but sanitization removed everything, reject the edit
  if (containsSuspiciousPatterns(newText)) {
    if (!sanitized || sanitized.trim().length < 1) {
      return NextResponse.json({ error: "Edited content contains disallowed content" }, { status: 400 });
    }
    console.warn('[Sanitize] Suspicious edit sanitized for commentId=', commentId);
  }

  // Enforce length cap
  const MAX_LEN = 5000;
  const finalText = sanitized.length > MAX_LEN ? sanitized.slice(0, MAX_LEN) : sanitized;

  // Perform the update with sanitized text
  const updateRes = await db.collection("comments").updateOne(
    findQuery,
    { $set: { text: finalText, edited: true, editedAt: new Date(), mentions: Array.isArray(mentions) ? mentions : [] } }
  );

  if (updateRes.modifiedCount === 0) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  await db.collection("recruiter-history").insertOne({
    interviewUID: interviewID,
    orgID: orgID,
    action: "Updated Feedback Comment",
    recruiterEmail: user?.email,
    createdAt: Date.now(),
  });

  return NextResponse.json({ success: true });
});
