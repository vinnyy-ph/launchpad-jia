// GET /api/push/vapid-public-key
// Returns the VAPID public key for push subscription

import { NextResponse } from 'next/server';

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_CLIENT;

  if (!publicKey) {
    return NextResponse.json(
      { error: 'VAPID public key not configured' },
      { status: 500 }
    );
  }

  return NextResponse.json({ publicKey });
}
