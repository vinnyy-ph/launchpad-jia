import { superAdminList } from "@/lib/SuperAdminUtils";

export interface EmailTemplate {
  _id: string;
  name: string;
  subject: string;
  messagePreview: string;
  fullMessage: string;
  messageContent?: string;
  dateCreated: Date;
  templateType: "user" | "global" | "system";
  variables?: string[];
  isActive: boolean;
  userEmail?: string; // Email of the user who created the template (for user templates)
  orgID?: string; // Organization ID (for user and global templates)
}

export interface User {
  email?: string;
  [key: string]: any;
}

/**
 * Check if a user can view a specific template
 */
export function canViewTemplate(
  template: EmailTemplate,
  user: User,
  userOrgID?: string
): boolean {
  if (template.templateType === "system") {
    // System templates can be viewed by anyone
    return true;
  } else if (template.templateType === "global") {
    // Global templates can be viewed by anyone in the organization
    return userOrgID === template.orgID;
  } else if (template.templateType === "user") {
    // User templates can only be viewed by their creator within the organization
    return (
      userOrgID === template.orgID && user && user.email === template.userEmail
    );
  }
  return false;
}

/**
 * Check if a user can edit a specific template
 */
export function canEditTemplate(
  template: EmailTemplate,
  user: User,
  userOrgID?: string
): boolean {
  if (template.templateType === "system") {
    // System templates can only be edited by super admins
    return user && user.email ? superAdminList.includes(user.email) : false;
  } else if (template.templateType === "global") {
    // Global templates can be edited by anyone in the organization
    return userOrgID === template.orgID;
  } else if (template.templateType === "user") {
    // User templates can only be edited by their creator within the organization
    return (
      userOrgID === template.orgID && user && user.email === template.userEmail
    );
  }
  return false;
}

/**
 * Check if a user can delete a specific template
 */
export function canDeleteTemplate(
  template: EmailTemplate,
  user: User,
  userOrgID?: string
): boolean {
  if (template.templateType === "system") {
    // System templates cannot be deleted by anyone
    return false;
  } else if (template.templateType === "global") {
    // Global templates can be deleted by anyone in the organization
    return userOrgID === template.orgID;
  } else if (template.templateType === "user") {
    // User templates can only be deleted by their creator within the organization
    return (
      userOrgID === template.orgID && user && user.email === template.userEmail
    );
  }
  return false;
}

/**
 * Check if a user can create a specific type of template
 */
export function canCreateTemplate(
  templateType: "user" | "global" | "system",
  user: User,
  userOrgID?: string
): boolean {
  if (templateType === "system") {
    // System templates can only be created by super admins
    return user && user.email ? superAdminList.includes(user.email) : false;
  } else if (templateType === "global" || templateType === "user") {
    // User and global templates can be created by anyone with an organization
    return !!userOrgID;
  }
  return false;
}

/**
 * Check if a user is a super admin
 */
export function isSuperAdmin(user: User): boolean {
  return user && user.email ? superAdminList.includes(user.email) : false;
}
