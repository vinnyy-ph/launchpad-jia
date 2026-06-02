// POST /api/notifications/init-indexes
// Initialize MongoDB indexes for notifications collection
// Should be run once during deployment or migration

import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongoDB/mongoDB';
import { withAuth, AuthenticatedRequest } from '@/lib/utils/authMiddleware';
import {
  createNotificationIndexes,
  createTabVisitsIndexes,
  createSeenItemsIndexes,
  createCommentViewsIndexes
} from '@/lib/utils/notificationHelpers';
import { superAdminList } from '@/lib/SuperAdminUtils';

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;

    // Only super admins can initialize indexes
    if (!superAdminList.includes(user.email)) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      );
    }

    const { db } = await connectMongoDB();

    await createNotificationIndexes(db);
    await createTabVisitsIndexes(db);
    await createSeenItemsIndexes(db);
    await createCommentViewsIndexes(db);

    return NextResponse.json({
      success: true,
      message: 'Notification, tab-visits, seen-items, and comment-views indexes created successfully',
    });
  } catch (error) {
    console.error('Error initializing notification indexes:', error);
    return NextResponse.json(
      { error: 'Failed to initialize notification indexes' },
      { status: 500 }
    );
  }
});

