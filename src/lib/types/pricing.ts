export interface PricingPlan {
  _id?: string;
  name: string;
  schema: "credit-based" | "premium";
  status: "published" | "unpublished";
  
  // Common fields
  costPerMonth: number;
  maxActiveJobPosts: number | null; // null = unlimited
  maxAdminSeats: number | null; // null = unlimited
  maxGuestHMSeats: number | null; // null = unlimited
  
  // Credit-based only
  creditsPerMonth?: number;
  
  // Premium only
  costPerYear?: number;
  additionalJobPostCost?: number;
  
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface PricingPlanFormData {
  name: string;
  schema: "credit-based" | "premium";
  costPerMonth: number;
  maxActiveJobPosts: number | null; // null = unlimited
  maxAdminSeats: number | null; // null = unlimited
  maxGuestHMSeats: number | null; // null = unlimited
  creditsPerMonth?: number;
  costPerYear?: number;
  additionalJobPostCost?: number;
}

export const DEFAULT_PRICING_PLAN: PricingPlanFormData = {
  name: "",
  schema: "credit-based",
  costPerMonth: 0,
  maxActiveJobPosts: null, // null = unlimited
  maxAdminSeats: null, // null = unlimited
  maxGuestHMSeats: null, // null = unlimited
  creditsPerMonth: 0,
};
