import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongoDB/mongoDB';
import { withAuth, AuthenticatedRequest } from '@/lib/utils/authMiddleware';

/**
 * POST /api/applicants/comments/mark-viewed
 * Marks comments as viewed for an applicant by updating viewedBy array
 * Body: { applicantEmail: string, interviewIDs?: string[] }
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;
    const body = await request.json();
    const { applicantEmail, interviewIDs, orgID} = body;

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
    const commentsCollection = db.collection('comments');

    // Parse interviewIDs if provided
    const interviewIDArray = Array.isArray(interviewIDs)
      ? interviewIDs
      : (typeof interviewIDs === 'string' ? interviewIDs.split(',').filter(Boolean) : []);

    // Application-level comments only
    if (interviewIDArray.length === 0) {
      return NextResponse.json({
        success: true,
        applicantEmail,
        commentsMarked: 0,
      });
    }

    const query = {
      orgID,
      interviewID: { $in: interviewIDArray },
      type: 'application',
      deleted: { $ne: true },
      deletedAt: { $exists: false },
    };

    // Mark application-level comments as viewed by current user
    const result = await commentsCollection.updateMany(
      query,
      {
        $addToSet: {
          viewedBy: user.email, // Add user email to viewedBy array (no duplicates)
        },
      }
    );

    return NextResponse.json({
      success: true,
      applicantEmail,
      commentsMarked: result.modifiedCount,
    });
  } catch (error: any) {
    console.error('Error marking comments as viewed:', error);
    return NextResponse.json(
      { error: 'Failed to mark comments as viewed', details: error.message },
      { status: 500 }
    );
  }
});