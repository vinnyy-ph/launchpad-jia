export type BlogPost = {
  id: string | number;
  slug: string;
  title: string;
  excerpt?: string | null;
  author?: BlogAuthor | null;
  tags?: BlogTag[] | null;
  strapiBaseUrl?: string | null;
  // Strapi "Rich Text (blocks)" returns an array of block objects.
  // Some posts may still use string content (HTML/Markdown/plain).
  content?: string | any[] | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  coverImageUrl?: string | null;
};

export type BlogTagCategory = "ai" | "recruiting" | "ops" | "ethics" | "product" | "unknown";

export type BlogTag = {
  id?: string | number;
  name: string;
  slug?: string | null;
  category?: BlogTagCategory | null;
};

export type BlogAuthor = {
  name: string;
  avatarUrl?: string | null;
  title?: string | null;
};

export type BlogPagination = {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
};

export type BlogListResponse = {
  posts: BlogPost[];
  pagination: BlogPagination | null;
};

export async function getAllBlogs(params?: {
  page?: number;
  pageSize?: number;
}): Promise<BlogListResponse> {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? 7;
  const url = new URL("/api/blog", typeof window !== "undefined" ? window.location.origin : "http://localhost");
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new Error("Failed to fetch blogs");
  const json = await res.json();
  return {
    posts: (json?.posts ?? []) as BlogPost[],
    pagination: (json?.pagination ?? null) as BlogPagination | null,
  };
}

export async function getBlogBySlug(slug: string): Promise<BlogPost | null> {
  if (!slug) return null;
  const res = await fetch(`/api/blog?slug=${encodeURIComponent(slug)}`, { method: "GET" });
  if (!res.ok) throw new Error("Failed to fetch blog");
  const json = await res.json();
  return (json?.post ?? null) as BlogPost | null;
}