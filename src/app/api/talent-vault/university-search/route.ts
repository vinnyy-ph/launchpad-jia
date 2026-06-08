import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/utils/authMiddleware";

// Prod-safe proxy for the inline-profile school autocomplete. The edit-CV modal
// calls hipolabs over http directly from the browser, which is blocked as mixed
// content on the live https site. Fetching server-side avoids that and lets us
// return the school domain so college logos resolve via logo.dev / Brandfetch.

interface HipolabsUniversity {
  name?: unknown;
  country?: unknown;
  domains?: unknown;
  web_pages?: unknown;
}

interface SchoolResult {
  name: string;
  country: string;
  domain: string;
  website: string;
}

const HIPOLABS_TIMEOUT_MS = 5000;

function normalizeDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();
}

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HIPOLABS_TIMEOUT_MS);

  try {
    const response = await fetch(
      `http://universities.hipolabs.com/search?name=${encodeURIComponent(query)}`,
      { cache: "no-store", signal: controller.signal },
    );

    if (!response.ok) {
      return NextResponse.json({ results: [] });
    }

    const payload = (await response.json()) as HipolabsUniversity[];
    const unique = new Map<string, SchoolResult>();

    (Array.isArray(payload) ? payload : []).forEach((item) => {
      const name = typeof item?.name === "string" ? item.name.trim() : "";
      if (!name) return;

      const country = typeof item?.country === "string" ? item.country.trim() : "";
      const domains = Array.isArray(item?.domains) ? (item.domains as unknown[]) : [];
      const webPages = Array.isArray(item?.web_pages) ? (item.web_pages as unknown[]) : [];
      const domain = normalizeDomain(typeof domains[0] === "string" ? (domains[0] as string) : "");
      const website = typeof webPages[0] === "string" ? (webPages[0] as string).trim() : "";

      const key = `${name.toLowerCase()}|${country.toLowerCase()}|${domain}`;
      if (unique.has(key)) return;

      unique.set(key, { name, country, domain, website });
    });

    return NextResponse.json({ results: Array.from(unique.values()).slice(0, 12) });
  } catch {
    // Timeout / network failure — degrade to empty so the typeahead never 5xxs.
    return NextResponse.json({ results: [] });
  } finally {
    clearTimeout(timeout);
  }
});
