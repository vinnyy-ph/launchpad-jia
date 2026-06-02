import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const PATCH = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { planId, status } = body;

    if (!planId) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    if (!status || !["published", "unpublished"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'published' or 'unpublished'" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    const result = await db.collection("organization-plans").updateOne(
      { _id: new ObjectId(planId) },
      { 
        $set: { 
          status,
          updatedAt: new Date(),
        } 
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Plan ${status === "published" ? "published" : "unpublished"} successfully`,
      status,
    });
  } catch (error) {
    console.error("Error toggling pricing plan status:", error);
    return NextResponse.json(
      { error: "Error toggling pricing plan status" },
      { status: 500 }
    );
  }
});
