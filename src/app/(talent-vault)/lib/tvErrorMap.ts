/**
 * Centralized error code to message mapping for Talent Vault
 * 
 * This module provides deterministic error message resolution with fallback support
 * for both new (`{ errorCode, message, details }`) and legacy (`{ error, errorCode }`) 
 * API response shapes.
 */

const ERROR_CODE_MAP: Record<string, string> = {
  AUTHENTICATION_REQUIRED: "Authentication is required to access this resource.",
  UNAUTHORIZED: "Authentication is required to access this resource.",
  ADMIN_ACCESS_REQUIRED: "You need admin access to perform this action.",

  CANDIDATE_PROFILE_REQUIRED: "Please complete your profile before proceeding.",
  SELECTED_SUBPROGRAM_REQUIRED: "Please select a subprogram to continue.",
  SUBPROGRAM_ID_INVALID: "The selected subprogram is invalid.",
  SUBPROGRAM_NOT_FOUND: "The subprogram could not be found.",
  SUBPROGRAM_NOT_ELIGIBLE: "You are not eligible for this subprogram.",
  SUBPROGRAM_NOT_FOUND_OR_INELIGIBLE: "The subprogram is not available or you are not eligible.",

  TITLE_REQUIRED: "Program title is required.",
  ROLE_TYPE_REQUIRED: "Role type is required.",
  DUPLICATE_TITLE: "A program with the same title already exists.",
  SUSPICIOUS_INPUT_DETECTED: "Input contains potentially dangerous content.",
  DIGITAL_CV_REQUIRED: "Your CV is required to continue.",
  CAREER_GOAL_IDS_REQUIRED: "Please select at least one career goal.",
  PRE_SCREENING_REQUIRED: "Pre-screening answers are required.",
  INVALID_ACTION: "The requested action is invalid.",
  ACTION_REQUIRED: "An action is required.",
  USER_EMAIL_MISSING: "User email is missing.",
  PROFILE_NOT_FOUND: "Profile not found.",
  UNSUPPORTED_ACTION: "The requested action is not supported.",
  SETUP_CURRENT_STEP_INVALID: "The current setup step is invalid.",
  VISIBILITY_STATUS_INVALID: "The visibility status is invalid.",
  PROFILE_REACTIVATION_REQUIRED: "Your profile needs to be reactivated before proceeding.",
  START_DATE_PREFERENCE_REQUIRED: "Start date preference is required.",
  PROFILE_SECTION_PAYLOAD_REQUIRED: "Profile section data is required.",
  PRE_SCREENING_SALARY_RANGE_INVALID: "The salary range provided is invalid.",

  // Interview Configuration
  INTERVIEW_CONFIG_INVALID: "The interview configuration is invalid. Please contact support.",
  PRE_SCREENING_VALIDATION_FAILED: "Pre-screening validation failed. Please try again.",
  INTERVIEW_VALIDATION_FAILED: "Interview validation failed. Please try again.",

  FETCH_SUBPROGRAMS_FAILED: "Failed to load subprograms. Please try again.",
  FETCH_SUBPROGRAM_DETAIL_FAILED: "Failed to load subprogram details. Please try again.",
  CREATE_SUBPROGRAM_FAILED: "Failed to create the subprogram. Please try again.",

  PRE_SCREENING_NOT_APPLICABLE: "Pre-screening is not applicable for this subprogram.",

  INTERNAL_SERVER_ERROR: "An unexpected error occurred. Please try again later.",
};

/**
 * Get a human-readable error message for a given error code
 * 
 * @param errorCode - The error code to look up
 * @param fallback - Optional fallback message if code is not found
 * @returns User-facing error message
 * 
 * @example
 * getTvErrorMessage("ADMIN_ACCESS_REQUIRED")
 * // => "You need admin access to perform this action."
 * 
 * getTvErrorMessage("UNKNOWN_CODE", "Something went wrong")
 * // => "Something went wrong"
 * 
 * getTvErrorMessage(undefined, "Please try again")
 * // => "Please try again"
 */
export function getTvErrorMessage(
  errorCode: string | undefined,
  fallback?: string
): string {
  if (!errorCode || typeof errorCode !== "string") {
    return fallback ?? "An error occurred. Please try again.";
  }

  return ERROR_CODE_MAP[errorCode] ?? fallback ?? "An error occurred. Please try again.";
}

/**
 * Extract error information from various response shapes
 * 
 * @param error - The error object from API response or catch block (full error, not just data)
 * @returns Extracted error with optional code and deterministic message
 */
export function extractTvError(error: unknown): {
  errorCode?: string;
  message: string;
} {
  if (!error) {
    return { message: "An error occurred. Please try again." };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;

    let data = obj;
    if (obj.response && typeof obj.response === "object") {
      const response = obj.response as Record<string, unknown>;
      if (response.data && typeof response.data === "object") {
        data = response.data as Record<string, unknown>;
      }
    }

    const errorCode =
      typeof data.errorCode === "string" && data.errorCode.trim().length > 0
        ? data.errorCode.trim()
        : undefined;

    let serverMessage: string | undefined;
    if (typeof data.message === "string" && data.message.trim().length > 0) {
      serverMessage = data.message.trim();
    } else if (typeof data.error === "string" && data.error.trim().length > 0) {
      const errorValue = data.error.trim();
      if (!/^[A-Z_]+$/.test(errorValue)) {
        serverMessage = errorValue;
      }
    } else if (typeof obj.message === "string" && obj.message.trim().length > 0) {
      serverMessage = obj.message.trim();
    }

    if (errorCode) {
      const message = getTvErrorMessage(errorCode, serverMessage);
      return { errorCode, message };
    }

    if (typeof data.error === "string" && data.error.trim().length > 0) {
      const legacyErrorCode = data.error.trim();
      if (ERROR_CODE_MAP[legacyErrorCode]) {
        const message = getTvErrorMessage(legacyErrorCode, serverMessage);
        return { errorCode: legacyErrorCode, message };
      }
    }

    if (serverMessage) {
      return { message: serverMessage };
    }
  }

  try {
    const stringified = String(error);
    if (stringified && stringified !== "[object Object]") {
      return { message: stringified };
    }
  } catch {
  }

  return { message: "An error occurred. Please try again." };
}
