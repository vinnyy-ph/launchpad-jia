import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const {
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

    const newPlan = {
      name: name.trim(),
      schema,
      status: "unpublished",
      costPerMonth,
      maxActiveJobPosts: maxActiveJobPosts ?? null, // null = unlimited
      maxAdminSeats: maxAdminSeats ?? null, // null = unlimited
      maxGuestHMSeats: maxGuestHMSeats ?? null, // null = unlimited
      ...(schema === "credit-based" && { creditsPerMonth }),
      ...(schema === "premium" && { costPerYear, additionalJobPostCost }),
      // Keep jobLimit for backward compatibility
      jobLimit: maxActiveJobPosts,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("organization-plans").insertOne(newPlan);

    return NextResponse.json({
      success: true,
      planId: result.insertedId,
      plan: { ...newPlan, _id: result.insertedId },
    });
  } catch (error) {
    console.error("Error creating pricing plan:", error);
    return NextResponse.json(
      { error: "Error creating pricing plan" },
      { status: 500 }
    );
  }
});
