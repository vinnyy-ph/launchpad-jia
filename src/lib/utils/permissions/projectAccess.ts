import { superAdminList } from "@/lib/SuperAdminUtils";
import { Db } from "mongodb";
import { Project } from "@/lib/types/projects";

/**
 * Check if a user is a super admin
 */
export function isSuperAdmin(userEmail: string): boolean {
  return superAdminList.includes(userEmail);
}

/**
 * Check if a user is an organization admin (requires DB query)
 */
export async function isOrgAdmin(
  userEmail: string,
  orgID: string,
  db: Db
): Promise<boolean> {
  const member = await db.collection("members").findOne({
    email: userEmail,
    orgID,
  });
  return member?.role === "admin";
}

/**
 * Check if a user is the project owner (synchronous)
 */
export function isProjectOwner(userEmail: string, project: Project): boolean {
  return project.owner.email === userEmail;
}

/**
 * Check if a user is the project creator (synchronous)
 */
export function isProjectCreator(
  userEmail: string,
  project: Project
): boolean {
  return project.createdBy?.email === userEmail;
}

/**
 * Check if a user can add careers to a project
 * Allowed: Super admins, org admins, project owner, hiring managers
 */
export async function canAddCareersToProject(
  userEmail: string,
  project: Project,
  orgID: string,
  db: Db,
  cachedMember?: any
): Promise<boolean> {
  // Super admins always allowed
  if (isSuperAdmin(userEmail)) return true;

  // Project owner allowed
  if (isProjectOwner(userEmail, project)) return true;

  // Use cached member if available (avoids DB query)
  if (cachedMember !== undefined) {
    if (cachedMember?.role === "guest") return false;
    return cachedMember?.role === "admin" || cachedMember?.role === "hiring_manager";
  }

  // Fallback to DB query
  if (await isOrgAdmin(userEmail, orgID, db)) return true;

  // Check if user is a hiring manager
  const member = await db.collection("members").findOne({
    email: userEmail,
    orgID,
  });

  if (member?.role === "guest") return false;

  if (member?.role === "hiring_manager") return true;

  // Other members NOT allowed
  return false;
}

/**
 * Check if a user can remove a career from a project
 * Allowed: Super admins, org admins, project owner
 * NOT allowed: hiring managers
 */
export async function canRemoveCareerFromProject(
  userEmail: string,
  project: Project,
  orgID: string,
  db: Db,
  cachedMember?: any
): Promise<boolean> {
  // Super admins always allowed
  if (isSuperAdmin(userEmail)) return true;

  // Project owner allowed
  if (isProjectOwner(userEmail, project)) return true;

  // Use cached member if available (avoids DB query)
  if (cachedMember !== undefined) {
    if (cachedMember?.role === "guest") return false;
    return cachedMember?.role === "admin";
  }

  // Fallback to DB query - only org admins allowed
  if (await isOrgAdmin(userEmail, orgID, db)) return true;

  // Hiring managers and guests not allowed to remove careers
  return false;
}

/**
 * Check if a user can transfer project ownership
 * Allowed: Super admins, org admins, current owner, original creator
 */
export async function canTransferOwnership(
  userEmail: string,
  project: Project,
  orgID: string,
  db: Db,
  cachedMember?: any
): Promise<boolean> {
  // Super admins always allowed
  if (isSuperAdmin(userEmail)) return true;

  // Current owner allowed
  if (isProjectOwner(userEmail, project)) return true;

  // Original creator allowed
  if (isProjectCreator(userEmail, project)) return true;

  // Use cached member if available (avoids DB query)
  if (cachedMember !== undefined) {
    if (cachedMember?.role === "guest") return false;
    return cachedMember?.role === "admin";
  }

  // Fallback to DB query
  if (await isOrgAdmin(userEmail, orgID, db)) return true;

  return false;
}

/**
 * Check if a user can manage project members
 * Allowed: Super admins, org admins, project owner
 */
export async function canManageProjectMembers(
  userEmail: string,
  project: Project,
  orgID: string,
  db: Db,
  cachedMember?: any
): Promise<boolean> {
  // Same as add/remove careers
  return canAddCareersToProject(userEmail, project, orgID, db, cachedMember);
}

/**
 * Check if a user can rename a project
 * Allowed: Super admins, org admins, project owner
 */
export async function canRenameProject(
  userEmail: string,
  project: Project,
  orgID: string,
  db: Db,
  cachedMember?: any
): Promise<boolean> {
  // Same as add/remove careers
  return canAddCareersToProject(userEmail, project, orgID, db, cachedMember);
}

/**
 * Check if a user can delete a project
 * Allowed: Super admins, org admins, project owner
 */
export async function canDeleteProject(
  userEmail: string,
  project: Project,
  orgID: string,
  db: Db,
  cachedMember?: any
): Promise<boolean> {
  // Same as add/remove careers
  return canAddCareersToProject(userEmail, project, orgID, db, cachedMember);
}

/**
 * Check if a user can link/unlink careers to/from projects
 * Allowed when updating existing careers: Super admins, org admins, project owner
 * Allowed when creating new careers: Also includes hiring managers
 * NOT allowed: hiring managers updating existing career links
 */
export async function canLinkCareerToProject(
  userEmail: string,
  project: Project,
  orgID: string,
  db: Db,
  cachedMember?: any
): Promise<boolean> {
  if (isSuperAdmin(userEmail)) return true;

  if (isProjectOwner(userEmail, project)) return true;

  if (cachedMember !== undefined) {
    if (cachedMember?.role === "guest") return false;
    return cachedMember?.role === "admin" || cachedMember?.role === "hiring_manager";
  }

  if (await isOrgAdmin(userEmail, orgID, db)) return true;

  const member = await db.collection("members").findOne({
    email: userEmail,
    orgID,
  });

  if (member?.role === "guest") return false;

  if (member?.role === "hiring_manager") return true;

  return false;
}
