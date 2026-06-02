import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const {
      planId,
      name,
      schema: rawSchema,
      costPerMonth,
      maxActiveJobPosts,
      maxAdminSeats,
      maxGuestHMSeats,
      creditsPerMonth,
      costPerYear,
      additionalJobPostCost,
    } = body;

    if (!planId) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    // Validation
    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Plan name is required" },
        { status: 400 }
      );
    }

    const schema = rawSchema === "post-based" ? "premium" : rawSchema;

    if (!schema || !["credit-based", "premium"].includes(schema)) {
      return NextResponse.json(
        { error: "Invalid schema type" },
        { status: 400 }
      );
    }

    if (typeof costPerMonth !== "number" || costPerMonth < 0) {
      return NextResponse.json(
        { error: "Cost per month must be a non-negative number" },
        { status: 400 }
      );
    }

    // maxActiveJobPosts: null = unlimited, or must be a non-negative integer
    if (maxActiveJobPosts !== null && (typeof maxActiveJobPosts !== "number" || maxActiveJobPosts < 0 || !Number.isInteger(maxActiveJobPosts))) {
      return NextResponse.json(
        { error: "Max active job posts must be null (unlimited) or a non-negative integer" },
        { status: 400 }
      );
    }

    // maxAdminSeats: null = unlimited, or must be a non-negative integer
    if (maxAdminSeats !== null && (typeof maxAdminSeats !== "number" || maxAdminSeats < 0 || !Number.isInteger(maxAdminSeats))) {
      return NextResponse.json(
        { error: "Max admin seats must be null (unlimited) or a non-negative integer" },
        { status: 400 }
      );
    }

    // Schema-specific validation
    if (schema === "credit-based") {
      if (typeof creditsPerMonth !== "number" || creditsPerMonth < 0 || !Number.isInteger(creditsPerMonth)) {
        return NextResponse.json(
          { error: "Credits per month must be a non-negative integer" },
          { status: 400 }
        );
      }
    }

    if (schema === "premium") {
      if (typeof costPerYear !== "number" || costPerYear < 0) {
        return NextResponse.json(
          { error: "Cost per year must be a non-negative number" },
          { status: 400 }
        );
      }
      if (typeof additionalJobPostCost !== "number" || additionalJobPostCost < 0) {
        return NextResponse.json(
          { error: "Additional job post cost must be a non-negative number" },
          { status: 400 }
        );
      }
    }

    const { db } = await connectMongoDB();

    const updateData: any = {
      name: name.trim(),
      schema,
      costPerMonth,
      maxActiveJobPosts: maxActiveJobPosts ?? null, // null = unlimited
      maxAdminSeats: maxAdminSeats ?? null, // null = unlimited
      maxGuestHMSeats: maxGuestHMSeats ?? null, // null = unlimited
      // Keep jobLimit for backward compatibility
      jobLimit: maxActiveJobPosts,
      updatedAt: new Date(),
    };

    // Add schema-specific fields
    if (schema === "credit-based") {
      updateData.creditsPerMonth = creditsPerMonth;
      // Remove premium fields
      updateData.costPerYear = null;
      updateData.additionalJobPostCost = null;
    } else {
      updateData.costPerYear = costPerYear;
      updateData.additionalJobPostCost = additionalJobPostCost;
      // Remove credit-based fields
      updateData.creditsPerMonth = null;
    }

    const result = await db.collection("organization-plans").updateOne(
      { _id: new ObjectId(planId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Plan updated successfully",
    });
  } catch (error) {
    console.error("Error updating pricing plan:", error);
    return NextResponse.json(
      { error: "Error updating pricing plan" },
      { status: 500 }
    );
  }
});
