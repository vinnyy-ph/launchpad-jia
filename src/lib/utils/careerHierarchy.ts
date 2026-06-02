/**
 * Career Parent-Child Hierarchy Utilities
 * 
 * This module contains helper functions for managing parent-child job post relationships
 * and determining invite permissions and data transfer rules between related jobs.
 */

export interface PipelineStage {
  id: string;
  name: string;
  alias?: string;
  type?: "core" | "custom";
  enabled?: boolean;
  [key: string]: any;
}

export interface CareerHierarchyInfo {
  id: string;
  parentCareerID?: string | null;
  careerPostType?: "standalone" | "candidate_pool" | "receiving_pool" | string | null;
  pipelineStages?: PipelineStage[];
}

export interface InvitePermissionResult {
  allowed: boolean;
  transfer: boolean;
  fromJobId?: string;
  reason?: string;
}

/**
 * Determines if a candidate can be invited from a source career to a target career,
 * and if so, whether data should be transferred and from which job.
 * 
 * Rules:
 * - Target is end-to-end/parent: Always allowed, NO transfer
 * - Target is child: Always allowed, transfer from SOURCE career
 * 
 * Summary: Transfer happens when target is a child career. Source is always the source career.
 * 
 * @param sourceCareer - The career the candidate is being invited FROM
 * @param targetCareer - The career the candidate is being invited TO
 * @returns InvitePermissionResult with allowed status, transfer flag, and source job ID
 */
export function canInviteAndGetSource(
  sourceCareer: CareerHierarchyInfo,
  targetCareer: CareerHierarchyInfo
): InvitePermissionResult {
  // Target is parent or end-to-end - always allowed, NO transfer
  if (!isChildCareer(targetCareer)) {
    return { allowed: true, transfer: false };
  }

  // Target is a child - always allowed, transfer from SOURCE career
  return {
    allowed: true,
    transfer: true,
    fromJobId: sourceCareer.id
  };
}

/**
 * CV Screening fields to transfer when copying data from parent interview
 */
export const CV_SCREENING_TRANSFER_FIELDS = [
  'confidence',
  'cvScreeningReason',
  'cvSettingResult',
  'cvStatus',
  'jobFitScore',
] as const;

/**
 * AI Interview fields to transfer when copying data from parent interview
 */
export const AI_INTERVIEW_TRANSFER_FIELDS = [
  'analysis',
  'jobFit',
  'score',
  'summary',
] as const;

/**
 * All fields to transfer from parent interview to child interview
 */
export const ALL_TRANSFER_FIELDS = [
  ...CV_SCREENING_TRANSFER_FIELDS,
  ...AI_INTERVIEW_TRANSFER_FIELDS,
] as const;

/**
 * Extracts transferable fields from a source interview record
 * 
 * @param sourceInterview - The parent's interview record
 * @returns Object containing only the transferable fields that exist in the source
 */
export function extractTransferableFields(sourceInterview: Record<string, any>): Record<string, any> {
  const transferData: Record<string, any> = {};

  for (const field of ALL_TRANSFER_FIELDS) {
    if (sourceInterview[field] !== undefined) {
      transferData[field] = sourceInterview[field];
    }
  }

  return transferData;
}

/**
 * Checks if a career is a child (has a parent or is a legacy child post)
 * 
 * Backward compatible: handles legacy careers without parentCareerID/careerPostType fields
 * - Primary check: parentCareerID is a non-empty string
 * - Secondary check: careerPostType === "receiving_pool"
 * - Legacy fallback: first core stage (id="1") has enabled === false
 * - Default: false (treat as parent/end-to-end)
 */
export function isChildCareer(career: CareerHierarchyInfo): boolean {
  // Primary: Check parentCareerID (most reliable)
  if (typeof career.parentCareerID === "string" && career.parentCareerID.length > 0) {
    return true;
  }
  
  // Secondary: Check careerPostType (receiving_pool = child career)
  if (career.careerPostType === "receiving_pool") {
    return true;
  }
  
  // Legacy fallback: Check if first core stage is explicitly disabled
  // This catches legacy "child post" careers created before parent/child fields existed
  if (career.pipelineStages && Array.isArray(career.pipelineStages)) {
    const firstCoreStage = career.pipelineStages.find(stage => stage.id === "1");
    if (firstCoreStage && firstCoreStage.enabled === false) {
      return true;
    }
  }
  
  return false;
}

/**
 * Checks if a career is a parent or end-to-end (has no parent)
 * Note: This only checks if the career CAN be a parent, not if it HAS children
 */
export function isParentCareer(career: CareerHierarchyInfo): boolean {
  return !isChildCareer(career);
}
