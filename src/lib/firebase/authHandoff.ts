/**
 * Cross-domain auth handoff helpers (client-side).
 *
 * Used by firebaseClient.js to detect when a login happened on a
 * Talent Vault subdomain (talentvault.{domain}) and redirect through
 * the handoff flow to the canonical domain.
 *
 * Supports both employer and applicant TV subdomains.
 */

import axios from "axios";

const EMPLOYER_DOMAIN = (process.env.NEXT_PUBLIC_EMPLOYER_APP_DOMAIN || "").toLowerCase();
const APPLICANT_DOMAIN = (process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN || "").toLowerCase();

/**
 * Normalize a hostname for comparison: lowercase, strip port, strip trailing dot.
 */
function normalizeHost(host: string): string {
  return host.split(":")[0].toLowerCase().replace(/\.$/, "");
}

/**
 * Returns true when the current page is on the **employer** Talent Vault
 * subdomain (talentvault.{employerDomain}).
 */
export function isOnEmployerTalentVaultDomain(): boolean {
  if (typeof window === "undefined") return false;
  const host = normalizeHost(window.location.host);
  if (!EMPLOYER_DOMAIN) return false;
  return host === `talentvault.${EMPLOYER_DOMAIN}`;
}

/**
 * Returns true when the current page is on the **applicant** Talent Vault
 * subdomain (talentvault.{applicantDomain}).
 */
export function isOnApplicantTalentVaultDomain(): boolean {
  if (typeof window === "undefined") return false;
  const host = normalizeHost(window.location.host);
  if (!APPLICANT_DOMAIN) return false;
  return host === `talentvault.${APPLICANT_DOMAIN}`;
}

/**
 * Initiate the handoff: call /api/auth/handoff/create with the current
 * Firebase token, then redirect to the canonical domain's /auth/handoff page.
 *
 * @param token  The Firebase ID token (from localStorage.authToken).
 * @param redirectPath  Where the user should end up after handoff completes.
 * @param target  Which canonical domain to bounce to ("employer" or "applicant").
 * @returns true if handoff was initiated (caller should stop further processing).
 * @throws Error if handoff request fails (caller should handle explicitly).
 */
export async function initiateHandoff(
  token: string,
  redirectPath: string,
  target: "employer" | "applicant" = "employer"
): Promise<boolean> {
  const res = await axios.post(
    "/api/auth/handoff/create",
    { redirectPath, target },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (res.data?.success && res.data?.redirectUrl) {
    window.location.href = res.data.redirectUrl;
    return true;
  }

  console.error("[Handoff] Create returned unexpected data:", res.data);
  return false;
}
