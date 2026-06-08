// Logo URL helpers shared by the manual-profile autocomplete fields. Mirrors the
// fallback strategy used by the edit-CV modals (logo.dev -> Brandfetch -> favicon).

export type LogoFormat = "webp" | "png" | "jpg";

export const LOGO_FORMATS: LogoFormat[] = ["webp", "png", "jpg"];

const LOGO_SIZE = 40;
// TODO: Move the Brandfetch id to environment variables (matches the edit-CV modals).
const BRANDFETCH_PUBLIC_CLIENT_ID_FALLBACK = "1idbHCuB66Z-QiSsg0M";

function logoDevKey(): string {
  return process.env.NEXT_PUBLIC_LOGODEV_PUBLISHABLE_KEY || "";
}

function brandfetchClientId(): string {
  return process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID || BRANDFETCH_PUBLIC_CLIENT_ID_FALLBACK;
}

export function normalizeDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();
}

export function buildLogoDevUrl(domain: string, format: LogoFormat): string {
  const key = logoDevKey();
  if (!domain || !key) return "";

  const encodedDomain = encodeURIComponent(domain.trim().toLowerCase());
  const params = new URLSearchParams({
    token: key,
    size: String(LOGO_SIZE),
    format,
  });

  return `https://img.logo.dev/${encodedDomain}?${params.toString()}`;
}

export function buildBrandfetchLogoUrl(domain: string): string {
  const clientId = brandfetchClientId();
  if (!domain || !clientId) return "";

  return `https://cdn.brandfetch.io/${encodeURIComponent(
    domain.trim().toLowerCase(),
  )}/w/80/h/80?c=${encodeURIComponent(clientId)}`;
}

// logo.dev first (when a key is configured), Brandfetch CDN otherwise.
export function buildLogoUrl(domain: string, format: LogoFormat): string {
  const logoDevUrl = buildLogoDevUrl(domain, format);
  if (logoDevUrl) return logoDevUrl;

  return buildBrandfetchLogoUrl(domain);
}

export function buildFaviconUrl(domain: string): string {
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}
