import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

/**
 * GET - Fetch the current applicant's visibility setting.
 * Returns profileVisible (boolean); defaults to true if not set.
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { db } = await connectMongoDB();
  const email = request.user.email;
  if (!email) {
    return NextResponse.json(
      { error: "User email not found" },
      { status: 401 }
    );
  }

  const applicant = await db.collection("applicants").findOne({ email });
  const profileVisible = applicant?.profileVisible !== false;

  return NextResponse.json({ profileVisible });
});

/**
 * PATCH - Update the current applicant's visibility setting.
 * Body: { profileVisible: boolean }
 */
export const PATCH = withAuth(async (request: AuthenticatedRequest) => {
  const { db } = await connectMongoDB();
  const email = request.user.email;
  if (!email) {
    return NextResponse.json(
      { error: "User email not found" },
      { status: 401 }
    );
  }

  let body: { profileVisible?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const profileVisible = body.profileVisible;
  if (typeof profileVisible !== "boolean") {
    return NextResponse.json(
      { error: "profileVisible must be a boolean" },
      { status: 400 }
    );
  }

  const result = await db.collection("applicants").updateOne(
    { email },
    { $set: { profileVisible } }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json(
      { error: "Applicant record not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ profileVisible });
});
