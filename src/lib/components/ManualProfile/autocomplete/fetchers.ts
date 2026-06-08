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

export interface AddressSuggestion {
  id: string;
  displayName: string;
}

interface PhotonFeature {
  properties?: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  geometry?: { coordinates?: number[] };
}

// Address suggestions from Photon (Komoot) — https + public, called directly
// (no auth, no proxy). Mirrors the edit-CV contact modal.
export async function searchAddresses(
  query: string,
  signal: AbortSignal,
): Promise<AddressSuggestion[]> {
  const response = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`,
    { signal },
  );
  const data = (await response.json()) as { features?: PhotonFeature[] };

  return (data.features || [])
    .map((feature, index) => {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates;
      const parts = [props.name, props.city, props.state, props.country].filter(Boolean);
      return {
        id: `${index}-${coords?.[0] ?? 0}-${coords?.[1] ?? 0}`,
        displayName: parts.length > 0 ? parts.join(", ") : props.name || "",
      };
    })
    .filter((item) => item.displayName);
}
