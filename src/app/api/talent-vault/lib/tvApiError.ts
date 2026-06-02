import { NextResponse } from "next/server";

/**
 * Standardized error response body for Talent Vault API endpoints.
 */
export type TvApiErrorBody = {
  errorCode: string;
  message: string;
  details: Record<string, unknown> | null;
};

/**
 * Helper function to create a consistent error response for Talent Vault API endpoints.
 *
 * @param status - HTTP status code
 * @param errorCode - Machine-readable error code
 * @param message - Human-readable error message
 * @param details - Optional error details (defaults to null)
 * @returns NextResponse with typed TvApiErrorBody
 */
export function tvErrorResponse(
  status: number,
  errorCode: string,
  message: string,
  details: Record<string, unknown> | null = null
): NextResponse<TvApiErrorBody> {
  return NextResponse.json<TvApiErrorBody>(
    {
      errorCode,
      message,
      details,
    },
    { status }
  );
}
