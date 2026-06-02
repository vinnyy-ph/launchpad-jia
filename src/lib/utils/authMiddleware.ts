/**
 * Authentication middleware using wrapper function with Firebase token verification
 * Provides decoded user object to API route handlers
 */

import { NextRequest, NextResponse } from "next/server";
import backendAuthCheck from "../firebase/backendAuthCheck";
import type { DecodedIdToken } from "firebase-admin/auth";

/**
 * Authenticated request with user information
 * Access user via request.user in your route handlers
 */
export interface AuthenticatedRequest extends NextRequest {
  user: DecodedIdToken;
}

type TokenValidationResult = 
  | { success: true; token: DecodedIdToken }
  | { success: false; error: "missing_token" | "invalid_token" | "verification_failed" };

/**
 * Validates bearer token from request headers and verifies with Firebase
 * @param request - The incoming request
 * @returns Object containing success status and either the decoded token or error type
 */
async function validateBearerToken(
  request: Request
): Promise<TokenValidationResult> {
  const authHeader = request.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { success: false, error: "missing_token" };
  }

  const token = authHeader.split("Bearer ")[1];

  if (!token) {
    return { success: false, error: "missing_token" };
  }

  try {
    const decoded = await backendAuthCheck(token);
    if ((decoded as any)?.error || !decoded) {
      console.error("Token verification failed:", (decoded as any)?.error);
      return { success: false, error: "invalid_token" };
    }
    return { success: true, token: decoded as DecodedIdToken };
  } catch (error) {
    console.error("Error verifying token:", error);
    return { success: false, error: "verification_failed" };
  }
}

/**
 * Best-effort helper for endpoints that support both authenticated and unauthenticated flows.
 * Returns decoded user if Authorization Bearer token is present and valid; otherwise null.
 */
export async function tryGetBearerUser(
  request: Request
): Promise<DecodedIdToken | null> {
  const result = await validateBearerToken(request);
  return result.success ? result.token : null;
}

/**
 * Higher-order function that wraps API route handlers with Firebase authentication
 * Automatically validates token and provides decoded user object to handlers
 *
 * @param handler - The API route handler function
 * @returns Wrapped handler with authentication
 *
 * @example
 * export const POST = withAuth(async (request: AuthenticatedRequest) => {
 *   const { user } = request; // Decoded Firebase user with uid, email, etc.
 *   const body = await request.json();
 *   console.log('User:', user.uid, user.email);
 *   return NextResponse.json({ success: true });
 * });
 */
export function withAuth(
  handler: (
    request: AuthenticatedRequest,
    context?: any
  ) => Promise<Response> | Response
) {
  return async (request: Request, context?: any): Promise<Response> => {
    const validationResult = await validateBearerToken(request);

    if (!validationResult.success) {
      let errorMessage = "Unauthorized";
      let status = 401;

      // Type guard is handled by !validationResult.success which implies 
      // the type is { success: false; error: ... }
      const errorType = (validationResult as { success: false; error: string }).error;

      switch (errorType) {
        case "missing_token":
          errorMessage = "Unauthorized - Missing Bearer token";
          break;
        case "invalid_token":
        case "verification_failed":
          errorMessage = "Unauthorized - Invalid or expired token";
          break;
      }

      return NextResponse.json(
        { error: errorMessage },
        { status }
      );
    }

    // Attach decoded user to request
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.user = validationResult.token;

    return handler(authenticatedRequest, context);
  };
}
