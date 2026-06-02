// GET/POST /api/notifications/preferences
// Get or update user notification preferences

import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongoDB/mongoDB';
import { withAuth, AuthenticatedRequest } from '@/lib/utils/authMiddleware';
import {
  getUserOrgID,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
} from '@/lib/utils/notificationHelpers';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;
    const { db } = await connectMongoDB();

    const { searchParams } = new URL(request.url);
    let orgID = searchParams.get('orgID');
    if (!orgID) orgID = await getUserOrgID(db, user.email);

    if (!orgID) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 404 }
      );
    }

    const preferences = await getUserNotificationPreferences(db, user.email, orgID);

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;
    const body = await request.json();

    if (!body.preferences || typeof body.preferences !== 'object') {
      return NextResponse.json(
        { error: 'Invalid preferences format' },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Accept orgID from request body or fetch from user
    let orgID = body.orgID;
    if (!orgID) {
      orgID = await getUserOrgID(db, user.email);
    }

    if (!orgID) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 404 }
      );
    }

    const success = await updateUserNotificationPreferences(
      db,
      user.email,
      orgID,
      body.preferences
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
});

