import { Db } from "mongodb";

/**
 * Verifies if the user is an admin or super_admin in the organization,
 * or a global admin in the system.
 * 
 * @param db - The MongoDB database instance
 * @param email - The email of the user attempting the action
 * @param orgID - The organization ID the action is targeting
 * @returns Object indicating if authorized and optional reason
 */
export async function verifyUserIsAdmin(
  db: Db,
  email: string,
  orgID: string
): Promise<{ authorized: boolean; reason?: string }> {
  if (!email) {
    return { authorized: false, reason: "Unauthorized - User email is missing from request" };
  }
  
  if (!orgID) {
    return { authorized: false, reason: "Bad Request - Organization ID is required" };
  }

  // Optimization: Parallelize global admin check and organization member role check
  const [admin, member] = await Promise.all([
    db.collection("admins").findOne({ email }, { projection: { _id: 1 } }),
    db.collection("members").findOne({ email, orgID }, { projection: { role: 1 } })
  ]);

  if (admin) {
    return { authorized: true };
  }

  if (!member) {
      return { authorized: false, reason: "Unauthorized - User is not a member of this organization" };
  }

  if (member.role === "admin" || member.role === "super_admin") {
    return { authorized: true };
  }

  return { authorized: false, reason: "Unauthorized - User does not have admin privileges" };
}

/**
 * Verifies if the user is a member of the organization.
 * 
 * @param db - The MongoDB database instance
 * @param email - The email of the user attempting the action
 * @param orgID - The organization ID the action is targeting
 * @returns Object indicating if authorized and optional reason
 */
export async function verifyUserIsMember(
  db: Db,
  email: string,
  orgID: string
): Promise<{ authorized: boolean; reason?: string }> {
  if (!email) {
    return { authorized: false, reason: "Unauthorized - User email is missing from request" };
  }
  
  if (!orgID) {
    return { authorized: false, reason: "Bad Request - Organization ID is required" };
  }

  // Optimization: Parallelize global admin check and organization membership check
  // Use projections to minimize data transfer from MongoDB
  const [admin, member] = await Promise.all([
    db.collection("admins").findOne({ email }, { projection: { _id: 1 } }),
    db.collection("members").findOne({ email, orgID }, { projection: { _id: 1 } })
  ]);

  if (admin || member) {
    return { authorized: true };
  }

  return { authorized: false, reason: "Unauthorized - User is not a member of this organization" };
}
