import type { BlogPost, BlogTag, BlogTagCategory } from "@/lib/blog/client";

export function toTagCategory(value: unknown): BlogTagCategory {
  const v = typeof value === "string" ? value.toLowerCase().trim() : "";
  if (v === "ai") return "ai";
  if (v === "recruiting") return "recruiting";
  if (v === "ops" || v === "operations") return "ops";
  if (v === "ethics" || v === "ux") return "ethics";
  if (v === "product" || v === "platform") return "product";
  return "unknown";
}

export function withAbsoluteUrl(base: string, maybeRelative?: string | null): string | null {
  if (!maybeRelative) return null;
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  const cleanedBase = base.replace(/\/$/, "");
  return `${cleanedBase}${maybeRelative.startsWith("/") ? "" : "/"}${maybeRelative}`;
}

export function getStrapiMediaUrl(media: any): string | null {
  if (!media) return null;

  // Strapi v4 (common): { data: { attributes: { url } } } or { data: [{ attributes: { url } }] }
  const v4Url = media?.data?.attributes?.url ?? media?.data?.[0]?.attributes?.url ?? null;
  if (typeof v4Url === "string") return v4Url;

  // Strapi v5 / "flattened" responses: { url, formats: { large: { url }, ... } }
  const flatUrl =
    media?.formats?.large?.url ??
    media?.formats?.medium?.url ??
    media?.formats?.small?.url ??
    media?.formats?.thumbnail?.url ??
    media?.url ??
    null;
  return typeof flatUrl === "string" ? flatUrl : null;
}

export function applyBlogPopulate(url: URL) {
  // Avoid wildcard populates on media; Strapi can reject deep keys like cover.related.
  url.searchParams.set("populate[cover][fields][0]", "url");
  url.searchParams.set("populate[cover][fields][1]", "formats");

  url.searchParams.set("populate[tags][fields][0]", "name");
  url.searchParams.set("populate[tags][fields][1]", "slug");
  url.searchParams.set("populate[tags][fields][2]", "category");

  url.searchParams.set("populate[author][fields][0]", "name");
  url.searchParams.set("populate[author][fields][1]", "jobTitle");
  url.searchParams.set("populate[author][populate][avatar][fields][0]", "url");
  url.searchParams.set("populate[author][populate][avatar][fields][1]", "formats");
}

export function buildStrapiBlogsUrl(
  strapiBaseUrl: string,
  opts?: { slug?: string | null; page?: number; pageSize?: number },
): URL {
  const url = new URL("/api/blogs", strapiBaseUrl);
  applyBlogPopulate(url);

  const slug = opts?.slug ? String(opts.slug) : null;
  if (slug) {
    url.searchParams.set("filters[slug][$eq]", slug);
    return url;
  }

  // Latest -> oldest. Prefer editorial `datePublished`, then fallback to publish/creation timestamps.
  url.searchParams.set("sort[0]", "datePublished:desc");
  url.searchParams.set("sort[1]", "publishedAt:desc");
  url.searchParams.set("sort[2]", "createdAt:desc");

  const page = Math.max(1, Number(opts?.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(opts?.pageSize ?? 7) || 7));
  url.searchParams.set("pagination[page]", String(page));
  url.searchParams.set("pagination[pageSize]", String(pageSize));
  return url;
}

export function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // 20 Jan 2025
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function normalizeStrapiBlog(strapiBaseUrl: string, item: any): BlogPost | null {
  if (!item) return null;

  const id = item.id ?? item._id ?? item.documentId ?? "";
  const a = item.attributes ?? item;

  const coverUrl =
    getStrapiMediaUrl(a?.cover) ?? getStrapiMediaUrl(a?.featuredImage) ?? getStrapiMediaUrl(a?.image) ?? null;

  const tagsData = a?.tags?.data ?? a?.tags ?? [];
  const tags = (Array.isArray(tagsData) ? tagsData : [])
    .map((t: any) => {
      const ta = t?.attributes ?? t;
      const name = ta?.name ?? ta?.title ?? ta?.tag ?? null;
      if (!name) return null;
      return {
        id: t?.id ?? t?._id ?? t?.documentId ?? undefined,
        name: String(name),
        slug: ta?.slug ?? null,
        category: ta?.category ? toTagCategory(ta.category) : "unknown",
      } satisfies BlogTag;
    })
    .filter(Boolean) as BlogTag[];

  const authorData = a?.author?.data ?? a?.author ?? null;
  const authorAttrs = authorData?.attributes ?? authorData;
  const authorName = a?.authorName ?? authorAttrs?.name ?? authorAttrs?.fullName ?? null;
  const authorTitle = authorAttrs?.title ?? authorAttrs?.jobTitle ?? authorAttrs?.role ?? authorAttrs?.position ?? null;
  const authorAvatarUrl = getStrapiMediaUrl(authorAttrs?.avatar) ?? authorAttrs?.avatarUrl ?? null;

  return {
    id,
    slug: a?.slug ?? "",
    title: a?.title ?? "",
    excerpt: a?.excerpt ?? a?.summary ?? null,
    strapiBaseUrl,
    content: a?.content ?? a?.body ?? null,
    // Prefer editorial date if present; Strapi `publishedAt` is the publish action timestamp.
    publishedAt: a?.datePublished ?? a?.publishedAt ?? null,
    updatedAt: a?.updatedAt ?? null,
    seoTitle: a?.seoTitle ?? null,
    seoDescription: a?.seoDescription ?? null,
    coverImageUrl: withAbsoluteUrl(strapiBaseUrl, coverUrl),
    tags: tags?.length ? tags : null,
    author: authorName
      ? {
          name: String(authorName),
          title: authorTitle ? String(authorTitle) : null,
          avatarUrl: withAbsoluteUrl(strapiBaseUrl, authorAvatarUrl),
        }
      : null,
  };
}


