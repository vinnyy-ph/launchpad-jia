// POST /api/tabs/mark-visited
// Records when a user visits a specific tab

import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongoDB/mongoDB';
import { withAuth, AuthenticatedRequest } from '@/lib/utils/authMiddleware';
import { getUserOrgID } from '@/lib/utils/notificationHelpers';

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;
    const { db } = await connectMongoDB();

    // Parse and validate request body
    const body = await request.json();
    const { tabName, orgID: providedOrgID } = body;

    // Use provided orgID or fetch from user
    let orgID = providedOrgID;
    if (!orgID) {
      orgID = await getUserOrgID(db, user.email);
    }

    if (!orgID) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 404 }
      );
    }

    // Validate tabName
    const validTabs = ['careers', 'requisitions'];
    if (!tabName || !validTabs.includes(tabName)) {
      return NextResponse.json(
        { error: 'Invalid tab name. Must be one of: careers, requisitions' },
        { status: 400 }
      );
    }

    // Upsert last visit timestamp
    const tabVisits = db.collection('tab-visits');
    await tabVisits.updateOne(
      {
        userId: user.email,
        orgID: orgID,
        tabName: tabName
      },
      {
        $set: {
          lastVisitedAt: new Date()
        }
      },
      {
        upsert: true
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking tab as visited:', error);
    return NextResponse.json(
      { error: 'Failed to mark tab as visited' },
      { status: 500 }
    );
  }
});