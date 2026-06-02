import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongoDB/mongoDB';
import { withAuth, AuthenticatedRequest } from '@/lib/utils/authMiddleware';
import { getUserOrgID } from '@/lib/utils/notificationHelpers';

const SEEN_ITEMS_COLLECTION = 'seen-items';
const TAB_VISITS_COLLECTION = 'tab-visits';

// GET /api/seen-items/check-new?itemType=career&itemIds=id1,id2,id3
// Checks which items are "new" for the current user
// Returns: { newItems: string[] } - array of item IDs that are new

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;
    const { searchParams } = new URL(request.url);
    const itemType = searchParams.get('itemType');
    const itemIdsParam = searchParams.get('itemIds');

    // Validation
    if (!itemType || !['career', 'requisition'].includes(itemType)) {
      return NextResponse.json(
        { error: 'Invalid itemType. Must be "career" or "requisition"' },
        { status: 400 }
      );
    }

    if (!itemIdsParam) {
      return NextResponse.json({ newItems: [] });
    }

    const itemIds = itemIdsParam.split(',').filter(Boolean);
    if (itemIds.length === 0) {
      return NextResponse.json({ newItems: [] });
    }

    const { db } = await connectMongoDB();

    const userId = user.uid;

    let orgID = searchParams.get('orgID');
    if (!orgID) orgID = await getUserOrgID(db, user.email);

    if (!userId || !orgID) {
      return NextResponse.json(
        { error: 'Missing userId or orgID' },
        { status: 400 }
      );
    }

    // Get last tab visit time
    const tabName = itemType === 'career' ? 'careers' : 'requisitions';
    const tabVisitsCollection = db.collection(TAB_VISITS_COLLECTION);
    const tabVisit = await tabVisitsCollection.findOne({
      userId,
      orgID,
      tabName,
    });

    const lastVisitedAt = tabVisit?.lastVisitedAt || new Date(0);

    // Get all items that have been marked as seen
    const seenItemsCollection = db.collection(SEEN_ITEMS_COLLECTION);
    const seenItems = await seenItemsCollection
      .find({
        userId,
        orgID,
        itemType,
        itemId: { $in: itemIds },
      })
      .toArray();

    const seenItemIds = new Set(seenItems.map((item) => item.itemId));

    // Items are "new" if:
    // 1. They haven't been marked as seen
    // 2. They were created/updated after the last tab visit
    // For now, we'll just check if they haven't been seen
    // The createdAt check would require item metadata which we can add later
    const newItems = itemIds.filter((itemId) => !seenItemIds.has(itemId));

    return NextResponse.json({ newItems });
  } catch (error: any) {
    console.error('Error checking new items:', error);
    return NextResponse.json(
      { error: 'Failed to check new items', details: error.message },
      { status: 500 }
    );
  }
});