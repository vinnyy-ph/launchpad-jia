import moment from "moment";
import type { QualityBreakdown } from "./AIInterviewSection/QualitiesBreakdownItem";

export const breakdownColorScheme = ["#9FCAED", "#CEB6DA", "#EBACC9", "#FCCEC0", "#E0DB96"] as const;
export const breakdownIcon = ["la-medal", "la-smile", "la-lightbulb", "la-microphone", "la-check-double"] as const;

export type CoreStages = "CV Screening" | "AI Interview" | "Human Interview";
export type ViewableStages = CoreStages | string;  // Allows both core and custom stage names

export type NameVisibility = "Full Name" | "Initials only" | "First name only";

type StageMeta = {
  pipelineStageIdx: number;
  stageId: string;
  substageId: string;
};

export type StageTab = {
  label: string;
  icon: string;
  fit?: string | number;
  humanEvaluation: string | null;
  evaluator: {
    image?: string;
    name?: string;
  };
  aiEvaluation: string | null;
  stageId: string;
  substageId: string;
};

export type StageAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  key: string;
  url: string;
  uploadedBy: {
    name: string;
    email: string;
    image?: string;
  };
  uploadedAt: string;
};

export type StageAttachmentBucket = {
  stageId: string;
  substageId: string;
  attachments: StageAttachment[];
};

export type PipelineSubstage = {
  id: string;
  name: string;
  currentStep?: string;
  status?: string;
};

export type PipelineStage = {
  id: string;
  name: string;
  alias?: string;
  icon?: string;
  type?: string;
  substages?: PipelineSubstage[];
};

export type InterviewData = {
  _id: string;
  name: string;
  image?: string;
  jobTitle: string;
  email?: string;
  createdAt: string | number | Date;
  pipelineStages: PipelineStage[];
  cvStatus?: string;
  jobFit?: string;
  cvScreeningReason?: string;
  summary?: string;
  interviewRecording?: {
    filetype?: string;
    filename?: string;
  } | null;
  interviewUpload?: unknown;
  interviewParts?: unknown[];
  analysis?: {
    overall_score?: number;
    final_assessment?: string;
    assessment_reason?: string;
    breakdown?: QualityBreakdown[];
  } | null;
  /** Stage attachments buckets (optional, may not exist if none uploaded) */
  stageAttachments?: StageAttachmentBucket[];
};

export type RecruiterEvaluation = {
  stageId: string;
  substageId: string;
  interviewUID: string;
  evaluationNotes: string;
  matchFit?: string;
  updatedBy: {
    name?: string;
    image?: string;
  };
};

export const employerAppURL = !process.env.NEXT_PUBLIC_EMPLOYER_APP_DOMAIN.includes("localhost")
  ? `https://${process.env.NEXT_PUBLIC_EMPLOYER_APP_DOMAIN}`
  : "http://localhost:3000";

export function adjustNameVisibility(nameVisibility: NameVisibility, name: string) {
  if (!name) return "";

  switch (nameVisibility) {
    case "First name only":
      return name.split(" ")[0];

    case "Initials only":
      return `${name
        .split(" ")
        .map((word: string) => word.charAt(0).toUpperCase())
        .join(". ")}.`;

    default:
      return name;
  }
}

export function redactNameFromContent(
  content: string,
  fullName: string,
  nameVisibility: NameVisibility
): string {
  if (!content || !fullName || nameVisibility === "Full Name") {
    return content;
  }

  const nameParts = fullName.trim().split(/\s+/);
  let redactedContent = content;
  
  const getReplacementForPart = (partIndex: number, isFullMatch: boolean = false): string => {
    if (isFullMatch) {
      return adjustNameVisibility(nameVisibility, fullName);
    }
    
    // For partial matches, replace based on which part it is
    if (nameVisibility === "Initials only") {
      return nameParts[partIndex].charAt(0).toUpperCase() + ".";
    } else if (nameVisibility === "First name only") {
      // Keep first name, hide others
      return partIndex === 0 ? nameParts[0] : nameParts[partIndex].charAt(0).toUpperCase() + ".";
    }
    return nameParts[partIndex];
  };
  
  // Replace in order of specificity (most specific first)
  // 1. Full name
  if (nameParts.length > 0) {
    const fullNamePattern = new RegExp(`\\b${nameParts.join('\\s+')}\\b`, 'gi');
    redactedContent = redactedContent.replace(fullNamePattern, () => getReplacementForPart(0, true));
  }
  
  // 2. First + Last
  if (nameParts.length > 1) {
    const firstLastPattern = new RegExp(
      `\\b${nameParts[0]}\\s+${nameParts[nameParts.length - 1]}\\b`, 
      'gi'
    );
    redactedContent = redactedContent.replace(firstLastPattern, () => getReplacementForPart(0, true));
  }
  
  // 3. Individual name parts (process from last to first to avoid conflicts)
  for (let idx = nameParts.length - 1; idx >= 0; idx--) {
    const part = nameParts[idx];
    
    // Skip very short names to avoid false positives
    const minLength = idx === 0 ? 2 : (idx === nameParts.length - 1 ? 3 : 2);
    if (part.length <= minLength) continue;
    
    const partPattern = new RegExp(`\\b${part}\\b`, 'gi');
    redactedContent = redactedContent.replace(partPattern, () => getReplacementForPart(idx));
  }
  
  return redactedContent;
}

export function getInterviewDuration(start?: number, end?: number) {
  const duration = moment.duration(moment(end).diff(moment(start)));
  const minutes = Math.floor(duration.asMinutes());
  const seconds = Math.floor(duration.asSeconds() % 60);

  return `${minutes}m ${seconds}s`;
}

export function getMatchFit(
  interviewData: InterviewData,
  evaluation: RecruiterEvaluation | undefined,
  stageId: string,
) {
  if (!evaluation) {
    return stageId === "1" ? interviewData.cvStatus : stageId === "2" ? interviewData.jobFit : undefined;
  }

  return evaluation.matchFit;
}

export function getTabDetails(
  interviewData: InterviewData,
  evaluations: Array<RecruiterEvaluation>,
  stageId: string,
  stageName: string,
): StageTab {
  const evaluation = evaluations.find(
    (e) => e.stageId === stageId && e.interviewUID === interviewData._id
  );

  const stage = interviewData.pipelineStages?.find(s => s.id === stageId);

  const substages = stage?.substages ?? [];
  const substageId = substages.length > 0 ? substages[substages.length - 1].id : "";

  return {
    label: stageName,
    icon: stage?.icon ?? "",
    fit: getMatchFit(interviewData, evaluation, stageId),
    humanEvaluation: evaluation ? evaluation.evaluationNotes : null,
    evaluator: {
      image: evaluation?.updatedBy?.image,
      name: evaluation?.updatedBy?.name,
    },
    aiEvaluation: stageId === "1" 
      ? interviewData.cvScreeningReason ?? null 
      : stageId === "2" 
      ? interviewData.analysis?.assessment_reason ?? null 
      : null,
    stageId,
    substageId,
  };
}

export function hasBreakdown(analysis?: InterviewData["analysis"]) {
  return Array.isArray(analysis?.breakdown) && analysis.breakdown.length > 0;
}

export function formatDate (date: string | number | Date) {
  return new Date(date instanceof Date ? date.toISOString() : date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
