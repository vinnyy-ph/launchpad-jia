// GET /api/notifications/fetch
// Fetches notifications for the authenticated user with pagination

import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongoDB/mongoDB';
import { withAuth, AuthenticatedRequest } from '@/lib/utils/authMiddleware';
import { getUserOrgID, fetchUserNotifications } from '@/lib/utils/notificationHelpers';
import { NotificationResponse } from '@/lib/utils/notificationTypes';
import { verifyUserIsMember } from '@/lib/utils/adminAuth';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || undefined;

    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    let orgID = searchParams.get('orgID');
    if (!orgID) { 
      orgID = await getUserOrgID(db, user.email);
    } else {
      const result = await verifyUserIsMember(db, user.email, orgID);
      if (!result.authorized) {
        return NextResponse.json({ error: result.reason }, { status: 403 });
      }
    }

    if (!orgID) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 404 }
      );
    }

    const { notifications, total } = await fetchUserNotifications(
      db,
      user.email,
      orgID,
      page,
      limit,
      search
    );

    const response: NotificationResponse = {
      notifications,
      total,
      hasMore: page * limit < total,
      page,
      limit,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
});

