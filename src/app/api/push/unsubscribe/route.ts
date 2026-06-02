// POST /api/push/unsubscribe
// Remove user's push notification subscription

import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongoDB/mongoDB';
import { withAuth, AuthenticatedRequest } from '@/lib/utils/authMiddleware';
import { removePushSubscription } from '@/lib/utils/notificationHelpers';

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint required' },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    const removed = await removePushSubscription(db, endpoint);

    return NextResponse.json({
      success: removed,
    });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    return NextResponse.json(
      { error: 'Failed to remove push subscription' },
      { status: 500 }
    );
  }
});
