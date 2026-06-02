// POST /api/push/subscribe
// Save user's push notification subscription

import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongoDB/mongoDB';
import { withAuth, AuthenticatedRequest } from '@/lib/utils/authMiddleware';
import { getUserOrgID, savePushSubscription } from '@/lib/utils/notificationHelpers';

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;
    const { subscription, userAgent, orgID: providedOrgID } = await request.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: 'Invalid push subscription' },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    let orgID = providedOrgID;
    if (!orgID) orgID = await getUserOrgID(db, user.email);

    if (!orgID) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 404 }
      );
    }

    const subscriptionId = await savePushSubscription(
      db,
      user.email,
      orgID,
      subscription,
      userAgent
    );

    return NextResponse.json({
      success: true,
      subscriptionId,
    });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    return NextResponse.json(
      { error: 'Failed to save push subscription' },
      { status: 500 }
    );
  }
});
