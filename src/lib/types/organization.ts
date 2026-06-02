/**
 * Organization-related TypeScript interfaces
 */

/**
 * Credit tracking fields for interview documents.
 * Used to track credit deductions/refunds for AI Interview stage.
 */
export interface InterviewCreditTracking {
  /** True if 10 credits were deducted for this candidate entering AI Interview */
  creditChargedForAIInterview?: boolean;
  /** True if credits were refunded (candidate dropped before taking interview) */
  creditRefundedForAIInterview?: boolean;
  /** True if auto-promotion was deferred due to low credit balance (≤50) */
  creditDeferred?: boolean;
  /** True once candidate has attempted AI interview (immutable for billing) */
  aiInterviewEverAttempted?: boolean;
  /** Timestamp of first AI interview attempt */
  aiInterviewEverAttemptedAt?: number | null;
  /** Timestamp when AI interview was explicitly completed */
  aiInterviewCompletedAt?: number | null;
  /** Legacy completion boolean retained for compatibility */
  interviewCompleted?: boolean;
}

export interface CreditTransaction {
  _id?: string;
  orgId: string;
  timestamp: Date;
  referenceId: string;
  type: "used" | "refunded" | "renewal" | "adjusted";
  amount: number;
  balanceAfter: number;
  careerId?: string;
  careerTitle?: string;
  candidateId?: string;
  candidateName?: string;
  adjustedBy?: string;
  adjustmentReason?: string;
  createdAt: Date;
}

export interface PlanHistoryEntry {
  planId: string;
  planName: string;
  schemaType: "credit-based" | "premium";
  startDate: Date;
  endDate: Date;
  action: "Applied Plan" | "Edited Plan Schedule";
  appliedBy: string;
  appliedByAvatar?: string;
  appliedAt: Date;
}

/**
 * Nested structure for credit-based plan assignment
 */
export interface CreditBasedPlanAssignment {
  planId: string;
  startDate: Date;
  endDate?: Date;
  creditsRemaining: number;
}

/**
 * Nested structure for premium plan assignment
 */
export interface PremiumPlanAssignment {
  planId: string;
  startDate: Date;
  endDate?: Date;
  /** Per-org adjustment to premium plan's maxActiveJobPosts (can be positive or negative) */
  jobSlotAdjustment?: number;
}

export interface OrganizationPlanAssignment {
  // Nested plan structure (single source of truth)
  creditBasedPlan?: CreditBasedPlanAssignment;
  premiumPlan?: PremiumPlanAssignment;

  /** Credit balance at the start of current billing period (for accurate usage calculation) */
  creditBalanceAtRenewal?: number;

  // Pending plans (keep flat for now - separate cleanup)
  /** Credits waiting for plan activation (when startDate > now) */
  pendingCredits?: number;
  /** Credits frozen from ended credit-based plan, added to next credit-based plan */
  frozenCredits?: number;
  nextRenewalDate?: Date;
  planHistory?: PlanHistoryEntry[];
}

export interface Organization extends OrganizationPlanAssignment {
  _id?: string;
  name: string;
  description?: string;
  status: "active" | "inactive";
  tier?: string;
  country?: string;
  province?: string;
  city?: string;
  address?: string; // Legacy address field
  organizationAddress?: OrganizationAddress[]; // New multi-location address field
  image?: string;
  coverImage?: string;
  documents?: OrganizationDocument[];
  companySlug?: string;
  brandedJobPortalSubdomain?: string;
  companyDomains?: string[];
  defaultCurrency?: string;
  defaultSalaryUnit?: string;

  // Direct feature flags (single source of truth)
  projectsEnabled?: boolean;
  guestPortalEnabled?: boolean;
  brandedPortalEnabled?: boolean;
  globalHiringEnabled?: boolean;
  linkedCareersEnabled?: boolean;

  creator?: string;
  members?: OrganizationMember[];
}

export interface OrganizationAddress {
  country: string;
  province?: string;
  city?: string;
  address?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  isMarkedHQ: boolean;
  isGPS?: boolean;
  createdBy?: UserInfo;
  lastEditedBy?: UserInfo;
  createdAt?: Date;
  updatedAt?: Date;
  members?: OrganizationMember[];
}

export interface OrganizationDocument {
  name: string;
  filename: string;
  filePath: string;
  fileType: string;
}

export interface UserInfo {
  image?: string;
  name: string;
  email: string;
}

export interface OrganizationMember {
  _id?: string;
  image?: string;
  name?: string;
  email: string;
  orgID: string;
  role: "hiring_manager" | "admin" | "super_admin";
  careers?: string[];
  addedAt?: Date;
  lastLogin?: Date | null;
  location?: string;
  latitude?: number;
  longitude?: number;
  status?: "invited" | "active";
}

// Import and re-export PricingPlan from pricing.ts to avoid duplication
import type { PricingPlan } from "./pricing";
export type { PricingPlan } from "./pricing";

export interface OrgPlanDetails {
  organization: Organization;
  plan: PricingPlan | null;
  usage: {
    creditsUsed?: number;
    creditsTotal?: number;
    activeJobPosts?: number;
    maxJobPosts?: number | null; // null = unlimited
    adminSeatsUsed: number;
    maxAdminSeats: number | null; // null = unlimited
  };
}
