export type CareerStatus =
  | "Active"
  | "On Hold"
  | "Completed"
  | "Cancelled"
  | "Unpublished";

export interface CareerMetrics {
  ongoing: number;
  dropped: number;
  hired: number;
}

export interface CareerSalaryRange {
  min: number | null;
  max: number | null;
  currency: string | null;
}

export interface CareerItem {
  id: string;
  title: string | null;
  postedOn: string | null;
  jobOwner: string | null;
  employmentType: string | null;
  workSetup: string | null;
  location: string | null;
  salaryRange: CareerSalaryRange;
  metrics: CareerMetrics;
  status: CareerStatus;
}
