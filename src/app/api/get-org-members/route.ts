import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { orgID } = await request.json();
    const { email } = request.user;

    if (!orgID) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Fetch all members from the same organization
    const members = await db
      .collection("members")
      .find({ orgID })
      .project({
        _id: 1,
        name: 1,
        email: 1,
        image: 1,
        role: 1,
      })
      .toArray();

    const isMember = members.find((member) => member.email === email);
    const adminAccount = await db.collection("admins").findOne({ email: email });
    if (!isMember && !adminAccount) {
      return NextResponse.json({ error: "You are not a member of this organization" }, { status: 403 });
    }

    return NextResponse.json({ members }, { status: 200 });
  } catch (error) {
    console.error("Error fetching organization members:", error);
    return NextResponse.json(
      { error: "Failed to fetch organization members" },
      { status: 500 }
    );
  }
});
