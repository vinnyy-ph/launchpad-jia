import { NextResponse } from "next/server";
import type { BlogPagination, BlogPost } from "@/lib/blog/client";
import { buildStrapiBlogsUrl, normalizeStrapiBlog } from "@/lib/blog/strapi";

export async function GET(request: Request) {
  const STRAPI_URL =
    process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || "";

  if (!STRAPI_URL) {
    return NextResponse.json(
      { error: "Missing STRAPI_URL (recommended) or NEXT_PUBLIC_STRAPI_URL" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") ?? "7") || 7));

  const url = buildStrapiBlogsUrl(STRAPI_URL, { slug, page, pageSize });

  const headers: Record<string, string> = {};
  // STRAPI_TOKEN is for future use when Strapi is not public (requires authentication).
  // Currently, Strapi is public, so this token is optional.
  const token = process.env.STRAPI_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(url.toString(), {
      headers,
      // Keep this low so deletes/new publishes show up quickly.
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Failed to fetch Strapi", status: res.status, details: text },
        { status: 502 },
      );
    }

    const json = await res.json();
    const data = Array.isArray(json?.data) ? json.data : [];
    const normalized = data
      .map((item: any) => normalizeStrapiBlog(STRAPI_URL, item))
      .filter(Boolean) as BlogPost[];

    if (slug) {
      return NextResponse.json({ post: normalized[0] ?? null });
    }

    const meta = json?.meta?.pagination;
    const pagination: BlogPagination | null =
      meta && typeof meta === "object"
        ? {
            page: Number(meta.page ?? page) || page,
            pageSize: Number(meta.pageSize ?? pageSize) || pageSize,
            pageCount: Number(meta.pageCount ?? 1) || 1,
            total: Number(meta.total ?? normalized.length) || normalized.length,
          }
        : null;

    return NextResponse.json({ posts: normalized, pagination });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unexpected error fetching Strapi", details: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}