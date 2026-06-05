/**
 * Shared TypeScript interfaces for the Projects module
 */

export interface Member {
  _id: string;
  email: string;
  name: string;
  image: string;
}

export interface Project {
  _id: string;
  name: string;
  owner: Member;
  members: Member[];
  careers?: string[];
  orgID?: string;
  createdBy?: Member;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BadgeCounts {
  newComments: number;
  importantActions: number;
}

export interface Career {
  _id: string;
  jobTitle: string;
  status?: string;
  archived?: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  createdAt?: string;
  lastActivityAt?: string;
  orgID?: string;
  interviewsInProgress?: number;
  dropped?: number;
  hired?: number;
  badges?: BadgeCounts;
}
