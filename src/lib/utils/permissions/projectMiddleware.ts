import { NextResponse } from "next/server";
import { AuthenticatedRequest, withAuth } from "@/lib/utils/authMiddleware";
import connectMongoDB from "@/lib/mongoDB/mongoDB";
import { ObjectId, Db } from "mongodb";
import {
  canAddCareersToProject,
  canRemoveCareerFromProject,
  canDeleteProject,
  canTransferOwnership,
  canManageProjectMembers,
  canRenameProject,
  canLinkCareerToProject,
} from "./projectAccess";

// ============================================================================
// TYPES
// ============================================================================

export interface ProjectContext {
  project: any;
  organization: any;
  db: Db;
  orgID: string;
  userMember: any | null;
}

export interface ProjectAuthenticatedRequest extends AuthenticatedRequest {
  projectContext: ProjectContext;
  json(): Promise<any>;
}

export type ProjectPermissionType =
  | "add-careers"
  | "remove-career"
  | "delete"
  | "update-owner"
  | "update-members"
  | "update-name"
  | "link-career";

// ============================================================================
// PERMISSION MAPPING
// ============================================================================

const PERMISSION_CHECKS: Record<
  ProjectPermissionType,
  (
    userEmail: string,
    project: any,
    orgID: string,
    db: Db,
    cachedMember?: any
  ) => Promise<boolean>
> = {
  "add-careers": canAddCareersToProject,
  "remove-career": canRemoveCareerFromProject,
  delete: canDeleteProject,
  "update-owner": canTransferOwnership,
  "update-members": canManageProjectMembers,
  "update-name": canRenameProject,
  "link-career": canLinkCareerToProject,
};

const ERROR_MESSAGES: Record<ProjectPermissionType, string> = {
  "add-careers": "You do not have permission to add careers to this project",
  "remove-career":
    "You do not have permission to remove careers from this project",
  delete: "You do not have permission to delete this project",
  "update-owner":
    "You do not have permission to transfer ownership of this project",
  "update-members":
    "You do not have permission to manage project members",
  "update-name": "You do not have permission to rename this project",
  "link-career": "You do not have permission to link careers to this project",
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

export interface ProjectPermissionOptions {
  skipProjectsEnabledCheck?: boolean;
  skipMemberCache?: boolean;
}

export function withProjectPermission(
  permissions: ProjectPermissionType | ProjectPermissionType[],
  options: ProjectPermissionOptions = {}
) {
  return function (
    handler: (request: ProjectAuthenticatedRequest) => Promise<Response>
  ) {
    return async (request: AuthenticatedRequest): Promise<Response> => {
      try {
        // Parse request body
        const body = await request.json();
        const { projectId, orgID } = body;

        // Validate required parameters
        if (!projectId) {
          return NextResponse.json(
            { error: "Project ID is required" },
            { status: 400 }
          );
        }

        if (!orgID) {
          return NextResponse.json(
            { error: "Organization ID is required" },
            { status: 400 }
          );
        }

        // Connect to database
        const { db } = await connectMongoDB();

        // Fetch organization
        const organization = await db.collection("organizations").findOne({
          _id: new ObjectId(orgID),
        });

        if (!organization) {
          return NextResponse.json(
            { error: "Organization not found" },
            { status: 404 }
          );
        }

        // Check projects feature flag
        if (
          !options.skipProjectsEnabledCheck &&
          !organization.projectsEnabled
        ) {
          return NextResponse.json(
            {
              error: "Projects feature is not enabled for this organization",
            },
            { status: 403 }
          );
        }

        // Fetch project WITH orgID filter (SECURITY FIX - prevents cross-org access)
        const project = await db.collection("projects").findOne({
          _id: new ObjectId(projectId),
          orgID, // CRITICAL: Prevents cross-org access
        });

        if (!project) {
          return NextResponse.json(
            { error: "Project not found" },
            { status: 404 }
          );
        }

        // Fetch user member for caching (optimization)
        let userMember = null;
        if (!options.skipMemberCache) {
          userMember = await db.collection("members").findOne({
            email: request.user.email,
            orgID,
          });
        }

        // Normalize permissions to array
        const permissionList = Array.isArray(permissions)
          ? permissions
          : [permissions];

        // Check all required permissions
        for (const permType of permissionList) {
          const checkFunction = PERMISSION_CHECKS[permType];
          const hasPermission = await checkFunction(
            request.user.email,
            project,
            orgID,
            db,
            userMember
          );

          if (!hasPermission) {
            console.warn("Permission denied:", {
              user: request.user.email,
              projectId,
              orgID,
              permissionType: permType,
            });

            return NextResponse.json(
              { error: ERROR_MESSAGES[permType] },
              { status: 403 }
            );
          }
        }

        // Create enhanced request with context
        const projectRequest = request as ProjectAuthenticatedRequest;
        projectRequest.projectContext = {
          project,
          organization,
          db,
          orgID,
          userMember,
        };

        // Cache body for re-reading
        (projectRequest as any)._body = body;
        Object.defineProperty(projectRequest, "json", {
          value: async () => (projectRequest as any)._body,
          writable: false,
          configurable: true,
        });

        return handler(projectRequest);
      } catch (error) {
        console.error("Project permission middleware error:", error);
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      }
    };
  };
}

// ============================================================================
// COMPOSITION HELPER
// ============================================================================

export function withAuthAndProjectPermission(
  permissions: ProjectPermissionType | ProjectPermissionType[],
  options?: ProjectPermissionOptions
) {
  return function (
    handler: (request: ProjectAuthenticatedRequest) => Promise<Response>
  ) {
    return withAuth(withProjectPermission(permissions, options)(handler));
  };
}
