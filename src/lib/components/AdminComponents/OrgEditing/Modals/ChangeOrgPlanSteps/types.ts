export interface PlanOption {
  id: string;
  name: string;
  schema: "credit-based" | "premium";
  costPerMonth: number;
  creditsPerMonth?: number;
  maxActiveJobPosts: number | null;
  maxAdminSeats: number | null;
  maxGuestHMSeats: number | null;
  additionalJobPostCost?: number;
}

export interface CurrentPlanDisplay {
  id: string;
  name: string;
  schema: "credit-based" | "premium";
  startedOn: string;
  endsOn: string;
  costPerMonth: number;
  creditsPerMonth?: number;
  maxActiveJobPosts: number | null;
  maxAdminSeats: number | null;
  maxGuestHMSeats: number | null;
}
