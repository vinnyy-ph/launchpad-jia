// Suggestion fetchers for the manual-profile autocomplete fields.
// - searchBrands: company / issuing-organization via the Brandfetch-backed route.
// - searchSchools: universities via the prod-safe hipolabs proxy route.

import { api } from "@/lib/utils/apiClient";
import { buildLogoUrl, normalizeDomain } from "./logoUrls";

export interface Suggestion {
  key: string;
  name: string;
  domain: string;
  logoUrl?: string;
  meta?: string;
}

export async function searchBrands(query: string, signal: AbortSignal): Promise<Suggestion[]> {
  const response = await api.get(
    `/api/whitecloak/logo-brand-search?q=${encodeURIComponent(query)}&strategy=typeahead`,
    { signal },
  );
  const rawResults = Array.isArray(response?.data?.results) ? response.data.results : [];

  return rawResults
    .map((item: unknown, index: number) => {
      const record = (item ?? {}) as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const domain = typeof record.domain === "string" ? normalizeDomain(record.domain) : "";
      const logoUrl = typeof record.logoUrl === "string" ? record.logoUrl.trim() : "";
      return { key: `${domain}-${index}`, name, domain, logoUrl } satisfies Suggestion;
    })
    .filter((item: Suggestion) => item.name && item.domain)
    .slice(0, 10);
}

export async function searchSchools(query: string, signal: AbortSignal): Promise<Suggestion[]> {
  const response = await api.get(
    `/api/talent-vault/university-search?q=${encodeURIComponent(query)}`,
    { signal },
  );
  const rawResults = Array.isArray(response?.data?.results) ? response.data.results : [];

  return rawResults
    .map((item: unknown, index: number) => {
      const record = (item ?? {}) as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const domain = typeof record.domain === "string" ? normalizeDomain(record.domain) : "";
      const country = typeof record.country === "string" ? record.country.trim() : "";
      return {
        key: `${index}-${domain || "no-domain"}-${name.toLowerCase().replace(/\s+/g, "-")}`,
        name,
        domain,
        logoUrl: domain ? buildLogoUrl(domain, "webp") : "",
        meta: country,
      } satisfies Suggestion;
    })
    .filter((item: Suggestion) => item.name)
    .slice(0, 12);
}
