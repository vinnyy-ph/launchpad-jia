// Shared hooks for ViewCareer components
export { useCVData } from "./useCVData";
export type { CVDataResult } from "./useCVData";

export { useOrgSkills } from "./useOrgSkills";
export type { OrgSkillsResult } from "./useOrgSkills";

export { useInterviewData } from "./useInterviewData";
export type { InterviewDataResult } from "./useInterviewData";

export { useRegenerateCV } from "./useRegenerateCV";
export type { RegenerateCVResult } from "./useRegenerateCV";

// Cache provider and hook for shared candidate data
export { CandidateCacheProvider, useCandidateCache } from "./CandidateCacheContext";
export type { CandidateCache } from "./CandidateCacheContext";

// Utility functions
export {
  extractSkillsFromCv,
  sanitizeLocation,
  getCVSectionContent,
  hasValidCVData,
  getDigitalCV,
} from "./cvUtils";

// Reusable components
export { DownloadCVButton } from "./DownloadCVButton";
export { RegenerateButton } from "./RegenerateButton";
