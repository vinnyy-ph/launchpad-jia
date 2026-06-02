// GET /api/tabs/count-new-items
// Returns badge counts for careers and requisitions in a single call

import { NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongoDB/mongoDB';
import { withAuth, AuthenticatedRequest } from '@/lib/utils/authMiddleware';
import { getUserOrgID } from '@/lib/utils/notificationHelpers';
import { fetchBadgeDataForCareers, computeBadgesForCareer } from '@/lib/utils/badgeComputations';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;
    const { db } = await connectMongoDB();
    const { searchParams } = new URL(request.url);

    let orgID = searchParams.get('orgID');
    if (!orgID) {
      orgID = await getUserOrgID(db, user.email);
    }

    if (!orgID) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 404 }
      );
    }

    // Fetch careers and requisitions counts in parallel
    const [careersCount, requisitionsCount] = await Promise.all([
      countCareersWithBadges(db, orgID, user),
      db.collection('requisitions').countDocuments({
        orgID: orgID,
        viewedBy: { $ne: user.email }
      })
    ]);

    return NextResponse.json({
      careers: careersCount,
      requisitions: requisitionsCount
    });
  } catch (error) {
    console.error('Error counting new items:', error);
    return NextResponse.json(
      { error: 'Failed to count new items' },
      { status: 500 }
    );
  }
});

async function countCareersWithBadges(db: any, orgID: string, user: { uid: string; email?: string }) {
  const careers = await db.collection('careers').find({ orgID }).toArray();

  if (careers.length === 0) return 0;

  const careerIds = careers.map((c: any) => c.id || c._id?.toString()).filter(Boolean);

  const badgeDataMaps = await fetchBadgeDataForCareers(db, careerIds, user.uid, orgID, user.email);

  let count = 0;
  careers.forEach((career: any) => {
    const careerId = career.id || career._id?.toString();
    if (!careerId) return;

    const badges = computeBadgesForCareer(careerId, badgeDataMaps, user.email);

    if (badges.newComments > 0 || badges.importantActions > 0 ) {
      count++;
    }
  });

  return count;
}