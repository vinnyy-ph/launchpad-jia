import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongoDB/mongoDB';
import { withAuth, AuthenticatedRequest } from '@/lib/utils/authMiddleware';

/**
 * Check the status of a member by email and orgID
 * Useful for debugging member/guest status
 */
export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const orgID = searchParams.get('orgID');

    if (!email || !orgID) {
      console.error("[check-member-status] Missing required data: email or orgID");
      return NextResponse.json(
        { success: false, error: 'Missing required data' },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    const member = await db.collection('members').findOne({ email, orgID });

    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      member: {
        email: member.email,
        name: member.name,
        role: member.role,
        status: member.status,
        lastLogin: member.lastLogin,
        addedAt: member.addedAt,
      },
    });
  } catch (error: any) {
    console.error('Error checking member status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check member status' },
      { status: 500 }
    );
  }
});
