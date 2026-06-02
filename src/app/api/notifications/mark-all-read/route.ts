// POST /api/notifications/mark-all-read
// Marks all notifications as read for the authenticated user

import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongoDB/mongoDB';
import { withAuth, AuthenticatedRequest } from '@/lib/utils/authMiddleware';
import { getUserOrgID, markAllNotificationsAsRead } from '@/lib/utils/notificationHelpers';

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;
    const body = await request.json();
    const { db } = await connectMongoDB();

    let orgID = body.orgID;
    if (!orgID) orgID = await getUserOrgID(db, user.email);

    if (!orgID) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 404 }
      );
    }

    const count = await markAllNotificationsAsRead(db, user.email, orgID);

    return NextResponse.json({
      success: true,
      markedAsRead: count,
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark all notifications as read' },
      { status: 500 }
    );
  }
});

