import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { db } = await connectMongoDB();
    const { orgID } = await req.json();

    const careers = await db
      .collection("affiliations")
      .find({ orgID })
      .sort({ updatedAt: -1 })
      .toArray();

    return NextResponse.json(careers);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch applicants" },
      { status: 500 }
    );
  }
});
