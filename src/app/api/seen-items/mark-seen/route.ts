import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongoDB/mongoDB';
import { withAuth, AuthenticatedRequest } from '@/lib/utils/authMiddleware';
import { getUserOrgID } from '@/lib/utils/notificationHelpers';

const SEEN_ITEMS_COLLECTION = 'seen-items';

// POST /api/seen-items/mark-seen
// Marks items as seen for the current user
// Body: { itemType: 'career' | 'requisition', itemIds: string[] }

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;
    const body = await request.json();
    const { itemType, itemIds, orgID: providedOrgID } = body;

    // Validation
    if (!itemType || !['career', 'requisition'].includes(itemType)) {
      return NextResponse.json(
        { error: 'Invalid itemType. Must be "career" or "requisition"' },
        { status: 400 }
      );
    }

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: 'itemIds must be a non-empty array' },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    const userId = user.uid;

    let orgID = providedOrgID;
    if (!orgID) orgID = await getUserOrgID(db, user.email);

    if (!userId || !orgID) {
      return NextResponse.json(
        { error: 'Missing userId or orgID' },
        { status: 400 }
      );
    }
    const collection = db.collection(SEEN_ITEMS_COLLECTION);

    // Bulk upsert operation
    const operations = itemIds.map((itemId) => ({
      updateOne: {
        filter: { userId, orgID, itemType, itemId },
        update: {
          $set: {
            userId,
            orgID,
            itemType,
            itemId,
            seenAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await collection.bulkWrite(operations);

    return NextResponse.json({
      success: true,
      marked: itemIds.length,
      upsertedCount: result.upsertedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (error: any) {
    console.error('Error marking items as seen:', error);
    return NextResponse.json(
      { error: 'Failed to mark items as seen', details: error.message },
      { status: 500 }
    );
  }
});