import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongoDB/mongoDB';

/**
 * Migration endpoint to move guests from 'guests' collection to 'members' collection
 * This is a one-time migration script
 */
export async function POST(request: NextRequest) {
  try {
    const { db } = await connectMongoDB();
    
    // Get all guests from the guests collection
    const guests = await db.collection('guests').find({}).toArray();
    
    if (guests.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No guests found to migrate',
        migrated: 0,
      });
    }

    let migratedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Get the first organization (or you can pass orgID as a parameter)
    const org = await db.collection('organizations').findOne({});
    const orgID = org?._id?.toString();

    if (!orgID) {
      return NextResponse.json(
        { success: false, error: 'No organization found' },
        { status: 400 }
      );
    }

    for (const guest of guests) {
      try {
        // Check if member already exists in members collection
        const existingMember = await db.collection('members').findOne({
          email: guest.email,
          orgID,
        });

        if (existingMember) {
          skippedCount++;
          continue;
        }

        // Create member record from guest
        const newMember = {
          image: `https://api.dicebear.com/9.x/shapes/svg?seed=${guest.email}`,
          name: guest.name || (
            guest.email.split('@')[0].charAt(0).toUpperCase() +
            guest.email.split('@')[0].slice(1)
          ),
          email: guest.email,
          orgID,
          role: 'guest',
          careers: undefined,
          addedAt: guest.createdAt || new Date(),
          lastLogin: null,
          status: guest.status === 'pending' ? 'invited' : guest.status,
        };

        // Insert into members collection
        await db.collection('members').insertOne(newMember);
        migratedCount++;
      } catch (error: any) {
        errors.push(`Failed to migrate ${guest.email}: ${error.message}`);
      }
    }

    // Optionally delete the guests from the guests collection after successful migration
    // Uncomment the line below if you want to delete the guests collection after migration
    // await db.collection('guests').deleteMany({});

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      migrated: migratedCount,
      skipped: skippedCount,
      total: guests.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Migration failed' },
      { status: 500 }
    );
  }
}
