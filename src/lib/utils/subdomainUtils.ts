// subdomain utils
export const RESERVED_SUBDOMAINS = ['www', 'admin', 'api', 'cdn', 'mail', 'staging', 'talentvault'];

export function extractSubdomain(hostname: string): string | null {
  if (!hostname) return null;

  const hostWithoutPort = hostname.split(':')[0];

  if (hostWithoutPort.includes('localhost')) {
    const parts = hostWithoutPort.split('.');
    if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
        const subdomain = parts[0];
        if (RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) return null;
        return subdomain;
    }
    return null;
  }

  const applicantDomain = process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN || '';
  const baseDomain = applicantDomain.split(':')[0];

  if (!hostWithoutPort.includes(baseDomain)) return null;

  const parts = hostWithoutPort.split('.');
  
  if (parts.length < 3) return null;

  const subdomain = parts[0];

  if (RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) return null;

  return subdomain;
}

export function isValidSubdomain(subdomain: string): boolean {
  if (!subdomain) return false;
  
  const subdomainRegex = /^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$/;
  return subdomainRegex.test(subdomain) && subdomain.length >= 3 && subdomain.length <= 50;
}

export function generateJobPortalUrl(orgSlug: string | null, jobID?: string): string {
  const applicantDomain = process.env.NEXT_PUBLIC_APPLICANT_APP_DOMAIN || '';
  const isLocalhost = applicantDomain.includes('localhost');
  
  let protocol = isLocalhost ? 'http' : 'https';
  if (typeof window !== 'undefined') {
    protocol = window.location.protocol.replace(':', '');
  }
  
  let baseUrl: string;
  
  if (orgSlug && isValidSubdomain(orgSlug)) {
    if (isLocalhost) {
        const portMatch = applicantDomain.match(/:(\d+)$/);
        const port = portMatch ? `:${portMatch[1]}` : '';

        if (!applicantDomain.includes('localhost')) {
             baseUrl = `${protocol}://${orgSlug}.${applicantDomain}`;
        } else {
             baseUrl = `${protocol}://${orgSlug}.localhost${port}`;
        }
    } else {
        baseUrl = `${protocol}://${orgSlug}.${applicantDomain}`;
    }
  } else {
    baseUrl = `${protocol}://${applicantDomain}`;
  }
  
  const path = jobID ? `/job-openings/${jobID}` : '/job-openings';
  
  return `${baseUrl}${path}`;
}
