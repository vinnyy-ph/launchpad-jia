/**
 * Requisition Authorization Guard
 * Provides comprehensive security validation for requisition API operations
 * - Validates organization membership
 * - Enforces role-based status transitions
 * - Prevents unauthorized cross-organization access
 */

import { Db, ObjectId } from "mongodb";
import type { DecodedIdToken } from "firebase-admin/auth";

export type RequisitionStatus =
  | "In Review"
  | "Requires More Info"
  | "Active"
  | "On Hold"
  | "Cancelled"
  | "Request to Cancel";

export type MemberRole = "admin" | "recruiter" | "guest" | "super_admin";

export interface MemberInfo {
  _id: ObjectId;
  email: string;
  orgID: string;
  role: MemberRole;
  name?: string;
  image?: string;
}

export interface AuthorizationResult {
  authorized: boolean;
  member?: MemberInfo;
  error?: string;
  statusCode?: number;
  code?: string;
}

export interface StatusTransitionResult {
  allowed: boolean;
  error?: string;
}

/**
 * Status transitions allowed by role
 * - admin: Can perform all status transitions
 * - recruiter: Can perform all status transitions
 * - guest: Can only request cancellation of their own requisitions
 * - super_admin: Global admin, same capabilities as admin
 */
const STATUS_TRANSITIONS: Record<
  MemberRole,
  {
    allowedStatuses: RequisitionStatus[];
    requiresOwnership: boolean;
  }
> = {
  admin: {
    allowedStatuses: [
      "In Review",
      "Requires More Info",
      "Active",
      "On Hold",
      "Cancelled",
      "Request to Cancel",
    ],
    requiresOwnership: false,
  },
  recruiter: {
    allowedStatuses: [
      "In Review",
      "Requires More Info",
      "Active",
      "On Hold",
      "Cancelled",
      "Request to Cancel",
    ],
    requiresOwnership: false,
  },
  guest: {
    allowedStatuses: ["Request to Cancel"], // Guests can only request to cancel their own
    requiresOwnership: true,
  },
  super_admin: {
    // Global admin should be able to perform all transitions without ownership restrictions
    allowedStatuses: [
      "In Review",
      "Requires More Info",
      "Active",
      "On Hold",
      "Cancelled",
      "Request to Cancel",
    ],
    requiresOwnership: false,
  },
};

/**
 * Validates that the authenticated user is a member of the specified organization
 * This is the primary security check to prevent cross-organization access
 */
export async function validateOrgMembership(
  db: Db,
  userEmail: string | undefined,
  orgID: string
): Promise<AuthorizationResult> {
  if (!userEmail) {
    return {
      authorized: false,
      error: "User email not found in token",
      statusCode: 401,
    };
  }

  if (!orgID) {
    return {
      authorized: false,
      error: "Organization ID is required",
      statusCode: 400,
    };
  }

  // Find member record in the organization
  const member = (await db.collection("members").findOne({
    email: userEmail,
    orgID: orgID,
  })) as MemberInfo | null;

  if (!member) {
    return {
      authorized: false,
      error: "You are not a member of this organization",
      statusCode: 403,
    };
  }

  // For guests, also enforce that Projects is enabled for this organization.
  // This protects guest-portal requisition APIs (view/create/update) even from direct API calls.
  try {
    // Validate orgID format before querying organizations collection
    if (!ObjectId.isValid(orgID)) {
      return {
        authorized: false,
        error: "Invalid organization ID",
        statusCode: 400,
      };
    }

    const org = await db
      .collection("organizations")
      .findOne({ _id: new ObjectId(orgID) });

    if (!org) {
      return {
        authorized: false,
        error: "Organization not found",
        statusCode: 404,
      };
    }

    if (member.role === "guest" && !org.projectsEnabled) {
      return {
        authorized: false,
        error:
          "Guest portal is only available when Projects is enabled for this organization.",
        statusCode: 403,
        code: "GUEST_PORTAL_REQUIRES_PROJECTS_ENABLED",
      };
    }
  } catch (err) {
    console.error(
      "Error enforcing projectsEnabled for guest member in validateOrgMembership:",
      err
    );
    return {
      authorized: false,
      error: "Error validating organization access",
      statusCode: 500,
    };
  }

  return {
    authorized: true,
    member,
  };
}

/** Statuses that allow editing */
const EDITABLE_STATUSES: RequisitionStatus[] = [
  "In Review",
  "Requires More Info",
];

/** Statuses that allow requesting cancellation */
const CANCELLABLE_STATUSES: RequisitionStatus[] = [
  "In Review",
  "Requires More Info",
  "Active",
  "On Hold",
];

/**
 * Validates that a user can access/modify a specific requisition
 * Checks both org membership and ownership for guests
 * Also validates status-based restrictions for edit operations
 */
export async function validateRequisitionAccess(
  db: Db,
  user: DecodedIdToken,
  requisition: any,
  operation: "read" | "write" | "delete"
): Promise<AuthorizationResult> {
  const userEmail = user.email;

  // First validate org membership
  const membershipResult = await validateOrgMembership(
    db,
    userEmail,
    requisition.orgID
  );
  if (!membershipResult.authorized) {
    return membershipResult;
  }

  const member = membershipResult.member!;

  // For guests, check ownership for write/delete operations
  if (member.role === "guest" && operation !== "read") {
    if (requisition.submittedBy?.email !== userEmail) {
      return {
        authorized: false,
        error: "Guests can only modify their own requisitions",
        statusCode: 403,
      };
    }
  }

  // For read operations, guests can only see their own requisitions
  if (member.role === "guest" && operation === "read") {
    if (requisition.submittedBy?.email !== userEmail) {
      return {
        authorized: false,
        error: "Unauthorized access to requisition",
        statusCode: 403,
      };
    }
  }

  // EDGE CASE: For write operations (Edit Details), check if status allows editing
  if (operation === "write") {
    const currentStatus = requisition.status as RequisitionStatus;
    if (!EDITABLE_STATUSES.includes(currentStatus)) {
      return {
        authorized: false,
        error: `Cannot edit requisition with status '${currentStatus}'. Only requisitions with status '${EDITABLE_STATUSES.join(
          "' or '"
        )}' can be edited.`,
        statusCode: 400,
      };
    }
  }

  return {
    authorized: true,
    member,
  };
}

/**
 * Validates if a user can perform a specific status transition
 * Enforces role-based access control for status updates
 * Also validates logical status transitions (edge cases)
 */
export function validateStatusTransition(
  member: MemberInfo,
  newStatus: RequisitionStatus,
  requisition: any,
  userEmail: string
): StatusTransitionResult {
  const role = member.role as MemberRole;
  const roleConfig = STATUS_TRANSITIONS[role];
  const currentStatus = requisition.status as RequisitionStatus;

  if (!roleConfig) {
    return {
      allowed: false,
      error: `Unknown role: ${role}`,
    };
  }

  // Once requisition is Active, restrict what it can transition to.
  // This supports flows where recruiters/admins can put an active requisition on hold or cancel it,
  // which will unpublish the linked career.
  if (currentStatus === "Active" && newStatus !== "Active") {
    const allowedFromActive: RequisitionStatus[] = ["On Hold", "Cancelled"];
    if (!allowedFromActive.includes(newStatus)) {
      return {
        allowed: false,
        error:
          "Cannot change status of an active requisition to this status. Manage the linked career instead.",
      };
    }
  }

  // Check if the status is allowed for this role
  if (!roleConfig.allowedStatuses.includes(newStatus)) {
    return {
      allowed: false,
      error: `Users with role '${role}' cannot set status to '${newStatus}'`,
    };
  }

  // Check ownership requirement for certain roles (e.g., guests)
  if (
    roleConfig.requiresOwnership &&
    requisition.submittedBy?.email !== userEmail
  ) {
    return {
      allowed: false,
      error: `Users with role '${role}' can only modify status of their own requisitions`,
    };
  }

  // ============================================
  // EDGE CASE: Status transition logic validation
  // ============================================

  // EDGE CASE: Request to Cancel - can only be requested from certain statuses
  if (newStatus === "Request to Cancel") {
    if (!CANCELLABLE_STATUSES.includes(currentStatus)) {
      return {
        allowed: false,
        error: `Cannot request cancellation for a requisition with status '${currentStatus}'. Only requisitions with status '${CANCELLABLE_STATUSES.join(
          "', '"
        )}' can be cancelled.`,
      };
    }
    // Prevent requesting cancellation on already cancelled or pending cancellation
    if (
      currentStatus === "Cancelled" ||
      currentStatus === "Request to Cancel"
    ) {
      return {
        allowed: false,
        error: `This requisition is already ${
          currentStatus === "Cancelled" ? "cancelled" : "pending cancellation"
        }.`,
      };
    }
  }

  // EDGE CASE: Cannot cancel a requisition that's not in Request to Cancel state (for admins)
  if (newStatus === "Cancelled" && currentStatus !== "Request to Cancel") {
    // Only allow admins/recruiters to directly cancel from Active or On Hold
    if (role === "guest") {
      return {
        allowed: false,
        error:
          "Guests cannot directly cancel requisitions. Please request cancellation instead.",
      };
    }
    // Admins/recruiters can cancel from these statuses
    const directCancelAllowed: RequisitionStatus[] = [
      "In Review",
      "Requires More Info",
      "Active",
      "On Hold",
      "Request to Cancel",
    ];
    if (!directCancelAllowed.includes(currentStatus)) {
      return {
        allowed: false,
        error: `Cannot cancel requisition with status '${currentStatus}'.`,
      };
    }
  }

  // EDGE CASE: Cannot reactivate a cancelled requisition
  if (currentStatus === "Cancelled" && newStatus !== "Cancelled") {
    return {
      allowed: false,
      error:
        "Cannot change status of a cancelled requisition. Please create a new requisition instead.",
    };
  }

  // EDGE CASE: Prevent going back to "In Review" from "Active"
  // (would lose the career creation)
  if (currentStatus === "Active" && newStatus === "In Review") {
    return {
      allowed: false,
      error:
        "Cannot revert an active requisition back to 'In Review'. Use 'On Hold' to pause or request cancellation.",
    };
  }

  return { allowed: true };
}

/**
 * Combined guard for requisition status update operations
 * Validates org membership, requisition access, and status transition permissions
 */
export async function guardStatusUpdate(
  db: Db,
  user: DecodedIdToken,
  requisition: any,
  newStatus: RequisitionStatus
): Promise<AuthorizationResult> {
  const userEmail = user.email;

  // Validate org membership
  const membershipResult = await validateOrgMembership(
    db,
    userEmail,
    requisition.orgID
  );
  if (!membershipResult.authorized) {
    return membershipResult;
  }

  const member = membershipResult.member!;

  // Validate status transition is allowed for this role
  const transitionResult = validateStatusTransition(
    member,
    newStatus,
    requisition,
    userEmail!
  );
  if (!transitionResult.allowed) {
    return {
      authorized: false,
      error: transitionResult.error,
      statusCode: 403,
    };
  }

  return {
    authorized: true,
    member,
  };
}

/**
 * Guard for creating new requisitions
 * Validates that user is a member of the target organization
 */
export async function guardCreateRequisition(
  db: Db,
  user: DecodedIdToken,
  targetOrgID: string
): Promise<AuthorizationResult> {
  return validateOrgMembership(db, user.email, targetOrgID);
}

/**
 * Utility to create consistent error response
 */
export function createAuthError(result: AuthorizationResult) {
  return {
    success: false,
    message: result.error || "Unauthorized",
    statusCode: result.statusCode || 403,
    code: result.code,
  };
}

// ============================================
// INPUT SANITIZATION & NOSQL INJECTION PROTECTION
// ============================================

/**
 * MongoDB operators that could be used for NoSQL injection
 */
const DANGEROUS_OPERATORS = [
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$ne",
  "$nin",
  "$in",
  "$and",
  "$or",
  "$not",
  "$nor",
  "$exists",
  "$type",
  "$mod",
  "$regex",
  "$text",
  "$where",
  "$all",
  "$elemMatch",
  "$size",
  "$slice",
  "$set",
  "$unset",
  "$inc",
  "$push",
  "$pull",
  "$addToSet",
  "$rename",
  "$bit",
  "$min",
  "$max",
  "$mul",
  "$expr",
  "$jsonSchema",
  "$comment",
];

/**
 * Check if a value contains MongoDB operators (potential NoSQL injection)
 */
function containsMongoOperator(value: any): boolean {
  if (typeof value === "string") {
    return DANGEROUS_OPERATORS.some((op) => value.includes(op));
  }
  if (typeof value === "object" && value !== null) {
    const keys = Object.keys(value);
    return keys.some(
      (key) => key.startsWith("$") || containsMongoOperator(value[key])
    );
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsMongoOperator(item));
  }
  return false;
}

/**
 * Sanitize a string value - remove potential injection patterns
 */
function sanitizeString(value: string, maxLength: number = 10000): string {
  if (typeof value !== "string") return "";
  // Truncate to max length
  let sanitized = value.slice(0, maxLength);
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, "");
  return sanitized;
}

/**
 * Deeply sanitize an object, removing dangerous keys and validating types
 */
function deepSanitize(obj: any, depth: number = 0, maxDepth: number = 10): any {
  // Prevent infinite recursion
  if (depth > maxDepth) {
    return null;
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (typeof obj === "number" || typeof obj === "boolean") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .map((item) => deepSanitize(item, depth + 1, maxDepth))
      .filter((item) => item !== null);
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip keys that start with $ (MongoDB operators)
      if (key.startsWith("$")) {
        console.warn(
          `[SECURITY] Blocked potential NoSQL injection: key "${key}"`
        );
        continue;
      }
      // Skip keys with null bytes or special characters
      if (/[\0\$]/.test(key)) {
        console.warn(`[SECURITY] Blocked suspicious key: "${key}"`);
        continue;
      }
      sanitized[key] = deepSanitize(value, depth + 1, maxDepth);
    }
    return sanitized;
  }

  return null;
}

export interface SanitizationResult {
  valid: boolean;
  sanitized?: any;
  error?: string;
}

/**
 * Sanitize and validate status update payload
 * Only allows: status (string), metadata (object with specific fields)
 */
export function sanitizeStatusUpdatePayload(body: any): SanitizationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  // Check for NoSQL injection in raw body
  if (containsMongoOperator(body)) {
    console.error(
      "[SECURITY] NoSQL injection attempt detected in status update"
    );
    return { valid: false, error: "Invalid request payload" };
  }

  const { status, metadata } = body;

  // Validate status is a plain string
  if (typeof status !== "string") {
    return { valid: false, error: "Status must be a string" };
  }

  const sanitized: any = {
    status: sanitizeString(status, 50),
  };

  // Sanitize metadata if provided
  if (metadata !== undefined) {
    if (
      typeof metadata !== "object" ||
      metadata === null ||
      Array.isArray(metadata)
    ) {
      return { valid: false, error: "Metadata must be an object" };
    }

    // Only allow specific metadata fields
    const allowedMetadataFields = [
      "moreInfoReason",
      "moreInfoBy",
      "cancelReason",
      "triggeredBy",
      "careerId",
    ];
    const sanitizedMetadata: Record<string, string> = {};

    for (const field of allowedMetadataFields) {
      if (metadata[field] !== undefined) {
        if (typeof metadata[field] !== "string") {
          return {
            valid: false,
            error: `Metadata field '${field}' must be a string`,
          };
        }
        sanitizedMetadata[field] = sanitizeString(metadata[field], 1000);
      }
    }

    // Check for extra fields (potential injection)
    const extraFields = Object.keys(metadata).filter(
      (k) => !allowedMetadataFields.includes(k)
    );
    if (extraFields.length > 0) {
      console.warn(
        `[SECURITY] Blocked extra metadata fields: ${extraFields.join(", ")}`
      );
    }

    sanitized.metadata = sanitizedMetadata;
  }

  return { valid: true, sanitized };
}

// ============================================
// STRICT TYPE DEFINITIONS FOR REQUISITION
// ============================================

/** Valid work arrangement options */
const VALID_WORK_ARRANGEMENTS = ["Hybrid", "Remote", "On-site"] as const;
type WorkArrangement = (typeof VALID_WORK_ARRANGEMENTS)[number];

/** Valid employment type options */
const VALID_EMPLOYMENT_TYPES = ["Contract", "Full-time", "Part-time"] as const;
type EmploymentType = (typeof VALID_EMPLOYMENT_TYPES)[number];

/** Valid currency options */
const VALID_CURRENCIES = ["PHP", "USD"] as const;
type Currency = (typeof VALID_CURRENCIES)[number];

/** Valid duration unit options */
const VALID_DURATION_UNITS = ["Months", "Years"] as const;
type DurationUnit = (typeof VALID_DURATION_UNITS)[number];

/** Strictly typed formData structure */
interface RequisitionFormData {
  positionName: string;
  jobDescription: string;
  headcount: string;
  workArrangement: WorkArrangement;
  workDays?: string;
  officeLocation: {
    country: string;
    stateProvince: string;
    city: string;
  };
  salaryRange: {
    min: string;
    max: string;
    currency: Currency;
  };
  employmentType: EmploymentType;
  duration?: {
    value: string;
    unit: DurationUnit;
  };
  reason: string;
}

/** Strictly typed submittedBy structure */
interface SubmittedBy {
  memberID?: string;
  name: string;
  email: string;
  avatar?: string;
}

/**
 * Sanitize and validate requisition creation payload
 * STRICT validation - only allows expected fields with proper types
 * Edge cases handled:
 * - Prevents non-members from creating requisitions (handled by guardCreateRequisition)
 * - Prevents impersonation (submittedBy.email must match authenticated user)
 * - Validates all required fields with proper types
 * - Rejects extra/unexpected fields
 * - Prevents NoSQL injection
 */
export function sanitizeCreateRequisitionPayload(
  body: any
): SanitizationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  // Check for NoSQL injection
  if (containsMongoOperator(body)) {
    console.error(
      "[SECURITY] NoSQL injection attempt detected in create requisition"
    );
    return { valid: false, error: "Invalid request payload" };
  }

  const { formData, orgID, submittedBy } = body;

  // ============================================
  // VALIDATE orgID
  // ============================================
  if (typeof orgID !== "string" || !orgID.trim()) {
    return {
      valid: false,
      error: "Organization ID must be a non-empty string",
    };
  }

  // ============================================
  // VALIDATE submittedBy (strict fields only)
  // ============================================
  if (
    !submittedBy ||
    typeof submittedBy !== "object" ||
    Array.isArray(submittedBy)
  ) {
    return { valid: false, error: "Submitter information is required" };
  }

  if (typeof submittedBy.name !== "string" || !submittedBy.name.trim()) {
    return { valid: false, error: "Submitter name is required" };
  }

  if (typeof submittedBy.email !== "string" || !submittedBy.email.trim()) {
    return { valid: false, error: "Submitter email is required" };
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(submittedBy.email)) {
    return { valid: false, error: "Invalid submitter email format" };
  }

  // ============================================
  // VALIDATE formData (strict fields with types)
  // ============================================
  if (!formData || typeof formData !== "object" || Array.isArray(formData)) {
    return { valid: false, error: "Form data is required" };
  }

  // --- positionName (required, string) ---
  if (
    typeof formData.positionName !== "string" ||
    !formData.positionName.trim()
  ) {
    return { valid: false, error: "Position name is required" };
  }

  // --- jobDescription (required, string, non-empty after stripping HTML) ---
  if (typeof formData.jobDescription !== "string") {
    return { valid: false, error: "Job description must be a string" };
  }
  const plainJobDescription = formData.jobDescription
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  if (!plainJobDescription) {
    return { valid: false, error: "Job description is required" };
  }

  // --- headcount (required, string, must be positive integer) ---
  if (typeof formData.headcount !== "string" || !formData.headcount.trim()) {
    return { valid: false, error: "Headcount is required" };
  }
  const headcountNum = parseInt(formData.headcount.trim(), 10);
  if (
    isNaN(headcountNum) ||
    headcountNum <= 0 ||
    !/^\d+$/.test(formData.headcount.trim())
  ) {
    return { valid: false, error: "Headcount must be a positive integer" };
  }

  // --- workArrangement (required, must be valid option) ---
  if (typeof formData.workArrangement !== "string") {
    return { valid: false, error: "Work arrangement must be a string" };
  }
  if (
    !VALID_WORK_ARRANGEMENTS.includes(
      formData.workArrangement as WorkArrangement
    )
  ) {
    return {
      valid: false,
      error: `Work arrangement must be one of: ${VALID_WORK_ARRANGEMENTS.join(
        ", "
      )}`,
    };
  }

  // --- workDays (required only if workArrangement is Hybrid) ---
  if (formData.workArrangement === "Hybrid") {
    if (typeof formData.workDays !== "string" || !formData.workDays.trim()) {
      return {
        valid: false,
        error: "Work days per week is required for Hybrid arrangement",
      };
    }
  }

  // --- officeLocation (required object with country, stateProvince, city) ---
  if (
    !formData.officeLocation ||
    typeof formData.officeLocation !== "object" ||
    Array.isArray(formData.officeLocation)
  ) {
    return { valid: false, error: "Office location is required" };
  }
  if (
    typeof formData.officeLocation.country !== "string" ||
    !formData.officeLocation.country.trim()
  ) {
    return { valid: false, error: "Country is required" };
  }
  if (
    typeof formData.officeLocation.stateProvince !== "string" ||
    !formData.officeLocation.stateProvince.trim()
  ) {
    return { valid: false, error: "State/Province is required" };
  }
  if (
    typeof formData.officeLocation.city !== "string" ||
    !formData.officeLocation.city.trim()
  ) {
    return { valid: false, error: "City is required" };
  }

  // --- salaryRange (required object with min, max, currency) ---
  if (
    !formData.salaryRange ||
    typeof formData.salaryRange !== "object" ||
    Array.isArray(formData.salaryRange)
  ) {
    return { valid: false, error: "Salary range is required" };
  }
  if (
    typeof formData.salaryRange.min !== "string" ||
    !formData.salaryRange.min.trim()
  ) {
    return { valid: false, error: "Minimum salary is required" };
  }
  if (
    typeof formData.salaryRange.max !== "string" ||
    !formData.salaryRange.max.trim()
  ) {
    return { valid: false, error: "Maximum salary is required" };
  }
  if (typeof formData.salaryRange.currency !== "string") {
    return { valid: false, error: "Currency must be a string" };
  }
  if (!VALID_CURRENCIES.includes(formData.salaryRange.currency as Currency)) {
    return {
      valid: false,
      error: `Currency must be one of: ${VALID_CURRENCIES.join(", ")}`,
    };
  }

  // Validate salary values are valid numbers
  const minSalary = Number(formData.salaryRange.min.replace(/,/g, ""));
  const maxSalary = Number(formData.salaryRange.max.replace(/,/g, ""));
  if (isNaN(minSalary) || minSalary < 0) {
    return {
      valid: false,
      error: "Minimum salary must be a valid non-negative number",
    };
  }
  if (isNaN(maxSalary) || maxSalary < 0) {
    return {
      valid: false,
      error: "Maximum salary must be a valid non-negative number",
    };
  }
  if (minSalary > maxSalary) {
    return {
      valid: false,
      error: "Maximum salary must be greater than or equal to minimum salary",
    };
  }

  // --- employmentType (required, must be valid option) ---
  if (typeof formData.employmentType !== "string") {
    return { valid: false, error: "Employment type must be a string" };
  }
  if (
    !VALID_EMPLOYMENT_TYPES.includes(formData.employmentType as EmploymentType)
  ) {
    return {
      valid: false,
      error: `Employment type must be one of: ${VALID_EMPLOYMENT_TYPES.join(
        ", "
      )}`,
    };
  }

  // --- duration (required only if employmentType is Contract) ---
  if (formData.employmentType === "Contract") {
    if (
      !formData.duration ||
      typeof formData.duration !== "object" ||
      Array.isArray(formData.duration)
    ) {
      return {
        valid: false,
        error: "Contract duration is required for Contract employment type",
      };
    }
    if (
      typeof formData.duration.value !== "string" ||
      !formData.duration.value.trim()
    ) {
      return { valid: false, error: "Contract duration value is required" };
    }
    if (typeof formData.duration.unit !== "string") {
      return { valid: false, error: "Contract duration unit must be a string" };
    }
    if (
      !VALID_DURATION_UNITS.includes(formData.duration.unit as DurationUnit)
    ) {
      return {
        valid: false,
        error: `Contract duration unit must be one of: ${VALID_DURATION_UNITS.join(
          ", "
        )}`,
      };
    }
  }

  // --- reason (required, string, non-empty after stripping HTML) ---
  if (typeof formData.reason !== "string") {
    return { valid: false, error: "Reason for requisition must be a string" };
  }
  const plainReason = formData.reason
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  if (!plainReason) {
    return { valid: false, error: "Reason for requisition is required" };
  }

  // ============================================
  // BUILD SANITIZED OUTPUT (only allowed fields)
  // ============================================
  const sanitizedFormData: RequisitionFormData = {
    positionName: sanitizeString(formData.positionName.trim(), 500),
    jobDescription: sanitizeString(formData.jobDescription, 50000),
    headcount: formData.headcount.trim(),
    workArrangement: formData.workArrangement as WorkArrangement,
    officeLocation: {
      country: sanitizeString(formData.officeLocation.country.trim(), 100),
      stateProvince: sanitizeString(
        formData.officeLocation.stateProvince.trim(),
        100
      ),
      city: sanitizeString(formData.officeLocation.city.trim(), 100),
    },
    salaryRange: {
      min: sanitizeString(formData.salaryRange.min.trim(), 50),
      max: sanitizeString(formData.salaryRange.max.trim(), 50),
      currency: formData.salaryRange.currency as Currency,
    },
    employmentType: formData.employmentType as EmploymentType,
    reason: sanitizeString(formData.reason, 50000),
  };

  // Add optional workDays for Hybrid
  if (formData.workArrangement === "Hybrid" && formData.workDays) {
    sanitizedFormData.workDays = sanitizeString(formData.workDays.trim(), 100);
  }

  // Add optional duration for Contract
  if (formData.employmentType === "Contract" && formData.duration) {
    sanitizedFormData.duration = {
      value: sanitizeString(formData.duration.value.trim(), 50),
      unit: formData.duration.unit as DurationUnit,
    };
  }

  const sanitizedSubmittedBy: SubmittedBy = {
    name: sanitizeString(submittedBy.name.trim(), 200),
    email: sanitizeString(submittedBy.email.trim().toLowerCase(), 200),
  };

  // Add optional fields for submittedBy
  if (submittedBy.memberID && typeof submittedBy.memberID === "string") {
    sanitizedSubmittedBy.memberID = sanitizeString(
      submittedBy.memberID.trim(),
      100
    );
  }
  if (submittedBy.avatar && typeof submittedBy.avatar === "string") {
    sanitizedSubmittedBy.avatar = sanitizeString(
      submittedBy.avatar.trim(),
      500
    );
  }

  const sanitized = {
    orgID: sanitizeString(orgID.trim(), 100),
    submittedBy: sanitizedSubmittedBy,
    formData: sanitizedFormData,
  };

  return { valid: true, sanitized };
}

/**
 * Sanitize requisition update payload (PUT)
 * Uses same strict validation as create payload
 */
export function sanitizeUpdateRequisitionPayload(
  body: any
): SanitizationResult {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  // Check for NoSQL injection
  if (containsMongoOperator(body)) {
    console.error(
      "[SECURITY] NoSQL injection attempt detected in update requisition"
    );
    return { valid: false, error: "Invalid request payload" };
  }

  const { formData } = body;

  // ============================================
  // VALIDATE formData (strict fields with types)
  // ============================================
  if (!formData || typeof formData !== "object" || Array.isArray(formData)) {
    return { valid: false, error: "Form data is required" };
  }

  // --- positionName (required, string) ---
  if (
    typeof formData.positionName !== "string" ||
    !formData.positionName.trim()
  ) {
    return { valid: false, error: "Position name is required" };
  }

  // --- jobDescription (required, string, non-empty after stripping HTML) ---
  if (typeof formData.jobDescription !== "string") {
    return { valid: false, error: "Job description must be a string" };
  }
  const plainJobDescription = formData.jobDescription
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  if (!plainJobDescription) {
    return { valid: false, error: "Job description is required" };
  }

  // --- headcount (required, string, must be positive integer) ---
  if (typeof formData.headcount !== "string" || !formData.headcount.trim()) {
    return { valid: false, error: "Headcount is required" };
  }
  const headcountNum = parseInt(formData.headcount.trim(), 10);
  if (
    isNaN(headcountNum) ||
    headcountNum <= 0 ||
    !/^\d+$/.test(formData.headcount.trim())
  ) {
    return { valid: false, error: "Headcount must be a positive integer" };
  }

  // --- workArrangement (required, must be valid option) ---
  if (typeof formData.workArrangement !== "string") {
    return { valid: false, error: "Work arrangement must be a string" };
  }
  if (
    !VALID_WORK_ARRANGEMENTS.includes(
      formData.workArrangement as WorkArrangement
    )
  ) {
    return {
      valid: false,
      error: `Work arrangement must be one of: ${VALID_WORK_ARRANGEMENTS.join(
        ", "
      )}`,
    };
  }

  // --- workDays (required only if workArrangement is Hybrid) ---
  if (formData.workArrangement === "Hybrid") {
    if (typeof formData.workDays !== "string" || !formData.workDays.trim()) {
      return {
        valid: false,
        error: "Work days per week is required for Hybrid arrangement",
      };
    }
  }

  // --- officeLocation (required object with country, stateProvince, city) ---
  if (
    !formData.officeLocation ||
    typeof formData.officeLocation !== "object" ||
    Array.isArray(formData.officeLocation)
  ) {
    return { valid: false, error: "Office location is required" };
  }
  if (
    typeof formData.officeLocation.country !== "string" ||
    !formData.officeLocation.country.trim()
  ) {
    return { valid: false, error: "Country is required" };
  }
  if (
    typeof formData.officeLocation.stateProvince !== "string" ||
    !formData.officeLocation.stateProvince.trim()
  ) {
    return { valid: false, error: "State/Province is required" };
  }
  if (
    typeof formData.officeLocation.city !== "string" ||
    !formData.officeLocation.city.trim()
  ) {
    return { valid: false, error: "City is required" };
  }

  // --- salaryRange (required object with min, max, currency) ---
  if (
    !formData.salaryRange ||
    typeof formData.salaryRange !== "object" ||
    Array.isArray(formData.salaryRange)
  ) {
    return { valid: false, error: "Salary range is required" };
  }
  if (
    typeof formData.salaryRange.min !== "string" ||
    !formData.salaryRange.min.trim()
  ) {
    return { valid: false, error: "Minimum salary is required" };
  }
  if (
    typeof formData.salaryRange.max !== "string" ||
    !formData.salaryRange.max.trim()
  ) {
    return { valid: false, error: "Maximum salary is required" };
  }
  if (typeof formData.salaryRange.currency !== "string") {
    return { valid: false, error: "Currency must be a string" };
  }
  if (!VALID_CURRENCIES.includes(formData.salaryRange.currency as Currency)) {
    return {
      valid: false,
      error: `Currency must be one of: ${VALID_CURRENCIES.join(", ")}`,
    };
  }

  // Validate salary values are valid numbers
  const minSalary = Number(formData.salaryRange.min.replace(/,/g, ""));
  const maxSalary = Number(formData.salaryRange.max.replace(/,/g, ""));
  if (isNaN(minSalary) || minSalary < 0) {
    return {
      valid: false,
      error: "Minimum salary must be a valid non-negative number",
    };
  }
  if (isNaN(maxSalary) || maxSalary < 0) {
    return {
      valid: false,
      error: "Maximum salary must be a valid non-negative number",
    };
  }
  if (minSalary > maxSalary) {
    return {
      valid: false,
      error: "Maximum salary must be greater than or equal to minimum salary",
    };
  }

  // --- employmentType (required, must be valid option) ---
  if (typeof formData.employmentType !== "string") {
    return { valid: false, error: "Employment type must be a string" };
  }
  if (
    !VALID_EMPLOYMENT_TYPES.includes(formData.employmentType as EmploymentType)
  ) {
    return {
      valid: false,
      error: `Employment type must be one of: ${VALID_EMPLOYMENT_TYPES.join(
        ", "
      )}`,
    };
  }

  // --- duration (required only if employmentType is Contract) ---
  if (formData.employmentType === "Contract") {
    if (
      !formData.duration ||
      typeof formData.duration !== "object" ||
      Array.isArray(formData.duration)
    ) {
      return {
        valid: false,
        error: "Contract duration is required for Contract employment type",
      };
    }
    if (
      typeof formData.duration.value !== "string" ||
      !formData.duration.value.trim()
    ) {
      return { valid: false, error: "Contract duration value is required" };
    }
    if (typeof formData.duration.unit !== "string") {
      return { valid: false, error: "Contract duration unit must be a string" };
    }
    if (
      !VALID_DURATION_UNITS.includes(formData.duration.unit as DurationUnit)
    ) {
      return {
        valid: false,
        error: `Contract duration unit must be one of: ${VALID_DURATION_UNITS.join(
          ", "
        )}`,
      };
    }
  }

  // --- reason (required, string, non-empty after stripping HTML) ---
  if (typeof formData.reason !== "string") {
    return { valid: false, error: "Reason for requisition must be a string" };
  }
  const plainReason = formData.reason
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  if (!plainReason) {
    return { valid: false, error: "Reason for requisition is required" };
  }

  // ============================================
  // BUILD SANITIZED OUTPUT (only allowed fields)
  // ============================================
  const sanitizedFormData: RequisitionFormData = {
    positionName: sanitizeString(formData.positionName.trim(), 500),
    jobDescription: sanitizeString(formData.jobDescription, 50000),
    headcount: formData.headcount.trim(),
    workArrangement: formData.workArrangement as WorkArrangement,
    officeLocation: {
      country: sanitizeString(formData.officeLocation.country.trim(), 100),
      stateProvince: sanitizeString(
        formData.officeLocation.stateProvince.trim(),
        100
      ),
      city: sanitizeString(formData.officeLocation.city.trim(), 100),
    },
    salaryRange: {
      min: sanitizeString(formData.salaryRange.min.trim(), 50),
      max: sanitizeString(formData.salaryRange.max.trim(), 50),
      currency: formData.salaryRange.currency as Currency,
    },
    employmentType: formData.employmentType as EmploymentType,
    reason: sanitizeString(formData.reason, 50000),
  };

  // Add optional workDays for Hybrid
  if (formData.workArrangement === "Hybrid" && formData.workDays) {
    sanitizedFormData.workDays = sanitizeString(formData.workDays.trim(), 100);
  }

  // Add optional duration for Contract
  if (formData.employmentType === "Contract" && formData.duration) {
    sanitizedFormData.duration = {
      value: sanitizeString(formData.duration.value.trim(), 50),
      unit: formData.duration.unit as DurationUnit,
    };
  }

  return { valid: true, sanitized: { formData: sanitizedFormData } };
}

/**
 * Validate MongoDB ObjectId format to prevent injection via ID parameter
 */
export function isValidObjectId(id: any): boolean {
  if (typeof id !== "string") return false;
  // MongoDB ObjectId is 24 hex characters
  return /^[a-fA-F0-9]{24}$/.test(id);
}
