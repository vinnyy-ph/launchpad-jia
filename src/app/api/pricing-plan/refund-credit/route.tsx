import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId } from "mongodb";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";
import { refundCreditForInterview } from "@/lib/utils/creditTransactions";

/**
 * POST /api/pricing-plan/refund-credit
 * Refunds 10 credits for a dropped candidate (before interview was taken).
 * 
 * Request body:
 * - candidateId: string - Interview document ID
 * - careerId: string - Career document ID
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { candidateId, careerId } = await request.json();

    if (!candidateId || !careerId) {
      console.error("[refund-credit] Missing required data: candidateId or careerId");
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

    // Check if candidate was charged and not already refunded
    if (!interview.creditChargedForAIInterview) {
      return NextResponse.json({
        success: true,
        message: "Candidate was not charged, no refund needed",
        noRefundNeeded: true,
      });
    }

    if (interview.creditRefundedForAIInterview) {
      return NextResponse.json({
        success: true,
        message: "Candidate was already refunded",
        alreadyRefunded: true,
      });
    }

    const hasEverAttempted = interview.aiInterviewEverAttempted === true;
    // Check if interview was taken (explicit completion or analysis generated)
    const hasInterviewTaken =
      !!interview.analysisResult ||
      interview.interviewCompleted === true ||
      !!interview.aiInterviewCompletedAt;

    if (hasEverAttempted || hasInterviewTaken) {
      return NextResponse.json({
        success: true,
        message: "Interview was attempted or completed, no refund applicable",
        interviewTaken: hasInterviewTaken,
        interviewAttempted: hasEverAttempted,
      });
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

    // Check if organization has an active credit-based plan (with 14-hour buffer)
    const organization = await db
      .collection("organizations")
      .findOne({ _id: new ObjectId(userOrgId) });

    if (organization) {
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
        return NextResponse.json({
          success: true,
          message: "No active credit-based plan, no refund needed",
          noActivePlan: true,
        });
      }
    }

    // Refund credits
    const result = await refundCreditForInterview(db, userOrgId, interview, career);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to refund credits" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
      creditsRefunded: 10,
    });
  } catch (error) {
    console.error("Error refunding credit:", error);
    return NextResponse.json(
      { error: "Error refunding credit" },
      { status: 500 }
    );
  }
});
