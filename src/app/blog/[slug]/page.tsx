import type { Metadata } from "next";
import { type BlogPost } from "@/lib/blog/client";
import BlogPostClient from "../../../lib/components/BlogComponents/BlogPostClient";
import { cache } from "react";
import { applyBlogPopulate, normalizeStrapiBlog } from "@/lib/blog/strapi";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hirejia.ai";
const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL;
// STRAPI_TOKEN is for future use when Strapi is not public (requires authentication).
// Currently, Strapi is public, so this token is optional.
const STRAPI_TOKEN = process.env.STRAPI_TOKEN;
export const revalidate = 30;

async function fetchPost(slug: string): Promise<BlogPost | null> {
  if (!slug) return null;

  // Prefer hitting Strapi directly so SSG/ISR works at build time.
  if (STRAPI_URL) {
    try {
      const url = new URL("/api/blogs", STRAPI_URL);
      url.searchParams.set("filters[slug][$eq]", slug);
      applyBlogPopulate(url);

      const headers: Record<string, string> = {};
      // Add authentication header if STRAPI_TOKEN is set (for future use when Strapi is not public).
      if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;

      const res = await fetch(url.toString(), { headers, next: { revalidate } });
      if (!res.ok) return null;
      const json = await res.json();
      const item = Array.isArray(json?.data) ? json.data[0] : null;
      if (!item) return null;
      return normalizeStrapiBlog(STRAPI_URL, item);
    } catch {
      // fall through to internal API
    }
  }

  // Fallback: call internal API (requires Next server running).
  try {
    const res = await fetch(`${SITE_URL}/api/blog?slug=${encodeURIComponent(slug)}`, {
      next: { revalidate },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.post ?? null) as BlogPost | null;
  } catch {
    return null;
  }
}

// Ensure we don't fetch the same post twice during SSG (once for `generateMetadata`, once for the page).
const fetchPostCached = cache(fetchPost);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const canonicalUrl = `${SITE_URL}/blog/${slug}`;

  const post = await fetchPostCached(slug);
  const title = post?.seoTitle || post?.title || "Blog | HireJIA";
  const description = post?.seoDescription || post?.excerpt || "HireJIA blog post.";

  const ogImages = post?.coverImageUrl
    ? [{ url: post.coverImageUrl, alt: post.title || "Blog cover image" }]
    : undefined;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
      images: ogImages,
      siteName: "HireJIA",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  // Prefer Strapi direct so build does not depend on the Next server running.
  if (STRAPI_URL) {
    try {
      const url = new URL("/api/blogs", STRAPI_URL);
      url.searchParams.set("fields[0]", "slug");
      url.searchParams.set("pagination[pageSize]", "100");

      const headers: Record<string, string> = {};
      // Add authentication header if STRAPI_TOKEN is set (for future use when Strapi is not public).
      if (STRAPI_TOKEN) headers.Authorization = `Bearer ${STRAPI_TOKEN}`;

      const res = await fetch(url.toString(), { headers, next: { revalidate: 3600 } });
      if (!res.ok) return [];
      const json = await res.json();
      const data = Array.isArray(json?.data) ? json.data : [];
      return data
        .map((item: any) => {
          const a = item?.attributes ?? item;
          return a?.slug ? { slug: a.slug } : null;
        })
        .filter(Boolean) as { slug: string }[];
    } catch {
      // fall through to internal API
    }
  }

  // Fallback: call internal API (only works if server running during build).
  try {
    const res = await fetch(`${SITE_URL}/api/blog`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json();
    const posts = Array.isArray(json?.posts) ? json.posts : [];
    return posts
      .map((p: any) => (p?.slug ? { slug: p.slug } : null))
      .filter(Boolean) as { slug: string }[];
  } catch {
    return [];
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await fetchPostCached(slug);
  return <BlogPostClient slug={slug} siteUrl={SITE_URL} initialPost={post} />;
}