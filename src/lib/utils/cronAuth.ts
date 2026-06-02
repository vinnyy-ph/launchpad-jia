import { NextRequest, NextResponse } from "next/server";

/**
 * Validates that the request is coming from a trusted source (Vercel Cron)
 * or includes a valid secret token.
 * 
 * @param request - The incoming request
 * @returns boolean indicating if the request is authorized
 */
export async function isCronAuthorized(request: NextRequest): Promise<boolean> {
  // 1. Check for Vercel Cron header
  const authHeader = request.headers.get('Authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }

  // 2. Fallback for manual testing (if CRON_SECRET is not set, this will fail safely)
  const cronSecret = request.nextUrl.searchParams.get('cron_secret');
  if (process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return true;
  }

  // 3. Vercel automatically adds this header when running cron jobs
  if (request.headers.get('x-vercel-cron') === '1') {
    return true;
  }

  return false;
}

/**
 * Response to return when cron authorization fails
 */
export const UnauthorizedCronResponse = NextResponse.json(
  { error: "Unauthorized - Cron secret required" },
  { status: 401 }
);
