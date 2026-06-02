import { useMemo, useEffect, useState } from 'react';
import { Project } from '@/lib/types/projects';

interface User {
  email: string;
  uid: string;
  [key: string]: any;
}

/**
 * Custom hook to check user permissions for project operations
 * Note: Client-side checks are for UI state only - server-side validation is authoritative
 */
export function useProjectPermissions(project: Project | null, user: User | null, orgID: string) {
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);

  // Fetch user's org role from localStorage
  useEffect(() => {
    const checkOrgRole = async () => {
      if (!user || !orgID) return;

      try {
        // Check localStorage for role (populated by AuthGuard)
        const storedRole = localStorage.getItem('role');
        setIsOrgAdmin(storedRole === 'admin');
      } catch (error) {
        console.error('Failed to check org role:', error);
      }
    };

    checkOrgRole();
  }, [user, orgID]);

  const permissions = useMemo(() => {
    if (!project || !user) {
      return {
        canAddCareers: false,
        canRemoveCareers: false,
        canManageMembers: false,
        canRename: false,
        canTransferOwnership: false,
        canDelete: false,
      };
    }

    const userEmail = user.email;
    const isOwner = project.owner?.email === userEmail;
    const isCreator = project.createdBy?.email === userEmail;

    // NOTE: Client-side checks are conservative approximations
    // Server-side validation is authoritative and will enforce actual permissions

    const canModify = isOwner || isOrgAdmin;

    return {
      canAddCareers: canModify,
      canRemoveCareers: canModify,
      canManageMembers: canModify,
      canRename: canModify,
      canTransferOwnership: canModify || isCreator,
      canDelete: canModify,
    };
  }, [project, user, isOrgAdmin]);

  return permissions;
}
