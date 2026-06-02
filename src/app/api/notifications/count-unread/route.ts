// GET /api/notifications/count-unread
// Returns count of unread notifications for the authenticated user

import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongoDB/mongoDB';
import { withAuth, AuthenticatedRequest } from '@/lib/utils/authMiddleware';
import { getUserOrgID, countUnreadNotifications } from '@/lib/utils/notificationHelpers';
import { verifyUserIsMember } from '@/lib/utils/adminAuth';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;
    const { db } = await connectMongoDB();

    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get('orgID');

    if (orgID) {
      // Optimization: Parallelize membership verification and unread count
      const [authResult, count] = await Promise.all([
        verifyUserIsMember(db, user.email, orgID),
        countUnreadNotifications(db, user.email, orgID)
      ]);

      if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.reason }, { status: 403 });
      }

      return NextResponse.json({ count });
    }

    // orgID not provided, must fetch it first
    const fetchedOrgID = await getUserOrgID(db, user.email);

    if (!fetchedOrgID) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 404 }
      );
    }

    // Count unread notifications using fetched orgID
    const count = await countUnreadNotifications(db, user.email, fetchedOrgID);

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error counting unread notifications:', error);
    return NextResponse.json(
      { error: 'Failed to count unread notifications' },
      { status: 500 }
    );
  }
});

