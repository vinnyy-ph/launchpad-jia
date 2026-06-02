import type { Metadata } from "next";
import BlogPageClient from "../../lib/components/BlogComponents/BlogPageClient";
import { type BlogPagination, type BlogPost } from "@/lib/blog/client";
import { buildStrapiBlogsUrl, normalizeStrapiBlog } from "@/lib/blog/strapi";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hirejia.ai";
const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL;
// STRAPI_TOKEN is for future use when Strapi is not public (requires authentication).
// Currently, Strapi is public, so this token is optional.
const STRAPI_TOKEN = process.env.STRAPI_TOKEN;
export const revalidate = 30;

const PAGE_URL = `${SITE_URL}/blog`;
const PAGE_TITLE = "Blog | HireJIA";
const PAGE_DESCRIPTION = "Updates, insights, and resources from HireJIA.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      url: PAGE_URL,
      siteName: "HireJIA",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
    },
  };
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number(pageRaw ?? "1") || 1);

  // Keep in sync with `getAllBlogs()` defaults.
  const pageSize = 7;

  let posts: BlogPost[] = [];
  let pagination: BlogPagination | null = null;

  // Prefer Strapi direct so SSG/ISR works at build time.
  if (STRAPI_URL) {
    try {
      const url = buildStrapiBlogsUrl(STRAPI_URL, { page, pageSize });

      const headers: Record<string, string> = {};
      // Add authentication header if STRAPI_TOKEN is set (for future use when Strapi is not public).
      if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;

      const res = await fetch(url.toString(), { headers, next: { revalidate } });
      if (res.ok) {
        const json = await res.json();
        const data = Array.isArray(json?.data) ? json.data : [];

        const meta = json?.meta?.pagination;
        pagination =
          meta && typeof meta === "object"
            ? {
                page: Number(meta.page ?? page) || page,
                pageSize: Number(meta.pageSize ?? pageSize) || pageSize,
                pageCount: Number(meta.pageCount ?? 1) || 1,
                total: Number(meta.total ?? data.length) || data.length,
              }
            : null;

        posts = data.map((item: any) => normalizeStrapiBlog(STRAPI_URL, item)).filter(Boolean) as BlogPost[];
      }
    } catch {
      // fall through to internal API
    }
  }

  if (!posts.length) {
    // Fallback: internal API (requires Next server running).
    try {
      const res = await fetch(`${SITE_URL}/api/blog?page=${page}&pageSize=${pageSize}`, { next: { revalidate } });
      if (res.ok) {
        const json = await res.json();
        posts = Array.isArray(json?.posts) ? json.posts : [];
        pagination = (json?.pagination ?? null) as BlogPagination | null;
      }
    } catch {
      posts = [];
      pagination = null;
    }
  }

  return <BlogPageClient initialPosts={posts} initialPagination={pagination} initialPage={page} pageSize={pageSize} />;
}