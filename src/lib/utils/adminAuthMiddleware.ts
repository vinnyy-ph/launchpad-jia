import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "./authMiddleware";
import { verifyUserIsAdmin } from "./adminAuth";
import connectMongoDB from "../mongoDB/mongoDB";

/**
 * Middleware that wraps withAuth and verifies that the user is a global super admin.
 * 
 * @param handler - The API route handler function
 * @returns Wrapped handler with super admin authentication
 */
export function withSuperAdminAuth(
  handler: (
    request: AuthenticatedRequest,
    context?: any
  ) => Promise<Response> | Response
) {
  return withAuth(async (request: AuthenticatedRequest, context?: any) => {
    try {
      const { db } = await connectMongoDB();
      const globalAdmin = await db.collection("admins").findOne({ email: request.user.email });
      
      if (!globalAdmin) {
        return NextResponse.json(
          { error: "Unauthorized - Global admin privileges required" },
          { status: 403 }
        );
      }

      return handler(request, context);
    } catch (error) {
      console.error("Super admin auth middleware error:", error);
      return NextResponse.json(
        { error: "Internal server error during authorization" },
        { status: 500 }
      );
    }
  });
}

/**
 * Middleware that wraps withAuth and additionally verifies that the user
 * has admin or super_admin privileges for the organization specified in the request.
 * 
 * The orgID can be provided in the request body (for POST/PATCH/PUT) 
 * or as a query parameter (for GET/DELETE).
 * 
 * @param handler - The API route handler function
 * @returns Wrapped handler with admin authentication
 */
export function withAdminAuth(
  handler: (
    request: AuthenticatedRequest,
    context?: any
  ) => Promise<Response> | Response
) {
  return withAuth(async (request: AuthenticatedRequest, context?: any) => {
    try {
      let orgID: string | null = null;

      // Try to get orgID from query parameters first
      const { searchParams } = new URL(request.url);
      orgID = searchParams.get("orgID");

      // If not in query params and it's a POST/PATCH/PUT request, try to get from body
      // Note: Reading body here might cause issues if the handler also tries to read it.
      // Next.js request.json() can only be called once.
      // To solve this, we can clone the request or rely on the handler to pass the orgID.
      // However, for admin routes, orgID is usually a top-level requirement.
      
      if (!orgID && ["POST", "PATCH", "PUT"].includes(request.method)) {
        try {
          const clonedRequest = request.clone();
          const body = await clonedRequest.json();
          orgID = body.orgID || body.orgId;
        } catch (e) {
          // Body might not be JSON or not exist
        }
      }

      if (!orgID) {
        // If we still don't have orgID, we check if the user is a global super admin
        const { db } = await connectMongoDB();
        const globalAdmin = await db.collection("admins").findOne({ email: request.user.email });
        if (globalAdmin) {
          return handler(request, context);
        }

        return NextResponse.json(
          { error: "Organization ID is required for admin authorization" },
          { status: 400 }
        );
      }

      const { db } = await connectMongoDB();
      const authResult = await verifyUserIsAdmin(db, request.user.email!, orgID);

      if (!authResult.authorized) {
        return NextResponse.json(
          { error: authResult.reason || "Unauthorized - Admin privileges required" },
          { status: 403 }
        );
      }

      return handler(request, context);
    } catch (error) {
      console.error("Admin auth middleware error:", error);
      return NextResponse.json(
        { error: "Internal server error during authorization" },
        { status: 500 }
      );
    }
  });
}
