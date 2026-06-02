// Career validation and sanitization utilities
// These helpers centralize the validation and sanitization logic that was previously
// duplicated in `upsert-career/route.tsx`.

import { objectContainsSuspiciousPatterns, sanitizeString, sanitizeQuestions, sanitizeObject } from "@/lib/utils/sanitizeInput";

export const DUPLICATE_CHILD_TITLE_ERROR =
  "Child Title already exists for this parent post.";

/**
 * Validate required fields and return an error object if validation fails.
 * Returns `null` when validation passes.
 */
export function validateCareerInput(data: any): { error: string; status: number } | null {
  const {
    jobTitle,
    description,
    questions,
    location,
    workSetup,
    id,
  } = data;

  if (!jobTitle || !description || !questions || !location || !workSetup || !id) {
    return {
      error: "Job title, description, questions, location and work setup are required",
      status: 400,
    };
  }

  // Check for suspicious patterns
  const inputData = { jobTitle, description, questions, workSetup, location };
  if (objectContainsSuspiciousPatterns(inputData)) {
    return {
      error: "Input contains potentially dangerous content. Please remove scripts, HTML event handlers, or other executable code.",
      status: 400,
    };
  }

  // Additional pipeline stage validation can be performed by callers if needed.
  return null;
}

/**
 * Sanitize all mutable string fields and return a new object containing the sanitized values.
 */
export function sanitizeCareerInput(data: any) {
  const {
    jobTitle,
    project,
    description,
    questions,
    preScreeningQuestions,
    pipelineStages,
    location,
  } = data;

  const sanitizedJobTitle = sanitizeString(jobTitle, "strict");
  const sanitizedProject = project ? sanitizeString(project, "strict") : project;
  const sanitizedDescription = sanitizeString(description, "moderate"); // allow basic formatting
  const sanitizedQuestions = sanitizeQuestions(questions);
  const sanitizedLocation = sanitizeString(location, "strict");
  const sanitizedPreScreeningQuestions = preScreeningQuestions
    ? sanitizeObject(preScreeningQuestions, "strict")
    : preScreeningQuestions;
  const sanitizedPipelineStages = pipelineStages
    ? sanitizeObject(pipelineStages, "strict")
    : pipelineStages;

  return {
    sanitizedJobTitle,
    sanitizedProject,
    sanitizedDescription,
    sanitizedQuestions,
    sanitizedLocation,
    sanitizedPreScreeningQuestions,
    sanitizedPipelineStages,
  };
}
