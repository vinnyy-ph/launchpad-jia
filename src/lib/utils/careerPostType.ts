import { guid } from "@/lib/Utils";
import { DEFAULT_JOB_PIPELINE } from "./constants";

// ============================================================================
// Types
// ============================================================================

export type CareerPostType = "standalone" | "candidate_pool" | "receiving_pool" | null;

// ============================================================================
// Labels and Descriptions
// ============================================================================

export const END_TO_END_LABEL = "End-to-end Career";
export const END_TO_END_DESCRIPTION =
  "An end-to-end job post from CV screening to Job Offer";

export const LINKED_CAREER_LABEL = "Linked Career";
export const LINKED_CAREER_DESCRIPTION =
  "A linked job post that separates the early and the later stages into separate job posts. This allows you to pool candidates for a broad requirement into a parent post, and then distribute them to child posts for more specific requirement.";

export const PARENT_POST_LABEL = "Parent Post";
export const PARENT_POST_DESCRIPTION =
  "Contains the early stages of a career pipeline including CV Screening and AI Interview";

export const CHILD_POST_LABEL = "Child Post";
export const CHILD_POST_DESCRIPTION =
  "Contains the later stages of a career pipeline including HM Interview and Job Offer";

// ============================================================================
// Custom Pipeline Stages
// ============================================================================

/**
 * Custom stages for Parent Post careers.
 * These are inserted after AI Interview and before Human Interview.
 */
const CANDIDATE_POOL_CUSTOM_STAGES = [
  {
    id: guid(),
    name: "HR Interview",
    type: "custom",
    substages: [
      { id: guid(), name: "Waiting Schedule", currentStep: "HR Interview", status: "Waiting Schedule" },
      { id: guid(), name: "Waiting Interview", currentStep: "HR Interview", status: "Waiting Interview" },
      { id: guid(), name: "For Review", currentStep: "HR Interview", status: "For Review" },
    ],
    autoEndorse: "None",
    autoDrop: "None",
  },
  {
    id: guid(),
    name: "Transferred to Client Project",
    type: "custom",
    substages: [
      { id: guid(), name: "Transferred to Client Project", currentStep: "Transferred to Client Project", status: "Transferred to Client Project" },
    ],
    autoEndorse: "None",
    autoDrop: "None",
  },
];

/**
 * Custom stages for Child Post careers.
 * These are inserted after AI Interview and before Human Interview.
 */
const RECEIVING_POOL_CUSTOM_STAGES = [
  {
    id: guid(),
    name: "Client Interview",
    type: "custom",
    substages: [
      { id: guid(), name: "Waiting Schedule", currentStep: "Client Interview", status: "Waiting Schedule" },
      { id: guid(), name: "Waiting Interview", currentStep: "Client Interview", status: "Waiting Interview" },
      { id: guid(), name: "For Review", currentStep: "Client Interview", status: "For Review" },
    ],
    autoEndorse: "None",
    autoDrop: "None",
  },
];

// ============================================================================
// Pipeline Builder Functions
// ============================================================================

/**
 * Build pipeline for Parent Post careers.
 * 
 * Stage configuration:
 * - CV Screening (1): enabled, cannot be disabled
 * - AI Interview (2): enabled, can be disabled
 * - HR Interview (custom): enabled
 * - Transferred to Client Project (custom): enabled
 * - Human Interview (3): disabled, can be re-enabled
 * - Job Offer (4): disabled, cannot be re-enabled
 */
export function buildCandidatePoolPipeline(): any[] {
  const basePipeline = JSON.parse(JSON.stringify(DEFAULT_JOB_PIPELINE));
  
  basePipeline[2].enabled = false; // Human Interview
  basePipeline[3].enabled = false; // Job Offer
  
  // Create fresh copies of custom stages with new GUIDs
  const customStages = JSON.parse(JSON.stringify(CANDIDATE_POOL_CUSTOM_STAGES)).map((stage: any) => ({
    ...stage,
    id: guid(),
    substages: stage.substages.map((sub: any) => ({ ...sub, id: guid() })),
  }));
  
  return [
    basePipeline[0], // CV Screening
    basePipeline[1], // AI Interview
    ...customStages, // HR Interview, Transferred to Client Project
    basePipeline[2], // Human Interview (disabled)
    basePipeline[3], // Job Offer (disabled)
  ];
}

/**
 * Build pipeline for Child Post careers.
 * 
 * Stage configuration:
 * - CV Screening (1): disabled, cannot be re-enabled
 * - AI Interview (2): disabled, cannot be re-enabled
 * - Client Interview (custom): enabled
 * - Human Interview (3): enabled, can be disabled/enabled
 * - Job Offer (4): enabled, can be disabled/enabled
 */
export function buildReceivingPoolPipeline(): any[] {
  const basePipeline = JSON.parse(JSON.stringify(DEFAULT_JOB_PIPELINE));
  
  basePipeline[0].enabled = false; // CV Screening
  basePipeline[1].enabled = false; // AI Interview
  
  // Create fresh copies of custom stages with new GUIDs
  const customStages = JSON.parse(JSON.stringify(RECEIVING_POOL_CUSTOM_STAGES)).map((stage: any) => ({
    ...stage,
    id: guid(),
    substages: stage.substages.map((sub: any) => ({ ...sub, id: guid() })),
  }));
  
  return [
    basePipeline[0], // CV Screening (disabled)
    basePipeline[1], // AI Interview (disabled)
    ...customStages, // Client Interview
    basePipeline[2], // Human Interview
    basePipeline[3], // Job Offer
  ];
}

/**
 * Build pipeline for End-to-end careers (standalone default pipeline).
 */
export function buildStandalonePipeline(): any[] {
  return JSON.parse(JSON.stringify(DEFAULT_JOB_PIPELINE));
}

/**
 * Build the appropriate pipeline based on career post type.
 */
export function buildPipelineForType(careerPostType: CareerPostType): any[] {
  switch (careerPostType) {
    case "candidate_pool":
      return buildCandidatePoolPipeline();
    case "receiving_pool":
      return buildReceivingPoolPipeline();
    case "standalone":
    default:
      return buildStandalonePipeline();
  }
}
