/**
 * Talent Vault Role Type Presentation Contract
 *
 * Canonical role types and immutable color token mappings for admin subprogram
 * creation, review, and listing surfaces.
 *
 * This is the single source of truth for:
 * - Role type labels in canonical order
 * - Per-role background, border, and text color tokens
 * - Type definitions for role type values
 */

/**
 * Canonical role types for talent vault subprograms.
 * Order matters: used for dropdown option ordering and canonical reference.
 */
export const TALENT_VAULT_ROLE_TYPES = [
  "Full-time",
  "Internship",
  "Project-Based",
  "Part-time",
] as const;

/**
 * Type definition for valid talent vault role types.
 */
export type TalentVaultRoleType = (typeof TALENT_VAULT_ROLE_TYPES)[number];

/**
 * Immutable color token mapping for each canonical role type.
 * Each role has background, border, and text (color) tokens.
 */
export const TALENT_VAULT_ROLE_TYPE_TOKENS: Record<
  TalentVaultRoleType,
  {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
  }
> = {
  "Full-time": {
    backgroundColor: "#F4F3FF",
    borderColor: "#D9D6FE",
    textColor: "#5925DC",
  },
  Internship: {
    backgroundColor: "#FEF6EE",
    borderColor: "#F9DBAF",
    textColor: "#B93815",
  },
  "Project-Based": {
    backgroundColor: "#EFF8FF",
    borderColor: "#B2DDFF",
    textColor: "#175CD3",
  },
  "Part-time": {
    backgroundColor: "#FDF2FA",
    borderColor: "#FCCEEE",
    textColor: "#C11574",
  },
} as const;

/**
 * Fallback (neutral) tokens for unknown or legacy role values.
 * Used when a role type doesn't match any canonical value.
 */
export const TALENT_VAULT_ROLE_TYPE_NEUTRAL_TOKENS = {
  backgroundColor: "#F8F9FC",
  borderColor: "#D5D9EB",
  textColor: "#363F72",
} as const;

/**
 * Normalize a role type value for consistent matching.
 * - Trims whitespace
 * - Case-sensitive (preserves original casing for display)
 *
 * @param roleType - Raw role type string from input
 * @returns Trimmed role type
 */
export function normalizeTalentVaultRoleType(roleType: string): string {
  return roleType.trim();
}

/**
 * Resolve a role type value to canonical form with tokens and fallback handling.
 *
 * Algorithm:
 * 1. Normalize input (trim whitespace)
 * 2. Check if normalized value matches any canonical role (case-sensitive)
 * 3. If exact match: return canonical label and tokens
 * 4. If known alias (e.g., "Project-based" -> "Project-Based"): return canonical form
 * 5. If non-empty unknown value: return neutral fallback tokens + original display text
 * 6. If empty: return undefined
 *
 * @param roleType - Raw role type string
 * @returns Object with canonical label, display text, and color tokens, or undefined
 */
export function resolveRoleTypeBadge(roleType: string | null | undefined) {
  // Empty values return undefined
  if (!roleType || roleType.trim() === "") {
    return undefined;
  }

  const normalized = normalizeTalentVaultRoleType(roleType);

  // Check for exact match with canonical role
  if ((TALENT_VAULT_ROLE_TYPES as readonly string[]).includes(normalized)) {
    const canonical = normalized as TalentVaultRoleType;
    return {
      label: canonical,
      displayText: canonical,
      tokens: TALENT_VAULT_ROLE_TYPE_TOKENS[canonical],
    };
  }

  // Check for known alias: "Project-based" -> "Project-Based"
  if (normalized.toLowerCase() === "project-based") {
    const canonical: TalentVaultRoleType = "Project-Based";
    return {
      label: canonical,
      displayText: canonical,
      tokens: TALENT_VAULT_ROLE_TYPE_TOKENS[canonical],
    };
  }

  // Unknown non-empty value: use neutral fallback and preserve original display text
  return {
    label: undefined,
    displayText: normalized,
    tokens: TALENT_VAULT_ROLE_TYPE_NEUTRAL_TOKENS,
  };
}
