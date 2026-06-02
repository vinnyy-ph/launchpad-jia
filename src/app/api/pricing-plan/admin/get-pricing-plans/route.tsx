import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { db } = await connectMongoDB();
    
    const pricingPlans = await db
      .collection("organization-plans")
      .find({})
      .sort({ createdAt: 1 })
      .toArray();

    return NextResponse.json(pricingPlans);
  } catch (error) {
    console.error("Error fetching pricing plans:", error);
    return NextResponse.json(
      { error: "Error fetching pricing plans" },
      { status: 500 }
    );
  }
});
