import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { randomUUID } from "crypto";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { orgId, amount, reason } = await request.json();

  if (!orgId || amount === undefined || amount === null) {
    console.error("[adjust-org-credits] Missing required data: orgId or amount");
    return NextResponse.json(
      { error: "Missing required data" },
      { status: 400 }
    );
  }

  if (typeof amount !== "number" || !Number.isInteger(amount)) {
    return NextResponse.json(
      { error: "Amount must be an integer" },
      { status: 400 }
    );
  }

  try {
    const { db } = await connectMongoDB();

    // Verify user is a platform super admin
    const userEmail = request.user?.email;
    if (!userEmail) {
      return NextResponse.json(
        { error: "User email not found in session" },
        { status: 401 }
      );
    }

    const organization = await db
      .collection("organizations")
      .findOne({ _id: new ObjectId(orgId) });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const currentCredits = organization.creditBasedPlan?.creditsRemaining || 0;
    const newBalance = currentCredits + amount;

    if (newBalance < 0) {
      return NextResponse.json(
        { error: "Adjustment would result in negative balance" },
        { status: 400 }
      );
    }

    const transaction = {
      orgId,
      timestamp: new Date(),
      referenceId: `ADJ-${randomUUID().split("-")[0].toUpperCase()}`,
      type: "adjusted" as const,
      amount,
      balanceAfter: newBalance,
      adjustedBy: userEmail,
      adjustmentReason: reason || "Manual adjustment",
      createdAt: new Date(),
    };

    await db.collection("credit-transactions").insertOne(transaction);

    await db.collection("organizations").updateOne(
      { _id: new ObjectId(orgId) },
      {
        $set: {
          "creditBasedPlan.creditsRemaining": newBalance,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      message: "Credits adjusted successfully",
      newBalance,
      transaction,
    });
  } catch (error) {
    console.error("Error adjusting credits:", error);
    return NextResponse.json(
      { error: "Error adjusting credits" },
      { status: 500 }
    );
  }
});
