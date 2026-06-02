import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import {
  checkOrgCreditBalance,
  deductCreditForInterview,
  canChargeForAIInterview,
} from "@/lib/utils/creditTransactions";

/**
 * POST /api/pricing-plan/deduct-credit
 * Deducts 10 credits for AI Interview entry.
 * 
 * Request body:
 * - candidateId: string - Interview document ID
 * - careerId: string - Career document ID
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { candidateId, careerId } = await request.json();

    if (!candidateId || !careerId) {
      console.error("[deduct-credit] Missing required data: candidateId or careerId");
      return NextResponse.json(
        { error: "Missing required data" },
        { status: 400 }
      );
    }

    const { db } = await connectMongoDB();

    // Get user email from authenticated session
    const userEmail = request.user?.email;
    if (!userEmail) {
      return NextResponse.json(
        { error: "User email not found in session" },
        { status: 401 }
      );
    }

    // Try to get orgID from user session first
    let userOrgId = request.user?.orgID || (request.user as any)?.orgId;

    // If not found in session, look up from members collection
    if (!userOrgId) {
      const member = await db.collection("members").findOne({ email: userEmail });
      if (member) {
        userOrgId = member.orgID || member.organizationId;
      }
    }

    if (!userOrgId) {
      return NextResponse.json(
        { error: "Organization not found for user" },
        { status: 400 }
      );
    }

    // Check if organization has an active credit-based plan
    const organization = await db
      .collection("organizations")
      .findOne({ _id: new ObjectId(userOrgId) });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const now = new Date();
    const BUFFER_MS = 14 * 60 * 60 * 1000;
    const nowWithBuffer = new Date(now.getTime() + BUFFER_MS);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const creditBasedPlan = organization.creditBasedPlan;
    const isCreditActive =
      creditBasedPlan?.planId &&
      creditBasedPlan.startDate &&
      new Date(creditBasedPlan.startDate) <= nowWithBuffer &&
      (!creditBasedPlan.endDate || new Date(creditBasedPlan.endDate) >= todayStart);

    if (!isCreditActive) {
      return NextResponse.json(
        { error: "AI Interview requires an active plan." },
        { status: 403 }
      );
    }

    // Check if org has sufficient credits
    const creditStatus = await checkOrgCreditBalance(db, userOrgId);

    if (creditStatus.isInsufficient) {
      return NextResponse.json(
        { error: "Insufficient credits to move candidate to AI Interview" },
        { status: 402 }
      );
    }

    // Fetch interview document
    const interview = await db
      .collection("interviews")
      .findOne({ _id: new ObjectId(candidateId) });

    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    // Fetch career document
    const career = await db
      .collection("careers")
      .findOne({ _id: new ObjectId(careerId) });

    if (!career) {
      return NextResponse.json(
        { error: "Career not found" },
        { status: 404 }
      );
    }

    // Check if candidate should be charged
    if (!canChargeForAIInterview(interview)) {
      return NextResponse.json({
        success: true,
        message: "Candidate already charged for this career",
        alreadyCharged: true,
        balance: creditStatus.balance,
      });
    }

    // Deduct credits
    const result = await deductCreditForInterview(db, userOrgId, interview, career);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to deduct credits" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
      creditsDeducted: 10,
    });
  } catch (error) {
    console.error("Error deducting credit:", error);
    return NextResponse.json(
      { error: "Error deducting credit" },
      { status: 500 }
    );
  }
});

