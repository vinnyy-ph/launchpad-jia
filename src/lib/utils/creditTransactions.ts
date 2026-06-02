import { Db, ObjectId } from "mongodb";
import { randomUUID } from "crypto";
import { CREDIT_THRESHOLDS } from "./constants";

/**
 * Credit balance status for an organization.
 */
export interface CreditBalanceStatus {
  balance: number;
  /** True if balance <= LOW_BALANCE (50) - triggers warnings and defers auto-promotions */
  isLowCredit: boolean;
  /** True if balance < INSUFFICIENT (10) - blocks manual moves to AI Interview */
  isInsufficient: boolean;
}

export interface RecordCreditTransactionParams {
  db: Db;
  orgId: string;
  type: "used" | "refunded" | "renewal" | "adjusted";
  amount: number;
  careerId?: string;
  careerTitle?: string;
  candidateId?: string;
  candidateName?: string;
  adjustedBy?: string;
  adjustmentReason?: string;
}

export async function recordCreditTransaction({
  db,
  orgId,
  type,
  amount,
  careerId,
  careerTitle,
  candidateId,
  candidateName,
  adjustedBy,
  adjustmentReason,
}: RecordCreditTransactionParams): Promise<{ success: boolean; newBalance: number; error?: string }> {
  try {
    // Generate UUID-based reference ID for uniqueness
    const referenceId = `TXN-${randomUUID().split("-")[0].toUpperCase()}`;

    // Use atomic findOneAndUpdate to prevent race conditions
    // For deductions (negative amounts), ensure we don't go below 0
    // Also ensure org is active for credit operations
    const query: Record<string, unknown> = {
      _id: new ObjectId(orgId),
      status: "active", // Only allow credit operations on active orgs
    };

    // For "used" type (deductions), add condition to ensure sufficient balance
    if (type === "used" && amount < 0) {
      query["creditBasedPlan.creditsRemaining"] = { $gte: Math.abs(amount) };
    }

    const updateResult = await db.collection("organizations").findOneAndUpdate(
      query,
      {
        $inc: { "creditBasedPlan.creditsRemaining": amount },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: "after" }
    );

    if (!updateResult) {
      // Check if org exists to give appropriate error
      const orgExists = await db
        .collection("organizations")
        .findOne({ _id: new ObjectId(orgId) });

      if (!orgExists) {
        return { success: false, newBalance: 0, error: "Organization not found" };
      }

      // Check if org is inactive
      if (orgExists.status !== "active") {
        return {
          success: false,
          newBalance: orgExists.creditBasedPlan?.creditsRemaining || 0,
          error: "Organization is inactive"
        };
      }

      // Org exists and is active but update failed - means insufficient credits
      return {
        success: false,
        newBalance: orgExists.creditBasedPlan?.creditsRemaining || 0,
        error: "Insufficient credits"
      };
    }

    const newBalance = Math.max(0, updateResult.creditBasedPlan?.creditsRemaining || 0);

    // Ensure balance doesn't go negative (safety net)
    if (newBalance < 0) {
      // Rollback the increment
      await db.collection("organizations").updateOne(
        { _id: new ObjectId(orgId) },
        { $inc: { "creditBasedPlan.creditsRemaining": -amount } }
      );
      return { success: false, newBalance: 0, error: "Insufficient credits" };
    }

    const transaction = {
      orgId,
      timestamp: new Date(),
      referenceId,
      type,
      amount,
      balanceAfter: newBalance,
      careerId,
      careerTitle,
      candidateId,
      candidateName,
      adjustedBy,
      adjustmentReason,
      createdAt: new Date(),
    };

    await db.collection("credit-transactions").insertOne(transaction);

    return { success: true, newBalance };
  } catch (error) {
    console.error("Error recording credit transaction:", error);
    return { success: false, newBalance: 0, error: "Failed to record transaction" };
  }
}

export async function recordCreditUsed(
  db: Db,
  orgId: string,
  careerId: string,
  careerTitle: string,
  candidateId: string,
  candidateName: string
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  return recordCreditTransaction({
    db,
    orgId,
    type: "used",
    amount: -10,
    careerId,
    careerTitle,
    candidateId,
    candidateName,
  });
}

export async function recordCreditRefunded(
  db: Db,
  orgId: string,
  careerId: string,
  careerTitle: string,
  candidateId: string,
  candidateName: string
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  return recordCreditTransaction({
    db,
    orgId,
    type: "refunded",
    amount: 10,
    careerId,
    careerTitle,
    candidateId,
    candidateName,
  });
}

export async function recordCreditRenewal(
  db: Db,
  orgId: string,
  creditsToAdd: number
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  return recordCreditTransaction({
    db,
    orgId,
    type: "renewal",
    amount: creditsToAdd,
  });
}

/**
 * Check an organization's credit balance and return status flags.
 * @param db - MongoDB database instance
 * @param orgId - Organization ID
 * @returns Credit balance status with isLowCredit and isInsufficient flags
 */
export async function checkOrgCreditBalance(
  db: Db,
  orgId: string
): Promise<CreditBalanceStatus> {
  const organization = await db
    .collection("organizations")
    .findOne({ _id: new ObjectId(orgId) });

  // Credits are stored in the nested creditBasedPlan structure
  const balance = organization?.creditBasedPlan?.creditsRemaining ?? 0;

  return {
    balance,
    isLowCredit: balance <= CREDIT_THRESHOLDS.LOW_BALANCE,
    isInsufficient: balance < CREDIT_THRESHOLDS.INSUFFICIENT,
  };
}

/**
 * Interview document shape for credit tracking (partial).
 */
interface InterviewForCredit {
  _id: ObjectId | string;
  creditChargedForAIInterview?: boolean;
  creditRefundedForAIInterview?: boolean;
  creditDeferred?: boolean;
  name?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Career document shape for credit tracking (partial).
 */
interface CareerForCredit {
  _id: ObjectId | string;
  title?: string;
  jobTitle?: string;
}

/**
 * Check if a candidate should be charged for AI Interview.
 * Returns true if candidate has NOT been charged, OR was previously refunded.
 * @param interview - Interview document with credit tracking fields
 */
export function canChargeForAIInterview(interview: InterviewForCredit): boolean {
  // If never charged, should charge
  if (!interview.creditChargedForAIInterview) {
    return true;
  }
  // If was charged but then refunded, should charge again
  if (interview.creditRefundedForAIInterview) {
    return true;
  }
  // Already charged and not refunded - don't charge again
  return false;
}

/**
 * Deduct 10 credits for AI Interview entry and update interview flags.
 * @param db - MongoDB database instance
 * @param orgId - Organization ID
 * @param interview - Interview document
 * @param career - Career document
 * @returns Transaction result with new balance
 */
export async function deductCreditForInterview(
  db: Db,
  orgId: string,
  interview: InterviewForCredit,
  career: CareerForCredit
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const interviewId = typeof interview._id === "string" ? interview._id : interview._id.toString();
  const careerId = typeof career._id === "string" ? career._id : career._id.toString();
  const candidateName = interview.name || `${interview.firstName || ""} ${interview.lastName || ""}`.trim() || "Unknown";
  const careerTitle = career.title || career.jobTitle || "Unknown Career";

  const claimResult = await db.collection("interviews").updateOne(
    {
      _id: new ObjectId(interviewId),
      $or: [
        { creditChargedForAIInterview: { $ne: true } },
        { creditRefundedForAIInterview: true }
      ]
    },
    {
      $set: {
        creditChargedForAIInterview: true,
        creditRefundedForAIInterview: false,
        creditDeferred: false,
      },
    }
  );

  if (claimResult.matchedCount === 0) {
    // Already charged by an overlapping request
    return { success: true, newBalance: 0 };
  }

  // Record the actual credit transaction for the organization
  const result = await recordCreditTransaction({
    db,
    orgId,
    type: "used",
    amount: -CREDIT_THRESHOLDS.INTERVIEW_COST,
    careerId,
    careerTitle,
    candidateId: interviewId,
    candidateName,
  });

  if (!result.success) {
    // ROLLBACK interview flags if organization credit deduction failed
    await db.collection("interviews").updateOne(
      { _id: new ObjectId(interviewId) },
      {
        $set: {
          creditChargedForAIInterview: false,
        },
      }
    );
    return result;
  }

  return result;
}

/**
 * Refund 10 credits for a dropped candidate (before interview was taken).
 * @param db - MongoDB database instance
 * @param orgId - Organization ID
 * @param interview - Interview document
 * @param career - Career document
 * @returns Transaction result with new balance
 */
export async function refundCreditForInterview(
  db: Db,
  orgId: string,
  interview: InterviewForCredit,
  career: CareerForCredit
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const interviewId = typeof interview._id === "string" ? interview._id : interview._id.toString();
  const careerId = typeof career._id === "string" ? career._id : career._id.toString();
  const candidateName = interview.name || `${interview.firstName || ""} ${interview.lastName || ""}`.trim() || "Unknown";
  const careerTitle = career.title || career.jobTitle || "Unknown Career";

  // ATOMIC CLAIM: Try to set creditRefundedForAIInterview: true ONLY IF it was charged and NOT refunded yet
  // This prevents double refunds in race conditions.
  const claimResult = await db.collection("interviews").updateOne(
    {
      _id: new ObjectId(interviewId),
      creditChargedForAIInterview: true,
      creditRefundedForAIInterview: { $ne: true }
    },
    {
      $set: {
        creditRefundedForAIInterview: true,
      },
    }
  );

  if (claimResult.matchedCount === 0) {
    // Already refunded or not charged
    return { success: true, newBalance: 0 };
  }

  // Record the credit refund transaction
  const result = await recordCreditTransaction({
    db,
    orgId,
    type: "refunded",
    amount: CREDIT_THRESHOLDS.INTERVIEW_COST,
    careerId,
    careerTitle,
    candidateId: interviewId,
    candidateName,
  });

  if (!result.success) {
    // ROLLBACK refund flag if credit transaction failed
    await db.collection("interviews").updateOne(
      { _id: new ObjectId(interviewId) },
      {
        $set: {
          creditRefundedForAIInterview: false,
        },
      }
    );
    return result;
  }

  return result;
}
