export type RequisitionStatus = 
  | "Requires More Info" 
  | "In Review" 
  | "Active" 
  | "Completed" 
  | "On Hold" 
  | "Cancelled" 
  | "Request to Cancel";

export interface RequisitionFormData {
  positionName: string;
  jobDescription: string;
  headcount: string;
  workArrangement: string;
  workDays?: string;
  officeLocation: {
    country: string;
    stateProvince: string;
    city: string;
  };
  salaryRange: {
    min: string;
    max: string;
    currency: string;
  };
  employmentType: string;
  duration?: {
    value: string;
    unit: string;
  };
  reason: string;
}

export interface RequisitionItem {
  id: string;
  positionName: string;
  referenceNo: string;
  dateSubmitted: string;
  status: RequisitionStatus;
  submittedBy?: {
    name: string;
    email: string;
    avatar?: string;
  };
  isLink?: boolean;
  hasWarning?: boolean;
  warningMessage?: string;
  cancelReason?: string;
  moreInfoReason?: string;
  moreInfoBy?: string;
  moreInfoByEmail?: string;
  moreInfoByAvatar?: string;
  formData?: RequisitionFormData;
}
