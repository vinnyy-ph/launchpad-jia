import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/utils/authMiddleware";

// TODO: Move to environment variables
const BRANDFETCH_CLIENT_ID_FALLBACK = "1idbHCuB66Z-QiSsg0M";

interface BrandfetchSearchResult {
  name?: unknown;
  domain?: unknown;
  icon?: unknown;
}

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  const strategy = (url.searchParams.get("strategy") || "typeahead").trim();

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const clientId =
    process.env.BRANDFETCH_CLIENT_ID ||
    process.env.BRAND_FETCH_CLIENT_ID ||
    process.env.NEXT_PUBLIC_BRANDFETCH_CLIENT_ID ||
    BRANDFETCH_CLIENT_ID_FALLBACK;

  try {
    const response = await fetch(
      `https://api.brandfetch.io/v2/search/${encodeURIComponent(query)}?c=${encodeURIComponent(clientId)}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      let upstreamBody = "";
      try {
        upstreamBody = await response.text();
      } catch {
        upstreamBody = "";
      }

      return NextResponse.json(
        {
          error: "Brandfetch org search failed",
          upstreamStatus: response.status,
          upstreamStatusText: response.statusText,
          details: upstreamBody.slice(0, 300),
          results: [],
        },
        { status: response.status >= 400 && response.status < 600 ? response.status : 502 },
      );
    }

    const payload = (await response.json()) as BrandfetchSearchResult[];
    const unique = new Map<string, { name: string; domain: string; logoUrl: string }>();
    const queryLower = query.toLowerCase();
    const exactMatchOnly = strategy === "match";

    (Array.isArray(payload) ? payload : []).forEach((item) => {
      const name = typeof item?.name === "string" ? item.name.trim() : "";
      const domain = typeof item?.domain === "string" ? item.domain.trim().toLowerCase() : "";
      const icon = typeof item?.icon === "string" ? item.icon.trim() : "";
      if (!name || !domain) return;

      if (exactMatchOnly) {
        const isNameMatch = name.toLowerCase() === queryLower;
        const isDomainMatch = domain === queryLower || domain === `${queryLower}.com`;
        if (!isNameMatch && !isDomainMatch) return;
      }

      if (unique.has(domain)) return;

      const logoUrl =
        icon ||
        `https://cdn.brandfetch.io/${encodeURIComponent(domain)}/w/80/h/80?c=${encodeURIComponent(
          clientId,
        )}`;

      unique.set(domain, { name, domain, logoUrl });
    });

    return NextResponse.json({ results: Array.from(unique.values()).slice(0, 10) });
  } catch {
    return NextResponse.json(
      { error: "org search request failed", results: [] },
      { status: 500 },
    );
  }
});
