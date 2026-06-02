import { NextRequest, NextResponse } from 'next/server';
import connectMongoDB from '@/lib/mongoDB/mongoDB';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgID = searchParams.get('orgID');
    
    const { db } = await connectMongoDB();
    
    // Fetch guests from members collection instead of guests collection
    const query = orgID ? { role: 'guest', orgID } : { role: 'guest' };
    const guests = await db.collection('members').find(query).toArray();
    
    return NextResponse.json({ success: true, guests });
  } catch (error: any) {
    console.error('Error fetching guests:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch guests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, orgID, companyName, inviterEmail, inviterName } = body;

    if (!email || !name || !orgID) {
      console.error("[create-guest] Missing required data: email, name, or orgID");
      return NextResponse.json(
        { success: false, error: 'Missing required data' },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    
    // Check if guest already exists in members collection
    const existingMember = await db.collection('members').findOne({ email, orgID });
    
    if (existingMember) {
      return NextResponse.json(
        { success: false, error: 'Member with this email already exists' },
        { status: 409 }
      );
    }

    // Create new member with guest role
    const newMember = {
      image: `https://api.dicebear.com/9.x/shapes/svg?seed=${email}`,
      name,
      email,
      orgID,
      role: 'guest',
      careers: undefined,
      addedAt: new Date(),
      lastLogin: null,
      status: 'invited',
    };

    const result = await db.collection('members').insertOne(newMember);

    return NextResponse.json({
      success: true,
      guest: { ...newMember, _id: result.insertedId },
    });
  } catch (error: any) {
    console.error('Error creating guest:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create guest' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const orgID = searchParams.get('orgID');

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Missing required data' },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();
    
    // Delete from members collection with role='guest'
    const query = orgID ? { email, orgID, role: 'guest' } : { email, role: 'guest' };
    const result = await db.collection('members').deleteOne(query);

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Guest not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting guest:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete guest' },
      { status: 500 }
    );
  }
}
