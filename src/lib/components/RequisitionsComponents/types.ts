import type { CSSProperties } from "react";

export type RequisitionStatus =
  | "In Review"
  | "Requires More Info"
  | "Active"
  | "On Hold"
  | "Cancelled"
  | "Request to Cancel";

export type Requisition = {
  id: string;
  positionName: string;
  referenceNo: string;
  dateSubmitted: string;
  status: RequisitionStatus;
  previousStatus?: RequisitionStatus;
  cancelRequestPreviousStatus?: RequisitionStatus;
  approvalCareerId?: string;
  submittedBy: {
    name: string;
    email: string;
    avatar: string;
  };
  moreInfoReason?: string;
  moreInfoBy?: string;
  cancelReason?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  viewedBy?: string[];
  badges?: {
    isNew: boolean;
    isUpdated: boolean;
  };
  formData?: {
    positionName?: string;
    jobDescription?: string;
    headcount?: string;
    workArrangement?: string;
    workDays?: string;
    officeLocation?: {
      country?: string;
      stateProvince?: string;
      city?: string;
    };
    salaryRange?: {
      min?: string;
      max?: string;
      currency?: string;
    };
    employmentType?: string;
    duration?: {
      value?: string;
      unit?: string;
    } | string;
    reason?: string;
  };
};

export interface RequisitionBadgeCounts {
  isNew: boolean;
  isUpdated: boolean;
}

export type StatusPillStyles = Record<RequisitionStatus, CSSProperties>;

export const statusPillStyles: StatusPillStyles = {
  "In Review": { background: "#EEF4FF", color: "#3538CD", border: "1px solid #C7D7FE" },
  "Requires More Info": { background: "#FFFAEB", color: "#B54708", border: "1px solid #FEDF89" },
  Active: { background: "#ECFDF3", color: "#027948", border: "1px solid #A6F4C5" },
  "On Hold": { background: "#F5F5F5", color: "#414651", border: "1px solid #E9EAEB" },
  Cancelled: { background: "#FEF3F2", color: "#B32318", border: "1px solid #FECDCA" },
  "Request to Cancel": { background: "rgba(255, 241, 243, 1)", color: "rgba(192, 16, 72, 1)", border: "1px solid rgba(254, 204, 214, 1)" },
};
