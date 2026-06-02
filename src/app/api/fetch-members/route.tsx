import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { db } = await connectMongoDB();
    const { orgID } = await req.json();

    const members = await db.collection("members").find({ orgID }).toArray();

    return NextResponse.json(members);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
});
