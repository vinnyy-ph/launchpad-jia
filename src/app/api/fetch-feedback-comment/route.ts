import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

/*
  Fetch comments for a given interviewID + orgID from standalone `comments` collection.
  Endpoint name aligned with legacy naming: /api/fetch-feedback-comments
*/
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { interviewID, orgID, candidateEmail, type } = await request.json();
  if (!orgID) {
    return NextResponse.json({ error: "Missing orgID" }, { status: 400 });
  }
  const resolvedType = typeof type === 'string' ? type : (interviewID ? 'application' : 'candidate');
  const { db } = await connectMongoDB();
  const query: any = { orgID };
  if (resolvedType === 'application') {
    if (!interviewID) return NextResponse.json({ error: 'interviewID required for application comments' }, { status: 400 });
    query.interviewID = interviewID;
    query.type = 'application';
  } else {
    // candidate scope: interviewID null and candidateEmail optional filter
    query.interviewID = null;
    query.type = 'candidate';
    if (candidateEmail) query.candidateEmail = candidateEmail;
  }
  const cursor = db.collection('comments').find(query).sort({ createdAt: -1 });
  const comments = await cursor.toArray();
  return NextResponse.json({ comments });
});
