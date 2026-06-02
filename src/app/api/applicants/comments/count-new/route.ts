import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongoDB/mongoDB';
import { withAuth, AuthenticatedRequest } from '@/lib/utils/authMiddleware';

/**
 * GET /api/applicants/comments/count-new?applicantEmail=email&interviewIDs=id1,id2
 * Counts new (unread) comments for an applicant using viewedBy array
 * Returns: { newCount: number, totalCount: number }
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;
    const { searchParams } = new URL(request.url);
    const applicantEmail = searchParams.get('applicantEmail');
    const interviewIDsParam = searchParams.get('interviewIDs');
    const orgID = searchParams.get('orgID');

    // Validation
    if (!applicantEmail) {
      return NextResponse.json(
        { error: 'applicantEmail is required' },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    const userId = user.uid;
    
    if (!userId || !orgID) {
      return NextResponse.json(
        { error: 'Missing userId or orgID' },
        { status: 400 }
      );
    }
    const userEmail = user.email;

    // Parse interview IDs
    const interviewIDs = interviewIDsParam
      ? interviewIDsParam.split(',').filter(Boolean)
      : [];

    // Fetch all comments for this applicant
    const commentsCollection = db.collection('comments');

    // Application-level comments only
    if (interviewIDs.length === 0) {
      return NextResponse.json({
        newCount: 0,
        totalCount: 0,
      });
    }

    const query = {
      orgID,
      interviewID: { $in: interviewIDs },
      type: 'application',
      deleted: { $ne: true },
      deletedAt: { $exists: false },
    };

    const allComments = await commentsCollection
      .find(query)
      .toArray();

    const totalCount = allComments.length;

    // Count comments where user is NOT in viewedBy array
    const newComments = allComments.filter((comment: any) => {
      return !comment.viewedBy || !comment.viewedBy.includes(userEmail);
    });

    const newCount = newComments.length;

    return NextResponse.json({
      newCount,
      totalCount,
    });
  } catch (error: any) {
    console.error('Error counting new comments:', error);
    return NextResponse.json(
      { error: 'Failed to count new comments', details: error.message },
      { status: 500 }
    );
  }
});