import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { APPLICANT_GOOGLE_TRACKING_IDS, EMPLOYER_GOOGLE_TRACKING_IDS } from './lib/utils/constants';
import { extractSubdomain } from './lib/utils/subdomainUtils';

/** Returns true if origin is allowed by exact match or by a wildcard pattern (e.g. https://*.hellojia.ai). */
function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes(origin)) return true;
  for (const pattern of allowedOrigins) {
    if (pattern.includes('*')) {
      const escaped = pattern
        .replace(/\*/g, '__W__')
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/__W__/g, '[^/]+');
      if (new RegExp(`^${escaped}$`).test(origin)) return true;
    }
  }
  return false;
}

/**
 * Build the Content-Security-Policy header value with a per-request nonce.
 *
 * Modern browsers (CSP Level 3) honour the nonce and 'strict-dynamic',
 * automatically ignoring the domain whitelist and the 'unsafe-inline' fallback.
 * Older browsers that don't understand nonces fall back to the domain
 * whitelist + 'unsafe-inline', providing graceful degradation.
 */
function buildCSP(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production';
  const evalDirective = isDev ? " 'unsafe-eval'" : " 'wasm-unsafe-eval'";
  const upgradeInsecureRequests = isDev ? '' : "upgrade-insecure-requests";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'${evalDirective} https://connect.facebook.net https://www.googletagmanager.com https://widgets.leadconnectorhq.com https://link.hirejia.ai https://*.firebaseapp.com https://apis.google.com https://accounts.google.com https://www.gstatic.com https://www.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://vercel.live`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.cdnfonts.com https://maxst.icons8.com https://fonts.bunny.net https://widgets.leadconnectorhq.com https://unpkg.com",
    "img-src 'self' data: blob: https: https://img.logo.dev",
    "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com https://fonts.cdnfonts.com https://maxst.icons8.com https://fonts.bunny.net",
    "connect-src 'self' wss://generativelanguage.googleapis.com https://generativelanguage.googleapis.com https://*.googleapis.com https://*.firebaseapp.com https://securetoken.googleapis.com https://www.googleapis.com https://apis.google.com https://*.google.com https://lh3.googleusercontent.com https://*.googleusercontent.com https://graph.microsoft.com https://login.microsoftonline.com https://www.googletagmanager.com https://www.google-analytics.com https://www.facebook.com https://*.leadconnectorhq.com https://link.hirejia.ai https://*.hellojia.ai https://*.hirejia.ai https://api.dicebear.com https://vercel.live https://googleads.g.doubleclick.net https://*.doubleclick.net https://*.msgsndr.com https://www.gstatic.com https://httpbin.org/get https://api.openai.com https://*.r2.cloudflarestorage.com https://nominatim.openstreetmap.org https://*.herokuapp.com https://photon.komoot.io https://universities.hipolabs.com https://img.logo.dev https://api.logo.dev",
    "frame-src 'self' https://link.hirejia.ai https://accounts.google.com https://login.microsoftonline.com https://*.firebaseapp.com https://www.googletagmanager.com https://vercel.live https://widgets.leadconnectorhq.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net",
    "worker-src 'self' blob:",
    "media-src 'self' blob: https://cdn.hellojia.ai https://*.r2.cloudflarestorage.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    upgradeInsecureRequests,
  ].filter(Boolean).join("; ");
}

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCSP(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const host = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;
  const url = request.nextUrl.clone();

  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
  const isHttp = request.headers.get('x-forwarded-proto') === 'http' || 
                 url.protocol === 'http:';
  const trackingCookieOptions = {
    secure: !isLocalhost,
    sameSite: "lax" as const,
    path: "/",
  }

  const allowedOrigins = (process.env.ALLOWED_CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
  let requestOrigin = request.headers.get('origin');
  if (!requestOrigin) {
    const referer = request.headers.get('referer');
    if (referer) {
      try {
        requestOrigin = new URL(referer).origin;
      } catch {
        requestOrigin = null;
      }
    }
  }

  if (!isLocalhost && isHttp) {
    url.protocol = 'https:';
    return NextResponse.redirect(url, 301);
  }

  // CORS: only for /api/* and only when Origin is whitelisted; skip server-only paths
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/cron/') && !pathname.startsWith('/api/save-metrics')) {
    if (requestOrigin && isOriginAllowed(requestOrigin, allowedOrigins)) {
      const corsHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': requestOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-org-subdomain',
        'Access-Control-Max-Age': '86400',
      };
      if (request.method === 'OPTIONS') {
        return new NextResponse(null, { status: 204, headers: corsHeaders });
      }
      const res = NextResponse.next({ request: { headers: requestHeaders } });
      Object.entries(corsHeaders).forEach(([key, value]) => res.headers.set(key, value));
      res.headers.set('Content-Security-Policy', csp);
      return res;
    }
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set('Content-Security-Policy', csp);
    return res;
  }

  // Employer landing page (src/app/page.tsx). On single-domain deploys "/"
  // is rewritten to the applicant job portal, so the employer landing is
  // exposed at /employers instead (pathConstants.employer points here).
  if (pathname === "/employers") {
    url.pathname = "/";
    const res = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    res.headers.set('Content-Security-Policy', csp);
    return res;
  }

  const employerAppDomain = process.env.NEXT_PUBLIC_EMPLOYER_APP_DOMAIN || "";
  const applicantAppDomain = process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN || "";
  const adminAppDomain = process.env.NEXT_PUBLIC_ADMIN_APP_DOMAIN || "";

  const subdomain = extractSubdomain(host);

  const talentVaultEmployerDomain = `talentvault.${employerAppDomain}`;
  const talentVaultApplicantDomain = `talentvault.${applicantAppDomain}`;

  if (!isLocalhost) {
    if (host.includes(talentVaultEmployerDomain)) {
      if (pathname === "/" || pathname === "/talent-vault") {
        url.pathname = "/talent-vault";
        const res = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
        res.cookies.set("ga-id", EMPLOYER_GOOGLE_TRACKING_IDS.measurementId, trackingCookieOptions);
        res.cookies.set("ads-id", EMPLOYER_GOOGLE_TRACKING_IDS.adsId, trackingCookieOptions);
        res.headers.set('Content-Security-Policy', csp);
        return res;
      }
      
      const newUrl = new URL(request.url);
      newUrl.hostname = employerAppDomain;
      const res = NextResponse.redirect(newUrl);
      res.cookies.set("ga-id", EMPLOYER_GOOGLE_TRACKING_IDS.measurementId, trackingCookieOptions);
      res.cookies.set("ads-id", EMPLOYER_GOOGLE_TRACKING_IDS.adsId, trackingCookieOptions);
      return res;
    }

    if (host.includes(talentVaultApplicantDomain)) {
      if (pathname === "/" || pathname === "/talent-vault/students") {
        url.pathname = "/talent-vault/students";
        const res = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
        res.cookies.set("ga-id", APPLICANT_GOOGLE_TRACKING_IDS.measurementId, trackingCookieOptions);
        if (APPLICANT_GOOGLE_TRACKING_IDS.adsId) {
          res.cookies.set("ads-id", APPLICANT_GOOGLE_TRACKING_IDS.adsId, trackingCookieOptions);
        }
        res.headers.set('Content-Security-Policy', csp);
        return res;
      }

      const newUrl = new URL(request.url);
      newUrl.hostname = applicantAppDomain;
      const res = NextResponse.redirect(newUrl);
      res.cookies.set("ga-id", APPLICANT_GOOGLE_TRACKING_IDS.measurementId, trackingCookieOptions);
      if (APPLICANT_GOOGLE_TRACKING_IDS.adsId) {
        res.cookies.set("ads-id", APPLICANT_GOOGLE_TRACKING_IDS.adsId, trackingCookieOptions);
      }
      return res;
    }
  }

  if (subdomain && host.includes(applicantAppDomain) && (pathname === "/" || pathname === "/job-portal")) {
    const newUrl = new URL(request.url);
    newUrl.pathname = "/job-openings";
    const res = NextResponse.redirect(newUrl);
    res.cookies.set("ga-id", APPLICANT_GOOGLE_TRACKING_IDS.measurementId);
    if (APPLICANT_GOOGLE_TRACKING_IDS.adsId) {
      res.cookies.set("ads-id", APPLICANT_GOOGLE_TRACKING_IDS.adsId);
    }
    return res;
  }

  if (!subdomain && pathname === "/" && host.includes(applicantAppDomain)) {
    url.pathname = "/job-portal";
    const res = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    res.cookies.set("ga-id", APPLICANT_GOOGLE_TRACKING_IDS.measurementId);
    if (APPLICANT_GOOGLE_TRACKING_IDS.adsId) {
      res.cookies.set("ads-id", APPLICANT_GOOGLE_TRACKING_IDS.adsId);
    }
    res.headers.set('Content-Security-Policy', csp);
    return res;
  }

  if (
    host.includes(employerAppDomain) &&
    // Single-domain deploys serve both portals from one host; redirecting to
    // the applicant domain would loop back onto the same URL.
    employerAppDomain !== applicantAppDomain &&
    !host.startsWith(adminAppDomain) &&
    !host.includes("localhost") &&
    (pathname.startsWith("/dashboard") || pathname.startsWith("/job-openings") || pathname.startsWith("/login"))
  ) {
    const newUrl = new URL(request.url);
    newUrl.hostname = applicantAppDomain;
    const res = NextResponse.redirect(newUrl);
    res.cookies.set("ga-id", APPLICANT_GOOGLE_TRACKING_IDS.measurementId, trackingCookieOptions);
    if (APPLICANT_GOOGLE_TRACKING_IDS.adsId) {
      res.cookies.set("ads-id", APPLICANT_GOOGLE_TRACKING_IDS.adsId, trackingCookieOptions);
    }
    return res;
  }

  if (host.includes(adminAppDomain) && pathname === "/") {
    const adminUrl = request.nextUrl.clone();
    adminUrl.pathname = `/admin-portal`;
    const res = NextResponse.rewrite(adminUrl, { request: { headers: requestHeaders } });
    res.headers.set('Content-Security-Policy', csp);
    return res;
  }

  if (!host.includes(employerAppDomain) && !host.includes("localhost") && pathname.includes("old-dashboard")) {
    const newUrl = new URL(request.url);
    newUrl.hostname = employerAppDomain;
    const res = NextResponse.redirect(newUrl);
    res.cookies.set("ga-id", EMPLOYER_GOOGLE_TRACKING_IDS.measurementId, trackingCookieOptions);
    res.cookies.set("ads-id", EMPLOYER_GOOGLE_TRACKING_IDS.adsId, trackingCookieOptions);
    return res;
  }

  if (!host.includes(applicantAppDomain) && !host.includes("localhost") && (pathname.includes("whitecloak/applicant") || pathname.includes("job-openings"))) {
    const newUrl = new URL(request.url);
    newUrl.hostname = applicantAppDomain;
    const res = NextResponse.redirect(newUrl);
    res.cookies.set("ga-id", APPLICANT_GOOGLE_TRACKING_IDS.measurementId, trackingCookieOptions);
    if (APPLICANT_GOOGLE_TRACKING_IDS.adsId) {
      res.cookies.set("ads-id", APPLICANT_GOOGLE_TRACKING_IDS.adsId, trackingCookieOptions);
    }
    return res;
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  
  if (subdomain && pathname.includes('/job-openings')) {
    res.headers.set('x-org-subdomain', subdomain);
  }
  
  if (host.includes(applicantAppDomain)) {
    res.cookies.set("ga-id", APPLICANT_GOOGLE_TRACKING_IDS.measurementId, trackingCookieOptions);
    if (APPLICANT_GOOGLE_TRACKING_IDS.adsId) {
      res.cookies.set("ads-id", APPLICANT_GOOGLE_TRACKING_IDS.adsId, trackingCookieOptions);
    }
  }

  if (host.includes(employerAppDomain) && !host.startsWith(adminAppDomain)) {
    res.cookies.set("ga-id", EMPLOYER_GOOGLE_TRACKING_IDS.measurementId, trackingCookieOptions);
    res.cookies.set("ads-id", EMPLOYER_GOOGLE_TRACKING_IDS.adsId, trackingCookieOptions);
  }

  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
