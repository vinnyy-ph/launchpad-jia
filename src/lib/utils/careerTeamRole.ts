export const LEGACY_REVIEWER_ROLE = "Reviewer";
export const HIRING_MANAGER_ROLE = "Hiring Manager";

export const normalizeCareerTeamRole = (
  role?: string | null
): string | undefined => {
  if (!role) return undefined;
  return role === LEGACY_REVIEWER_ROLE ? HIRING_MANAGER_ROLE : role;
};
