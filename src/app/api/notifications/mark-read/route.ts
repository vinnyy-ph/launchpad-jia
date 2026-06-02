// POST /api/notifications/mark-read
// Marks a specific notification as read

import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongoDB/mongoDB';
import { withAuth, AuthenticatedRequest } from '@/lib/utils/authMiddleware';
import { getUserOrgID, markNotificationAsRead } from '@/lib/utils/notificationHelpers';

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;
    const body = await request.json();

    if (!body.notificationId) {
      return NextResponse.json(
        { error: 'Missing notificationId' },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    let orgID = body.orgID;
    if (!orgID) orgID = await getUserOrgID(db, user.email);

    if (!orgID) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 404 }
      );
    }

    const success = await markNotificationAsRead(
      db,
      body.notificationId,
      user.email,
      orgID
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Notification not found or already read' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
});

